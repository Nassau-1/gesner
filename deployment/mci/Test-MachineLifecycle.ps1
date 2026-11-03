# Execute actual installer/detector/uninstaller against isolated HKCU test keys.
# Fixture Core overrides only environment boundaries: elevation/join, roots, wait.
$ErrorActionPreference = 'Stop'
$id = [guid]::NewGuid().ToString('N')
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('gesner-machine-test-' + $id)
$registryRoot = 'HKCU:\Software\GesnerTests\' + $id
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$passed = 0
function Assert($Condition, [string]$Message) { if (-not $Condition) { throw $Message }; $script:passed++ }
function Run([string]$Script, [int]$Expected) {
    $output = & $powershell -NoProfile -NonInteractive -File (Join-Path $testRoot $Script)
    Assert ($LASTEXITCODE -eq $Expected) ($Script + ' expected ' + $Expected + ', got ' + $LASTEXITCODE + ': ' + ($output -join "`n"))
    if ($Script -eq 'Detect.ps1') { Assert (($Expected -eq 0) -eq (@($output).Count -gt 0)) 'Detector output must exist only on success.' }
}
try {
    New-Item -ItemType Directory -Path $testRoot | Out-Null
    $config = [pscustomobject]@{
        extensionId = 'abcdefghijklmnopabcdefghijklmnop'; version = '1.0.1'
        tenantId = 'd9ef70ce-45e1-4de9-9547-4a1fa301bf70'
        updateUrl = 'https://github.com/Nassau-1/gesner/releases/download/mci-channel/gesner-mci-updates.xml'
    }
    $config | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $testRoot 'config.json')
    $entry = $config.extensionId + ';' + $config.updateUrl
    $localData = Join-Path $testRoot 'profiles\Local'
    $fixtureCore = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'Core.ps1') -Raw) + @"

function Assert-GesnerAdministrator {}
function Assert-GesnerMciJoin(`$Config) {}
function Get-GesnerPolicyBase { '$registryRoot\Policies\' }
function Get-GesnerOwnershipKey { '$registryRoot\Ownership' }
function Get-GesnerDeviceLocalData { '$localData' }
function Start-Sleep { param(`$Seconds) }
"@
    $fixtureCore | Set-Content -LiteralPath (Join-Path $testRoot 'Core.ps1')
    foreach ($scriptFile in @('Install.ps1', 'Uninstall.ps1')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $scriptFile) -Destination $testRoot }
    $fixtureLog = Join-Path $testRoot 'logs'
    (Get-Content -LiteralPath (Join-Path $testRoot 'Install.ps1') -Raw).Replace("Join-Path `$env:SystemRoot 'Logs\Gesner-MCI'", "'" + $fixtureLog.Replace("'", "''") + "'") | Set-Content -LiteralPath (Join-Path $testRoot 'Install.ps1')
    $template = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'Detect.ps1') -Raw
    $template.Replace('__CORE__', $fixtureCore).Replace('__EXTENSION_ID__', $config.extensionId).Replace('__VERSION__', $config.version) | Set-Content -LiteralPath (Join-Path $testRoot 'Detect.ps1')
    . (Join-Path $testRoot 'Core.ps1')
    foreach ($browser in Get-GesnerBrowsers) {
        $key = (Get-GesnerPolicyBase) + $browser.Policy + '\ExtensionInstallForcelist'
        New-Item -Path $key -Force | Out-Null
        New-ItemProperty -LiteralPath $key -Name '1' -Value 'other-extension;https://example.invalid' | Out-Null
    }
    Run 'Install.ps1' 1618
    Run 'Detect.ps1' 1
    $stateKey = Get-GesnerOwnershipKey
    $state = (Get-ItemProperty -LiteralPath $stateKey -Name State).State | ConvertFrom-Json
    Assert (@($state.owned).Count -eq 4) 'All four new policy entries must be owned.'
    $profile = Join-Path $localData 'Vivaldi\User Data\Default'
    $version = Join-Path $profile ('Extensions\' + $config.extensionId + '\1.0.1_0')
    New-Item -ItemType Directory -Path $version -Force | Out-Null
    @{ name = 'Gesner'; version = '1.0.1' } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $version 'manifest.json')
    Run 'Detect.ps1' 1
    $settings = @{}; $settings[$config.extensionId] = @{ state = 1 }
    @{ extensions = @{ settings = $settings } } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $profile 'Secure Preferences')
    Run 'Install.ps1' 0
    Run 'Detect.ps1' 0
    Run 'Install.ps1' 0
    $state = (Get-ItemProperty -LiteralPath $stateKey -Name State).State | ConvertFrom-Json
    Assert (@($state.owned).Count -eq 4) 'Repeated installation must not duplicate ownership.'
    $first = $state.owned[0]
    Remove-ItemProperty -LiteralPath $first.Key -Name $first.Name
    Run 'Detect.ps1' 1
    Run 'Install.ps1' 0
    $state = (Get-ItemProperty -LiteralPath $stateKey -Name State).State | ConvertFrom-Json
    Assert (@($state.owned).Count -eq 4) 'Repair of a missing entry must reuse ownership.'
    $goodState = $state | ConvertTo-Json -Depth 5 -Compress
    $state.owned[1].Key = $registryRoot + '\Forbidden'
    Set-ItemProperty -LiteralPath $stateKey -Name State -Value ($state | ConvertTo-Json -Depth 5 -Compress)
    Run 'Uninstall.ps1' 1603
    Assert ((Get-ItemProperty -LiteralPath $first.Key).($first.Name) -ceq $entry) 'An invalid later ownership record must prevent all deletion.'
    Set-ItemProperty -LiteralPath $stateKey -Name State -Value $goodState
    Set-ItemProperty -LiteralPath $first.Key -Name $first.Name -Value 'replacement-extension'
    Run 'Uninstall.ps1' 0
    Assert ((Get-ItemProperty -LiteralPath $first.Key).($first.Name) -eq 'replacement-extension') 'Uninstall must preserve replaced entries.'
    foreach ($browser in Get-GesnerBrowsers) {
        $values = Get-GesnerValues ((Get-GesnerPolicyBase) + $browser.Policy + '\ExtensionInstallForcelist')
        Assert ($values['1'] -eq 'other-extension;https://example.invalid') 'Uninstall must preserve other extensions.'
        Assert (-not (@($values.Values) -contains $entry)) 'Owned matching entry must be removed.'
    }
    Run 'Detect.ps1' 1
    Run 'Uninstall.ps1' 0
    # Conflicts must be planned before any writes/ownership creation.
    Set-ItemProperty -LiteralPath $first.Key -Name $first.Name -Value ($config.extensionId + ';https://different.invalid')
    Run 'Install.ps1' 1603
    Assert (-not (Test-Path -LiteralPath $stateKey)) 'A conflicting channel must not create ownership.'
    Set-ItemProperty -LiteralPath $first.Key -Name $first.Name -Value $entry
    Run 'Install.ps1' 0
    $state = (Get-ItemProperty -LiteralPath $stateKey -Name State).State | ConvertFrom-Json
    Assert (@($state.owned).Count -eq 3) 'A pre-existing identical entry must not become owned.'
    Run 'Uninstall.ps1' 0
    Assert ((Get-ItemProperty -LiteralPath $first.Key).($first.Name) -ceq $entry) 'Uninstall must preserve pre-existing identical policy.'
    Write-Output "$passed machine lifecycle checks passed. Only isolated test registry/profile paths were changed."
} finally {
    if ($registryRoot -notmatch '^HKCU:\\Software\\GesnerTests\\[a-f0-9]{32}$') { throw 'Unsafe registry cleanup path.' }
    if (Test-Path -LiteralPath $registryRoot) { Remove-Item -LiteralPath $registryRoot -Recurse -Force }
    $resolved = [IO.Path]::GetFullPath($testRoot)
    if (-not $resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()), [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notlike 'gesner-machine-test-*') { throw 'Unsafe fixture cleanup path.' }
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
