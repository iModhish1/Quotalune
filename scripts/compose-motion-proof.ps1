param(
    [string]$SourceRoot = "output/playwright/motion",
    [string]$DestinationRoot = "docs/images/v9/motion"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$themes = @(
    @{ Slug = "01-obsidian-orbit"; Name = "Obsidian Orbit"; Character = "Orbit" },
    @{ Slug = "02-aurora-bloom"; Name = "Aurora Bloom"; Character = "Bloom" },
    @{ Slug = "03-solar-ember"; Name = "Solar Ember"; Character = "Detent" },
    @{ Slug = "05-noir-constellation"; Name = "Noir Constellation"; Character = "Constellation" },
    @{ Slug = "07-eclipse-dial"; Name = "Eclipse Dial"; Character = "Corona" },
    @{ Slug = "12-crimson-nova"; Name = "Crimson Nova"; Character = "Nova" },
    @{ Slug = "15-astral-dune"; Name = "Astral Dune"; Character = "Dune" }
)
$frames = @(
    @{ File = "01-idle.png"; Label = "IDLE" },
    @{ File = "02-hover.png"; Label = "HOVER" },
    @{ File = "03-focus.png"; Label = "FOCUS" },
    @{ File = "04-expand-mid.png"; Label = "EXPAND / MID" },
    @{ File = "05-expanded.png"; Label = "EXPANDED" },
    @{ File = "06-collapse-mid.png"; Label = "COLLAPSE / MID" },
    @{ File = "07-collapsed.png"; Label = "COLLAPSED" }
)

$source = (Resolve-Path -LiteralPath $SourceRoot).Path
$destination = Join-Path (Get-Location) $DestinationRoot
New-Item -ItemType Directory -Path $destination -Force | Out-Null

$canvasWidth = 2240
$headerHeight = 92
$rowHeight = 244
$canvasHeight = $headerHeight + ($themes.Count * $rowHeight) + 24
$cellWidth = 280
$cellHeight = 186
$left = 180
$gap = 10

$bitmap = [System.Drawing.Bitmap]::new($canvasWidth, $canvasHeight)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#070b13"))

$fontFamily = "Segoe UI Variable Display"
$titleFont = [System.Drawing.Font]::new($fontFamily, 28, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$subtitleFont = [System.Drawing.Font]::new($fontFamily, 13, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$themeFont = [System.Drawing.Font]::new($fontFamily, 16, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$characterFont = [System.Drawing.Font]::new($fontFamily, 11, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$labelFont = [System.Drawing.Font]::new($fontFamily, 10, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$white = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#f6f8fb"))
$muted = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#8d9aab"))
$accent = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#74efe0"))
$border = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml("#273245"), 1)

try {
    $graphics.DrawString("QUOTAARC V9  /  BOUNDED MOTION PROOF", $titleFont, $white, 28, 18)
    $graphics.DrawString("One continuous production-stage interaction / no idle animation loops / full-motion runtime", $subtitleFont, $muted, 30, 57)

    for ($column = 0; $column -lt $frames.Count; $column++) {
        $x = $left + ($column * ($cellWidth + $gap))
        $graphics.DrawString($frames[$column].Label, $labelFont, $muted, $x + 4, 77)
    }

    $manifestFrames = @()
    for ($row = 0; $row -lt $themes.Count; $row++) {
        $theme = $themes[$row]
        $y = $headerHeight + ($row * $rowHeight)
        $graphics.DrawString(($row + 1).ToString("00"), $themeFont, $accent, 28, $y + 34)
        $graphics.DrawString($theme.Name, $themeFont, $white, 28, $y + 59)
        $graphics.DrawString($theme.Character.ToUpperInvariant(), $characterFont, $muted, 30, $y + 84)

        for ($column = 0; $column -lt $frames.Count; $column++) {
            $frame = $frames[$column]
            $path = Join-Path (Join-Path $source $theme.Slug) $frame.File
            if (-not (Test-Path -LiteralPath $path)) {
                throw "Missing motion frame: $path"
            }

            $image = [System.Drawing.Image]::FromFile($path)
            try {
                if ($image.Width -ne 820 -or $image.Height -ne 540) {
                    throw "Unexpected frame dimensions for ${path}: $($image.Width)x$($image.Height)"
                }
                $x = $left + ($column * ($cellWidth + $gap))
                $target = [System.Drawing.Rectangle]::new($x, $y + 28, $cellWidth, $cellHeight)
                $graphics.DrawImage($image, $target)
                $graphics.DrawRectangle($border, $target)
            }
            finally {
                $image.Dispose()
            }

            $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
            $manifestFrames += [ordered]@{
                theme = $theme.Slug
                character = $theme.Character.ToLowerInvariant()
                state = [System.IO.Path]::GetFileNameWithoutExtension($frame.File)
                sha256 = $hash
                width = 820
                height = 540
            }
        }
    }

    $boardPath = Join-Path $destination "THEME_MOTION_PROOF_BOARD.png"
    $bitmap.Save($boardPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
    $border.Dispose()
    $accent.Dispose()
    $muted.Dispose()
    $white.Dispose()
    $labelFont.Dispose()
    $characterFont.Dispose()
    $themeFont.Dispose()
    $subtitleFont.Dispose()
    $titleFont.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

$boardHash = (Get-FileHash -LiteralPath $boardPath -Algorithm SHA256).Hash.ToLowerInvariant()
$evidence = [ordered]@{
    schemaVersion = 1
    generatedAtUtc = [DateTime]::UtcNow.ToString("o")
    runtime = "production TaskbarStage through V8 demo proof shell"
    interaction = @("idle", "hover", "focus", "expand-mid", "expanded", "collapse-mid", "collapsed")
    noIdleLoop = $true
    board = [ordered]@{
        path = "THEME_MOTION_PROOF_BOARD.png"
        sha256 = $boardHash
        width = $canvasWidth
        height = $canvasHeight
    }
    frames = $manifestFrames
}
$evidence | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $destination "evidence.json") -Encoding utf8
Write-Output $boardPath
