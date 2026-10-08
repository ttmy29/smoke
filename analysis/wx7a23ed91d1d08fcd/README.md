# wx7a23ed91d1d08fcd 解包整理

原始目录：`E:\json\new\wx7a23ed91d1d08fcd_unpacked`

这是已经提取文件的微信小游戏包，不是原始 `.wxapkg`。应用名为“一环套一环”，使用 Cocos Creator 3.8.6，竖屏，设计分辨率 750 × 1623。启动场景是 `db://assets/First/Loding-2.scene`。

## 整理结果

- `modules/`：从原始 `game.js` 按 `define("模块名", …)` 拆出的 36 个 JavaScript 模块，保留原始代码，没有改写运行逻辑。
- `manifest.json`：模块路径与大小、21 个可识别的 `System.register` 名称、场景和分包索引。
- 游戏逻辑主要分布在 `modules/assets/main/index.81ce8.js`、`modules/src/bundle-scripts/` 和原目录的 `subpackages/Interlocking/game.js`。`modules/cocos-js/cc.9d7f6.js` 主要是引擎代码。

原目录共有 894 个文件，包含 639 个 JSON、213 张 PNG、14 个 MP3、16 个图集和 3 个 BIN。这里只拆分了代码，图片、声音和资源配置仍可在原目录查看。

## 还原边界

构建产物包含压缩和字符串混淆，也没有发现 source map，因此拆分后的文件不是原始 TypeScript 工程，原始变量名、目录结构和注释无法直接恢复。配置声明了多个远程资源包；当前目录只包含 `Interlocking` 和 `resources` 两个本地分包，其他分包的资源与代码并不完整。
