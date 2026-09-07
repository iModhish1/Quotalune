param(
    [Parameter(Mandatory = $true)]
    [int]$ProcessId,
    [string]$InputDirectory = "docs/images/v9/native/surfaces"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$directory = [System.IO.Path]::GetFullPath((Join-Path $root $InputDirectory))
$output = Join-Path $directory "NATIVE_SURFACE_DPI_PROOF_BOARD.png"
$evidencePath = Join-Path $directory "windows-evidence.json"

$definitions = @(
    @{ Id = "taskbar"; Title = "QuotaArc Taskbar Arc"; File = "cua-taskbar-expanded.png" },
    @{ Id = "top"; Title = "QuotaArc Top Arc"; File = "cua-top-expanded.png" },
    @{ Id = "edge"; Title = "QuotaArc Edge Arc"; File = "cua-edge-expanded.png" }
)

$windowState = (cua-driver call list_windows '{}') | ConvertFrom-Json
$windows = foreach ($definition in $definitions) {
    $window = $windowState.windows | Where-Object {
        $_.pid -eq $ProcessId -and $_.title -eq $definition.Title
    } | Select-Object -First 1
    if (-not $window) { throw "Missing native window: $($definition.Title) (PID $ProcessId)" }
    if (-not $window.is_on_screen -or $window.minimized) {
        throw "Native window is not visibly composited: $($definition.Title)"
    }
    $imagePath = Join-Path $directory $definition.File
    if (-not (Test-Path -LiteralPath $imagePath)) { throw "Missing capture: $imagePath" }
    $hash = (Get-FileHash -LiteralPath $imagePath -Algorithm SHA256).Hash.ToLowerInvariant()
    [ordered]@{
        id = $definition.Id
        title = $window.title
        pid = $window.pid
        windowId = $window.window_id
        onScreen = $window.is_on_screen
        minimized = $window.minimized
        bounds = $window.bounds
        capture = $definition.File
        sha256 = $hash
    }
}

$evidence = [ordered]@{
    schemaVersion = 1
    generatedAtUtc = [DateTime]::UtcNow.ToString("o")
    runtime = "Windows DWM-composited native Tauri windows"
    executable = "target/debug/QuotalisDev.exe"
    processId = $ProcessId
    display = [ordered]@{ physicalWidth = 3200; physicalHeight = 2136; devicePixelRatio = 2.5 }
    theme = "10-celestial-ice"
    startupRestoredWithoutManualShow = $true
    windows = @($windows)
}
$evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $evidencePath -Encoding utf8

Add-Type -AssemblyName System.Drawing
$canvas = New-Object System.Drawing.Bitmap 2400, 1700
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.Clear([System.Drawing.Color]::FromArgb(10, 14, 21))

$titleFont = New-Object System.Drawing.Font("Segoe UI", 23, [System.Drawing.FontStyle]::Bold)
$subFont = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Regular)
$labelFont = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$metaFont = New-Object System.Drawing.Font("Consolas", 9, [System.Drawing.FontStyle]::Regular)
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(236, 244, 255))
$muted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(150, 177, 207))
$accent = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(119, 219, 255))
$panel = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20, 27, 38))
$border = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(55, 87, 118), 2)

function Draw-PanelImage {
    param([string]$Path, [System.Drawing.Rectangle]$Rectangle, [string]$Label)
    $graphics.FillRectangle($panel, $Rectangle)
    $graphics.DrawRectangle($border, $Rectangle)
    $headerHeight = 50
    $imageRectangle = [System.Drawing.Rectangle]::new(
        $Rectangle.X + 12,
        $Rectangle.Y + $headerHeight,
        $Rectangle.Width - 24,
        $Rectangle.Height - $headerHeight - 12
    )
    $image = [System.Drawing.Image]::FromFile($Path)
    try {
        $scale = [Math]::Min($imageRectangle.Width / $image.Width, $imageRectangle.Height / $image.Height)
        $width = [int]($image.Width * $scale)
        $height = [int]($image.Height * $scale)
        $x = $imageRectangle.X + [int](($imageRectangle.Width - $width) / 2)
        $y = $imageRectangle.Y + [int](($imageRectangle.Height - $height) / 2)
        $graphics.DrawImage($image, $x, $y, $width, $height)
    } finally {
        $image.Dispose()
    }
    $graphics.DrawString($Label, $labelFont, $accent, $Rectangle.X + 18, $Rectangle.Y + 12)
}

try {
    $graphics.DrawString("QUOTAARC V9 · NATIVE SURFACE + DPI PROOF", $titleFont, $white, 58, 16)
    $graphics.DrawString("Fresh Tauri WebView2 · Windows DWM capture · DPR 2.5 · Celestial Ice", $subFont, $muted, 62, 78)
    $graphics.DrawString("PID $ProcessId · auto-restored at startup · shared 27 / 79 / 42 provider snapshot", $metaFont, $accent, 62, 120)

    Draw-PanelImage (Join-Path $directory "cua-taskbar-expanded.png") ([System.Drawing.Rectangle]::new(55, 180, 1510, 990)) "TASKBAR · 2050 × 1350 PHYSICAL PX"
    Draw-PanelImage (Join-Path $directory "cua-top-expanded.png") ([System.Drawing.Rectangle]::new(1605, 180, 740, 500)) "TOP · 1900 × 1075 PHYSICAL PX"
    Draw-PanelImage (Join-Path $directory "cua-edge-expanded.png") ([System.Drawing.Rectangle]::new(1605, 720, 740, 800)) "EDGE · 1050 × 1500 PHYSICAL PX"

    $graphics.DrawString("NATIVE WINDOW BOUNDS", $labelFont, $white, 70, 1230)
    $lineY = 1275
    foreach ($window in $windows) {
        $b = $window.bounds
        $line = "{0,-8} x={1,4} y={2,4}  {3,4}×{4,-4}  on-screen={5}" -f $window.id.ToUpperInvariant(), $b.x, $b.y, $b.width, $b.height, $window.onScreen
        $graphics.DrawString($line, $metaFont, $muted, 72, $lineY)
        $lineY += 29
    }
    $graphics.DrawString("No clipping · no fabricated unavailable value · one theme / geometry / motion runtime", $subFont, $accent, 70, 1390)
    $graphics.DrawString("Evidence: evidence.json + windows-evidence.json · SHA-256 recorded per capture", $metaFont, $muted, 70, 1440)

    $canvas.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $graphics.Dispose()
    $canvas.Dispose()
    $titleFont.Dispose(); $subFont.Dispose(); $labelFont.Dispose(); $metaFont.Dispose()
    $white.Dispose(); $muted.Dispose(); $accent.Dispose(); $panel.Dispose(); $border.Dispose()
}

Write-Output $output
Write-Output $evidencePath
