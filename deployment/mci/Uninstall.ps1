try {
    . (Join-Path $PSScriptRoot 'Core.ps1')
    $config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config.json') -Raw | ConvertFrom-Json
    Assert-GesnerConfig $config
    Assert-GesnerAdministrator
    $stateKey = Get-GesnerOwnershipKey
    if (-not (Test-Path -LiteralPath $stateKey)) { exit 0 }
    $state = (Get-ItemProperty -LiteralPath $stateKey -Name State).State | ConvertFrom-Json
    # Validate every record before performing any removal.
    $entries = @(Get-GesnerOwnedEntries $state $config)
    foreach ($owned in $entries) {
        $values = Get-GesnerValues $owned.Key
        if ($values.ContainsKey($owned.Name) -and $values[$owned.Name] -eq $owned.Value) {
            Remove-ItemProperty -LiteralPath $owned.Key -Name $owned.Name
        }
    }
    # Browsers remove the force-installed extension when they refresh policy. Never edit browser preferences.
    Remove-ItemProperty -LiteralPath $stateKey -Name State
    Remove-Item -LiteralPath $stateKey
    exit 0
} catch { Write-Output $_.Exception.Message; exit 1603 }
