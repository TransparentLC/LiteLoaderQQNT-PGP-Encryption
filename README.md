# LiteLoaderQQNT-PGP-Encryption

在 QQ 中使用 PGP 进行端到端加密，支持半自动加密和自动解密。

![](https://p.sda1.dev/20/46239ec68b0c24bb19a5a65d0d80ea1c)

目前已经有了一些提供加密功能的 QQNT 插件（例如[歪比巴卜](https://github.com/yuyumoko/LiteLoaderQQNT-Plugin-Eencode)和 [Encrypt Chat](https://github.com/WJZ-P/LiteLoaderQQNT-Encrypt-Chat)），不过这些插件采用的都是自定义的密钥管理和加密数据格式，无法在 QQNT 以外的环境下使用。

而 PGP 是一套非常成熟、久经考验、且已经高度标准化的加密协议，你可以在任何支持 PGP 的客户端上解密使用 PGP 标准加密的数据，例如 [GnuPG](https://gnupg.org/)、[OpenKeychain](https://www.openkeychain.org/)、[Thunderbird](https://www.thunderbird.net/) 等等。这个插件允许你在 QQ 上更方便地使用 PGP 加密。

使用插件前需要安装 [GnuPG](https://gnupg.org)。

> [!IMPORTANT]  
> 由于目前使用 LiteLoaderQQNT 会被检测（参见 LiteLoaderQQNT 的 Issue [#1051](https://github.com/LiteLoaderQQNT/LiteLoaderQQNT/issues/1051)、[#1044](https://github.com/LiteLoaderQQNT/LiteLoaderQQNT/issues/1044)、[#1032](https://github.com/LiteLoaderQQNT/LiteLoaderQQNT/issues/1032)），且我自己已经因此被封号两次，因此我暂时无法使用 LiteLoaderQQNT 并测试和更新这个项目。
>
> 如果你遇到了问题，请尽量提供 `gpg --list-secret-keys`、`gpg --list-keys`、添加 `--enable-logging` 参数启动 QQ 后终端和以及 DevTools 中和这个项目相关的输出（可以对敏感信息脱敏），我会尽量修复不需要运行 QQ 就能处理的问题。

## 使用方式

### 一些简单的基本概念

* PGP 密钥由私钥和公钥组成，拥有私钥可以导出对应的公钥，反之不行
* 私钥需要保密，公钥可以公开
* 想要向别人发送加密消息，需要使用他的公钥将消息加密
* 使用对应的私钥解密收到的加密消息
* 发送消息时，可以使用私钥对消息进行签名，来表示消息是由你（持有这个私钥的人）发出的
* 使用对应的公钥验证签名
* 在 PGP 中，私钥和公钥一般是以 `-----BEGIN/END PGP PRIVATE/PUBLIC KEY BLOCK-----` 开头和结尾、中间是一串 Base64 的文本文件

你可以查找更多关于 PGP 的介绍。

![](https://p.sda1.dev/20/7bee6e77e0c5273da705aa30ffe9bb03)

### 钥匙串

插件会读取你在 GnuPG 中添加过的密钥。

如果你需要给某个人发送加密消息，你需要通过各种方式获得他的公钥，然后保存到钥匙串中。

你也可以将你自己的个人密钥（私钥）保存到钥匙串中，虽然对于发送加密消息来说这不是必须的。如果你没有个人密钥，可以自己生成一个。

### 解密

当你在聊天窗口、合并转发和聊天记录中收到了 `-----BEGIN/END PGP MESSAGE-----` 开头和结尾的 PGP 加密消息，这个插件就会自动尝试解密，并展示解密结果。

将鼠标放到“PGP 加密消息”的文字提示上，会显示加密和签名消息使用的密钥。你需要持有对应的私钥才能解密消息。

点击🔓图标可以在显示解密结果和原始密文之间切换，右键复制时复制的仍然是密文。

### 加密

你需要在“密钥设置”→“公钥绑定”中将公钥与 QQ 号或群号绑定，这样插件就可以知道使用哪个密钥加密了。在对应的聊天窗口左下角会有“PGP 加密可用”的提示，此时按下 <kbd>Ctrl + /</kbd> 即可加密输入窗口内的文本。

如果你设置了个人密钥，则消息也会使用该密钥进行加密和签名。反之则消息不会被签名，且发送后你自己也无法解密。

> [!NOTE]
> 如果密文需要被复制到 GnuPG 以外的 PGP 客户端上解密，你可能需要在加密前在 GnuPG 中修改你的密钥，关闭 AEAD (OCB) 加密模式，它目前存在兼容性问题。
>
> 参见：
>
> * [Should one really disable AEAD for recent GnuPG created PGP keys? - Information Security Stack Exchange](https://security.stackexchange.com/questions/275883)
> * [GnuPG - ArchWiki (8.1 Disable unsupported AEAD mechanism)](https://wiki.archlinux.org/title/GnuPG#Disable_unsupported_AEAD_mechanism)

## 局限性

* **只能处理纯文本**，无法处理图片、视频、文件等数据
* 可能会与其他修改界面和消息发送的插件冲突

## 借物表

* 插件模板修改自 [MisaLiu/LiteLoaderQQNT-PluginTemplate-Vite](https://github.com/MisaLiu/LiteLoaderQQNT-PluginTemplate-Vite)
