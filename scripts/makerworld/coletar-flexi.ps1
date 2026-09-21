[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateCount(1, 200)]
  [ValidateScript({ $_ -gt 0 })]
  [int[]]$Ids,

  [ValidateScript({ $_ -gt 0 -and -not [double]::IsInfinity($_) -and -not [double]::IsNaN($_) })]
  [double]$MaxHoras = 2
)

$ErrorActionPreference = 'Stop'
$idsUnicos = @($Ids | Sort-Object -Unique)
$identificador = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
$pastaExecucao = Join-Path $PSScriptRoot "dados/amostras/$identificador"
$userAgent = 'MahouPrintsProspector/1.0'
$origens = @()
$utf8SemBom = [Text.UTF8Encoding]::new($false)

try {
  $comandoNpm = Get-Command npm.cmd -ErrorAction Stop
  New-Item -ItemType Directory -Path $pastaExecucao -ErrorAction Stop | Out-Null
  foreach ($modeloId in $idsUnicos) {
    $urlModelo = "https://makerworld.com/api/v1/design-service/design/$modeloId"
    $resposta = Invoke-RestMethod -Uri $urlModelo -Method Get -UserAgent $userAgent `
      -Headers @{ Accept = 'application/json' } -TimeoutSec 30
    $consultadoEm = [DateTime]::UtcNow.ToString('o')
    $arquivoModelo = Join-Path $pastaExecucao "$modeloId.json"
    $jsonModelo = $resposta | ConvertTo-Json -Depth 100
    [IO.File]::WriteAllText($arquivoModelo, $jsonModelo, $utf8SemBom)
    $origens += [ordered]@{ id = $modeloId; url = $urlModelo; consultadoEm = $consultadoEm }
    Write-Host "Coletado $modeloId ($($origens.Count)/$($idsUnicos.Count))."
    Start-Sleep -Milliseconds 1000
  }

  $jsonOrigens = [ordered]@{ userAgent = $userAgent; consultas = $origens } | ConvertTo-Json -Depth 5
  [IO.File]::WriteAllText((Join-Path $pastaExecucao 'proveniencia.json'), $jsonOrigens, $utf8SemBom)
  Write-Host "Respostas desta execucao: $pastaExecucao"
  $horasArgumento = $MaxHoras.ToString([Globalization.CultureInfo]::InvariantCulture)
  Push-Location -LiteralPath $PSScriptRoot
  try {
    & $comandoNpm.Source run flexi -- --amostras $pastaExecucao --ids ($idsUnicos -join ',') `
      --limite $idsUnicos.Count --max-horas $horasArgumento
    if ($LASTEXITCODE -ne 0) { throw "Triagem flexi terminou com codigo $LASTEXITCODE." }
  } finally {
    Pop-Location
  }
} catch {
  Write-Error "Coleta interrompida; esta execucao nao foi importada no Hub. $($_.Exception.Message)" -ErrorAction Continue
  exit 1
}
