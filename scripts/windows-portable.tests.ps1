#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'windows-portable.ps1')

function Assert-Throws {
    param([scriptblock]$Action, [string]$Label)
    $failed = $false
    try { & $Action } catch { $failed = $true }
    if (-not $failed) { throw "Expected rejection: $Label" }
}

$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('quotalis-portable-test-' + [guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($fixtureRoot)
try {
    $desktop = Join-Path $fixtureRoot 'Quotalis.exe'
    $files = Get-QuotalisPortableFiles -DesktopExe $desktop -RepoRoot $fixtureRoot
    foreach ($name in $files.Keys) {
        [void][IO.Directory]::CreateDirectory((Split-Path $files[$name] -Parent))
        [IO.File]::WriteAllText($files[$name], "Fixture content for $name")
    }
    [IO.File]::WriteAllText((Join-Path $fixtureRoot 'private-settings.json'), 'must never ship')
    $destination = Join-Path $fixtureRoot 'portable.zip'
    New-QuotalisPortableArchive -Destination $destination -DesktopExe $desktop -RepoRoot $fixtureRoot
    Assert-QuotalisPortableArchive -ArchivePath $destination -DesktopExe $desktop -RepoRoot $fixtureRoot
    $originalHash = (Get-FileHash -LiteralPath $destination).Hash
    Assert-Throws { New-QuotalisPortableArchive -Destination $destination -DesktopExe $desktop -RepoRoot $fixtureRoot } 'existing archive must be preserved'
    if ((Get-FileHash -LiteralPath $destination).Hash -cne $originalHash) { throw 'Existing archive changed' }

    $zip = [IO.Compression.ZipFile]::Open($destination, [IO.Compression.ZipArchiveMode]::Update)
    try { $zip.GetEntry('quotalis-icon-128.png').Delete() } finally { $zip.Dispose() }
    Assert-Throws { Assert-QuotalisPortableArchive -ArchivePath $destination -DesktopExe $desktop -RepoRoot $fixtureRoot } 'missing notification artwork'

    $missingDestination = Join-Path $fixtureRoot 'missing.zip'
    Remove-Item -LiteralPath $files['quotalis-icon-128.png']
    Assert-Throws { New-QuotalisPortableArchive -Destination $missingDestination -DesktopExe $desktop -RepoRoot $fixtureRoot } 'missing source fails before output'
    if (Test-Path -LiteralPath $missingDestination) { throw 'Missing input produced an archive' }

    [IO.File]::WriteAllText($files['quotalis-icon-128.png'], 'restored icon')
    $tampered = Join-Path $fixtureRoot 'tampered.zip'
    New-QuotalisPortableArchive -Destination $tampered -DesktopExe $desktop -RepoRoot $fixtureRoot
    [IO.File]::WriteAllText($desktop, 'different executable')
    Assert-Throws { Assert-QuotalisPortableArchive -ArchivePath $tampered -DesktopExe $desktop -RepoRoot $fixtureRoot } 'executable hash mismatch'
    if (@(Get-ChildItem -LiteralPath $fixtureRoot -Filter '*.tmp').Count) { throw 'Temporary archive leaked' }
} finally {
    # The only recursive removal is the unique directory created above.
    $resolvedFixture = [IO.Path]::GetFullPath($fixtureRoot)
    $tempPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolvedFixture.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        (Split-Path $resolvedFixture -Leaf) -notlike 'quotalis-portable-test-*') { throw 'Unsafe fixture cleanup path' }
    Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
}
Write-Host 'Portable archive checks passed: exact entries, original resources, no private files, hashes, missing input, immutable output and cleanup.'
