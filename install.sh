#!/bin/sh
set -e

REPO="kavass168/luci-app-timecontrol-25.12"

echo "正在获取最新 Release..."
TAG=$(uclient-fetch -qO- "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null \
  | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
[ -z "$TAG" ] && { echo "错误：无法获取最新 Release"; exit 1; }

echo "标签：$TAG"
BASE_URL="https://github.com/${REPO}/releases/download/${TAG}"

# 获取 Release 中的所有 asset 文件名（通过 API）
ASSETS=$(uclient-fetch -qO- "https://api.github.com/repos/${REPO}/releases/tags/${TAG}" 2>/dev/null \
  | sed -n 's/.*"name":"\([^"]*\.apk\)".*/\1/p')

# 下载主包（匹配 luci-app-timecontrol-*.apk）
MAIN_APK=$(echo "$ASSETS" | grep '^luci-app-timecontrol-.*\.apk$' | head -1)
LANG_APK=$(echo "$ASSETS" | grep '^luci-i18n-timecontrol-zh-cn-.*\.apk$' | head -1)

if [ -z "$MAIN_APK" ] || [ -z "$LANG_APK" ]; then
  echo "错误：未找到所需的 .apk 文件"
  exit 1
fi

echo "下载：$MAIN_APK"
uclient-fetch -qO /tmp/main.apk "$BASE_URL/$MAIN_APK"
echo "下载：$LANG_APK"
uclient-fetch -qO /tmp/lang.apk "$BASE_URL/$LANG_APK"

apk add --allow-untrusted /tmp/main.apk /tmp/lang.apk
rm -f /tmp/main.apk /tmp/lang.apk

# 刷新 LuCI
rm -f /tmp/luci-indexcache /tmp/luci-modulecache/* 2>/dev/null
/etc/init.d/rpcd reload >/dev/null 2>&1

echo "✅ 安装完成！"
