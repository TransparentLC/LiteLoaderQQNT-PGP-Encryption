# LiteLoaderQQNT-PGP-Encryption

在 QQ 中使用 PGP 进行端到端加密，支持半自动加密和自动解密。

![](https://p.sda1.dev/20/46239ec68b0c24bb19a5a65d0d80ea1c)

目前已经有了一些提供加密功能的 QQNT 插件（例如[歪比巴卜](https://github.com/yuyumoko/LiteLoaderQQNT-Plugin-Eencode)和 [Encrypt Chat](https://github.com/WJZ-P/LiteLoaderQQNT-Encrypt-Chat)），不过这些插件采用的都是自定义的密钥管理和加密数据格式，无法在 QQNT 以外的环境下使用。

而 PGP 是一套非常成熟、久经考验、且已经高度标准化的加密协议，你可以在任何支持 PGP 的客户端上解密使用 PGP 标准加密的数据，例如 [GnuPG](https://gnupg.org/)、[OpenKeychain](https://www.openkeychain.org/)、[Thunderbird](https://www.thunderbird.net/) 等等。这个插件允许你在 QQ 上更方便地使用 PGP 加密。

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

插件的数据目录 `/path/to/LiteLoaderQQNT/data/PGP_Encryption/keychain` 相当于你的“钥匙串”，你可以把你需要使用的密钥放在这里。

如果你需要给某个人发送加密消息，你需要通过各种方式获得他的公钥，然后保存到钥匙串中。

你也可以将你自己的个人密钥（私钥）保存到钥匙串中，虽然对于发送加密消息来说这不是必须的。如果你没有个人密钥，可以自己生成一个。

如果你安装了 GnuPG，可以使用 `gpg --armor --export` 和 `gpg --armor --export-secret-keys` 导出已有的密钥。

### 解密

当你在聊天窗口、合并转发和聊天记录中收到了 `-----BEGIN/END PGP MESSAGE-----` 开头和结尾的 PGP 加密消息，这个插件就会自动尝试解密，并展示解密结果。

将鼠标放到“PGP 加密消息”的文字提示上，会显示加密和签名消息使用的密钥。你需要持有对应的私钥才能解密消息。

点击🔓图标可以在显示解密结果和原始密文之间切换，右键复制时复制的仍然是密文。

### 加密

你需要在“密钥设置”→“公钥绑定”中将公钥与 QQ 号或群号绑定，这样插件就可以知道使用哪个密钥加密了。在对应的聊天窗口左下角会有“PGP 加密可用”的提示，此时按下 <kbd>Ctrl + /</kbd> 即可加密输入窗口内的文本。

如果你设置了个人密钥，则消息也会使用该密钥进行加密和签名。反之则消息不会被签名，且发送后你自己也无法解密。

## 局限性

* **只能处理纯文本**，无法处理图片、视频、文件等数据
* 不支持使用密码保护的私钥
* 忽略密钥有效期、是否撤销、密钥用途等属性
* 使用 OpenPGP.js v5 而不是最新的 v6（解密时会出现 Key Data Integrity failed 错误，但是相同的密文和密钥在 Node.js 23 上可以正常解密）
* 可能会与其他修改界面和消息发送的插件冲突

## 借物表

* 插件模板修改自 [MisaLiu/LiteLoaderQQNT-PluginTemplate-Vite](https://github.com/MisaLiu/LiteLoaderQQNT-PluginTemplate-Vite)
* PGP 实现来自 [OpenPGP.js](https://openpgpjs.org/)
