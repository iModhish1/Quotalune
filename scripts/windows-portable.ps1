#Requires -Version 5.1
Set-StrictMode -Version Latest

function Get-QuotalisPortableFiles {
    param([Parameter(Mandatory)][string]$DesktopExe, [Parameter(Mandatory)][string]$RepoRoot)
    return [ordered]@{
        'Quotalis.exe' = $DesktopExe
        'quotalis-icon-128.png' = Join-Path $RepoRoot 'assets/brand/icons/quotaarc-icon-128.png'
        'icon.ico' = Join-Path $RepoRoot 'rust/icons/icon.ico'
        'LICENSE' = Join-Path $RepoRoot 'LICENSE'
        'NOTICE' = Join-Path $RepoRoot 'NOTICE'
        'THIRD_PARTY_NOTICES.md' = Join-Path $RepoRoot 'THIRD_PARTY_NOTICES.md'
        'README.md' = Join-Path $RepoRoot 'docs/validation/QUOTALIS_PORTABLE_WINDOWS.md'
    }
}

function Assert-QuotalisPortableArchive {
    param(
        [Parameter(Mandatory)][string]$ArchivePath,
        [Parameter(Mandatory)][string]$DesktopExe,
        [Parameter(Mandatory)][string]$RepoRoot
    )
    Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
    $files = Get-QuotalisPortableFiles -DesktopExe $DesktopExe -RepoRoot $RepoRoot
    $archive = [IO.Compression.ZipFile]::OpenRead($ArchivePath)
    try {
        if ($archive.Entries.Count -ne $files.Count) { throw 'Portable archive has unexpected or missing files.' }
        foreach ($name in $files.Keys) {
            $entries = @($archive.Entries | Where-Object { $_.FullName -ceq $name })
            if ($entries.Count -ne 1) { throw "Portable archive must contain exactly one $name at its root." }
            $stream = $entries[0].Open()
            $sha = [Security.Cryptography.SHA256]::Create()
            try { $actual = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '') }
            finally { $stream.Dispose(); $sha.Dispose() }
            $expected = (Get-FileHash -LiteralPath $files[$name] -Algorithm SHA256).Hash
            if ($actual -cne $expected) { throw "Portable archive resource mismatch: $name" }
        }
    } finally { $archive.Dispose() }
}

function New-QuotalisPortableArchive {
    param(
        [Parameter(Mandatory)][string]$Destination,
        [Parameter(Mandatory)][string]$DesktopExe,
        [Parameter(Mandatory)][string]$RepoRoot
    )
    Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
    $destinationPath = [IO.Path]::GetFullPath($Destination)
    if (Test-Path -LiteralPath $destinationPath) { throw "Portable destination already exists: $destinationPath" }
    $files = Get-QuotalisPortableFiles -DesktopExe $DesktopExe -RepoRoot $RepoRoot
    foreach ($name in $files.Keys) {
        if (-not (Test-Path -LiteralPath $files[$name] -PathType Leaf)) { throw "Missing portable resource: $name" }
    }
    # Only explicit public release resources enter the archive; never recurse over
    # the build directory, which can also contain development or private files.
    $temporaryPath = "$destinationPath.$([guid]::NewGuid().ToString('N')).tmp"
    try {
        $archive = [IO.Compression.ZipFile]::Open($temporaryPath, [IO.Compression.ZipArchiveMode]::Create)
        try {
            foreach ($name in $files.Keys) {
                [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                    $archive, $files[$name], $name, [IO.Compression.CompressionLevel]::Optimal)
            }
        } finally { $archive.Dispose() }
        Assert-QuotalisPortableArchive -ArchivePath $temporaryPath -DesktopExe $DesktopExe -RepoRoot $RepoRoot
        # File.Move fails if another caller populated the destination meanwhile.
        [IO.File]::Move($temporaryPath, $destinationPath)
    } finally {
        if (Test-Path -LiteralPath $temporaryPath -PathType Leaf) { Remove-Item -LiteralPath $temporaryPath }
    }
}
