param(
    [string]$ReferenceRoot = ".local/research/theme-catalog/themes",
    [string]$CaptureRoot = "output/playwright/reference",
    [string]$DestinationRoot = "docs/images/v9/reference"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$themes = @(
    @{ Slug = "01-obsidian-orbit"; Name = "Obsidian Orbit"; Geometry = "Orbit"; Motion = "Orbit" },
    @{ Slug = "02-aurora-bloom"; Name = "Aurora Bloom"; Geometry = "Petals"; Motion = "Bloom" },
    @{ Slug = "03-solar-ember"; Name = "Solar Ember"; Geometry = "Dial"; Motion = "Detent" },
    @{ Slug = "04-porcelain-halo"; Name = "Porcelain Halo"; Geometry = "Orbit"; Motion = "Float" },
    @{ Slug = "05-noir-constellation"; Name = "Noir Constellation"; Geometry = "Constellation"; Motion = "Constellation" },
    @{ Slug = "06-halo-spine"; Name = "Halo Spine"; Geometry = "Spine"; Motion = "Rail" },
    @{ Slug = "07-eclipse-dial"; Name = "Eclipse Dial"; Geometry = "Eclipse"; Motion = "Corona" },
    @{ Slug = "08-prism-zenith"; Name = "Prism Zenith"; Geometry = "Facets"; Motion = "Facet" },
    @{ Slug = "09-quantum-orchid"; Name = "Quantum Orchid"; Geometry = "Orchid"; Motion = "Orchid" },
    @{ Slug = "10-celestial-ice"; Name = "Celestial Ice"; Geometry = "Ice"; Motion = "Frost" },
    @{ Slug = "11-emerald-singularity"; Name = "Emerald Singularity"; Geometry = "Lens"; Motion = "Gravity" },
    @{ Slug = "12-crimson-nova"; Name = "Crimson Nova"; Geometry = "Nova"; Motion = "Nova" },
    @{ Slug = "13-lunar-titanium"; Name = "Lunar Titanium"; Geometry = "Aperture"; Motion = "Shutter" },
    @{ Slug = "14-sapphire-observatory"; Name = "Sapphire Observatory"; Geometry = "Astrolabe"; Motion = "Reticle" },
    @{ Slug = "15-astral-dune"; Name = "Astral Dune"; Geometry = "Dunes"; Motion = "Dune" }
)

$reference = (Resolve-Path -LiteralPath $ReferenceRoot).Path
$captures = (Resolve-Path -LiteralPath $CaptureRoot).Path
$destination = Join-Path (Get-Location) $DestinationRoot
New-Item -ItemType Directory -Path $destination -Force | Out-Null

function New-Font([float]$size, [System.Drawing.FontStyle]$style = [System.Drawing.FontStyle]::Regular) {
    return [System.Drawing.Font]::new("Segoe UI Variable Display", $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

function Draw-ContainedImage(
    [System.Drawing.Graphics]$graphics,
    [string]$path,
    [System.Drawing.Rectangle]$target,
    [System.Drawing.Pen]$border
) {
    $image = [System.Drawing.Image]::FromFile($path)
    try {
        $scale = [Math]::Min($target.Width / $image.Width, $target.Height / $image.Height)
        $width = [int][Math]::Round($image.Width * $scale)
        $height = [int][Math]::Round($image.Height * $scale)
        $x = $target.X + [int](($target.Width - $width) / 2)
        $y = $target.Y + [int](($target.Height - $height) / 2)
        $graphics.FillRectangle($script:cellBrush, $target)
        $graphics.DrawImage($image, [System.Drawing.Rectangle]::new($x, $y, $width, $height))
        $graphics.DrawRectangle($border, $target)
    }
    finally {
        $image.Dispose()
    }
}

$script:cellBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#0b111c"))
$white = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#f5f8fc"))
$muted = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#8492a6"))
$accent = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#66e8d4"))
$border = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml("#263247"), 1)
$rule = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml("#182337"), 1)
$titleFont = New-Font 34 ([System.Drawing.FontStyle]::Bold)
$subtitleFont = New-Font 14
$labelFont = New-Font 12 ([System.Drawing.FontStyle]::Bold)
$metaHeadFont = New-Font 11 ([System.Drawing.FontStyle]::Bold)
$metaValueFont = New-Font 18 ([System.Drawing.FontStyle]::Bold)

$sheetWidth = 2400
$sheetHeight = 1640
$sheetRecords = @()

try {
    foreach ($theme in $themes) {
        $bitmap = [System.Drawing.Bitmap]::new($sheetWidth, $sheetHeight)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#070b13"))

        try {
            $graphics.DrawString("$($theme.Name.ToUpperInvariant())  /  REFERENCE -> PRODUCTION", $titleFont, $white, 44, 28)
            $graphics.DrawString("V9 shared runtime / same provider fixture / motion disabled for deterministic visual comparison", $subtitleFont, $muted, 47, 73)
            $graphics.DrawLine($rule, 44, 112, 2356, 112)

            $referencePath = Join-Path (Join-Path $reference $theme.Slug) "00-full-asset-kit-board.png"
            $captureDirectory = Join-Path $captures $theme.Slug
            $paths = @{
                Taskbar = Join-Path $captureDirectory "taskbar.png"
                Top = Join-Path $captureDirectory "top.png"
                Edge = Join-Path $captureDirectory "edge.png"
                Hud = Join-Path $captureDirectory "hud.png"
                Quick = Join-Path $captureDirectory "quick.png"
                Dashboard = Join-Path $captureDirectory "dashboard.png"
            }
            @($referencePath) + @($paths.Values) | ForEach-Object {
                if (-not (Test-Path -LiteralPath $_)) { throw "Missing comparison input: $_" }
            }

            $graphics.DrawString("SOURCE ASSET KIT", $labelFont, $accent, 50, 128)
            Draw-ContainedImage $graphics $referencePath ([System.Drawing.Rectangle]::new(50, 154, 1100, 733)) $border

            $graphics.DrawString("TASKBAR / EXPANDED", $labelFont, $accent, 1200, 128)
            Draw-ContainedImage $graphics $paths.Taskbar ([System.Drawing.Rectangle]::new(1200, 154, 820, 540)) $border
            $graphics.DrawString("TOP / EXPANDED", $labelFont, $accent, 1200, 712)
            Draw-ContainedImage $graphics $paths.Top ([System.Drawing.Rectangle]::new(1200, 738, 760, 430)) $border

            $metaX = 2055
            $graphics.DrawString("RUNTIME IDENTITY", $metaHeadFont, $muted, $metaX, 164)
            $graphics.DrawString($theme.Geometry.ToUpperInvariant(), $metaValueFont, $white, $metaX, 188)
            $graphics.DrawString("GEOMETRY", $metaHeadFont, $muted, $metaX, 218)
            $graphics.DrawString($theme.Motion.ToUpperInvariant(), $metaValueFont, $white, $metaX, 264)
            $graphics.DrawString("MOTION", $metaHeadFont, $muted, $metaX, 294)
            $graphics.DrawString("6", $metaValueFont, $white, $metaX, 340)
            $graphics.DrawString("LIVE SURFACES", $metaHeadFont, $muted, $metaX, 370)
            $graphics.DrawString("SHARED", $metaValueFont, $white, $metaX, 416)
            $graphics.DrawString("TOKENS + DATA", $metaHeadFont, $muted, $metaX, 446)

            $bottomY = 1220
            $graphics.DrawString("EDGE", $labelFont, $accent, 50, 1194)
            Draw-ContainedImage $graphics $paths.Edge ([System.Drawing.Rectangle]::new(50, $bottomY, 280, 400)) $border
            $graphics.DrawString("HUD", $labelFont, $accent, 360, 1194)
            Draw-ContainedImage $graphics $paths.Hud ([System.Drawing.Rectangle]::new(360, $bottomY, 368, 400)) $border
            $graphics.DrawString("QUICK PANEL", $labelFont, $accent, 758, 1194)
            Draw-ContainedImage $graphics $paths.Quick ([System.Drawing.Rectangle]::new(758, $bottomY, 500, 400)) $border
            $graphics.DrawString("DASHBOARD", $labelFont, $accent, 1288, 1194)
            Draw-ContainedImage $graphics $paths.Dashboard ([System.Drawing.Rectangle]::new(1288, $bottomY, 1062, 400)) $border

            $sheetPath = Join-Path $destination "$($theme.Slug)-reference-vs-production.png"
            $bitmap.Save($sheetPath, [System.Drawing.Imaging.ImageFormat]::Png)
            $sheetRecords += [ordered]@{
                theme = $theme.Slug
                name = $theme.Name
                geometry = $theme.Geometry.ToLowerInvariant()
                motion = $theme.Motion.ToLowerInvariant()
                path = [System.IO.Path]::GetFileName($sheetPath)
                sha256 = (Get-FileHash -LiteralPath $sheetPath -Algorithm SHA256).Hash.ToLowerInvariant()
                sourceSha256 = (Get-FileHash -LiteralPath $referencePath -Algorithm SHA256).Hash.ToLowerInvariant()
            }
        }
        finally {
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    }

    $indexWidth = 1500
    $indexHeight = 1770
    $index = [System.Drawing.Bitmap]::new($indexWidth, $indexHeight)
    $indexGraphics = [System.Drawing.Graphics]::FromImage($index)
    $indexGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $indexGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $indexGraphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#070b13"))
    try {
        $indexGraphics.DrawString("QUOTAARC V9  /  15-THEME REFERENCE INDEX", $titleFont, $white, 30, 24)
        $indexGraphics.DrawString("Source identity beside six production surfaces / deterministic shared fixture", $subtitleFont, $muted, 34, 68)
        for ($indexValue = 0; $indexValue -lt $themes.Count; $indexValue++) {
            $column = $indexValue % 3
            $row = [Math]::Floor($indexValue / 3)
            $x = 30 + ($column * 490)
            $y = 116 + ($row * 326)
            $sheetPath = Join-Path $destination "$($themes[$indexValue].Slug)-reference-vs-production.png"
            Draw-ContainedImage $indexGraphics $sheetPath ([System.Drawing.Rectangle]::new($x, $y, 460, 314)) $border
        }
        $indexPath = Join-Path $destination "REFERENCE_VS_PRODUCTION_INDEX.png"
        $index.Save($indexPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $indexGraphics.Dispose()
        $index.Dispose()
    }
}
finally {
    $metaValueFont.Dispose()
    $metaHeadFont.Dispose()
    $labelFont.Dispose()
    $subtitleFont.Dispose()
    $titleFont.Dispose()
    $rule.Dispose()
    $border.Dispose()
    $accent.Dispose()
    $muted.Dispose()
    $white.Dispose()
    $script:cellBrush.Dispose()
}

$manifest = [ordered]@{
    schemaVersion = 1
    generatedAtUtc = [DateTime]::UtcNow.ToString("o")
    source = "QuotaArc 15-theme asset-kit boards"
    production = "V9 shared browser runtime, deterministic fixture, motion off"
    surfaces = @("taskbar-expanded", "top-expanded", "edge-expanded", "hud", "quick", "dashboard")
    index = [ordered]@{
        path = "REFERENCE_VS_PRODUCTION_INDEX.png"
        sha256 = (Get-FileHash -LiteralPath $indexPath -Algorithm SHA256).Hash.ToLowerInvariant()
        width = $indexWidth
        height = $indexHeight
    }
    sheets = $sheetRecords
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $destination "evidence.json") -Encoding utf8
Write-Output $indexPath
