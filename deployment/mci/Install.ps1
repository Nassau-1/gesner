# Intune Win32, SYSTEM context, 64-bit. Never closes or launches a browser.
$script:logPath = $null
$phase = 'InitializeLog'
function Write-GesnerInstallLog([string]$Message) {
    $line = [DateTimeOffset]::Now.ToString('o') + ' ' + $Message
    Write-Output $line
    if ($null -ne $script:logPath) {
        try { Add-Content -LiteralPath $script:logPath -Value $line -Encoding UTF8 -ErrorAction Stop }
        catch { Write-Output 'Gesner local diagnostic log could not be written.' }
    }
}
try {
    $ErrorActionPreference = 'Stop'
    $stateDirectory = Join-Path $env:SystemRoot 'Logs\Gesner-MCI'
    New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
    $script:logPath = Join-Path $stateDirectory 'install.log'
    Write-GesnerInstallLog 'Starting MCI machine-policy installer revision 3.'
    $phase = 'LoadCore'
    . (Join-Path $PSScriptRoot 'Core.ps1')
    $phase = 'ValidateConfig'
    $config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config.json') -Raw | ConvertFrom-Json
    Assert-GesnerConfig $config
    $phase = 'ValidateAdministrator'
    Assert-GesnerAdministrator
    $phase = 'ValidateMciJoin'
    Assert-GesnerMciJoin $config
    Write-GesnerInstallLog 'MCI join validated.'
    $entry = $config.extensionId + ';' + $config.updateUrl
    $plans = @()
    foreach ($browser in Get-GesnerBrowsers) {
        $phase = 'PlanPolicy:' + $browser.Name
        $root = (Get-GesnerPolicyBase) + $browser.Policy
        $key = $root + '\ExtensionInstallForcelist'
        $settings = Get-ItemProperty -LiteralPath $root -Name ExtensionSettings -ErrorAction SilentlyContinue
        if ($null -ne $settings) {
            $parsed = $settings.ExtensionSettings | ConvertFrom-Json
            if ($null -ne $parsed.PSObject.Properties[$config.extensionId]) { throw ('An explicit ExtensionSettings policy already manages Gesner in ' + $browser.Name) }
        }
        $slot = Get-GesnerSlot (Get-GesnerValues $key) $entry $config.extensionId
        $plans += [pscustomobject]@{ Key = $key; Name = $slot.Name; Add = $slot.Add }
    }
    $phase = 'LoadOwnership'
    $stateKey = Get-GesnerOwnershipKey
    $owned = @()
    if (Test-Path -LiteralPath $stateKey) {
        $previous = (Get-ItemProperty -LiteralPath $stateKey -Name State).State | ConvertFrom-Json
        $owned = @(Get-GesnerOwnedEntries $previous $config)
    }
    foreach ($plan in $plans) {
        if (-not $plan.Add) { continue }
        $phase = 'WritePolicy:' + $plan.Key
        Write-GesnerInstallLog ('Applying policy: ' + $plan.Key)
        if ((Get-GesnerValues $plan.Key).ContainsKey($plan.Name)) { throw 'Policy changed during installation; retry.' }
        # Record ownership before the write, so interrupted installs can be removed safely.
        if (@($owned | Where-Object { $_.Key -eq $plan.Key -and $_.Name -eq $plan.Name -and $_.Value -ceq $entry }).Count -eq 0) {
            $owned += [pscustomobject]@{ Key = $plan.Key; Name = $plan.Name; Value = $entry }
        }
        $state = @{ extensionId = $config.extensionId; scope = 'Machine'; owned = $owned } | ConvertTo-Json -Depth 5 -Compress
        if (-not (Test-Path -LiteralPath $stateKey)) { New-Item -Path $stateKey -Force | Out-Null }
        New-ItemProperty -LiteralPath $stateKey -Name State -Value $state -PropertyType String -Force | Out-Null
        if (-not (Test-Path -LiteralPath $plan.Key)) { New-Item -Path $plan.Key -Force | Out-Null }
        New-ItemProperty -LiteralPath $plan.Key -Name $plan.Name -Value $entry -PropertyType String -Force | Out-Null
    }
    $phase = 'WaitForEnabledProfile'
    Write-GesnerInstallLog 'Gesner policies configured. The browser must download and enable the signed extension before detection succeeds.'
    # Intune performs detection immediately afterwards. Allow policy refresh in an already-open browser.
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if (@(Get-GesnerDeviceInstalledProfiles $config).Count -gt 0) { Write-GesnerInstallLog 'Enabled profile detected. ExitCode=0'; exit 0 }
        Start-Sleep -Seconds 5
    }
    Write-GesnerInstallLog 'Extension not confirmed yet. Open/restart Vivaldi or Chrome, then retry from Company Portal. ExitCode=1618'
    exit 1618
} catch {
    $failure = $_
    Write-GesnerInstallLog ('Gesner installation failed. Phase=' + $phase + '; ExitCode=1603; Type=' + $failure.Exception.GetType().FullName + '; HResult=' + $failure.Exception.HResult + '; ScriptLine=' + $failure.InvocationInfo.ScriptLineNumber + '; Message=' + $failure.Exception.Message)
    exit 1603
}
