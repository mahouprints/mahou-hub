#!/usr/bin/env bash
# Cria os filamentos reais da Mahou + estoque inicial (carretéis lacrados × 1 kg).
#
# Uso local:  LOGIN_EMAIL=... LOGIN_SENHA=... bash scripts/montar-estoque-filamentos.sh
# Uso prod:   API_BASE=https://api.mahouprints.com/api/v1 LOGIN_EMAIL=... LOGIN_SENHA=... bash scripts/...
#
# Idempotente: pula filamento que já existe (não duplica estoque).
# Custo/potência são PLACEHOLDER por material — ajustar os reais depois pela tela.

API_BASE="${API_BASE:-http://localhost:3000/api/v1}"
JAR="$(mktemp)"

# material|cor|carreteis|observacao
DADOS=$(cat <<'EOF'
PLA|Vermelho Velvet|9|
PLA|Vermelho Silk|5|
PLA|Duo Color Shadow Dourado e Preto|5|
PLA|Tri Color Dourado Rosa e Verde|4|
PLA|Lilás Macaron Velvet|5|
PLA|Branco Off white Velvet|2|Filamento atual dos suportes de móbile
PLA|Azul|1|
PLA|Branco Velvet|1|
PLA|Bronze|4|
PLA|Cinza Claro Velvet|5|
PLA|Laranja|4|
PLA|Rose Gold|3|Alternativa de cor do suporte de móbile
PLA|Azul Titanium|5|
PLA|Inox|5|
PLA|Fibra de Carbono|2|
PLA|Dourado|5|
PLA|Marrom caramelo|4|
PLA|Branco Dental|5|
ABS|Amarelo|15|
ABS|Cinza Claro|15|
ABS|Branco Dental|5|
ABS|Natural|5|
PETG HF|Marrom|5|
PETG HF|Natural Translúcido|5|
PETG HF|Azul|4|
PETG HF|Grafite|10|
PETG HF|Vermelho|2|
EOF
)

custo_de() { case "$1" in PLA) echo 11500;; ABS) echo 6300;; "PETG HF") echo 7000;; *) echo 10000;; esac; }
pa1_de()   { case "$1" in PLA) echo 90;;    ABS) echo 180;;  "PETG HF") echo 130;;  *) echo 120;;   esac; }
ph2_de()   { case "$1" in PLA) echo 120;;   ABS) echo 280;;  "PETG HF") echo 160;;  *) echo 160;;   esac; }

if [ -z "${LOGIN_EMAIL:-}" ] || [ -z "${LOGIN_SENHA:-}" ]; then
  echo "Defina LOGIN_EMAIL e LOGIN_SENHA no ambiente."; exit 1
fi

curl -s -c "$JAR" -X POST "$API_BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$LOGIN_EMAIL\",\"senha\":\"$LOGIN_SENHA\"}" > /dev/null

EXISTENTES=$(curl -s -b "$JAR" "$API_BASE/filamentos" | jq -r '.[].nome')

criados=0; pulados=0; kg_total=0
while IFS='|' read -r mat cor spools obs; do
  [ -z "$mat" ] && continue
  nome="$mat $cor"
  if grep -qxF "$nome" <<< "$EXISTENTES"; then echo "= já existe: $nome"; pulados=$((pulados+1)); continue; fi
  obs_json="null"; [ -n "$obs" ] && obs_json="\"$obs\""
  novo=$(curl -s -b "$JAR" -X POST "$API_BASE/filamentos" -H 'Content-Type: application/json' \
    -d "{\"nome\":\"$nome\",\"custoKgCentavos\":$(custo_de "$mat"),\"potenciaA1W\":$(pa1_de "$mat"),\"potenciaH2cW\":$(ph2_de "$mat"),\"observacao\":$obs_json,\"estoqueMinGramas\":500}")
  fid=$(jq -r '.id // empty' <<< "$novo")
  if [ -z "$fid" ]; then echo "! erro em $nome: $novo"; continue; fi
  gramas=$((spools * 1000))
  curl -s -b "$JAR" -X POST "$API_BASE/estoque/movimentos" -H 'Content-Type: application/json' \
    -d "{\"tipoItem\":\"FILAMENTO\",\"filamentoId\":\"$fid\",\"quantidade\":$gramas,\"motivo\":\"ESTOQUE_INICIAL\",\"observacao\":\"$spools carretel(eis) lacrado(s)\"}" > /dev/null
  echo "+ $nome → ${gramas}g (${spools} kg)"
  criados=$((criados+1)); kg_total=$((kg_total+spools))
done <<< "$DADOS"

echo "----"
echo "Criados: $criados · pulados (já existiam): $pulados · total carregado: ${kg_total} kg"
