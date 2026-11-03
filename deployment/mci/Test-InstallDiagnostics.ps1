# Launch only invalid-config fixtures: never reaches dsregcmd or a registry write.
$ErrorActionPreference = 'Stop'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('gesner-install-diagnostics-' + [guid]::NewGuid().ToString())
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
try {
    $fixture = Join-Path $testRoot 'fixture'
    New-Item -ItemType Directory -Path $fixture -Force | Out-Null
    $installer = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'Install.ps1') -Raw
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Core.ps1') -Destination $fixture
    $config = @{
        extensionId = 'abcdefghijklmnopabcdefghijklmnop'; version = 'not-a-version'
        tenantId = 'd9ef70ce-45e1-4de9-9547-4a1fa301bf70'
        updateUrl = 'https://github.com/Nassau-1/gesner/releases/download/mci-channel/gesner-mci-updates.xml'
    }
    $config | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $fixture 'config.json') -Encoding UTF8
    $fixtureLog = Join-Path $testRoot 'logs'
    $installer.Replace("Join-Path `$env:SystemRoot 'Logs\Gesner-MCI'", "'" + $fixtureLog.Replace("'", "''") + "'") | Set-Content -LiteralPath (Join-Path $fixture 'Install.ps1')
    $childOutput = & $powershell -NoProfile -NonInteractive -File (Join-Path $fixture 'Install.ps1')
    if ($LASTEXITCODE -ne 1603) { throw 'Invalid config did not fail closed with 1603.' }
    $persisted = Get-Content -LiteralPath (Join-Path $fixtureLog 'install.log') -Raw
    if ($persisted -notmatch 'Phase=ValidateConfig; ExitCode=1603' -or $persisted -notmatch 'Message=Invalid version\.') { throw 'Local log did not retain the exception phase and message.' }
    if (($childOutput -join "`n") -notmatch 'Phase=ValidateConfig') { throw 'Diagnostic output is missing from stdout.' }
    $blockedPath = Join-Path $testRoot 'blocked'
    Set-Content -LiteralPath $blockedPath -Value 'fixture'
    $installer.Replace("Join-Path `$env:SystemRoot 'Logs\Gesner-MCI'", "'" + $blockedPath.Replace("'", "''") + "'") | Set-Content -LiteralPath (Join-Path $fixture 'Install.ps1')
    $childOutput = & $powershell -NoProfile -NonInteractive -File (Join-Path $fixture 'Install.ps1')
    if ($LASTEXITCODE -ne 1603) { throw 'An unavailable local log changed the installer failure exit code.' }
    $stdout = $childOutput -join "`n"
    if ($stdout -notmatch 'Phase=ValidateConfig; ExitCode=1603' -or $stdout -notmatch 'Gesner local diagnostic log could not be written\.') { throw 'An unavailable local log masked the original failure instead of retaining stdout diagnostics.' }
    Write-Output '5 installer diagnostic checks passed. Invalid fixtures only; no production registry, browser, or identity changed.'
} finally {
    $resolved = [IO.Path]::GetFullPath($testRoot)
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if (-not $resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notlike 'gesner-install-diagnostics-*') { throw 'Unsafe test cleanup path.' }
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
