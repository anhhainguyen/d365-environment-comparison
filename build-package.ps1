<#
.SYNOPSIS
    Builds a clean Chrome Web Store upload package for D365 Environment Comparison.

.DESCRIPTION
    Copies only the files Chrome actually needs into a staging folder, validates
    the manifest and icons, then produces dist/d365-env-comparison-<version>.zip.

    Development-only files (loop notes, README, store screenshots, git metadata)
    are deliberately excluded so reviewers see a minimal, purposeful package.

.EXAMPLE
    pwsh -File .\build-package.ps1
#>

[CmdletBinding()]
param(
    [string]$OutputDir = 'dist'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = $PSScriptRoot
Push-Location $root

try {
    # Files and folders that ship to the Chrome Web Store.
    $include = @(
        'manifest.json',
        'popup.html',
        'popup.js',
        'content.js',
        'background.js',
        'privacy.html',
        'icons',
        'fonts'
    )

    Write-Host '==> Validating manifest.json' -ForegroundColor Cyan
    $manifestPath = Join-Path $root 'manifest.json'
    if (-not (Test-Path $manifestPath)) {
        throw 'manifest.json not found.'
    }

    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

    if ($manifest.manifest_version -ne 3) {
        throw "manifest_version must be 3 (found: $($manifest.manifest_version))."
    }
    if ($manifest.version -notmatch '^\d+(\.\d+){0,3}$') {
        throw "Invalid version string: '$($manifest.version)'."
    }
    if ($manifest.description.Length -gt 132) {
        throw "description exceeds the 132 character store limit ($($manifest.description.Length))."
    }
    if ($manifest.name.Length -gt 75) {
        throw "name exceeds the 75 character store limit ($($manifest.name.Length))."
    }

    Write-Host "    name        : $($manifest.name)"
    Write-Host "    version     : $($manifest.version)"
    Write-Host "    permissions : $($manifest.permissions -join ', ')"
    Write-Host "    hosts       : $($manifest.host_permissions -join ', ')"

    Write-Host '==> Verifying icon dimensions' -ForegroundColor Cyan
    Add-Type -AssemblyName System.Drawing
    foreach ($size in 16, 32, 48, 128) {
        $iconRelative = $manifest.icons.$size
        $iconPath = Join-Path $root $iconRelative
        if (-not (Test-Path $iconPath)) {
            throw "Missing icon declared in manifest: $iconRelative"
        }
        $image = [System.Drawing.Image]::FromFile($iconPath)
        try {
            if ($image.Width -ne [int]$size -or $image.Height -ne [int]$size) {
                throw "$iconRelative is $($image.Width)x$($image.Height); expected ${size}x${size}."
            }
            Write-Host "    $iconRelative -> $($image.Width)x$($image.Height) OK"
        }
        finally {
            $image.Dispose()
        }
    }

    Write-Host '==> Checking referenced scripts exist' -ForegroundColor Cyan
    $referenced = @($manifest.background.service_worker, $manifest.action.default_popup)
    $referenced += $manifest.content_scripts.js
    foreach ($file in ($referenced | Where-Object { $_ })) {
        if (-not (Test-Path (Join-Path $root $file))) {
            throw "Manifest references a missing file: $file"
        }
        Write-Host "    $file OK"
    }

    Write-Host '==> Scanning for remote script/style references' -ForegroundColor Cyan
    # Only resource-loading tags matter for CSP / remote-code review.
    # Plain <a href="https://..."> links are legitimate and are ignored.
    $remotePattern = '<\s*(?:script|link|img|iframe|embed|object|source|video|audio)\b[^>]*\b(?:src|href)\s*=\s*["'']https?://'
    $remoteHits = Select-String -Path (Join-Path $root '*.html') `
                                -Pattern $remotePattern `
                                -ErrorAction SilentlyContinue
    if ($remoteHits) {
        Write-Warning 'Remote resources referenced in HTML (review before submitting):'
        $remoteHits | ForEach-Object {
            Write-Warning ("    {0}:{1}" -f (Split-Path $_.Path -Leaf), $_.LineNumber)
        }
    }
    else {
        Write-Host '    No remote resources found.'
    }

    Write-Host '==> Checking for unresolved placeholders' -ForegroundColor Cyan
    $placeholderHits = Select-String -Path (Join-Path $root '*.html') `
                                     -Pattern 'REPLACE_WITH_' `
                                     -ErrorAction SilentlyContinue
    if ($placeholderHits) {
        Write-Warning 'Unresolved placeholders found — fix before submitting:'
        $placeholderHits | ForEach-Object {
            Write-Warning ("    {0}:{1}" -f (Split-Path $_.Path -Leaf), $_.LineNumber)
        }
    }
    else {
        Write-Host '    No placeholders found.'
    }

    Write-Host '==> Staging package contents' -ForegroundColor Cyan
    $distPath = Join-Path $root $OutputDir
    $stagePath = Join-Path $distPath 'package'

    if (Test-Path $stagePath) { Remove-Item $stagePath -Recurse -Force }
    New-Item -ItemType Directory -Path $stagePath -Force | Out-Null

    foreach ($item in $include) {
        $source = Join-Path $root $item
        if (-not (Test-Path $source)) {
            throw "Expected package item not found: $item"
        }
        Copy-Item $source -Destination $stagePath -Recurse -Force
        Write-Host "    + $item"
    }

    $zipName = "d365-env-comparison-$($manifest.version).zip"
    $zipPath = Join-Path $distPath $zipName
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

    Write-Host '==> Creating zip' -ForegroundColor Cyan
    Compress-Archive -Path (Join-Path $stagePath '*') -DestinationPath $zipPath -Force

    $zipInfo = Get-Item $zipPath
    $fileCount = (Get-ChildItem $stagePath -Recurse -File).Count

    Write-Host ''
    Write-Host 'Package ready' -ForegroundColor Green
    Write-Host "    path  : $($zipInfo.FullName)"
    Write-Host "    size  : $([math]::Round($zipInfo.Length / 1KB, 1)) KB"
    Write-Host "    files : $fileCount"
    Write-Host ''
    Write-Host 'Upload this zip at https://chrome.google.com/webstore/devconsole'
}
finally {
    Pop-Location
}
