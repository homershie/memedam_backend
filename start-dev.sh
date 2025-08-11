#!/bin/bash
# 本地開發啟動腳本 - 確保中文日誌正確顯示

# 設置 UTF-8 編碼環境
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# 設置開發環境
export NODE_ENV=development
export PORT=${PORT:-4000}

echo "🚀 啟動迷因典後端開發服務器..."
echo "📝 日誌將以格式化方式顯示，支援中文"
echo "🌐 環境: $NODE_ENV"
echo "🔌 端口: $PORT"
echo ""

# 啟動應用
node index.js