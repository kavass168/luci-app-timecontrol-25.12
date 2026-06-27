#!/bin/sh
set -e

REPO="kavass168/luci-app-timecontrol-25.12"

echo "正在获取最新 Release..."
# 与你的原始脚本完全相同，获取最新 Release 的 tag_name
TAG=$(uclient-fetch -qO- "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null \
  | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)

[ -n "$TAG" ] || { echo "错误：无法获取最新 Release"; exit 1; }

echo "最新标签：$TAG"
BASE_URL="https://github.com/${REPO}/releases/download/${TAG}"

# ----- 关键改进：直接从该 Release 的 assets 中提取文件名 -----
# 调用 /releases/tags/{tag} 获取该标签下的所有 asset 信息
ASSETS_JSON=$(uclient-fetch -qO- "https://api.github.com/repos/${REPO}/releases/tags/${TAG}" 2>/dev/null)

# 提取所有 .apk 的下载 URL（用 grep 和 sed 解析）
APK_URLS=$(echo "$ASSETS_JSON" | grep -o '"browser_download_url":"[^"]*\.apk"' | sed 's/"browser_download_url":"//;s/"//')

if [ -z "$APK_URLS" ]; then
    echo "错误：该 Release 中没有 .apk 文件。"
    exit 1
fi

# 筛选出主包和语言包（按文件名模式）
MAIN_URL=$(echo "$APK_URLS" | grep 'luci-app-timecontrol-.*\.apk' | head -1)
LANG_URL=$(echo "$APK_URLS" | grep 'luci-i18n-timecontrol-zh-cn-.*\.apk' | head -1)

if [ -z "$MAIN_URL" ] || [ -z "$LANG_URL" ]; then
    echo "错误：未找到主包或语言包。"
    echo "可用的 .apk 文件："
    echo "$APK_URLS"
    exit 1
fi

echo "下载主包：$(basename "$MAIN_URL")"
uclient-fetch -qO /tmp/main.apk "$MAIN_URL"

echo "下载语言包：$(basename "$LANG_URL")"
uclient-fetch -qO /tmp/lang.apk "$LANG_URL"

echo "安装（跳过签名验证）..."
apk add --allow-untrusted /tmp/main.apk /tmp/lang.apk

rm -f /tmp/main.apk /tmp/lang.apk

# 刷新 LuCI
rm -f /tmp/luci-indexcache /tmp/luci-modulecache/* 2>/dev/null
/etc/init.d/rpcd reload >/dev/null 2>&1

echo "✅ 安装完成！"
