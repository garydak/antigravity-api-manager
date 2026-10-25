#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=========================================================="
echo "  Antigravity API Manager (macOS / Linux 一键卸载脚本)"
echo "=========================================================="

if ! command -v node >/dev/null 2>&1; then
    echo "❌ 未检测到 Node.js，请先安装 Node.js (v20+ 或 v22+): https://nodejs.org/"
    exit 1
fi

echo "🗑️ 正在安全还原 Antigravity 官方原版..."
node "$DIR/suite/install.cjs" --modules "none" "$@"

echo ""
echo "=========================================================="
echo "✅ Antigravity API Manager 已成功卸载，已完全恢复官方原版。"
echo "=========================================================="
