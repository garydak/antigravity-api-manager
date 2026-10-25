#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=========================================================="
echo "  Antigravity API Manager (macOS / Linux 一键安装脚本)"
echo "=========================================================="

if ! command -v node >/dev/null 2>&1; then
    echo "❌ 未检测到 Node.js，请先安装 Node.js (v20+ 或 v22+): https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js 版本过低 (当前: $(node -v))，请安装 Node.js v20 或更高版本。"
    exit 1
fi

echo "🚀 正在安装 Antigravity API Manager 套件..."
node "$DIR/suite/install.cjs" --modules "i18n,accounts,api" "$@"

echo ""
echo "=========================================================="
echo "✅ Antigravity API Manager 安装完成！"
echo "请打开或重新启动 Antigravity 客户端即可享受完整增强功能。"
echo "=========================================================="
