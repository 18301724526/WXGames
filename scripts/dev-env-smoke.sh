#!/usr/bin/env bash
# 全链路环境烟测(发任何环境配方单之前必跑;未跟踪脚手架)
# 用法: bash scripts/dev-env-smoke.sh <目标目录> <后端端口> <预览端口>
# 四点: ①后端起+version ②直连登录 ③代理登录 ④带token代理拿game/state(过发布门)
set -u
DIR="${1:?目标目录}"; BP="${2:?后端端口}"; PP="${3:?预览端口}"
cd "$DIR" || { echo "FAIL: 目录不存在"; exit 1; }
PORT=$BP DB_PATH=tmp/smoke-$BP.db node backend/server.js > tmp/smoke-backend-$BP.log 2>&1 &
BPID=$!
LOCAL_PREVIEW_PORT=$PP LOCAL_PREVIEW_API_BASE=http://127.0.0.1:$BP node scripts/local-preview-server.js > tmp/smoke-preview-$PP.log 2>&1 &
PPID2=$!
cleanup(){ kill $BPID $PPID2 2>/dev/null; }
trap cleanup EXIT
sleep 4
ok=0; fail=0
step(){ if [ "$1" = "0" ]; then echo "PASS: $2"; ok=$((ok+1)); else echo "FAIL: $2  <<== 环境不可用,禁止发单"; fail=$((fail+1)); fi }
V=$(curl -s -m 5 -o /dev/null -w "%{http_code}" http://127.0.0.1:$BP/api/version); [ "$V" = "200" ]; step $? "①后端 /api/version ($V)"
TOK=$(curl -s -m 5 -X POST http://127.0.0.1:$BP/api/player/login -H "Content-Type: application/json" -d '{"username":"test1","password":"123456"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).token||'')}catch(e){console.log('')}})")
[ -n "$TOK" ]; step $? "②直连登录拿 token"
PBODY=$(curl -s -m 5 -X POST http://127.0.0.1:$PP/api/player/login -H "Content-Type: application/json" -d '{"username":"test1","password":"123456"}')
TOK2=$(echo "$PBODY" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).token||'')}catch(e){console.log('')}})")
[ -n "$TOK2" ]; step $? "③代理登录拿 token"
G=$(curl -s -m 8 -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOK2" "http://127.0.0.1:$PP/api/game/state"); [ "$G" = "200" ]; step $? "④代理带token拿 game/state ($G) [发布门]"
echo "── 结果: $ok/4 通过"
[ "$fail" = "0" ] && exit 0 || exit 1
