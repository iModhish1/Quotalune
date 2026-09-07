param(
    [string]$InputDirectory = "docs/images/v9/native/usage",
    [string]$OutputFile = "docs/images/v9/native/USAGE_NATIVE_PROOF_BOARD.png"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = (Get-Location).Path
$inputPath = [System.IO.Path]::GetFullPath((Join-Path $root $InputDirectory))
$outputPath = [System.IO.Path]::GetFullPath((Join-Path $root $OutputFile))
$outputParent = Split-Path -Parent $outputPath
[System.IO.Directory]::CreateDirectory($outputParent) | Out-Null

$cards = @(
    @{ File = "01-global-used.png"; Title = "GLOBAL USED"; Detail = "Codex 21  |  Claude 73  |  Gemini 58" },
    @{ File = "02-global-remaining.png"; Title = "GLOBAL REMAINING"; Detail = "Codex 79  |  Claude 27  |  Gemini 42" },
    @{ File = "03-global-hybrid.png"; Title = "GLOBAL HYBRID"; Detail = "Primary used  |  secondary remaining" },
    @{ File = "04-remaining-claude-used.png"; Title = "REMAINING + CLAUDE USED"; Detail = "Provider override beats global" },
    @{ File = "05-used-claude-remaining.png"; Title = "USED + CLAUDE REMAINING"; Detail = "Provider override beats global" },
    @{ File = "06-unavailable.png"; Title = "HONEST UNAVAILABLE"; Detail = "DeepSeek renders dash; no fabricated quota" }
)

$boardWidth = 1920
$boardHeight = 1020
$outer = 30
$gap = 20
$headerHeight = 92
$footerHeight = 42
$cardWidth = [int](($boardWidth - (2 * $outer) - (2 * $gap)) / 3)
$cardHeight = [int](($boardHeight - $headerHeight - $footerHeight - (2 * $outer) - $gap) / 2)
$labelHeight = 58

$bitmap = [System.Drawing.Bitmap]::new($boardWidth, $boardHeight)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.Clear([System.Drawing.Color]::FromArgb(255, 8, 11, 16))

$titleFont = [System.Drawing.Font]::new("Segoe UI", 28, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$subtitleFont = [System.Drawing.Font]::new("Segoe UI", 16, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$cardTitleFont = [System.Drawing.Font]::new("Segoe UI", 18, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$cardDetailFont = [System.Drawing.Font]::new("Segoe UI", 13, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$titleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 235, 241, 248))
$mutedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 151, 166, 181))
$accentBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 53, 211, 199))
$cardBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 19, 24, 32))
$borderPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 41, 55, 68), 1)

try {
    $graphics.DrawString("QuotaArc V9  ·  Native Usage Proof", $titleFont, $titleBrush, $outer, 22)
    $graphics.DrawString(
        "Fresh QuotalisDev.exe · Settings-driven state changes · real Tauri Taskbar WebView2 · 250% DPI",
        $subtitleFont,
        $mutedBrush,
        $outer,
        61
    )

    for ($index = 0; $index -lt $cards.Count; $index++) {
        $column = $index % 3
        $row = [int][Math]::Floor($index / 3)
        $x = $outer + ($column * ($cardWidth + $gap))
        $y = $headerHeight + $outer + ($row * ($cardHeight + $gap))
        $card = $cards[$index]
        $sourcePath = Join-Path $inputPath $card.File
        if (-not (Test-Path -LiteralPath $sourcePath)) {
            throw "Missing capture: $sourcePath"
        }

        $rect = [System.Drawing.Rectangle]::new($x, $y, $cardWidth, $cardHeight)
        $graphics.FillRectangle($cardBrush, $rect)
        $graphics.DrawRectangle($borderPen, $rect)
        $graphics.DrawString($card.Title, $cardTitleFont, $accentBrush, $x + 14, $y + 10)
        $graphics.DrawString($card.Detail, $cardDetailFont, $mutedBrush, $x + 14, $y + 33)

        $image = [System.Drawing.Image]::FromFile($sourcePath)
        try {
            $imageTop = $y + $labelHeight
            $availableHeight = $cardHeight - $labelHeight
            $scale = [Math]::Min($cardWidth / $image.Width, $availableHeight / $image.Height)
            $drawWidth = [int][Math]::Round($image.Width * $scale)
            $drawHeight = [int][Math]::Round($image.Height * $scale)
            $drawX = $x + [int](($cardWidth - $drawWidth) / 2)
            $drawY = $imageTop + [int](($availableHeight - $drawHeight) / 2)
            $graphics.DrawImage($image, $drawX, $drawY, $drawWidth, $drawHeight)
        }
        finally {
            $image.Dispose()
        }
    }

    $graphics.DrawString(
        "Evidence manifest: native/usage/evidence.json  ·  SHA-256 recorded per frame  ·  Personal data untouched",
        $subtitleFont,
        $mutedBrush,
        $outer,
        $boardHeight - $footerHeight + 8
    )
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "wrote $outputPath"
}
finally {
    $borderPen.Dispose()
    $cardBrush.Dispose()
    $accentBrush.Dispose()
    $mutedBrush.Dispose()
    $titleBrush.Dispose()
    $cardDetailFont.Dispose()
    $cardTitleFont.Dispose()
    $subtitleFont.Dispose()
    $titleFont.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
