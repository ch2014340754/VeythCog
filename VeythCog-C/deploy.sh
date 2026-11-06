#!/usr/bin/env bash
# ============================================================
# VeythCog 后端 一键发版脚本（时间戳 tag + .env 驱动，无需手改 compose.yml）
#
# 用法：
#   bash deploy.sh                    # 发版，tag 自动取 vYYYYMMDD-HHMM
#   bash deploy.sh v2                 # 发版，指定 tag
#   bash deploy.sh list               # 列出已有镜像 tag（便于挑回滚点）
#   bash deploy.sh current            # 查看当前生效的 tag / 运行镜像
#   bash deploy.sh rollback v20261106-1430   # 回滚到指定 tag
#
# 前置（一次性，在 compose 所在目录）：
#   1) docker-compose.yml 里 backend.image 写成：
#        image: veyth-cog-backend:${BACKEND_TAG:-v1}
#   2) compose 目录下建 .env（脚本会自动补），内容：
#        BACKEND_TAG=v1
#   之后 tag 变更只改 .env，docker-compose.yml 永远不动。
#
# 放置位置：仓库内 VeythCog-C/deploy.sh（脚本会自动向上定位仓库根）
# ============================================================
set -euo pipefail

# ---------- 可配置项 ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # .../VeythCog-C
BACKEND_DIR="${BACKEND_DIR:-$SCRIPT_DIR}"                      # 含 pom.xml / Dockerfile
REPO_DIR="${REPO_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"          # git 仓库根
COMPOSE_DIR="${COMPOSE_DIR:-/opt}"                             # docker-compose.yml 所在目录
IMAGE="${IMAGE:-veyth-cog-backend}"
SERVICE="${SERVICE:-backend}"
TAG_VAR="${TAG_VAR:-BACKEND_TAG}"                              # 对应 compose 里的 ${BACKEND_TAG}
ENV_FILE="${ENV_FILE:-$COMPOSE_DIR/.env}"                      # docker compose 自动读取
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8123/api/health}"
HEALTH_TRIES="${HEALTH_TRIES:-10}"
# ------------------------------

log()  { printf '\n\033[1;36m[%s] %s\033[0m\n' "$(date '+%H:%M:%S')" "$*"; }
ok()   { printf '\033[1;32m  ✔ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m  ! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m[失败] %s\033[0m\n' "$*" >&2; exit 1; }

usage() { sed -n '3,20p' "$0" | sed 's/^# \{0,1\}/  /'; }

# ---------- 工具函数 ----------
precheck() {
  command -v docker >/dev/null 2>&1 || die "未找到 docker"
  docker info >/dev/null 2>&1 || die "Docker 守护进程未运行（systemctl start docker）"
  docker compose version >/dev/null 2>&1 || die "docker compose 插件不可用"
  [ -d "$COMPOSE_DIR" ] || die "compose 目录不存在: $COMPOSE_DIR"
  [ -f "$COMPOSE_DIR/docker-compose.yml" ] || [ -f "$COMPOSE_DIR/compose.yml" ] || die "未找到 docker-compose.yml / compose.yml（$COMPOSE_DIR）"
}

env_tag() {  # 读取 .env 中当前 tag
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^${TAG_VAR}=" "$ENV_FILE" 2>/dev/null | tail -n1 | cut -d= -f2- || true
}

write_env_tag() {  # 写入/更新 .env 中的 tag，其它行原样保留
  local tag="$1"
  if [ -f "$ENV_FILE" ] && grep -q "^${TAG_VAR}=" "$ENV_FILE"; then
    sed -i "s|^${TAG_VAR}=.*|${TAG_VAR}=${tag}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$TAG_VAR" "$tag" >> "$ENV_FILE"
  fi
  ok ".env 已更新 → ${TAG_VAR}=${tag}"
}

assert_compose_uses_var() {  # 防止 compose 里 tag 写死导致换 tag 无效
  local tag="$1"
  ( cd "$COMPOSE_DIR" && docker compose config 2>/dev/null ) >/tmp/.vc_compose_cfg.$$ || die "docker compose config 解析失败，请检查 docker-compose.yml"
  if ! grep -q "${IMAGE}:${tag}" /tmp/.vc_compose_cfg.$$; then
    rm -f /tmp/.vc_compose_cfg.$$
    die "compose 未按变量解析镜像（期望 ${IMAGE}:${tag}）。请把 backend.image 改成：${IMAGE}:\${${TAG_VAR}:-v1}"
  fi
  rm -f /tmp/.vc_compose_cfg.$$
}

up_service() {
  ( cd "$COMPOSE_DIR" && docker compose up -d --no-deps "$SERVICE" ) || die "docker compose up 失败"
  ok "服务 ${SERVICE} 已按新镜像重建"
}

health_check() {
  log "健康检查 $HEALTH_URL"
  local i code body
  for i in $(seq 1 "$HEALTH_TRIES"); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$HEALTH_URL" 2>/dev/null || true)"
    if [ "$code" = "200" ]; then
      body="$(curl -s --max-time 3 "$HEALTH_URL" 2>/dev/null || true)"
      ok "健康检查通过：${body:-200}"
      return 0
    fi
    printf '  ...第 %s/%s 次：状态 %s，等待重试\n' "$i" "$HEALTH_TRIES" "${code:-无响应}"
    sleep 3
  done
  echo "最近日志："
  docker logs --tail=80 "$SERVICE" 2>&1 | sed 's/^/    /' || true
  return 1
}

# ---------- 子命令 ----------
cmd_release() {
  local tag="${1:-}"
  [ -n "$tag" ] || tag="v$(date +%Y%m%d-%H%M)"
  local start_ts; start_ts=$(date +%s)

  log "开始发版（tag=${tag}）"
  precheck
  [ -d "$REPO_DIR/.git" ] || die "不是 git 仓库: $REPO_DIR"
  [ -f "$BACKEND_DIR/Dockerfile" ] || die "未找到 Dockerfile: $BACKEND_DIR"

  log "1/4 拉取最新代码（$REPO_DIR）"
  cd "$REPO_DIR"
  local branch; branch="$(git rev-parse --abbrev-ref HEAD)"
  if [ "$branch" = "HEAD" ]; then die "当前处于 detached HEAD，请先 git checkout 分支"; fi
  if ! git diff --quiet || ! git diff --cached --quiet; then
    git status --short
    die "仓库存在未提交改动，已中止。请先 git stash 或 commit 后再发版"
  fi
  git fetch origin --prune
  local before after
  before="$(git rev-parse --short HEAD)"
  git pull --ff-only origin "$branch" || die "git pull 失败（非快进），请手动处理冲突后再发版"
  after="$(git rev-parse --short HEAD)"
  if [ "$before" = "$after" ]; then warn "已是最新（$before），按当前代码构建"; else ok "代码更新 $before -> $after"; fi

  log "2/4 构建镜像 ${IMAGE}:${tag}"
  ( cd "$BACKEND_DIR" && DOCKER_BUILDKIT=1 docker build -t "${IMAGE}:${tag}" . ) || die "镜像构建失败"
  ok "镜像构建完成：${IMAGE}:${tag}"

  log "3/4 切换 tag 并重建 ${SERVICE}"
  write_env_tag "$tag"
  assert_compose_uses_var "$tag"
  up_service

  log "4/4 健康检查"
  health_check || die "健康检查未通过，请检查上方日志"

  log "发版成功，用时 $(( $(date +%s) - start_ts ))s，当前 tag=${tag}"
  echo "  外网验证：curl -I https://api.veythcog.top/api/health"
  echo "  回滚命令：bash $0 rollback <旧tag>（用 bash $0 list 查看）"
}

cmd_rollback() {
  local tag="${1:-}"
  [ -n "$tag" ] || die "用法: bash deploy.sh rollback <tag>（可先执行 list 查看可用 tag）"
  precheck
  docker image inspect "${IMAGE}:${tag}" >/dev/null 2>&1 || die "本机没有镜像 ${IMAGE}:${tag}，无法回滚（用 list 查看已有 tag）"

  log "回滚到 ${IMAGE}:${tag}"
  write_env_tag "$tag"
  assert_compose_uses_var "$tag"
  up_service
  health_check || die "回滚后健康检查未通过，请检查日志"
  ok "已回滚到 ${tag}"
}

cmd_list() {
  precheck
  echo "当前 .env 生效 tag： $(env_tag)"
  echo
  docker images "$IMAGE" --format 'table {{.Tag}}\t{{.ID}}\t{{.CreatedAt}}\t{{.Size}}' | sed 's/^/  /'
}

cmd_current() {
  precheck
  echo ".env 配置 tag： $(env_tag)"
  echo
  ( cd "$COMPOSE_DIR" && docker compose ps "$SERVICE" ) || true
  local cid=""
  cid="$( cd "$COMPOSE_DIR" && docker compose ps -q "$SERVICE" 2>/dev/null | head -n1 )" || true
  if [ -n "$cid" ]; then
    docker inspect --format '运行中镜像： {{.Config.Image}}' "$cid" || true
  fi
}

# ---------- 入口 ----------
ACTION="${1:-release}"
case "$ACTION" in
  -h|--help|help)            usage ;;
  list|tags)                 cmd_list ;;
  current|status)            cmd_current ;;
  rollback)
      if [ "$#" -gt 0 ]; then shift; fi
      cmd_rollback "${1:-}"
      ;;
  release|deploy)
      if [ "$#" -gt 0 ]; then shift; fi
      cmd_release "${1:-}"
      ;;
  *)                         cmd_release "$ACTION" ;;   # 兼容 `deploy.sh v2`
esac
