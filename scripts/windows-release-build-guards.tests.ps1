$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "windows-release-build.ps1"
$source = Get-Content -LiteralPath $scriptPath -Raw
$tokens = $null
$parseErrors = $null
[void][Management.Automation.Language.Parser]::ParseFile(
    $scriptPath,
    [ref]$tokens,
    [ref]$parseErrors
)
if ($parseErrors.Count -ne 0) {
    throw "windows-release-build.ps1 has parse errors: $($parseErrors.Message -join '; ')"
}

function Assert-EarlyFailure {
    param(
        [string[]]$Arguments,
        [string]$ExpectedMessage,
        [string]$Label
    )
    $workRoot = Join-Path ([IO.Path]::GetTempPath()) ("quotalis-release-guard-" + [guid]::NewGuid().ToString("N"))
    $allArguments = @(
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-File",
        $scriptPath,
        "-WorkRoot",
        $workRoot
    ) + $Arguments
    $output = (& pwsh @allArguments 2>&1) -join "`n"
    if ($LASTEXITCODE -eq 0) {
        throw "$Label unexpectedly succeeded. Output: $output"
    }
    if ($output -notlike "*$ExpectedMessage*") {
        throw "$Label returned an unexpected error. Output: $output"
    }
    if (Test-Path -LiteralPath $workRoot) {
        throw "$Label performed work before rejecting unsafe smoke arguments: $workRoot"
    }
}

Assert-EarlyFailure `
    -Label "missing acknowledgement" `
    -ExpectedMessage "requires -AcknowledgeDisposableSmokeEnvironment" `
    -Arguments @("-SmokeInstall")

Assert-EarlyFailure `
    -Label "missing disposable root" `
    -ExpectedMessage "requires an explicit -SmokeDisposableTestRoot" `
    -Arguments @("-SmokeInstall", "-AcknowledgeDisposableSmokeEnvironment")

Assert-EarlyFailure `
    -Label "missing install directory" `
    -ExpectedMessage "requires an explicit -SmokeInstallDir" `
    -Arguments @(
        "-SmokeInstall",
        "-AcknowledgeDisposableSmokeEnvironment",
        "-SmokeDisposableTestRoot",
        (Join-Path ([IO.Path]::GetTempPath()) "quotalis-disposable")
    )

Assert-EarlyFailure `
    -Label "incompatible warm-cache mode" `
    -ExpectedMessage "cannot be combined with WarmCacheOnly" `
    -Arguments @(
        "-SmokeInstall",
        "-WarmCacheOnly",
        "-AcknowledgeDisposableSmokeEnvironment",
        "-SmokeDisposableTestRoot",
        (Join-Path ([IO.Path]::GetTempPath()) "quotalis-disposable"),
        "-SmokeInstallDir",
        (Join-Path ([IO.Path]::GetTempPath()) "quotalis-disposable\install")
    )

Assert-EarlyFailure `
    -Label "orphan safety arguments" `
    -ExpectedMessage "valid only when -SmokeInstall is supplied" `
    -Arguments @("-AcknowledgeDisposableSmokeEnvironment")

$guardPosition = $source.IndexOf('if ($SmokeInstall)')
$firstWorkPosition = $source.IndexOf('New-Item -ItemType Directory -Force $WorkRoot')
if ($guardPosition -lt 0 -or $firstWorkPosition -lt 0 -or $guardPosition -ge $firstWorkPosition) {
    throw "SmokeInstall guard must execute before release directories or build work are created."
}
foreach ($requiredForwardedArgument in @(
    '-DisposableTestRoot $SmokeDisposableTestRoot',
    '-InstallDir $SmokeInstallDir',
    '-AcknowledgeDisposableTestEnvironment'
)) {
    if ($source -notmatch [regex]::Escape($requiredForwardedArgument)) {
        throw "Release build does not forward smoke safety argument: $requiredForwardedArgument"
    }
}

Write-Host "windows-release-build smoke guard tests: ok"
