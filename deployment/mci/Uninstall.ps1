try {
    . (Join-Path $PSScriptRoot 'Core.ps1')
    $config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config.json') -Raw | ConvertFrom-Json
    Assert-GesnerConfig $config
    $statePath = Join-Path $env:LOCALAPPDATA 'Gesner-MCI\deployment.json'
    if (-not (Test-Path -LiteralPath $statePath)) { exit 0 }
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    if ($state.extensionId -ne $config.extensionId) { throw 'Identity mismatch.' }
    $allowedKeys = @((Get-GesnerBrowsers) | ForEach-Object { 'HKCU:\Software\Policies\' + $_.Policy + '\ExtensionInstallForcelist' })
    foreach ($owned in $state.owned) {
        if ($owned.Key -notin $allowedKeys -or $owned.Name -notmatch '^\d+$' -or $owned.Value -ne ($config.extensionId + ';' + $config.updateUrl)) { throw 'Invalid ownership record.' }
        $values = Get-GesnerValues $owned.Key
        if ($values.ContainsKey($owned.Name) -and $values[$owned.Name] -eq $owned.Value) {
            Remove-ItemProperty -LiteralPath $owned.Key -Name $owned.Name
        }
    }
    # Browsers remove the force-installed extension when they refresh policy. Never edit browser preferences.
    Remove-Item -LiteralPath $statePath -Force
    exit 0
} catch { Write-Output $_.Exception.Message; exit 1603 }
