param(
    [string]$InputDirectory = "docs/images/v9/native/themes"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$directory = [System.IO.Path]::GetFullPath((Join-Path $root $InputDirectory))
$evidence = Get-Content -Raw -LiteralPath (Join-Path $directory "evidence.json") | ConvertFrom-Json
if ($evidence.captures.Count -ne 15) { throw "Expected 15 theme captures" }

Add-Type -AssemblyName System.Drawing
$canvas = New-Object System.Drawing.Bitmap 2500, 1650
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.Clear([System.Drawing.Color]::FromArgb(8, 12, 19))

$titleFont = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
$subFont = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Regular)
$nameFont = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$metaFont = New-Object System.Drawing.Font("Consolas", 8, [System.Drawing.FontStyle]::Regular)
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(239, 246, 255))
$muted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(139, 166, 197))
$accent = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(103, 225, 239))
$panel = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18, 25, 36))
$border = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(48, 72, 99), 2)

try {
    $graphics.DrawString("QUOTAARC V9 · 15-THEME NATIVE WINDOWS MATRIX", $titleFont, $white, 45, 12)
    $graphics.DrawString("Fresh Dev binary · persisted Taskbar surface override · live settings broadcast · WebView2 DPR 2.5", $subFont, $muted, 48, 66)
    $graphics.DrawString("15/15 themes · $($evidence.geometryCount) geometry variants · $($evidence.motionCount) motion characters · SHA-256 evidence per frame", $metaFont, $accent, 48, 102)

    for ($index = 0; $index -lt $evidence.captures.Count; $index++) {
        $capture = $evidence.captures[$index]
        $column = $index % 5
        $row = [Math]::Floor($index / 5)
        $x = 35 + ($column * 490)
        $y = 150 + ($row * 485)
        $rectangle = [System.Drawing.Rectangle]::new($x, $y, 455, 445)
        $graphics.FillRectangle($panel, $rectangle)
        $graphics.DrawRectangle($border, $rectangle)
        $graphics.DrawString(("{0:D2}  {1}" -f ($index + 1), $capture.name.ToUpperInvariant()), $nameFont, $white, $x + 14, $y + 12)
        $graphics.DrawString(("{0} · {1}" -f $capture.runtime.geometry.ToUpperInvariant(), $capture.runtime.motion.ToUpperInvariant()), $metaFont, $accent, $x + 14, $y + 48)

        $image = [System.Drawing.Image]::FromFile((Join-Path $directory $capture.file))
        try {
            $imageRect = [System.Drawing.Rectangle]::new($x + 10, $y + 82, 435, 286)
            $scale = [Math]::Min($imageRect.Width / $image.Width, $imageRect.Height / $image.Height)
            $width = [int]($image.Width * $scale)
            $height = [int]($image.Height * $scale)
            $imageX = $imageRect.X + [int](($imageRect.Width - $width) / 2)
            $imageY = $imageRect.Y + [int](($imageRect.Height - $height) / 2)
            $graphics.DrawImage($image, $imageX, $imageY, $width, $height)
        } finally {
            $image.Dispose()
        }

        $graphics.DrawString("2050×1350 PX · EXPANDED · LIVE", $metaFont, $muted, $x + 14, $y + 395)
    }

    $output = Join-Path $directory "NATIVE_15_THEME_MATRIX.png"
    $canvas.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output $output
} finally {
    $graphics.Dispose(); $canvas.Dispose()
    $titleFont.Dispose(); $subFont.Dispose(); $nameFont.Dispose(); $metaFont.Dispose()
    $white.Dispose(); $muted.Dispose(); $accent.Dispose(); $panel.Dispose(); $border.Dispose()
}
