# 通用 UI 组件

两个组件位于 `assets/scripts/common/`，可以挂到其他预制体上复用。当前首页已自动接入，业务回调由 `HomeController` 提供。视觉效果由用户查看和验收，Codex 只做必要的编译、代码及业务逻辑检查。

## 开发前检查

涉及 UI 尺寸、运行时 Label 或输入框时，先阅读 [UI 易错点与复用约定](ui-pitfalls.md)。其中记录了本项目的混合单位比例失衡，以及 EditBox 默认 label 残留、锚点错位、多行滚动条和手机 `scrollIntoView` 空引用的具体原因、配置顺序与清理约定。UIButton／TextSweep 不包含通用输入框管理，不能假设复用这两个组件会自动处理 EditBox 生命周期。

## UIButton

在 Creator 的组件菜单 `UI/UIButton` 中添加到点击区域节点，例如 `button/bg`。组件自动依赖一个 Cocos Button，用该节点的 UITransform 处理命中；原生 Button 的过渡设为 NONE，由通用组件统一提供反馈。

| 配置 | 默认值 | 用途 |
| --- | --- | --- |
| `tintTarget` | 当前节点的 Sprite | 接受按下和禁用变色的图片 |
| `pressedTint` | 220,220,220 | 与原颜色相乘，按下时略微变暗 |
| `disabledTint` | 140,140,140 | 禁用颜色，保留原透明度 |
| `visualTarget` | 空 | 可选的缩放对象，例如 `bg/visual` 或同组图标 |
| `pressScale` | 0.96 | 缩放对象的按下比例 |
| `pressDuration` / `releaseDuration` | 0.08 / 0.12 秒 | 按下与回弹时间 |
| `clickInterval` | 0.2 秒 | 两次有效业务回调的最小间隔 |
| `clickSound` / `soundVolume` | 无 / 0.8 | 可选点击音效；未配置不播放 |
| `clickEvents` | 空 | 在 Inspector 绑定业务组件方法 |

缩放对象不能是点击节点本身或其祖先，否则组件会跳过缩放，避免改变点击区域。变色作用于显示图片，不修改 UITransform。按下取消、组件停用时恢复原颜色和缩放；只停止自身创建的 Tween。

代码接入：

```ts
import { UIButton } from '../common/UIButton';

const control = UIButton.bind(bg, () => this.openPage());
control.clickInterval = 0.25;
control.interactable = false; // 业务繁忙时锁定
control.interactable = true;
control.setHandler(() => this.openAnotherPage()); // 替换回调
control.setHandler(null); // 保留反馈，暂不接业务
```

改变 `visualTarget` 等运行时目标配置后调用 `refreshFeedback()`；透明背景可通过 `setTintTarget(sprite)` 指定同组图标。原生 Button 的 `interactable` 被外部修改时，组件也会同步禁用反馈。

业务回调使用 `UIButton.setHandler` 或 `UIButton.clickEvents` 配置。自行监听原生 `Button.EventType.CLICK` 或在原生 Button 配置 `clickEvents` 的回调不会经过本组件的防连点管理。需要统一防连点的业务应迁入 UIButton。

当前首页接入位置：

- `top/ts/bg`：额外烟票教程入口，沿用背景当前的 440×89 点击区，按压变色，打开 `DesktopGuide`。
- `top/button1/icon`：设置入口直接按 icon 的 UITransform 命中（当前 91×91），使用 Sprite 按压变色，点击打开 Graphics 设置页。
- `top/button2～button6/bg`。
- `side/record/bg`、`record2/bg`、`record3/bg`。
- `bottom/buttons/Node/bg`、`Node2/bg`、`one/bg`。

这些位置的父节点 Button 停用。普通背景图片使用变色反馈；没有 Sprite 的导航背景使用同组图标的变色与缩放反馈。尚未开放的业务入口仍不跳转；底部导航通过 `setBottomNavigationHandlers` 接入全服切换，全服页复用导航副本，返回“来一根”首页。

## TextSweep

从组件菜单 `UI/TextSweep` 添加到文字 Label 所在节点，例如 `bottom/buttons/one/Label`。组件读取该 Label 的文案、系统字体、字号、粗体和斜体设置；运行时暂时停用 Label 自身渲染，以同一张 Canvas 绘制底字和亮带，避免双份文字错位。组件停用后恢复 Label 原来的渲染状态，销毁时释放自建纹理。

| 配置 | 默认值 | 用途 |
| --- | --- | --- |
| `duration` | 2.8 秒 | 完整循环周期 |
| `direction` | LeftToRight | 左到右或右到左 |
| `baseColor` | 暖金 | 底字颜色 |
| `highlightColor` / `accentColor` | 白金 / 暖金 | 亮带颜色 |
| `glowColor` / `glowBlur` | 暖橙 / 26 | 文字发光颜色与范围 |
| `bandWidth` | 224 | 亮带宽度，使用节点的设计单位 |
| `letterSpacingRatio` | 0.11 | 字号比例字距，另叠加 Label.spacingX |
| `framesPerSecond` | 30 | 纹理更新频率，上限 60 |
| `playOnEnable` | true | 未被代码覆盖时是否播放 |

代码接入：

```ts
import { TextSweep, TextSweepDirection } from '../common/TextSweep';

const effect = label.node.getComponent(TextSweep) ?? label.node.addComponent(TextSweep);
effect.setText('来一根');
effect.duration = 2.8;
effect.direction = TextSweepDirection.LeftToRight;
effect.refresh();
effect.setPlaying(false); // 保留底字，暂停并去除亮带
effect.setPlaying(true);  // 从原相位继续
effect.restart();         // 重置相位
effect.setText('补一盒');
```

修改 Label 文案或样式会自动刷新，也可调用 `refresh()` 立即更新。组件会按字形测量结果和发光边距调整自己的纹理尺寸，同时刷新 SpriteFrame 显示区域，并继承 Label 节点的渲染层。首次绘制与上传成功后才停用原 Label；初始化或绘制报错时恢复原 Label，防止文字随扫光故障一起消失。

当前 `one/icon` 图片隐藏，“来一根”和“补一盒”共用 `one/Label` 上的 TextSweep；`HomeController` 仅设置文案与播放状态。开盖和取烟时暂停亮带，空盒“补一盒”仍可扫光，存档不可用时只显示“烟盒不可用”。

此版本沿用项目的浏览器 CanvasTexture 桥接，适用于浏览器运行的单行、居中、系统字体文字；多行排版、Cocos 自定义字体资源和原生／小游戏发布需另外适配。组件不依赖首页存档或业务控制器。

## 代码检查

`node tools/test-ui-button.cjs` 检查回调替换、防连点、禁用、Inspector 事件路由和监听解绑，不做动画或画面效果验证。
