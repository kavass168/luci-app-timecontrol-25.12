> 由于 OpenWrt 25.12 开始使用 `apk` 包管理器，
> 本项目目前以 **未签名的 APK** 形式发布。
>
> 一键安装命令（仅限 `25.12` 以上）：
> ```
> uclient-fetch -qO- https://github.com/kavass168/luci-app-timecontrol-25.12/edit/main/install.sh | sh
> ```
> 
请 **认真阅读完毕** 本页面，本页面包含注意事项和如何使用。

## 功能说明：

### 2025.12.28 上网时间控制js版 v3.2.1 为方便统一名字用回luci-app-timecontrol

- 1.升级JS版本，全新整理制作。
- 2.修复NFT模式上个版本无法使用问题
- 3.增加日志显示功能，实时显示增加或者删除的机器限制等。
- 4.增加普通管制功能。
- 5.增强强力管控力度，增加即时断开功能。

- 1. Upgrade the JS version and completely reorganize and produce it.
- 2. Fix the issue that the previous version of NFT mode was unusable
- 3. Add a log display function to show in real-time any additions or deletions of machine restrictions.
- 4. Add general control functions.
- 5. Enhance strong control measures and add an instant disconnection function.

### 上网时间控制NFT版2.0.2版

#### 专门针对24.10分支，适配NFT的上网时间控制插件。21.04NFT版名字：luci-app-nft-timecontrol 2.X ,18.06名字：luci-app-timecontrol 1.X（早期几年前做的版本）


## 编译使用方法 [![](https://img.shields.io/badge/-编译使用方法-F5F5F5.svg)](#编译使用方法-)

将luci-app-timecontrol添加至 LEDE/OpenWRT 源码的方法。

### 下载源码方法一：
编辑源码文件夹根目录feeds.conf.default并加入如下内容:

```Brach
    # feeds获取源码：
    src-git timecontrol  https://github.com/sirpdboy/luci-app-timecontrol
 ``` 
  ```Brach
   # 更新feeds，并安装主题：
    scripts/feeds update timecontrol
	scripts/feeds install luci-app-timecontrol
 ``` 	

### 下载源码方法：
 ```Brach
    # 下载源码
    git clone https://github.com/sirpdboy/luci-app-timecontrol package/luci-app-timecontrol
    make menuconfig
 ``` 
### 配置菜单
 ```Brach
    make menuconfig
	# 找到 LuCI -> Applications, 选择 luci-app-timecontrol（18.06 timecontrol，24.10选择nft-timecontrol), 保存后退出。
 ``` 
### 编译
 ```Brach 
    # 编译固件
    make package/luci-app-timecontrol/compile V=s
 ```

## 说明 [![](https://img.shields.io/badge/-说明-F5F5F5.svg)](#说明-)

源码来源：https://github.com/sirpdboy/luci-app-timecontrol


- 你可以随意使用其中的源码，但请注明出处。

![screenshots](https://raw.githubusercontent.com/sirpdboy/openwrt/master/doc/说明2.jpg)

## 界面

![screenshots](./doc/timecontrol1.png)

![screenshots](./doc/timecontrol2.png)

# My other project

- 路由安全看门狗 ：https://github.com/sirpdboy/luci-app-watchdog
- 网络速度测试 ：https://github.com/sirpdboy/luci-app-netspeedtest
- 计划任务插件（原定时设置） : https://github.com/sirpdboy/luci-app-taskplan
- 关机功能插件 : https://github.com/sirpdboy/luci-app-poweroffdevice
- opentopd主题 : https://github.com/sirpdboy/luci-theme-opentopd
- kucat酷猫主题: https://github.com/sirpdboy/luci-theme-kucat
- kucat酷猫主题设置工具: https://github.com/sirpdboy/luci-app-kucat-config
- NFT版上网时间控制插件: https://github.com/sirpdboy/luci-app-timecontrol
- 家长控制: https://github.com/sirpdboy/luci-theme-parentcontrol
- 定时限速: https://github.com/sirpdboy/luci-app-eqosplus
- 系统高级设置 : https://github.com/sirpdboy/luci-app-advanced
- ddns-go动态域名: https://github.com/sirpdboy/luci-app-ddns-go
- 进阶设置（系统高级设置+主题设置kucat/agron/opentopd）: https://github.com/sirpdboy/luci-app-advancedplus
- 网络设置向导: https://github.com/sirpdboy/luci-app-netwizard
- 一键分区扩容: https://github.com/sirpdboy/luci-app-partexp
- lukcy大吉: https://github.com/sirpdboy/luci-app-lukcy

## 捐助

![screenshots](https://raw.githubusercontent.com/sirpdboy/openwrt/master/doc/说明3.jpg)

|     <img src="https://img.shields.io/badge/-支付宝-F5F5F5.svg" href="#赞助支持本项目-" height="25" alt="图飞了😂"/>  |  <img src="https://img.shields.io/badge/-微信-F5F5F5.svg" height="25" alt="图飞了😂" href="#赞助支持本项目-"/>  | 
| :-----------------: | :-------------: |
|![xm1](https://raw.githubusercontent.com/sirpdboy/openwrt/master/doc/支付宝.png) | ![xm1](https://raw.githubusercontent.com/sirpdboy/openwrt/master/doc/微信.png) |

<a href="#readme">
    <img src="https://img.shields.io/badge/-返回顶部-orange.svg" alt="图飞了😂" title="返回顶部" align="right"/>
</a>
