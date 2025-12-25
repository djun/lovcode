#!/bin/bash

# 检查输入参数
if [ -z "$1" ]; then
    echo "使用方法: ./update-icon.sh <图片路径>"
    exit 1
fi

ICON_PATH=$1

# 检查文件是否存在
if [ ! -f "$ICON_PATH" ]; then
    echo "错误: 文件 $ICON_PATH 不存在"
    exit 1
fi

echo "开始生成 Tauri 图标..."

# 执行 Tauri 命令 (这里假设你使用 npm，也可以换成 yarn 或 cargo tauri)
npx tauri icon "$ICON_PATH"

if [ $? -eq 0 ]; then
    echo "✅ 图标已更新到 src-tauri/icons 目录。"
    
    # 如果是 Mac，清理 Dock 缓存
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "正在重置 Dock 缓存..."
        killall Dock
    fi
    
    echo "请重新启动开发服务器: npm run tauri dev"
else
    echo "❌ 图标生成失败，请检查是否安装了 @tauri-apps/cli"
fi
