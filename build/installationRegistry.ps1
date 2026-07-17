[CmdletBinding()]
param(
  [ValidateSet('prepare', 'installed', 'uninstalled', 'rollback')]
  [string]$Action = $env:SPELLBOOK_INSTALL_ACTION,
  [ValidateSet('HKCU', 'HKLM')]
  [string]$RegistryRoot = $env:SPELLBOOK_INSTALL_ROOT,
  [string]$InstallKeyPath = $env:SPELLBOOK_INSTALL_KEY,
  [string]$UninstallKeyPath = $env:SPELLBOOK_UNINSTALL_KEY,
  [string]$InstancesKeyPath = $env:SPELLBOOK_INSTANCES_KEY,
  [string]$InstallPath = $env:SPELLBOOK_INSTALL_PATH
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

foreach ($value in @(
  $Action,
  $RegistryRoot,
  $InstallKeyPath,
  $UninstallKeyPath,
  $InstancesKeyPath,
  $InstallPath
)) {
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw 'Installation registry operation is missing a required value.'
  }
}

$rootKey = if ($RegistryRoot -eq 'HKLM') {
  [Microsoft.Win32.Registry]::LocalMachine
} else {
  [Microsoft.Win32.Registry]::CurrentUser
}

function Get-NormalizedPath {
  param([Parameter(Mandatory = $true)][string]$Path)

  return [IO.Path]::GetFullPath($Path).TrimEnd(
    [IO.Path]::DirectorySeparatorChar,
    [IO.Path]::AltDirectorySeparatorChar
  )
}

function Get-InstanceId {
  param([Parameter(Mandatory = $true)][string]$Path)

  $normalized = (Get-NormalizedPath $Path).ToUpperInvariant()
  $bytes = [Text.Encoding]::UTF8.GetBytes($normalized)
  $sha256 = [Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($sha256.ComputeHash($bytes))).Replace('-', '')
  } finally {
    $sha256.Dispose()
  }
}

function Remove-RegistryTree {
  param([Parameter(Mandatory = $true)][string]$Path)

  try {
    $rootKey.DeleteSubKeyTree($Path, $false)
  } catch [ArgumentException] {
    # Missing keys are already in the required state.
  }
}

function Read-RegistryValues {
  param([Parameter(Mandatory = $true)][string]$Path)

  $key = $rootKey.OpenSubKey($Path, $false)
  if ($null -eq $key) {
    return @()
  }

  try {
    $values = @()
    foreach ($name in $key.GetValueNames()) {
      $kind = $key.GetValueKind($name)
      $value = $key.GetValue(
        $name,
        $null,
        [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames
      )
      if ($kind -eq [Microsoft.Win32.RegistryValueKind]::Binary) {
        $value = [Convert]::ToBase64String([byte[]]$value)
      } elseif ($kind -eq [Microsoft.Win32.RegistryValueKind]::MultiString) {
        $value = @([string[]]$value)
      }
      $values += [pscustomobject]@{
        name = $name
        kind = $kind.ToString()
        value = $value
      }
    }
    return $values
  } finally {
    $key.Dispose()
  }
}

function Write-RegistryValues {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][object[]]$Values
  )

  Remove-RegistryTree $Path
  $flatValues = @($Values | ForEach-Object { $_ })
  $key = $rootKey.CreateSubKey($Path)
  try {
    foreach ($entry in $flatValues) {
      $kind = [Microsoft.Win32.RegistryValueKind]([Enum]::Parse(
        [Microsoft.Win32.RegistryValueKind],
        [string]$entry.kind
      ))
      $value = $entry.value
      if ($kind -eq [Microsoft.Win32.RegistryValueKind]::Binary) {
        $value = [Convert]::FromBase64String([string]$value)
      } elseif ($kind -eq [Microsoft.Win32.RegistryValueKind]::MultiString) {
        $value = [string[]]@($value)
      } elseif ($kind -eq [Microsoft.Win32.RegistryValueKind]::DWord) {
        $value = [int]$value
      } elseif ($kind -eq [Microsoft.Win32.RegistryValueKind]::QWord) {
        $value = [long]$value
      } else {
        $value = [string]$value
      }
      $key.SetValue([string]$entry.name, $value, $kind)
    }
  } finally {
    $key.Dispose()
  }
}

function Get-ActiveInstallLocation {
  $key = $rootKey.OpenSubKey($InstallKeyPath, $false)
  if ($null -eq $key) {
    return $null
  }
  try {
    return $key.GetValue('InstallLocation', $null)
  } finally {
    $key.Dispose()
  }
}

function Save-ActiveRegistration {
  $location = Get-ActiveInstallLocation
  if ([string]::IsNullOrWhiteSpace([string]$location)) {
    return
  }

  $normalized = Get-NormalizedPath ([string]$location)
  if (-not (Test-Path -LiteralPath $normalized -PathType Container)) {
    return
  }

  $installValues = @(Read-RegistryValues $InstallKeyPath)
  $uninstallValues = @(Read-RegistryValues $UninstallKeyPath)
  if ($installValues.Count -eq 0 -or $uninstallValues.Count -eq 0) {
    return
  }

  $instanceKeyPath = "$InstancesKeyPath\$(Get-InstanceId $normalized)"
  $instanceKey = $rootKey.CreateSubKey($instanceKeyPath)
  try {
    $instanceKey.SetValue(
      'InstallLocation',
      $normalized,
      [Microsoft.Win32.RegistryValueKind]::String
    )
    $instanceKey.SetValue(
      'InstallValues',
      (ConvertTo-Json -InputObject $installValues -Compress -Depth 8),
      [Microsoft.Win32.RegistryValueKind]::String
    )
    $instanceKey.SetValue(
      'UninstallValues',
      (ConvertTo-Json -InputObject $uninstallValues -Compress -Depth 8),
      [Microsoft.Win32.RegistryValueKind]::String
    )
    $instanceKey.SetValue(
      'UpdatedAt',
      [DateTime]::UtcNow.Ticks,
      [Microsoft.Win32.RegistryValueKind]::QWord
    )
  } finally {
    $instanceKey.Dispose()
  }
}

function Get-InstanceRecords {
  $instancesKey = $rootKey.OpenSubKey($InstancesKeyPath, $false)
  if ($null -eq $instancesKey) {
    return @()
  }

  try {
    $records = @()
    foreach ($name in $instancesKey.GetSubKeyNames()) {
      $instanceKey = $instancesKey.OpenSubKey($name, $false)
      if ($null -eq $instanceKey) {
        continue
      }
      try {
        $location = [string]$instanceKey.GetValue('InstallLocation', '')
        $records += [pscustomobject]@{
          id = $name
          keyPath = "$InstancesKeyPath\$name"
          installLocation = $location
          installValues = [string]$instanceKey.GetValue('InstallValues', '[]')
          uninstallValues = [string]$instanceKey.GetValue('UninstallValues', '[]')
          updatedAt = [long]$instanceKey.GetValue('UpdatedAt', 0)
        }
      } finally {
        $instanceKey.Dispose()
      }
    }
    return $records
  } finally {
    $instancesKey.Dispose()
  }
}

function Remove-StaleInstances {
  foreach ($record in @(Get-InstanceRecords)) {
    if (
      [string]::IsNullOrWhiteSpace($record.installLocation) -or
      -not (Test-Path -LiteralPath $record.installLocation -PathType Container)
    ) {
      Remove-RegistryTree $record.keyPath
    }
  }
}

function Restore-Registration {
  param([Parameter(Mandatory = $true)]$Record)

  $installValues = @($Record.installValues | ConvertFrom-Json)
  $uninstallValues = @($Record.uninstallValues | ConvertFrom-Json)
  if ($installValues.Count -eq 0 -or $uninstallValues.Count -eq 0) {
    throw "Installation record '$($Record.id)' is incomplete."
  }
  Write-RegistryValues $InstallKeyPath $installValues
  Write-RegistryValues $UninstallKeyPath $uninstallValues
}

$normalizedInstallPath = Get-NormalizedPath $InstallPath

if ($Action -eq 'prepare') {
  Save-ActiveRegistration
  Remove-StaleInstances
  $targetId = Get-InstanceId $normalizedInstallPath
  $target = @(Get-InstanceRecords | Where-Object { $_.id -eq $targetId }) |
    Select-Object -First 1
  if ($null -ne $target) {
    Restore-Registration $target
  } else {
    Remove-RegistryTree $InstallKeyPath
    Remove-RegistryTree $UninstallKeyPath
  }
  return
}

if ($Action -eq 'installed') {
  $activeLocation = Get-ActiveInstallLocation
  if (
    [string]::IsNullOrWhiteSpace([string]$activeLocation) -or
    -not [string]::Equals(
      (Get-NormalizedPath ([string]$activeLocation)),
      $normalizedInstallPath,
      [StringComparison]::OrdinalIgnoreCase
    )
  ) {
    throw 'The installer did not register the selected installation directory.'
  }
  Save-ActiveRegistration
  Remove-StaleInstances
  return
}

if ($Action -eq 'rollback') {
  Remove-StaleInstances
  $survivor = @(Get-InstanceRecords | Sort-Object updatedAt -Descending) |
    Select-Object -First 1
  if ($null -ne $survivor) {
    Restore-Registration $survivor
  } else {
    Remove-RegistryTree $InstallKeyPath
    Remove-RegistryTree $UninstallKeyPath
    Remove-RegistryTree $InstancesKeyPath
  }
  return
}

Remove-RegistryTree "$InstancesKeyPath\$(Get-InstanceId $normalizedInstallPath)"
Remove-StaleInstances
$survivor = @(Get-InstanceRecords | Sort-Object updatedAt -Descending) |
  Select-Object -First 1
if ($null -ne $survivor) {
  Restore-Registration $survivor
} else {
  Remove-RegistryTree $InstallKeyPath
  Remove-RegistryTree $UninstallKeyPath
  Remove-RegistryTree $InstancesKeyPath
}
