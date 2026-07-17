[CmdletBinding()]
param(
  [ValidateSet('prepare', 'installed', 'validate-uninstall', 'uninstalled', 'rollback')]
  [string]$Action = $env:SPELLBOOK_INSTALL_ACTION,
  [ValidateSet('HKCU', 'HKLM')]
  [string]$RegistryRoot = $env:SPELLBOOK_INSTALL_ROOT,
  [string]$InstallKeyPath = $env:SPELLBOOK_INSTALL_KEY,
  [string]$UninstallKeyPath = $env:SPELLBOOK_UNINSTALL_KEY,
  [string]$InstancesKeyPath = $env:SPELLBOOK_INSTANCES_KEY,
  [string]$InstallPath = $env:SPELLBOOK_INSTALL_PATH,
  [string]$InstalledExecutablePath = $env:SPELLBOOK_INSTALL_EXECUTABLE,
  [string]$UninstallerPath = $env:SPELLBOOK_INSTALL_UNINSTALLER
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
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$Values
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

function Get-RegistrySnapshot {
  param([Parameter(Mandatory = $true)][string]$Path)

  $key = $rootKey.OpenSubKey($Path, $false)
  if ($null -eq $key) {
    return [pscustomobject]@{
      exists = $false
      values = @()
    }
  }
  $key.Dispose()
  return [pscustomobject]@{
    exists = $true
    values = @(Read-RegistryValues $Path)
  }
}

function Restore-RegistrySnapshot {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)]$Snapshot
  )

  if (-not $Snapshot.exists) {
    Remove-RegistryTree $Path
    return
  }
  Write-RegistryValues $Path @($Snapshot.values)
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
    return $false
  }

  $normalized = Get-NormalizedPath ([string]$location)
  if (-not (Test-Path -LiteralPath $normalized -PathType Container)) {
    throw "The active installation directory '$normalized' is unavailable."
  }

  $installValues = @(Read-RegistryValues $InstallKeyPath)
  $uninstallValues = @(Read-RegistryValues $UninstallKeyPath)
  $uninstallString = @(
    $uninstallValues |
      Where-Object { $_.name -eq 'UninstallString' } |
      Select-Object -First 1
  )
  if (
    $installValues.Count -eq 0 -or
    $uninstallValues.Count -eq 0 -or
    $uninstallString.Count -eq 0 -or
    [string]::IsNullOrWhiteSpace([string]$uninstallString[0].value)
  ) {
    throw "The active installation registration for '$normalized' is incomplete."
  }

  $instanceKeyPath = "$InstancesKeyPath\$(Get-InstanceId $normalized)"
  $previousInstance = Get-RegistrySnapshot $instanceKeyPath
  $instanceValues = @(
    [pscustomobject]@{
      name = 'InstallLocation'
      kind = 'String'
      value = $normalized
    },
    [pscustomobject]@{
      name = 'InstallValues'
      kind = 'String'
      value = (ConvertTo-Json -InputObject $installValues -Compress -Depth 8)
    },
    [pscustomobject]@{
      name = 'UninstallValues'
      kind = 'String'
      value = (ConvertTo-Json -InputObject $uninstallValues -Compress -Depth 8)
    },
    [pscustomobject]@{
      name = 'UpdatedAt'
      kind = 'QWord'
      value = [DateTime]::UtcNow.Ticks
    }
  )
  try {
    Write-RegistryValues $instanceKeyPath $instanceValues
  } catch {
    $writeFailure = $_
    try {
      Restore-RegistrySnapshot $instanceKeyPath $previousInstance
    } catch {
      throw "Saving the active installation failed and its previous instance snapshot could not be restored: $($writeFailure.Exception.Message); rollback: $($_.Exception.Message)"
    }
    throw $writeFailure
  }
  return $true
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

function Restore-LatestRegistration {
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
}

function Assert-InstalledArtifacts {
  foreach ($requiredValue in @($InstalledExecutablePath, $UninstallerPath)) {
    if ([string]::IsNullOrWhiteSpace($requiredValue)) {
      throw 'The installed action is missing an expected artifact path.'
    }
  }

  $normalizedExecutablePath = Get-NormalizedPath $InstalledExecutablePath
  $normalizedUninstallerPath = Get-NormalizedPath $UninstallerPath
  foreach ($artifactPath in @($normalizedExecutablePath, $normalizedUninstallerPath)) {
    if (
      -not [string]::Equals(
        [IO.Path]::GetDirectoryName($artifactPath),
        $normalizedInstallPath,
        [StringComparison]::OrdinalIgnoreCase
      )
    ) {
      throw "Expected installed artifact '$artifactPath' is outside the selected directory."
    }
  }

  if (-not (Test-Path -LiteralPath $normalizedInstallPath -PathType Container)) {
    throw "The selected installation directory '$normalizedInstallPath' was not created."
  }
  $installDirectory = Get-Item -LiteralPath $normalizedInstallPath -Force
  if (
    -not ($installDirectory -is [IO.DirectoryInfo]) -or
    ($installDirectory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
  ) {
    throw "The selected installation directory '$normalizedInstallPath' is not a real directory."
  }
  if (-not (Test-Path -LiteralPath $normalizedExecutablePath -PathType Leaf)) {
    throw "The installed application executable '$normalizedExecutablePath' is missing."
  }
  if (-not (Test-Path -LiteralPath $normalizedUninstallerPath -PathType Leaf)) {
    throw "The installed uninstaller '$normalizedUninstallerPath' is missing."
  }
  foreach ($artifactPath in @($normalizedExecutablePath, $normalizedUninstallerPath)) {
    $artifact = Get-Item -LiteralPath $artifactPath -Force
    if (
      -not ($artifact -is [IO.FileInfo]) -or
      ($artifact.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
    ) {
      throw "Expected installed artifact '$artifactPath' is not a real file."
    }
  }
}

function Get-UninstallCommandExecutablePath {
  param(
    [Parameter(Mandatory = $true)][string]$CommandLine,
    [Parameter(Mandatory = $true)][string]$ExpectedPath
  )

  $command = $CommandLine.Trim()
  if ([string]::IsNullOrWhiteSpace($command)) {
    throw 'The registered uninstall command is empty.'
  }

  if ($command.StartsWith('"')) {
    $closingQuote = $command.IndexOf('"', 1)
    if ($closingQuote -le 1) {
      throw 'The registered uninstall command is malformed.'
    }
    if (
      $command.Length -gt ($closingQuote + 1) -and
      -not [char]::IsWhiteSpace($command[$closingQuote + 1])
    ) {
      throw 'The registered uninstall command is malformed.'
    }
    return Get-NormalizedPath $command.Substring(1, $closingQuote - 1)
  }

  if ($command.Length -lt $ExpectedPath.Length) {
    throw 'The registered uninstall command does not target the expected uninstaller.'
  }
  $pathPrefix = $command.Substring(0, $ExpectedPath.Length)
  if (
    -not [string]::Equals(
      $pathPrefix,
      $ExpectedPath,
      [StringComparison]::OrdinalIgnoreCase
    ) -or
    (
      $command.Length -gt $ExpectedPath.Length -and
      -not [char]::IsWhiteSpace($command[$ExpectedPath.Length])
    )
  ) {
    throw 'The registered uninstall command does not target the expected uninstaller.'
  }
  return Get-NormalizedPath $pathPrefix
}

function Assert-RegisteredUninstallTarget {
  $target = @(
    Get-InstanceRecords |
      Where-Object { $_.id -eq $targetId }
  ) | Select-Object -First 1
  if ($null -eq $target) {
    throw "The uninstall directory '$normalizedInstallPath' is not a registered Spellbook instance."
  }

  $registeredInstallPath = Get-NormalizedPath $target.installLocation
  if (
    -not [string]::Equals(
      $registeredInstallPath,
      $normalizedInstallPath,
      [StringComparison]::OrdinalIgnoreCase
    )
  ) {
    throw "The registered Spellbook instance does not match '$normalizedInstallPath'."
  }

  $parsedUninstallValues = $target.uninstallValues | ConvertFrom-Json
  $uninstallStringValue = $null
  foreach ($entry in $parsedUninstallValues) {
    if (
      [string]::Equals(
        [string]($entry.name),
        'UninstallString',
        [StringComparison]::OrdinalIgnoreCase
      )
    ) {
      $uninstallStringValue = [string]($entry.value)
      break
    }
  }
  if ([string]::IsNullOrWhiteSpace($uninstallStringValue)) {
    throw "The registered Spellbook instance for '$normalizedInstallPath' has no uninstall command."
  }

  $expectedUninstallerPath = Get-NormalizedPath $UninstallerPath
  $registeredUninstallerPath = Get-UninstallCommandExecutablePath `
    $uninstallStringValue `
    $expectedUninstallerPath
  if (
    -not [string]::Equals(
      $registeredUninstallerPath,
      $expectedUninstallerPath,
      [StringComparison]::OrdinalIgnoreCase
    )
  ) {
    throw "The registered uninstall command does not point to '$expectedUninstallerPath'."
  }

  Assert-InstalledArtifacts
}

$normalizedInstallPath = Get-NormalizedPath $InstallPath
$targetId = Get-InstanceId $normalizedInstallPath

if ($Action -eq 'validate-uninstall') {
  Assert-RegisteredUninstallTarget
  return
}

if ($Action -eq 'prepare') {
  $originalInstall = Get-RegistrySnapshot $InstallKeyPath
  $originalUninstall = Get-RegistrySnapshot $UninstallKeyPath
  $restoringTarget = $false
  try {
    Save-ActiveRegistration | Out-Null
    Remove-StaleInstances
    $target = @(Get-InstanceRecords | Where-Object { $_.id -eq $targetId }) |
      Select-Object -First 1
    if ($null -ne $target) {
      $restoringTarget = $true
      Restore-Registration $target
      $restoringTarget = $false
    } else {
      Remove-RegistryTree $InstallKeyPath
      Remove-RegistryTree $UninstallKeyPath
    }
  } catch {
    $prepareFailure = $_
    if ($restoringTarget) {
      Remove-RegistryTree "$InstancesKeyPath\$targetId"
    }
    $restoreErrors = @()
    try {
      Restore-RegistrySnapshot $InstallKeyPath $originalInstall
    } catch {
      $restoreErrors += $_.Exception.Message
    }
    try {
      Restore-RegistrySnapshot $UninstallKeyPath $originalUninstall
    } catch {
      $restoreErrors += $_.Exception.Message
    }
    if ($restoreErrors.Count -gt 0) {
      throw "Preparing the installation failed and the original registration could not be fully restored: $($prepareFailure.Exception.Message); rollback: $($restoreErrors -join '; ')"
    }
    throw $prepareFailure
  }
  return
}

if ($Action -eq 'installed') {
  $targetInstancePath = "$InstancesKeyPath\$targetId"
  $targetInstanceBeforeInstall = Get-RegistrySnapshot $targetInstancePath
  try {
    Assert-InstalledArtifacts
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
    Save-ActiveRegistration | Out-Null
    Remove-StaleInstances
  } catch {
    $installFailure = $_
    try {
      if ($targetInstanceBeforeInstall.exists) {
        Restore-RegistrySnapshot $targetInstancePath $targetInstanceBeforeInstall
      } else {
        Remove-RegistryTree $targetInstancePath
      }
      Restore-LatestRegistration
    } catch {
      throw "Validating the installation failed and the previous registration could not be restored: $($installFailure.Exception.Message); rollback: $($_.Exception.Message)"
    }
    throw $installFailure
  }
  return
}

if ($Action -eq 'rollback') {
  Restore-LatestRegistration
  return
}

Remove-RegistryTree "$InstancesKeyPath\$targetId"
Restore-LatestRegistration
