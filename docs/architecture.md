# Cocos 模块拆分（设计，尚未实现）

## 场景

第一版沿用 `assets/scenes/game.scene`，在一个场景中切换 `HomePanel`、`SessionPanel`、`ResultPanel` 三组节点。共享 Canvas、音频控制和一次会话数据；以后页面增加再拆场景。

## 建议模块

下表的脚本路径是**计划，不是现有文件**。新代码统一放在 `assets/scripts/`。当前空目录 `assets/scritpts/` 有拼写错误，创建脚本前需在 Creator 中处理，注意保留 `.meta` 一致性。

| 模块 | 建议目录 | 职责 |
| --- | --- | --- |
| `DemoFlow` | `scripts/app/` | 切换三个面板，传递会话快照。 |
| `SessionModel` | `scripts/domain/` | 与引擎无关的状态机、剩余量、吸入次数和时长。 |
| `HomeController` | `scripts/home/` | 烟盒展示、开盒、选烟和启动会话。 |
| `SessionController` | `scripts/session/` | 将输入转为会话事件并调度画面。 |
| `CigaretteView` | `scripts/session/view/` | 香烟、滤嘴、燃烧端与剩余长度的绘制。 |
| `AshEffect` | `scripts/session/effects/` | 灰段增长、弹灰和下落碎屑。 |
| `SmokeEffect` | `scripts/session/effects/` | 烟头飘烟和呼出烟雾；控制粒子数量。 |
| `SessionInput` | `scripts/session/input/` | 长按、松开、弹灰手势；以后可接入晃动。 |
| `DemoAudio` | `scripts/audio/` | 音效、静音和临时素材替换。 |
| `ResultController` | `scripts/result/` | 显示本次结果并返回首页。 |
| `AssetCatalog` | `scripts/assets/` | 集中引用临时图片和音频，标注旧包来源。 |

数据流：`SessionInput → SessionController → SessionModel → CigaretteView / AshEffect / SmokeEffect / ResultController`。画面组件不直接修改业务状态。第一版不实现烟票和十根库存，首页烟盒只是演示入口。

## 渲染与注释约定

- 固定 UI、烟盒封面：Sprite、Label、预制体。香烟先用分层 Sprite/Graphics；焦黑渐变需要时改用贴图或材质，不逐句翻译旧 Canvas 代码。
- 烟雾、灰屑：ParticleSystem2D 或池化 Sprite；离开互动页时停止输入、计时器、音效和粒子。
- 状态转换注释写清前置状态及拒绝原因，不只复述代码。
- 临时旧素材标注 `LEGACY_ASSET: <旧包相对路径>; TODO_REPLACE: <替代物>`。
- 尚待截图核对的视觉标注 `VISUAL_APPROX`；暂缓功能统一记录在 `requirements.md`，不留无归属的空按钮。
