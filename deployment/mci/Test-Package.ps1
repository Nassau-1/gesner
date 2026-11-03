# Pure planning and synthetic browser-profile tests. No production registry writes.
. (Join-Path $PSScriptRoot 'Core.ps1')
$passed = 0
function Assert($Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
    $script:passed++
}
function Assert-Throws([scriptblock]$Action, [string]$Message) {
    $failed = $false
    try { & $Action } catch { $failed = $true }
    Assert $failed $Message
}
$config = [pscustomobject]@{
    extensionId = 'abcdefghijklmnopabcdefghijklmnop'
    version = '1.0.1'
    tenantId = 'd9ef70ce-45e1-4de9-9547-4a1fa301bf70'
    updateUrl = 'https://github.com/Nassau-1/gesner/releases/download/mci-channel/gesner-mci-updates.xml'
}
Assert-GesnerConfig $config
$entry = $config.extensionId + ';' + $config.updateUrl
$slot = Get-GesnerSlot @{ '1' = 'another-extension'; '3' = 'also-preserve' } $entry $config.extensionId
Assert ($slot.Name -eq '2' -and $slot.Add) 'Must preserve other extensions and use a free numeric slot.'
$slot = Get-GesnerSlot @{ '5' = $entry } $entry $config.extensionId
Assert ($slot.Name -eq '5' -and -not $slot.Add) 'Repeated install must be idempotent.'
Assert-Throws { Get-GesnerSlot @{ '1' = ($config.extensionId + ';https://elsewhere.invalid') } $entry $config.extensionId } 'Conflicting Gesner channel must fail.'
$bad = $config | Select-Object *; $bad.extensionId = '../unsafe'
Assert-Throws { Assert-GesnerConfig $bad } 'Reject invalid identity.'
$bad = $config | Select-Object *; $bad.updateUrl = 'http://elsewhere.invalid'
Assert-Throws { Assert-GesnerConfig $bad } 'Reject different update channel.'
Assert (@(Get-GesnerBrowsers).Count -eq 4) 'Exactly four supported roots.'
Assert (@(Get-GesnerBrowsers | Where-Object Name -eq 'Vivaldi').Count -eq 1) 'Vivaldi must have its own policy root.'
Assert (@(Get-GesnerBrowsers | Where-Object Name -eq 'Edge').Count -eq 0) 'Entra-only Edge self-hosting is unsupported.'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('gesner-profile-test-' + [guid]::NewGuid().ToString())
try {
    New-Item -ItemType Directory -Path $testRoot | Out-Null
    Assert (@(Get-GesnerInstalledProfiles $config $testRoot).Count -eq 0) 'No browser profile is not installed.'
    $profile = Join-Path $testRoot 'Vivaldi\User Data\Default'
    $version = Join-Path $profile ('Extensions\' + $config.extensionId + '\1.0.1_0')
    New-Item -ItemType Directory -Path $version -Force | Out-Null
    @{ name = 'Gesner'; version = '1.0.1' } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $version 'manifest.json')
    Assert (@(Get-GesnerInstalledProfiles $config $testRoot).Count -eq 0) 'Leftover files do not prove enabled installation.'
    $settings = @{}; $settings[$config.extensionId] = @{ state = 1 }
    @{ extensions = @{ settings = $settings } } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $profile 'Secure Preferences')
    Assert (@(Get-GesnerInstalledProfiles $config $testRoot).Count -eq 1) 'Enabled Vivaldi profile should be detected.'
    $settings[$config.extensionId].state = 0
    @{ extensions = @{ settings = $settings } } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $profile 'Secure Preferences')
    Assert (@(Get-GesnerInstalledProfiles $config $testRoot).Count -eq 0) 'Disabled extension is not installed successfully.'
    $settings[$config.extensionId].state = 1
    @{ extensions = @{ settings = $settings } } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $profile 'Secure Preferences')
    @{ name = 'Gesner'; version = '1.0.0' } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $version 'manifest.json')
    Assert (@(Get-GesnerInstalledProfiles $config $testRoot).Count -eq 0) 'Old version must not satisfy new package detection.'
    @{ name = 'Gesner'; version = '1.0.1' } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $version 'manifest.json')
    # Modern Chromium no longer persists state=1. Require its registered manifest,
    # and continue rejecting every disable/blocklist signal and uninstall record.
    $modern = @{ manifest = @{ name = 'Gesner'; version = '1.0.1' }; path = ($config.extensionId + '\1.0.1_0'); disable_reasons = @() }
    $settings[$config.extensionId] = $modern
    function Save-Profile { @{ extensions = @{ settings = $settings } } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $profile 'Secure Preferences') }
    Save-Profile
    Assert (@(Get-GesnerInstalledProfiles $config $testRoot).Count -eq 1) 'Modern enabled profile without legacy state must be detected.'
    $modern.Remove('disable_reasons'); Save-Profile
    Assert (@(Get-GesnerInstalledProfiles $config $testRoot).Count -eq 1) 'Missing modern disable reasons means no disable reasons when registration is valid.'
    $modern.disable_reasons = 0; Save-Profile
    Assert (@(Get-GesnerInstalledProfiles $config $testRoot).Count -eq 1) 'Legacy zero disable bitmap remains supported.'
    foreach ($reasons in @(4, @(1), @(999999), 'invalid', $null)) {
        $modern.disable_reasons = $reasons; Save-Profile
        Assert (@(Get-GesnerInstalledProfiles $config $testRoot).Count -eq 0) 'Disabled, unknown or malformed disable reasons must not be detected.'
    }
    $modern.disable_reasons = @()
    foreach ($field in @('blacklist_state', 'omaha_blocklist_state', 'extension_telemetry_service_blocklist_state', 'blacklist')) {
        $modern[$field] = 1; Save-Profile
        Assert (@(Get-GesnerInstalledProfiles $config $testRoot).Count -eq 0) 'Blocklist indicators must prevent success.'
        $modern.Remove($field)
    }
    $modern.state = 0; Save-Profile
    Assert (@(Get-GesnerInstalledProfiles $config $testRoot).Count -eq 0) 'Explicit legacy disabled state must override empty modern reasons.'
    $modern.state = 1; $modern.disable_reasons = @(4); Save-Profile
    Assert (@(Get-GesnerInstalledProfiles $config $testRoot).Count -eq 0) 'Modern disable reason must override legacy enabled state.'
    $modern.Remove('state'); $modern.disable_reasons = @(); $modern.manifest.version = '1.0.0'; Save-Profile
    Assert (@(Get-GesnerInstalledProfiles $config $testRoot).Count -eq 0) 'Stale modern registration must not pass based on leftover versioned files.'
    $modern.manifest.version = '1.0.1'
    @{ extensions = @{ settings = $settings; external_uninstalls = @($config.extensionId) } } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $profile 'Secure Preferences')
    Assert (@(Get-GesnerInstalledProfiles $config $testRoot).Count -eq 0) 'An externally uninstalled identity must not pass detection.'
    $settings[$config.extensionId] = @{}; Save-Profile
    Assert (@(Get-GesnerInstalledProfiles $config $testRoot).Count -eq 0) 'An empty settings entry and leftover files are not registration.'
} finally {
    $resolved = [IO.Path]::GetFullPath($testRoot)
    $temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if (-not $resolved.StartsWith($temp, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notlike 'gesner-profile-test-*') { throw 'Unsafe test cleanup path.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
Write-Output "$passed packaging checks passed. No production registry or browser profile changed."
