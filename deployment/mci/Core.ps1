Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-GesnerBrowsers {
    @(
        [pscustomobject]@{ Name = 'Vivaldi'; Policy = 'Vivaldi'; Data = 'Vivaldi\User Data' }
        [pscustomobject]@{ Name = 'Chrome'; Policy = 'Google\Chrome'; Data = 'Google\Chrome\User Data' }
        [pscustomobject]@{ Name = 'Brave'; Policy = 'BraveSoftware\Brave'; Data = 'BraveSoftware\Brave-Browser\User Data' }
        [pscustomobject]@{ Name = 'Chromium'; Policy = 'Chromium'; Data = 'Chromium\User Data' }
    )
}

function Assert-GesnerConfig($Config) {
    if ($Config.extensionId -cnotmatch '^[a-p]{32}$') { throw 'Invalid extension identity.' }
    if ($Config.version -notmatch '^\d+\.\d+\.\d+(\.\d+)?$') { throw 'Invalid version.' }
    if ($Config.tenantId -ne 'd9ef70ce-45e1-4de9-9547-4a1fa301bf70') { throw 'Unexpected tenant.' }
    if ($Config.updateUrl -ne 'https://github.com/Nassau-1/gesner/releases/download/mci-channel/gesner-mci-updates.xml') { throw 'Unexpected update channel.' }
}

function Get-GesnerSlot($Values, [string]$Entry, [string]$Id) {
    foreach ($name in $Values.Keys) {
        if ([string]$Values[$name] -eq $Entry) { return [pscustomobject]@{ Name = [string]$name; Add = $false } }
        if (([string]$Values[$name]).Split(';')[0] -eq $Id) { throw 'Gesner already has a different deployment channel; resolve the conflict first.' }
    }
    $index = 1
    while ($Values.ContainsKey([string]$index)) { $index++ }
    [pscustomobject]@{ Name = [string]$index; Add = $true }
}

function Get-GesnerValues([string]$Key) {
    $values = @{}
    if (Test-Path -LiteralPath $Key) {
        $item = Get-Item -LiteralPath $Key
        foreach ($name in $item.GetValueNames()) { $values[$name] = $item.GetValue($name) }
    }
    return ,$values
}

function Get-GesnerInstalledProfiles($Config, [string]$LocalData = $env:LOCALAPPDATA) {
    foreach ($browser in Get-GesnerBrowsers) {
        $data = Join-Path $LocalData $browser.Data
        if (-not (Test-Path -LiteralPath $data)) { continue }
        foreach ($profile in Get-ChildItem -LiteralPath $data -Directory) {
            $extension = Join-Path $profile.FullName ('Extensions\' + $Config.extensionId)
            if (-not (Test-Path -LiteralPath $extension)) { continue }
            foreach ($version in Get-ChildItem -LiteralPath $extension -Directory) {
                $manifestPath = Join-Path $version.FullName 'manifest.json'
                if (-not (Test-Path -LiteralPath $manifestPath)) { continue }
                try {
                    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
                    if ($manifest.name -ne 'Gesner' -or [version]$manifest.version -lt [version]$Config.version) { continue }
                    # Disk files alone can be left behind after disable/uninstall. Require enabled profile state too.
                    $enabled = $false
                    foreach ($preference in @('Secure Preferences', 'Preferences')) {
                        $preferencesPath = Join-Path $profile.FullName $preference
                        if (-not (Test-Path -LiteralPath $preferencesPath)) { continue }
                        $preferences = Get-Content -LiteralPath $preferencesPath -Raw | ConvertFrom-Json
                        $extensions = $preferences.PSObject.Properties['extensions']
                        if ($null -eq $extensions) { continue }
                        $settings = $extensions.Value.PSObject.Properties['settings']
                        if ($null -eq $settings) { continue }
                        $entry = $settings.Value.PSObject.Properties[$Config.extensionId]
                        if ($null -eq $entry) { continue }
                        $state = $entry.Value.PSObject.Properties['state']
                        if ($null -ne $state -and $state.Value -eq 1) { $enabled = $true }
                        break
                    }
                    if ($enabled) { [pscustomobject]@{ Browser = $browser.Name; Version = $manifest.version }; break }
                } catch { continue }
            }
        }
    }
}
