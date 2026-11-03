# Self-contained at staging: never executes code from installed/user-writable paths.
__CORE__
try {
    $config = [pscustomobject]@{
        extensionId = '__EXTENSION_ID__'; version = '__VERSION__'
        tenantId = 'd9ef70ce-45e1-4de9-9547-4a1fa301bf70'
        updateUrl = 'https://github.com/Nassau-1/gesner/releases/download/mci-channel/gesner-mci-updates.xml'
    }
    Assert-GesnerConfig $config
    $entry = $config.extensionId + ';' + $config.updateUrl
    foreach ($browser in Get-GesnerBrowsers) {
        $values = Get-GesnerValues ((Get-GesnerPolicyBase) + $browser.Policy + '\ExtensionInstallForcelist')
        if (-not (@($values.Values) -ccontains $entry)) { exit 1 }
    }
    if (@(Get-GesnerDeviceInstalledProfiles $config).Count -eq 0) { exit 1 }
    Write-Output ('Gesner ' + $config.version + ' configured for the device and enabled in at least one registered user profile.')
    exit 0
} catch { exit 1 }
