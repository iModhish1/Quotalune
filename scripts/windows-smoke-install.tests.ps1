$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "windows-smoke-install.ps1"
$source = Get-Content -LiteralPath $scriptPath -Raw
$tokens = $null
$parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile(
    $scriptPath,
    [ref]$tokens,
    [ref]$parseErrors
)
if ($parseErrors.Count -ne 0) {
    throw "windows-smoke-install.ps1 has parse errors: $($parseErrors.Message -join '; ')"
}

function Assert-ThrowsLike {
    param(
        [scriptblock]$Action,
        [string]$Pattern,
        [string]$Label
    )
    try {
        & $Action
    } catch {
        if ($_.Exception.Message -notlike $Pattern) {
            throw "$Label threw an unexpected error: $($_.Exception.Message)"
        }
        return
    }
    throw "$Label did not fail closed."
}

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("quotalis-smoke-guard-tests-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
    $missingInstaller = Join-Path $testRoot "Quotalis-0.11.0-Setup.exe"
    $safeInstall = Join-Path $testRoot "install"

    Assert-ThrowsLike -Label "missing acknowledgement" -Pattern "*AcknowledgeDisposableTestEnvironment*" -Action {
        & $scriptPath -InstallerPath $missingInstaller -DisposableTestRoot $testRoot -InstallDir $safeInstall
    }

    $personalInstall = Join-Path $env:LOCALAPPDATA "Programs\Quotalis"
    Assert-ThrowsLike -Label "Personal install path" -Pattern "*normal application install root*" -Action {
        & $scriptPath `
            -InstallerPath $missingInstaller `
            -DisposableTestRoot (Join-Path $env:LOCALAPPDATA "Programs") `
            -InstallDir $personalInstall `
            -AcknowledgeDisposableTestEnvironment
    }

    $outsideRoot = Join-Path ([IO.Path]::GetTempPath()) ("quotalis-smoke-outside-" + [guid]::NewGuid().ToString("N"))
    Assert-ThrowsLike -Label "install path outside disposable root" -Pattern "*must be a child of DisposableTestRoot*" -Action {
        & $scriptPath `
            -InstallerPath $missingInstaller `
            -DisposableTestRoot $testRoot `
            -InstallDir $outsideRoot `
            -AcknowledgeDisposableTestEnvironment
    }

    $junctionTarget = Join-Path ([IO.Path]::GetTempPath()) ("quotalis-smoke-junction-target-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $junctionTarget | Out-Null
    $junction = Join-Path $testRoot "escaped-parent"
    New-Item -ItemType Junction -Path $junction -Target $junctionTarget | Out-Null
    Assert-ThrowsLike -Label "junction ancestor" -Pattern "*reparse-point ancestor*" -Action {
        & $scriptPath `
            -InstallerPath $missingInstaller `
            -DisposableTestRoot $testRoot `
            -InstallDir (Join-Path $junction "install") `
            -AcknowledgeDisposableTestEnvironment
    }
    $nestedDisposableRoot = Join-Path $junction "nested"
    New-Item -ItemType Directory -Path $nestedDisposableRoot | Out-Null
    Assert-ThrowsLike -Label "junction above disposable root" -Pattern "*reparse-point ancestor*" -Action {
        & $scriptPath `
            -InstallerPath $missingInstaller `
            -DisposableTestRoot $nestedDisposableRoot `
            -InstallDir (Join-Path $nestedDisposableRoot "install") `
            -AcknowledgeDisposableTestEnvironment
    }
    Remove-Item -LiteralPath $nestedDisposableRoot
    Remove-Item -LiteralPath $junction
    Remove-Item -LiteralPath $junctionTarget

    New-Item -ItemType Directory -Path $safeInstall | Out-Null
    Assert-ThrowsLike -Label "pre-existing install directory" -Pattern "*must not already exist*" -Action {
        & $scriptPath `
            -InstallerPath $missingInstaller `
            -DisposableTestRoot $testRoot `
            -InstallDir $safeInstall `
            -AcknowledgeDisposableTestEnvironment
    }
    Remove-Item -LiteralPath $safeInstall

    Assert-ThrowsLike -Label "safe arguments continue to installer validation" -Pattern "*cannot find path*" -Action {
        & $scriptPath `
            -InstallerPath $missingInstaller `
            -DisposableTestRoot $testRoot `
            -InstallDir $safeInstall `
            -AcknowledgeDisposableTestEnvironment
    }

    $wrongInstallerName = Join-Path $testRoot "QuotaArc-0.11.0-Setup.exe"
    [IO.File]::WriteAllBytes($wrongInstallerName, [byte[]](0))
    Assert-ThrowsLike -Label "noncanonical installer name" -Pattern "*canonical Quotalis Inno Setup release asset*" -Action {
        & $scriptPath `
            -InstallerPath $wrongInstallerName `
            -DisposableTestRoot $testRoot `
            -InstallDir $safeInstall `
            -AcknowledgeDisposableTestEnvironment
    }

    if ($source -match '\bStop-Process\b') {
        throw "Smoke script must not stop product processes by name."
    }
    foreach ($requiredName in @("Quotalis", "QuotalisDev", "QuotaArc", "QuotaArcDev")) {
        if ($source -notmatch [regex]::Escape($requiredName)) {
            throw "Smoke script is missing the process guard for $requiredName."
        }
    }
    if ($source -notmatch [regex]::Escape('/DIR=`"$installDirPath`"')) {
        throw "Smoke script does not direct Inno Setup into the validated disposable install directory."
    }
    if ($source -match 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall') {
        throw "Smoke script must not fall back to a machine-wide uninstall identity."
    }

    $lifecycleDefinition = $ast.Find(
        {
            param($node)
            $node -is [Management.Automation.Language.FunctionDefinitionAst] -and
                $node.Name -eq "Invoke-SmokeInstallLifecycle"
        },
        $true
    )
    if ($null -eq $lifecycleDefinition) {
        throw "Smoke script is missing its guaranteed-cleanup lifecycle function."
    }
    Invoke-Expression $lifecycleDefinition.Extent.Text

    $failureState = [pscustomobject]@{ Verified = 0; Cleaned = 0 }
    Assert-ThrowsLike -Label "verification failure cleanup" -Pattern "*verification failed*cleaned up*" -Action {
        Invoke-SmokeInstallLifecycle `
            -Install { } `
            -AcquireOwnership { [pscustomobject]@{ Owned = $true } } `
            -Verify {
                param($owned)
                if (-not $owned.Owned) { throw "missing synthetic ownership" }
                $failureState.Verified++
                throw "injected verification failure"
            } `
            -Cleanup {
                param($owned)
                if (-not $owned.Owned) { throw "missing synthetic cleanup ownership" }
                $failureState.Cleaned++
            } `
            -LeaveInstalled $false `
            -RecoveryInstructions "synthetic recovery"
    }
    if ($failureState.Verified -ne 1 -or $failureState.Cleaned -ne 1) {
        throw "Injected verification failure did not run exactly one guaranteed cleanup."
    }

    $uncertainState = [pscustomobject]@{ OwnershipChecks = 0; Cleaned = 0 }
    Assert-ThrowsLike -Label "uncertain ownership preservation" -Pattern "*ownership could not be validated*synthetic recovery*" -Action {
        Invoke-SmokeInstallLifecycle `
            -Install { } `
            -AcquireOwnership {
                $uncertainState.OwnershipChecks++
                throw "injected uncertain ownership"
            } `
            -Verify { throw "must not verify without ownership" } `
            -Cleanup { $uncertainState.Cleaned++ } `
            -LeaveInstalled $false `
            -RecoveryInstructions "synthetic recovery"
    }
    if ($uncertainState.OwnershipChecks -ne 2 -or $uncertainState.Cleaned -ne 0) {
        throw "Uncertain ownership must be checked once for the operation and once for recovery, then preserved without cleanup."
    }
} finally {
    Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "windows-smoke-install guard tests: ok"
