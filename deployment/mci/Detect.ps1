# Generated package replaces __EXTENSION_ID__ / __VERSION__; no marker-only success.
try {
    . (Join-Path $env:LOCALAPPDATA 'Gesner-MCI\Core.ps1')
    $config = Get-Content -LiteralPath (Join-Path $env:LOCALAPPDATA 'Gesner-MCI\config.json') -Raw | ConvertFrom-Json
    Assert-GesnerConfig $config
    if ($config.extensionId -ne '__EXTENSION_ID__' -or [version]$config.version -lt [version]'__VERSION__') { exit 1 }
    $entry = $config.extensionId + ';' + $config.updateUrl
    foreach ($browser in Get-GesnerBrowsers) {
        $values = Get-GesnerValues ('HKCU:\Software\Policies\' + $browser.Policy + '\ExtensionInstallForcelist')
        if (-not (@($values.Values) -contains $entry)) { exit 1 }
    }
    if (@(Get-GesnerInstalledProfiles $config).Count -eq 0) { exit 1 }
    Write-Output ('Gesner ' + $config.version + ' configured in four browsers and enabled in at least one profile.')
    exit 0
} catch { exit 1 }
