#!/usr/bin/env bash
# sync-skills.sh
#
# Espelha as skills versionadas em `.claude/skills/<nome>/SKILL.md` (canonical
# no repo) pra `~/.claude/commands/<nome>.md` (uso global do Claude Code), ajustando
# os paths de `content/...` (relativos ao repo) pra paths locais absolutos
# (`~/Marketplace/`, `~/Instagram/`, etc).
#
# Fluxo: repo é fonte da verdade. Edita lá, commita, sincroniza pra local.
# NÃO sincroniza local → repo (drift seria difícil de gerenciar).
#
# Uso:
#   ./scripts/sync-skills.sh                 # sincroniza tudo pra ~/.claude/commands/
#   ./scripts/sync-skills.sh --dry-run       # mostra o que faria, sem escrever
#   ./scripts/sync-skills.sh --clean         # também remove skills locais que sumiram do repo
#   ./scripts/sync-skills.sh --target DIR    # alvo customizado (default ~/.claude/commands)
#
# Skills com múltiplos arquivos (ex: oportunidades-mahou com criterios-3d.md +
# exemplos/...) são puladas — ~/.claude/commands/ aceita só arquivo único por
# skill. Pra essas, abra o Claude Code dentro do repo (.claude/skills/ é lido
# automaticamente em modo project-level).

set -euo pipefail

# ─────────────────────── cores ───────────────────────
if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'
  C_BOLD=$'\033[1m'
  C_DIM=$'\033[2m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'
  C_RED=$'\033[31m'
else
  C_RESET="" C_BOLD="" C_DIM="" C_GREEN="" C_YELLOW="" C_BLUE="" C_RED=""
fi

log()   { echo "${C_BLUE}→${C_RESET} $*"; }
ok()    { echo "${C_GREEN}✓${C_RESET} $*"; }
warn()  { echo "${C_YELLOW}⚠${C_RESET} $*"; }
err()   { echo "${C_RED}✗${C_RESET} $*" >&2; }

# ─────────────────────── flags ───────────────────────
DRY_RUN=0
CLEAN=0
TARGET="${HOME}/.claude/commands"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)  DRY_RUN=1; shift ;;
    --clean)    CLEAN=1; shift ;;
    --target)   TARGET="$2"; shift 2 ;;
    --help|-h)
      sed -n '2,/^set -euo/p' "$0" | sed -e 's/^# \{0,1\}//' -e '$d'
      exit 0
      ;;
    *)
      err "flag desconhecida: $1 (use --help)"
      exit 1
      ;;
  esac
done

# ─────────────────────── localizar raiz do repo ───────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_DIR="$REPO_ROOT/.claude/skills"

if [[ ! -d "$SKILLS_DIR" ]]; then
  err "$SKILLS_DIR não existe — esse script deve rodar de dentro do mahou-hub"
  exit 1
fi

log "${C_BOLD}sync-skills${C_RESET}  ${C_DIM}repo:${C_RESET} $REPO_ROOT"
log "${C_BOLD}           ${C_RESET}  ${C_DIM}alvo:${C_RESET} $TARGET"
if (( DRY_RUN )); then
  warn "modo --dry-run — nada vai ser escrito"
fi
echo ""

# ─────────────────────── garantir alvo existe ───────────────────────
if [[ ! -d "$TARGET" ]]; then
  if (( DRY_RUN )); then
    log "criaria $TARGET (não existe ainda)"
  else
    mkdir -p "$TARGET"
    log "criou $TARGET"
  fi
fi

# ─────────────────────── substituições de path ───────────────────────
# Aplica nos arquivos sincronizados: converte paths do repo (`content/...`) pra
# os paths locais absolutos onde Claude Code espera encontrar os assets.
apply_path_rewrites() {
  local input="$1"
  sed \
    -e 's|content/marketplace/|~/Marketplace/|g' \
    -e 's|content/instagram/|~/Instagram/|g' \
    -e 's|content/imagegen/templates/|~/Documents/Mahou Prints/imagegen/templates/|g' \
    -e 's|content/imagegen/|~/Documents/Mahou Prints/imagegen/|g' \
    -e 's|content/memory/|~/.claude/projects/C--Users-PC/memory/|g' \
    -e 's|\.claude/skills/gerar-imagem/SKILL\.md|~/.claude/commands/gerar-imagem.md|g' \
    -e 's|\.claude/skills/gerar-descricao/SKILL\.md|~/.claude/commands/gerar-descricao.md|g' \
    -e 's|\.claude/skills/gerar-post/SKILL\.md|~/.claude/commands/gerar-post.md|g' \
    "$input"
}

# ─────────────────────── iterar skills ───────────────────────
COUNT_CREATED=0
COUNT_UPDATED=0
COUNT_UNCHANGED=0
COUNT_SKIPPED_MULTIFILE=0
SYNCED_NAMES=()

shopt -s nullglob
for skill_dir in "$SKILLS_DIR"/*/; do
  skill_name="$(basename "$skill_dir")"
  skill_main="$skill_dir/SKILL.md"

  if [[ ! -f "$skill_main" ]]; then
    warn "skill ${C_BOLD}${skill_name}${C_RESET} sem SKILL.md — pulando"
    continue
  fi

  # Detecta multi-arquivo (skill tem .md irmãos além de SKILL.md ou subpastas)
  aux_count=$(find "$skill_dir" -mindepth 1 -not -name SKILL.md -not -name README.md | wc -l | tr -d ' ')
  if (( aux_count > 0 )); then
    warn "${C_BOLD}${skill_name}${C_RESET} tem $aux_count arquivo(s) auxiliar(es) — pulando (use Claude Code dentro do repo pra essa skill)"
    COUNT_SKIPPED_MULTIFILE=$((COUNT_SKIPPED_MULTIFILE + 1))
    continue
  fi

  target_file="$TARGET/${skill_name}.md"
  tmp_file="$(mktemp)"
  apply_path_rewrites "$skill_main" > "$tmp_file"

  if [[ -f "$target_file" ]]; then
    if cmp -s "$tmp_file" "$target_file"; then
      ok "${C_BOLD}${skill_name}${C_RESET} ${C_DIM}(já em sincronia)${C_RESET}"
      COUNT_UNCHANGED=$((COUNT_UNCHANGED + 1))
      rm "$tmp_file"
    else
      if (( DRY_RUN )); then
        warn "${C_BOLD}${skill_name}${C_RESET} ${C_YELLOW}(atualizaria)${C_RESET}"
      else
        mv "$tmp_file" "$target_file"
        ok "${C_BOLD}${skill_name}${C_RESET} ${C_GREEN}(atualizada)${C_RESET}"
      fi
      COUNT_UPDATED=$((COUNT_UPDATED + 1))
    fi
  else
    if (( DRY_RUN )); then
      warn "${C_BOLD}${skill_name}${C_RESET} ${C_YELLOW}(criaria)${C_RESET}"
      rm "$tmp_file"
    else
      mv "$tmp_file" "$target_file"
      ok "${C_BOLD}${skill_name}${C_RESET} ${C_GREEN}(criada)${C_RESET}"
    fi
    COUNT_CREATED=$((COUNT_CREATED + 1))
  fi

  SYNCED_NAMES+=("$skill_name")
done

# ─────────────────────── --clean: remover órfãs ───────────────────────
COUNT_REMOVED=0
if (( CLEAN )); then
  echo ""
  log "--clean: procurando skills locais que sumiram do repo"
  for local_file in "$TARGET"/*.md; do
    [[ -e "$local_file" ]] || continue
    local_name="$(basename "$local_file" .md)"
    found=0
    for synced in "${SYNCED_NAMES[@]+"${SYNCED_NAMES[@]}"}"; do
      if [[ "$synced" == "$local_name" ]]; then
        found=1
        break
      fi
    done
    if (( found == 0 )); then
      if (( DRY_RUN )); then
        warn "removeria ${C_BOLD}${local_name}.md${C_RESET}"
      else
        rm "$local_file"
        ok "removida ${C_BOLD}${local_name}.md${C_RESET}"
      fi
      COUNT_REMOVED=$((COUNT_REMOVED + 1))
    fi
  done
fi

# ─────────────────────── resumo ───────────────────────
echo ""
log "${C_BOLD}resumo${C_RESET}"
echo "  criadas:        $COUNT_CREATED"
echo "  atualizadas:    $COUNT_UPDATED"
echo "  já em sync:     $COUNT_UNCHANGED"
echo "  multi-arquivo:  $COUNT_SKIPPED_MULTIFILE   ${C_DIM}(usar dentro do repo)${C_RESET}"
if (( CLEAN )); then
  echo "  removidas:      $COUNT_REMOVED"
fi

if (( DRY_RUN )); then
  echo ""
  warn "modo --dry-run — rode sem --dry-run pra aplicar"
fi
