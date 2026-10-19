param([ValidateSet('start','status','restart-app','reset','verify','stop')][string]$Action='status',[string]$Scenario='open',[int]$Seconds=180,[string]$Address='')
$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if($Action -eq 'start') { if($Address) { node --experimental-strip-types scripts/iphone-acceptance.mjs start $Address } else { node --experimental-strip-types scripts/iphone-acceptance.mjs start } }
elseif($Action -eq 'reset') { node --experimental-strip-types scripts/iphone-acceptance.mjs reset $Scenario $Seconds }
else { node --experimental-strip-types scripts/iphone-acceptance.mjs $Action }
if($LASTEXITCODE -ne 0) { throw "Acceptance command failed with exit code $LASTEXITCODE" }
