# Intune Win32, USER context, 64-bit. Never closes or launches a browser.
try {
    . (Join-Path $PSScriptRoot 'Core.ps1')
    $config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config.json') -Raw | ConvertFrom-Json
    Assert-GesnerConfig $config
    $join = (& "$env:SystemRoot\System32\dsregcmd.exe" /status) -join "`n"
    if ($join -notmatch 'AzureAdJoined\s*:\s*YES' -or $join -notmatch ('TenantId\s*:\s*' + [regex]::Escape($config.tenantId))) { throw 'This installer requires an Entra-joined MCI device.' }
    $entry = $config.extensionId + ';' + $config.updateUrl
    $plans = @()
    foreach ($browser in Get-GesnerBrowsers) {
        $root = 'HKCU:\Software\Policies\' + $browser.Policy
        $key = $root + '\ExtensionInstallForcelist'
        $settings = Get-ItemProperty -LiteralPath $root -Name ExtensionSettings -ErrorAction SilentlyContinue
        if ($null -ne $settings) {
            $parsed = $settings.ExtensionSettings | ConvertFrom-Json
            if ($null -ne $parsed.PSObject.Properties[$config.extensionId]) { throw ('An explicit ExtensionSettings policy already manages Gesner in ' + $browser.Name) }
        }
        $slot = Get-GesnerSlot (Get-GesnerValues $key) $entry $config.extensionId
        $plans += [pscustomobject]@{ Key = $key; Name = $slot.Name; Add = $slot.Add }
    }
    $stateDirectory = Join-Path $env:LOCALAPPDATA 'Gesner-MCI'
    New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
    $statePath = Join-Path $stateDirectory 'deployment.json'
    $owned = @()
    if (Test-Path -LiteralPath $statePath) {
        $previous = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        if ($previous.extensionId -ne $config.extensionId) { throw 'Existing installer state belongs to another identity.' }
        $owned = @($previous.owned)
    }
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Core.ps1') -Destination (Join-Path $stateDirectory 'Core.ps1') -Force
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'config.json') -Destination (Join-Path $stateDirectory 'config.json') -Force
    foreach ($plan in $plans) {
        if (-not $plan.Add) { continue }
        if ((Get-GesnerValues $plan.Key).ContainsKey($plan.Name)) { throw 'Policy changed during installation; retry.' }
        # Record ownership before the write, so interrupted installs can be removed safely.
        $owned += [pscustomobject]@{ Key = $plan.Key; Name = $plan.Name; Value = $entry }
        @{ extensionId = $config.extensionId; owned = $owned } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $statePath -Encoding UTF8
        if (-not (Test-Path -LiteralPath $plan.Key)) { New-Item -Path $plan.Key -Force | Out-Null }
        New-ItemProperty -LiteralPath $plan.Key -Name $plan.Name -Value $entry -PropertyType String -Force | Out-Null
    }
    Write-Output 'Gesner policies configured. The browser must download and enable the signed extension before detection succeeds.'
    # Intune performs detection immediately afterwards. Allow policy refresh in an already-open browser.
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if (@(Get-GesnerInstalledProfiles $config).Count -gt 0) { exit 0 }
        Start-Sleep -Seconds 5
    }
    Write-Output 'Extension not confirmed yet. Open/restart Vivaldi or Chrome, then retry from Company Portal.'
    exit 1618
} catch { Write-Output ('Gesner installation failed: ' + $_.Exception.Message); exit 1603 }
