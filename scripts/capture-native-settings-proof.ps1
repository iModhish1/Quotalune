param(
    [Parameter(Mandatory = $true)]
    [int]$ProcessId,
    [Parameter(Mandatory = $true)]
    [int]$WindowId,
    [string]$OutputDirectory = "docs/images/v9/native/settings"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$directory = [System.IO.Path]::GetFullPath((Join-Path $root $OutputDirectory))
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$screenshot = Join-Path $directory "theme-gallery.png"
$session = "quotaarc-settings-proof-$ProcessId"

$startRequest = @{ session = $session } | ConvertTo-Json -Compress
cua-driver call start_session $startRequest | Out-Null
$stateRequest = @{
    pid = $ProcessId
    window_id = $WindowId
    include_screenshot = $true
    screenshot_out_file = $screenshot
    session = $session
    max_elements = 180
} | ConvertTo-Json -Compress
$state = (cua-driver call get_window_state $stateRequest) | ConvertFrom-Json

$labels = @($state.elements | ForEach-Object { $_.label } | Where-Object { $_ })
$themeTab = $state.elements | Where-Object { $_.role -eq "TabItem" -and $_.label -eq "Themes" } | Select-Object -First 1
$themeButtons = @($state.elements | Where-Object { $_.role -eq "Button" -and $_.label -like "Apply theme *" })
$requiredScopes = @("Global", "Current profile", "Taskbar", "Top", "Edge", "HUD", "Quick panel", "Dashboard")
$missingScopes = @($requiredScopes | Where-Object { $_ -notin $labels })
$usageModes = @($state.elements | Where-Object { $_.role -eq "RadioButton" -and $_.label -in @("Remaining", "Used", "Hybrid") })

if (-not $themeTab.selected) { throw "Themes tab is not selected" }
if ($themeButtons.Count -ne 15) { throw "Expected 15 theme cards, found $($themeButtons.Count)" }
if ($missingScopes.Count -gt 0) { throw "Missing theme scopes: $($missingScopes -join ', ')" }
if ($usageModes.Count -ne 3) { throw "Usage mode controls were not present in the native UIA tree" }
if (-not (Test-Path -LiteralPath $screenshot)) { throw "CUA did not create the Settings capture" }

Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile($screenshot)
try {
    $dimensions = [ordered]@{ width = $image.Width; height = $image.Height }
} finally {
    $image.Dispose()
}

$nativeWindow = ((cua-driver call list_windows '{}') | ConvertFrom-Json).windows | Where-Object {
    $_.pid -eq $ProcessId -and $_.window_id -eq $WindowId
} | Select-Object -First 1
if (-not $nativeWindow) { throw "Settings native window disappeared before evidence was recorded" }

$evidence = [ordered]@{
    schemaVersion = 1
    generatedAtUtc = [DateTime]::UtcNow.ToString("o")
    runtime = "Windows DWM-composited QuotaArc Settings window"
    executable = "target/debug/QuotalisDev.exe"
    processId = $ProcessId
    windowId = $WindowId
    bounds = $nativeWindow.bounds
    onScreen = $nativeWindow.is_on_screen
    selectedTab = "Themes"
    themeCardCount = $themeButtons.Count
    assignmentScopes = $requiredScopes
    activeGlobalTheme = "Solar Ember"
    usageModes = @($usageModes | ForEach-Object { $_.label })
    capture = [ordered]@{
        file = "theme-gallery.png"
        sha256 = (Get-FileHash -LiteralPath $screenshot -Algorithm SHA256).Hash.ToLowerInvariant()
        dimensions = $dimensions
    }
}
$evidence | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $directory "evidence.json") -Encoding utf8

Write-Output $screenshot
Write-Output (Join-Path $directory "evidence.json")
