# 素材需求与待确认项

## 已收到的四张参考图

用户提供的截图已本地保存到 `docs/reference/`：`01-home.png`、`02-extraction.png`、`03-session-before-ignition.png`、`04-result.png`。布局观察和第一版取舍见 `visual-reference.md`。这些是**参考图**，不会直接作为 Cocos 运行时全屏贴图使用。

## 下一批最有价值的画面

若方便，请提供一段从“长按点火”到“吸一口、吐烟、弹灰”的短录屏，或至少三张：**点燃后、正在吐烟、弹灰瞬间**。当前四图没有展示火焰、燃烧端发光、烟雾形态和灰屑运动；这些只能先做近似，标 `VISUAL_APPROX`。

## 旧包现有素材（可暂用，尚未导入新工程）

- 烟盒皮肤：`pack-skins/assets/*.jpg`、`assets/packs/life/skin.jpg`。
- 音效：`audio/ignition/*.mp3`、`audio/actions/inhale.mp3`、`audio/actions/exhale-*.mp3`、`audio/actions/ash-tap.mp3`。
- 图标：`assets/icons/*.svg`。不显示的控制项不必导入。
- 香烟本体、灰层和烟雾主要是程序绘制，尚未确认有整根香烟图片。

使用旧素材时，在资源引用处标 `LEGACY_ASSET` 与 `TODO_REPLACE`；不把旧资源目录整包复制进 `assets`。

## 已决定／未决定

- 已决定：第一版仅首页烟盒、抽烟互动、本次结果；暂不做烟票、成就、完整统计。
- 已决定：先本机演示，后续可能构建；图片音频可临时使用。
- 默认：触摸弹灰优先；晃动弹灰、麦克风吹烟不作第一版验收条件。
- 截图已确认首页使用“王溪 / WANG-XI”烟盒皮肤；首版暂以此为固定皮肤。点火后特效细节仍待图或录屏。
- 待后续：正式发布平台与微信服务，不阻塞本机演示。
