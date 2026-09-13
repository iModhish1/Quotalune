param(
    [Parameter(Mandatory = $true)]
    [string]$InstallerPath,

    [string]$ExpectedVersion = "",

    [Parameter(Mandatory = $true)]
    [string]$DisposableTestRoot,

    [Parameter(Mandatory = $true)]
    [string]$InstallDir,

    [switch]$AcknowledgeDisposableTestEnvironment,

    [switch]$LeaveInstalled
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[smoke] $Message"
}

function Assert-Path {
    param(
        [string]$Path,
        [string]$Label
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing $Label at $Path"
    }
}

function Get-NormalizedPath {
    param(
        [string]$Path,
        [string]$Label
    )
    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw "$Label must not be empty."
    }
    $fullPath = [IO.Path]::GetFullPath(
        [Environment]::ExpandEnvironmentVariables($Path)
    )
    $pathRoot = [IO.Path]::GetPathRoot($fullPath)
    if ($fullPath.Equals($pathRoot, [StringComparison]::OrdinalIgnoreCase)) {
        return $pathRoot
    }
    return $fullPath.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
}

function Test-PathWithinRoot {
    param(
        [string]$Path,
        [string]$Root,
        [switch]$AllowRoot
    )
    if ($Path.Equals($Root, [StringComparison]::OrdinalIgnoreCase)) {
        return $AllowRoot.IsPresent
    }
    $rootPrefix = if ($Root.EndsWith([IO.Path]::DirectorySeparatorChar)) {
        $Root
    } else {
        $Root + [IO.Path]::DirectorySeparatorChar
    }
    return $Path.StartsWith(
        $rootPrefix,
        [StringComparison]::OrdinalIgnoreCase
    )
}

function Assert-NoReparsePointInPath {
    param(
        [string]$Path,
        [string]$StopAt
    )
    $current = Get-NormalizedPath -Path $Path -Label "reparse-check path"
    $stop = Get-NormalizedPath -Path $StopAt -Label "reparse-check root"
    if (-not (Test-PathWithinRoot -Path $current -Root $stop -AllowRoot)) {
        throw "Reparse-check path is outside its required root. root=$stop path=$current"
    }
    while ($true) {
        $item = Get-Item -LiteralPath $current -Force
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Refusing a path with a reparse-point ancestor: $current"
        }
        if ($current.Equals([IO.Path]::GetPathRoot($current), [StringComparison]::OrdinalIgnoreCase)) {
            return
        }
        $parent = Split-Path -Parent $current
        if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $current) {
            throw "Could not reach the required root while checking path ancestors: $Path"
        }
        $current = Get-NormalizedPath -Path $parent -Label "reparse-check parent"
    }
}

function Invoke-SmokeInstallLifecycle {
    param(
        [scriptblock]$Install,
        [scriptblock]$AcquireOwnership,
        [scriptblock]$Verify,
        [scriptblock]$Cleanup,
        [bool]$LeaveInstalled,
        [string]$RecoveryInstructions
    )
    $ownedContext = $null
    $operationError = $null
    $ownershipError = $null
    $cleanupError = $null

    try {
        & $Install
        $ownedContext = & $AcquireOwnership
        & $Verify $ownedContext
    } catch {
        $operationError = $_
        if (-not $LeaveInstalled -and $null -eq $ownedContext) {
            try {
                $ownedContext = & $AcquireOwnership
            } catch {
                $ownershipError = $_
            }
        }
    } finally {
        if (-not $LeaveInstalled -and $null -ne $ownedContext) {
            try {
                & $Cleanup $ownedContext
            } catch {
                $cleanupError = $_
            }
        }
    }

    if ($null -ne $operationError) {
        $message = "Smoke install or verification failed: $($operationError.Exception.Message)"
        if ($null -ne $ownershipError) {
            $message += " Cleanup was not attempted because disposable-install ownership could not be validated: $($ownershipError.Exception.Message). $RecoveryInstructions"
        } elseif ($null -ne $cleanupError) {
            $message += " Cleanup was attempted but failed: $($cleanupError.Exception.Message). $RecoveryInstructions"
        } elseif (-not $LeaveInstalled) {
            $message += " The validated disposable installation was cleaned up."
        }
        throw $message
    }
    if ($null -ne $cleanupError) {
        throw "Smoke verification passed, but disposable cleanup failed: $($cleanupError.Exception.Message). $RecoveryInstructions"
    }
}

if (-not $AcknowledgeDisposableTestEnvironment.IsPresent) {
    throw "Refusing to run: explicitly pass -AcknowledgeDisposableTestEnvironment only inside a disposable Windows test environment with no Personal installation."
}

$disposableRoot = Get-NormalizedPath -Path $DisposableTestRoot -Label "DisposableTestRoot"
$installDirPath = Get-NormalizedPath -Path $InstallDir -Label "InstallDir"
if (-not (Test-Path -LiteralPath $disposableRoot -PathType Container)) {
    throw "DisposableTestRoot must be an existing directory: $disposableRoot"
}
if (-not (Test-PathWithinRoot -Path $installDirPath -Root $disposableRoot)) {
    throw "InstallDir must be a child of DisposableTestRoot. root=$disposableRoot install=$installDirPath"
}
$installParent = Get-NormalizedPath -Path (Split-Path -Parent $installDirPath) -Label "InstallDir parent"
if (-not (Test-Path -LiteralPath $installParent -PathType Container)) {
    throw "InstallDir must be a direct child of an existing directory beneath DisposableTestRoot: $installParent"
}
Assert-NoReparsePointInPath -Path $installParent -StopAt $disposableRoot
$resolvedDisposableRoot = Get-NormalizedPath -Path (Resolve-Path -LiteralPath $disposableRoot).ProviderPath -Label "resolved DisposableTestRoot"
$resolvedInstallParent = Get-NormalizedPath -Path (Resolve-Path -LiteralPath $installParent).ProviderPath -Label "resolved InstallDir parent"
if (-not (Test-PathWithinRoot -Path $resolvedInstallParent -Root $resolvedDisposableRoot -AllowRoot)) {
    throw "InstallDir parent resolves outside DisposableTestRoot; refusing a junction/symlink escape. root=$resolvedDisposableRoot parent=$resolvedInstallParent"
}

$forbiddenInstallRoots = @()
if ($env:LOCALAPPDATA) {
    $forbiddenInstallRoots += Get-NormalizedPath -Path (Join-Path $env:LOCALAPPDATA "Programs") -Label "LOCALAPPDATA Programs"
}
if ($env:ProgramFiles) {
    $forbiddenInstallRoots += Get-NormalizedPath -Path $env:ProgramFiles -Label "ProgramFiles"
}
if (${env:ProgramFiles(x86)}) {
    $forbiddenInstallRoots += Get-NormalizedPath -Path ${env:ProgramFiles(x86)} -Label "ProgramFiles(x86)"
}
foreach ($forbiddenRoot in $forbiddenInstallRoots) {
    if (Test-PathWithinRoot -Path $installDirPath -Root $forbiddenRoot -AllowRoot) {
        throw "InstallDir is inside a normal application install root and is not safe for a disposable smoke test: $installDirPath"
    }
}
if (Test-Path -LiteralPath $installDirPath) {
    throw "InstallDir must not already exist; refusing to overwrite an existing directory: $installDirPath"
}

$isWindowsHost = [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform(
    [System.Runtime.InteropServices.OSPlatform]::Windows
)
if (-not $isWindowsHost) {
    throw "This smoke test must run on Windows."
}

$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
if ([IO.Path]::GetExtension($installer).ToLowerInvariant() -ne ".exe") {
    throw "Expected an Inno Setup .exe installer, got: $installer"
}
$installerName = Split-Path $installer -Leaf
if ($installerName -notmatch '^Quotalis-[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?-Setup\.exe$') {
    throw "Expected a canonical Quotalis Inno Setup release asset, got: $installerName"
}

$canonicalUninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\QuotaArcDesktop_is1"
$canonicalAumidKey = "HKCU:\Software\Classes\AppUserModelId\app.quotaarc.desktop"
$startMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$shortcutCandidates = @(
    (Join-Path $startMenu "Quotalis.lnk"),
    (Join-Path $startMenu "Quotalis\Quotalis.lnk")
)

if (Test-Path -LiteralPath $canonicalUninstallKey) {
    throw "Refusing to run while the canonical Quotalis/QuotaArc installer identity already exists: $canonicalUninstallKey"
}
if (Test-Path -LiteralPath $canonicalAumidKey) {
    throw "Refusing to run while the canonical Quotalis notification identity already exists: $canonicalAumidKey"
}
$existingShortcut = $shortcutCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if ($existingShortcut) {
    throw "Refusing to replace an existing Quotalis Start Menu shortcut: $existingShortcut"
}

$runningProductProcesses = @(
    Get-Process -Name @("Quotalis", "QuotalisDev", "QuotaArc", "QuotaArcDev") -ErrorAction SilentlyContinue
)
if ($runningProductProcesses.Count -gt 0) {
    $runningSummary = ($runningProductProcesses | ForEach-Object { "$($_.ProcessName)#$($_.Id)" }) -join ", "
    throw "Refusing to stop or install over a running Quotalis process: $runningSummary"
}

Write-Step "installer: $installer"
$installerHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $installer).Hash.ToLowerInvariant()
Write-Step "installer sha256: $installerHash"

$signature = Get-AuthenticodeSignature -FilePath $installer
if ($signature.Status -eq "Valid") {
    Write-Step "installer signature: valid ($($signature.SignerCertificate.Subject))"
} else {
    Write-Step "installer signature: $($signature.Status)"
}

$logDir = Join-Path $disposableRoot ("logs-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$installLog = Join-Path $logDir "install.log"

$installArgs = @(
    "/VERYSILENT",
    "/SUPPRESSMSGBOXES",
    "/NORESTART",
    "/DIR=`"$installDirPath`"",
    "/LOG=`"$installLog`""
)
$desktopExe = Join-Path $installDirPath "Quotalis.exe"
$cliExe = Join-Path $installDirPath "quotalis-cli.exe"
$legacyDesktopExe = Join-Path $installDirPath "quotalis-desktop.exe"
$icon = Join-Path $installDirPath "icon.ico"
$verifyExecutablesScript = Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\verify-windows-executables.ps1"

$installAction = {
    Write-Step "running silent install"
    $install = Start-Process -FilePath $installer -ArgumentList $installArgs -Wait -PassThru
    if ($install.ExitCode -notin @(0, 3010)) {
        throw "Installer exited with $($install.ExitCode). Log: $installLog"
    }
}

$acquireOwnership = {
    if (-not (Test-Path -LiteralPath $installDirPath -PathType Container)) {
        throw "Disposable InstallDir was not created: $installDirPath"
    }
    Assert-NoReparsePointInPath -Path $installDirPath -StopAt $disposableRoot
    $resolvedInstalledDir = Get-NormalizedPath -Path (Resolve-Path -LiteralPath $installDirPath).ProviderPath -Label "resolved InstallDir"

    if (-not (Test-Path -LiteralPath $canonicalUninstallKey)) {
        throw "Missing per-user Quotalis uninstall registry entry: $canonicalUninstallKey"
    }
    $entry = Get-ItemProperty -LiteralPath $canonicalUninstallKey
    if ($entry.DisplayName -ne "Quotalis") {
        throw "Unexpected uninstall DisplayName: $($entry.DisplayName)"
    }
    if ($entry.InstallLocation) {
        $registeredInstallDir = Get-NormalizedPath -Path ([string]$entry.InstallLocation) -Label "InstallLocation"
        $resolvedRegisteredInstallDir = Get-NormalizedPath -Path (Resolve-Path -LiteralPath $registeredInstallDir).ProviderPath -Label "resolved InstallLocation"
        if (-not $resolvedRegisteredInstallDir.Equals($resolvedInstalledDir, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Uninstall entry points at a different install directory: $resolvedRegisteredInstallDir"
        }
    }

    $uninstallCommand = [string]$entry.UninstallString
    if (-not $uninstallCommand) {
        throw "UninstallString is empty."
    }
    $uninstallerMatch = [regex]::Match($uninstallCommand, '^\s*"([^"]+)"')
    if (-not $uninstallerMatch.Success) {
        throw "UninstallString is not a quoted executable path: $uninstallCommand"
    }
    $uninstaller = Get-NormalizedPath -Path $uninstallerMatch.Groups[1].Value -Label "uninstaller"
    Assert-Path -Path $uninstaller -Label "disposable uninstaller"
    Assert-NoReparsePointInPath -Path $uninstaller -StopAt $installDirPath
    $resolvedUninstaller = Get-NormalizedPath -Path (Resolve-Path -LiteralPath $uninstaller).ProviderPath -Label "resolved uninstaller"
    if (-not (Test-PathWithinRoot -Path $resolvedUninstaller -Root $resolvedInstalledDir)) {
        throw "Uninstaller resolves outside the disposable InstallDir: $resolvedUninstaller"
    }

    [pscustomobject]@{
        Entry = $entry
        Uninstaller = $resolvedUninstaller
    }
}

$verifyAction = {
    param($owned)

    Assert-Path -Path $desktopExe -Label "installed desktop executable"
    Assert-Path -Path $cliExe -Label "installed CLI executable"
    Assert-Path -Path $legacyDesktopExe -Label "installed desktop compatibility executable"
    Assert-Path -Path $icon -Label "icon"

    $desktopHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $desktopExe).Hash.ToLowerInvariant()
    Write-Step "installed Quotalis.exe sha256: $desktopHash"
    $cliHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $cliExe).Hash.ToLowerInvariant()
    Write-Step "installed quotalis-cli.exe sha256: $cliHash"
    $legacyDesktopHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $legacyDesktopExe).Hash.ToLowerInvariant()
    Write-Step "installed quotalis-desktop.exe sha256: $legacyDesktopHash"

    if (-not (Test-Path -LiteralPath $verifyExecutablesScript)) {
        throw "Executable verification script not found: $verifyExecutablesScript"
    }
    & $verifyExecutablesScript `
        -DesktopExe $desktopExe `
        -CliExe $cliExe `
        -LegacyDesktopExe $legacyDesktopExe `
        -CheckCliStdout

    if ($ExpectedVersion) {
        $versionOutput = (& $cliExe --version) -join "`n"
        if ($LASTEXITCODE -ne 0) {
            throw "quotalis-cli.exe --version exited with $LASTEXITCODE"
        }
        if ($versionOutput -notmatch [regex]::Escape($ExpectedVersion)) {
            throw "Expected quotalis-cli.exe --version to mention $ExpectedVersion, got: $versionOutput"
        }
        if ($owned.Entry.DisplayVersion -ne $ExpectedVersion) {
            throw "Expected uninstall DisplayVersion $ExpectedVersion, got $($owned.Entry.DisplayVersion)"
        }
        Write-Step "CLI version output: $versionOutput"
    }

    $helpOutput = (& $cliExe --help) -join "`n"
    if ($LASTEXITCODE -ne 0) {
        throw "quotalis-cli.exe --help exited with $LASTEXITCODE"
    }
    if ($helpOutput -notmatch "Usage:" -or $helpOutput -notmatch "diagnose") {
        throw "quotalis-cli.exe --help did not print CLI help."
    }
    Write-Step "CLI help output: ok"

    $shortcut = $shortcutCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $shortcut) {
        throw "Missing Start Menu shortcut. Checked: $($shortcutCandidates -join ', ')"
    }
    Write-Step "Start Menu shortcut: $shortcut"
}

$cleanupAction = {
    param($owned)

    $uninstallLog = Join-Path $logDir "uninstall.log"
    Write-Step "running silent uninstall"
    $uninstallArgs = @(
        "/VERYSILENT",
        "/SUPPRESSMSGBOXES",
        "/NORESTART",
        "/LOG=`"$uninstallLog`""
    )
    $uninstall = Start-Process -FilePath $owned.Uninstaller -ArgumentList $uninstallArgs -Wait -PassThru
    if ($uninstall.ExitCode -notin @(0, 3010)) {
        throw "Uninstaller exited with $($uninstall.ExitCode). Log: $uninstallLog"
    }
    foreach ($leftover in @($desktopExe, $cliExe, $legacyDesktopExe)) {
        if (Test-Path -LiteralPath $leftover) {
            throw "Executable still exists after uninstall: $leftover"
        }
    }
}

$recoveryInstructions = "Inspect $installLog, $installDirPath, and $canonicalUninstallKey inside this disposable environment; remove only artifacts whose paths and Quotalis identity you verify."
Invoke-SmokeInstallLifecycle `
    -Install $installAction `
    -AcquireOwnership $acquireOwnership `
    -Verify $verifyAction `
    -Cleanup $cleanupAction `
    -LeaveInstalled $LeaveInstalled.IsPresent `
    -RecoveryInstructions $recoveryInstructions

Write-Step "ok"
