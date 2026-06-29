> 由于 OpenWrt 25.12 开始使用 `apk` 包管理器，
> 本项目目前以 **未签名的 APK** 形式发布。
>
> 一键安装命令（仅限 `25.12` 以上）：
> ```
> uclient-fetch -qO- https://raw.githubusercontent.com/kavass168/luci-app-timecontrol-25.12/main/install.sh | sh
> ```


# 2. 查看内容（确认无误）
cat /tmp/install.sh

# 3. 执行
sh /tmp/install.sh
> ```
> 
请 **认真阅读完毕** 本页面，本页面包含注意事项和如何使用。

## 功能说明：

复制开源项目：https://github.com/sirpdboy/luci-app-timecontrol 感谢作者。本人只是做简单适配25.12,，修改添加些功能。
添加多时段控制支持，添加流量感知计时。
