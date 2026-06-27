#!/bin/sh
set -e

REPO="kavass168/luci-app-timecontrol-25.12"

echo "正在获取最新 Release..."
TAG=$(uclient-fetch -qO- "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null \
  | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)

[ -n "$TAG" ] || { echo "错误：无法获取最新 Release"; exit 1; }

echo "最新标签：$TAG"
BASE_URL="https://github.com/${REPO}/releases/download/${TAG}"

# 获取该 Release 的所有 asset 下载 URL
ASSETS_JSON=$(uclient-fetch -qO- "https://api.github.com/repos/${REPO}/releases/tags/${TAG}" 2>/dev/null)
APK_URLS=$(echo "$ASSETS_JSON" | grep -o '"browser_download_url":"[^"]*\.apk"' | sed 's/"browser_download_url":"//;s/"//')

if [ -z "$APK_URLS" ]; then
    echo "错误：该 Release 中没有 .apk 文件。"
    exit 1
fi

echo "找到以下 .apk 文件："
echo "$APK_URLS" | while read url; do echo "  $(basename "$url")"; done

# 筛选主包：文件名以 luci-app-timecontrol- 开头
MAIN_URL=$(echo "$APK_URLS" | grep -E 'luci-app-timecontrol-[^/]+\.apk$' | head -1)
# 筛选语言包：文件名以 luci-i18n-timecontrol-zh-cn- 开头
LANG_URL=$(echo "$APK_URLS" | grep -E 'luci-i18n-timecontrol-zh-cn-[^/]+\.apk$' | head -1)

if [ -z "$MAIN_URL" ]; then
    echo "错误：未找到主包（luci-app-timecontrol-*.apk）"
    exit 1
fi

if [ -z "$LANG_URL" ]; then
    echo "警告：未找到中文语言包，将只安装主包。"
fi

echo "下载主包：$(basename "$MAIN_URL")"
uclient-fetch -qO /tmp/main.apk "$MAIN_URL"

if [ -n "$LANG_URL" ]; then
    echo "下载语言包：$(basename "$LANG_URL")"
    uclient-fetch -qO /tmp/lang.apk "$LANG_URL"
    APK_INSTALL="/tmp/main.apk /tmp/lang.apk"
else
    APK_INSTALL="/tmp/main.apk"
fi

echo "安装（跳过签名验证）..."
apk add --allow-untrusted $APK_INSTALL

rm -f /tmp/main.apk /tmp/lang.apk 2>/dev/null

# 刷新 LuCI
rm -f /tmp/luci-indexcache /tmp/luci-modulecache/* 2>/dev/null
/etc/init.d/rpcd reload >/dev/null 2>&1

echo "✅ 安装完成！"
