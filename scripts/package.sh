#!/bin/bash

# 设置脚本在遇到错误时退出
set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录的父目录（项目根目录）
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"
DIST_PATH="$PROJECT_ROOT/dist"
OUTPUT_DIR="$PROJECT_ROOT/packages"
SRC_MANIFEST="$PROJECT_ROOT/src/manifest.json"

# 获取传入的版本号参数
NEW_VERSION="$1"

echo -e "${BLUE}🚀 开始打包Chrome扩展...${NC}"

# 如果传入了版本号参数，则更新manifest.json
if [ ! -z "$NEW_VERSION" ]; then
    echo -e "${BLUE}🔧 更新版本号到: v${NEW_VERSION}${NC}"
    
    # 检查源manifest.json是否存在
    if [ ! -f "$SRC_MANIFEST" ]; then
        echo -e "${RED}❌ 源manifest.json不存在: $SRC_MANIFEST${NC}"
        exit 1
    fi
    
    # 验证版本号格式（简单的语义化版本检查）
    if [[ ! $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo -e "${RED}❌ 版本号格式错误，请使用语义化版本格式 (例如: 1.2.0)${NC}"
        exit 1
    fi
    
    # 备份原始manifest.json
    cp "$SRC_MANIFEST" "$SRC_MANIFEST.backup"
    echo -e "${GREEN}📋 已备份原始manifest.json${NC}"
    
    # 更新版本号
    if command -v jq &> /dev/null; then
        # 使用jq更新版本号
        jq --arg version "$NEW_VERSION" '.version = $version' "$SRC_MANIFEST" > "$SRC_MANIFEST.tmp" && mv "$SRC_MANIFEST.tmp" "$SRC_MANIFEST"
        echo -e "${GREEN}✅ 已使用jq更新版本号${NC}"
    else
        # 使用sed作为备用方案
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/\"version\": *\"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" "$SRC_MANIFEST"
        else
            # Linux
            sed -i "s/\"version\": *\"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" "$SRC_MANIFEST"
        fi
        echo -e "${GREEN}✅ 已使用sed更新版本号${NC}"
    fi
    
    # 验证更新是否成功
    UPDATED_VERSION=$(grep -o '"version"[^,]*' "$SRC_MANIFEST" | sed 's/.*"version": *"//;s/".*//' 2>/dev/null || echo "unknown")
    if [ "$UPDATED_VERSION" != "$NEW_VERSION" ]; then
        echo -e "${RED}❌ 版本号更新失败，请检查manifest.json格式${NC}"
        # 恢复备份
        mv "$SRC_MANIFEST.backup" "$SRC_MANIFEST"
        exit 1
    fi
    
    echo -e "${GREEN}🎯 版本号已成功更新为: v${NEW_VERSION}${NC}"
fi

# 如果更新了版本号，需要重新构建
if [ ! -z "$NEW_VERSION" ]; then
    echo -e "${BLUE}🔨 版本号已更新，正在重新构建...${NC}"
    cd "$PROJECT_ROOT"
    
    # 检查是否使用pnpm
    if command -v pnpm &> /dev/null && [ -f "pnpm-lock.yaml" ]; then
        pnpm run build
    elif [ -f "package-lock.json" ]; then
        npm run build
    elif [ -f "yarn.lock" ]; then
        yarn build
    else
        npm run build
    fi
    
    echo -e "${GREEN}✅ 重新构建完成${NC}"
fi

# 检查dist目录是否存在
if [ ! -d "$DIST_PATH" ]; then
    echo -e "${RED}❌ dist目录不存在，请先运行构建命令${NC}"
    if [ ! -z "$NEW_VERSION" ]; then
        echo -e "${YELLOW}💡 尝试恢复备份的manifest.json...${NC}"
        if [ -f "$SRC_MANIFEST.backup" ]; then
            mv "$SRC_MANIFEST.backup" "$SRC_MANIFEST"
            echo -e "${GREEN}✅ 已恢复原始manifest.json${NC}"
        fi
    fi
    exit 1
fi

# 创建packages目录
if [ ! -d "$OUTPUT_DIR" ]; then
    mkdir -p "$OUTPUT_DIR"
    echo -e "${GREEN}📁 已创建packages目录${NC}"
fi

# 读取版本号
VERSION="unknown"
MANIFEST_PATH="$DIST_PATH/manifest.json"
if [ -f "$MANIFEST_PATH" ]; then
    # 使用jq解析JSON（如果系统有的话）
    if command -v jq &> /dev/null; then
        VERSION=$(jq -r '.version' "$MANIFEST_PATH" 2>/dev/null || echo "unknown")
    else
        # 使用grep和sed作为备用方案
        VERSION=$(grep -o '"version"[^,]*' "$MANIFEST_PATH" | sed 's/.*"version": *"//;s/".*//' 2>/dev/null || echo "unknown")
    fi
    echo -e "${GREEN}📋 检测到扩展版本: v${VERSION}${NC}"
else
    echo -e "${YELLOW}⚠️ 未找到manifest.json文件${NC}"
fi

# 生成时间戳
TIMESTAMP=$(date +"%Y-%m-%dT%H-%M-%S")
FILENAME="sinan-extension-v${VERSION}-${TIMESTAMP}.zip"
OUTPUT_PATH="$OUTPUT_DIR/$FILENAME"

echo -e "${BLUE}📦 输出文件: ${FILENAME}${NC}"

# 进入dist目录并创建zip文件
cd "$DIST_PATH"
echo -e "${BLUE}🔄 正在压缩文件...${NC}"

# 创建zip文件，排除不需要的文件
if zip -r "$OUTPUT_PATH" . -x "*.DS_Store" "*.git*" "*__pycache__*" "*.pyc" > /dev/null 2>&1; then
    # 获取文件大小
    if [ "$(uname)" == "Darwin" ]; then
        # macOS
        FILE_SIZE=$(stat -f%z "$OUTPUT_PATH")
    else
        # Linux
        FILE_SIZE=$(stat -c%s "$OUTPUT_PATH")
    fi
    
    SIZE_MB=$(echo "scale=2; $FILE_SIZE / 1024 / 1024" | bc 2>/dev/null || echo "unknown")
    
    echo -e "${GREEN}✅ 打包完成！${NC}"
    echo -e "${GREEN}📊 文件大小: ${SIZE_MB} MB${NC}"
    echo -e "${GREEN}📁 输出路径: ${OUTPUT_PATH}${NC}"
    echo ""
    echo -e "${GREEN}🎉 扩展包已准备就绪，可以上传到Chrome Web Store！${NC}"
    echo ""
    echo -e "${YELLOW}💡 提示:${NC}"
    echo -e "  - 上传前请检查manifest.json中的版本号"
    echo -e "  - 确保所有必需的权限都已正确配置"
    echo -e "  - 测试扩展的所有功能是否正常工作"
    echo -e "  - 检查Chrome Web Store的发布政策合规性"
else
    echo -e "${RED}❌ 打包失败${NC}"
    echo -e "${YELLOW}💡 可能的解决方案:${NC}"
    echo -e "  - 确保系统已安装zip命令"
    echo -e "  - 检查dist目录是否有读取权限"
    echo -e "  - 确保packages目录有写入权限"
    
    # 如果更新了版本号，恢复原始manifest.json
    if [ ! -z "$NEW_VERSION" ] && [ -f "$SRC_MANIFEST.backup" ]; then
        echo -e "${YELLOW}💡 正在恢复原始manifest.json...${NC}"
        mv "$SRC_MANIFEST.backup" "$SRC_MANIFEST"
        echo -e "${GREEN}✅ 已恢复原始manifest.json${NC}"
    fi
    
    exit 1
fi

# 清理备份文件（如果打包成功）
if [ ! -z "$NEW_VERSION" ] && [ -f "$SRC_MANIFEST.backup" ]; then
    rm -f "$SRC_MANIFEST.backup"
    echo -e "${GREEN}🧹 已清理备份文件${NC}"
fi