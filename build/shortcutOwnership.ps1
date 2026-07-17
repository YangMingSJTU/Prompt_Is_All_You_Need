[CmdletBinding()]
param(
  [ValidateSet('install', 'uninstall')]
  [string]$Action = $env:SPELLBOOK_SHORTCUT_ACTION,
  [string]$ShortcutPath = $env:SPELLBOOK_SHORTCUT_PATH,
  [string]$TargetPath = $env:SPELLBOOK_SHORTCUT_TARGET,
  [string]$MarkerPath = $env:SPELLBOOK_SHORTCUT_MARKER,
  [string]$Requested = $env:SPELLBOOK_SHORTCUT_REQUESTED
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

foreach ($value in @($Action, $ShortcutPath, $TargetPath, $MarkerPath)) {
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw 'Shortcut ownership operation is missing a required value.'
  }
}

function Get-NormalizedPath {
  param([Parameter(Mandatory = $true)][string]$Path)

  return [IO.Path]::GetFullPath($Path).TrimEnd(
    [IO.Path]::DirectorySeparatorChar,
    [IO.Path]::AltDirectorySeparatorChar
  )
}

function Test-SamePath {
  param(
    [Parameter(Mandatory = $true)][string]$Left,
    [Parameter(Mandatory = $true)][string]$Right
  )

  return [string]::Equals(
    (Get-NormalizedPath $Left),
    (Get-NormalizedPath $Right),
    [StringComparison]::OrdinalIgnoreCase
  )
}

function Get-ShortcutTarget {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return $null
  }
  $shell = New-Object -ComObject WScript.Shell
  return $shell.CreateShortcut($Path).TargetPath
}

function Write-OwnershipMarker {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Shortcut,
    [Parameter(Mandatory = $true)][string]$Target
  )

  $marker = @{
    shortcutPath = Get-NormalizedPath $Shortcut
    targetPath = Get-NormalizedPath $Target
  } | ConvertTo-Json -Compress
  $temporaryPath = "$Path.tmp-$PID-$([Guid]::NewGuid().ToString('N'))"
  try {
    [IO.File]::WriteAllText($temporaryPath, $marker, (New-Object Text.UTF8Encoding $false))
    Move-Item -LiteralPath $temporaryPath -Destination $Path -Force
  } finally {
    Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
  }
}

$normalizedTarget = Get-NormalizedPath $TargetPath
$normalizedShortcut = Get-NormalizedPath $ShortcutPath

if ($Action -eq 'install') {
  if (-not [string]::Equals($Requested, 'true', [StringComparison]::OrdinalIgnoreCase)) {
    return
  }

  if (Test-Path -LiteralPath $ShortcutPath -PathType Leaf) {
    if (Test-Path -LiteralPath $MarkerPath -PathType Leaf) {
      try {
        $marker = Get-Content -LiteralPath $MarkerPath -Raw | ConvertFrom-Json
        $currentTarget = Get-ShortcutTarget $ShortcutPath
        if (
          $null -ne $currentTarget -and
          (Test-SamePath $marker.shortcutPath $normalizedShortcut) -and
          (Test-SamePath $marker.targetPath $normalizedTarget) -and
          (Test-SamePath $currentTarget $normalizedTarget)
        ) {
          return
        }
      } catch {
        # A stale or malformed marker never grants ownership of an existing shortcut.
      }
      Remove-Item -LiteralPath $MarkerPath -Force -ErrorAction SilentlyContinue
    }
    return
  }

  New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($ShortcutPath)) -Force | Out-Null
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  $shortcut.TargetPath = $TargetPath
  $shortcut.WorkingDirectory = [IO.Path]::GetDirectoryName($TargetPath)
  $shortcut.IconLocation = "$TargetPath,0"
  $shortcut.Description = 'Spellbook'
  $shortcut.Save()

  $createdTarget = Get-ShortcutTarget $ShortcutPath
  if ($null -eq $createdTarget -or -not (Test-SamePath $createdTarget $normalizedTarget)) {
    throw 'The shortcut was not created with the expected target.'
  }
  Write-OwnershipMarker $MarkerPath $normalizedShortcut $normalizedTarget
  return
}

if (-not (Test-Path -LiteralPath $MarkerPath -PathType Leaf)) {
  return
}

try {
  $marker = Get-Content -LiteralPath $MarkerPath -Raw | ConvertFrom-Json
  $currentTarget = Get-ShortcutTarget $ShortcutPath
  if (
    $null -ne $currentTarget -and
    (Test-SamePath $marker.shortcutPath $normalizedShortcut) -and
    (Test-SamePath $marker.targetPath $normalizedTarget) -and
    (Test-SamePath $currentTarget $normalizedTarget)
  ) {
    Remove-Item -LiteralPath $ShortcutPath -Force
  }
} finally {
  Remove-Item -LiteralPath $MarkerPath -Force -ErrorAction SilentlyContinue
}
