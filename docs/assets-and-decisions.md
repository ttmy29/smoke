# 素材需求与待确认项

选盒 UI 最新补充：祖国 `pack-v1.jpg` 已依旧包来源取得并通过原大小／MD5 校验，导入 `assets/legacy-temp/pack-skins/assets/zuguo.jpg`。选盒页使用九款皮肤，无影烟按旧包隐藏盒体；回调接口和使用边界见 [选盒页](pack-select.md)。

## 已收到的四张参考图

用户提供的截图已本地保存到 `docs/reference/`：`01-home.png`、`02-extraction.png`、`03-session-before-ignition.png`、`04-result.png`。布局观察和第一版取舍见 `visual-reference.md`。这些是**参考图**，不会直接作为 Cocos 运行时全屏贴图使用。

## 下一批最有价值的画面

若方便，请提供一段从“长按点火”到“吸一口、吐烟、弹灰”的短录屏，或至少三张：**点燃后、正在吐烟、弹灰瞬间**。当前四图没有展示火焰、燃烧端发光、烟雾形态和灰屑运动；这些只能先做近似，标 `VISUAL_APPROX`。

## 旧包现有素材

- 烟盒皮肤：`pack-skins/assets/*.jpg`、`assets/packs/life/skin.jpg`。
- 音效：`audio/ignition/*.mp3`、`audio/actions/inhale.mp3`、`audio/actions/exhale-*.mp3`、`audio/actions/ash-tap.mp3`。
- 图标：`assets/icons/*.svg`。不显示的控制项不必导入。
- 香烟本体、灰层和烟雾主要是程序绘制，尚未确认有整根香烟图片。

使用旧素材时，在资源引用处标 `LEGACY_ASSET` 与 `TODO_REPLACE`；不把旧资源目录整包复制进 `assets`。

### 已导入的首版临时资源（2026-09-24）

- `assets/resources/textures/packs/wang-xi.jpg` ← `assets/packs/life/skin.jpg`。
- `assets/resources/audio/ignition.mp3` ← `audio/ignition/ember-wheel.mp3`。
- `assets/resources/audio/inhale.mp3` ← `audio/actions/inhale.mp3`。
- `assets/resources/audio/exhale.mp3` ← `audio/actions/exhale-soft.mp3`。
- `assets/resources/audio/ash-tap.mp3` ← `audio/actions/ash-tap.mp3`。

资源引用和替换标记集中在 `assets/scripts/assets/AssetCatalog.ts`。运行时仍仅接入上述资源。2026-10-16 已将当前缺少的 29 个本地音频和 7 张普通烟盒图片复制至 Cocos `assets` 之外的 [素材暂存目录](../legacy-assets/v1.0.8-merged/README.md)，尚未导入或接入；版本、用途和远程资源缺口见 [素材审计](legacy-asset-audit.md)。

后续导入已完成：上述 36 份素材已进入 `assets/legacy-temp/` 独立 Bundle，Creator 元数据和导入产物已核对；[导入清单](../legacy-assets/v1.0.8-merged/cocos-import.json) 提供路径与 UUID。仅导入，不替换现有素材，不修改运行逻辑。

## 已决定／未决定

- 已决定：第一版仅首页烟盒、抽烟互动、本次结果；暂不做烟票、成就、完整统计。
- 已决定：先本机演示，后续可能构建；图片音频可临时使用。
- 默认：触摸弹灰优先；晃动弹灰、麦克风吹烟不作第一版验收条件。
- 截图已确认首页使用“王溪 / WANG-XI”烟盒皮肤；首版暂以此为固定皮肤。点火后特效细节仍待图或录屏。
- 待后续：正式发布平台与微信服务，不阻塞本机演示。
