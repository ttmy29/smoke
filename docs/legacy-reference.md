# 旧微信小程序编译包参考（只读）

实际目录：`E:\json\smoke_wxd0b7dafebccb8110_unpacked`。用户先前给出的 `E:\json\smoke\_wxd0b7dafebccb8110\_unpacked` 当前不存在。

此包是“来一根再说”的微信小程序**编译产物**，不是 Cocos 工程，也不是可直接导入的源码。`app-config.json` 声明 `webview` 渲染和 `glass-easel` 组件框架；业务模块虽保留 `currentFile` 路径，但合并在 `appservice.app.js` 和各 `chunk_*.appservice.js` 中。新项目按行为重新实现。

## 与第一版相关的已确认行为

| 旧逻辑 | 编译包内位置 | 新项目处理 |
| --- | --- | --- |
| 取烟、点火、待机、吸入、呼出、完成/熄灭 | `appservice.app.js`：`domain/cyber-session-v3.js` | 提炼为 `SessionModel`。 |
| 吸入时长与燃烧量 | `domain/cyber-session.js` | 参考行为，首版不要求数值完全一致。 |
| 香烟、燃烧端、烟灰几何 | `domain/smoking-physics.js`、`presentation/cigarette-tip-material.js` | Cocos 分层绘制；视觉待截图确认。 |
| 长按、弹灰、绘制和音效 | 根目录 `chunk_3.appservice.js`：`components/session-experience/session-experience.js` | 拆为输入、控制、视图、特效。 |
| 烟头飘烟、呼出烟粒子 | `presentation/tip-smoke.js`、`presentation/smoking-particles.js` | 基础 2D 特效优先，复杂烟圈暂缓。 |
| 灰生长与弹落 | `domain/smoking-physics.js`：`growSmokingAsh`、`flickSmokingAsh`；互动组件：`drawAshStack`、`updateAshBreak` | 数据和视觉分离。 |
| 本次结果 | `record-pages/chunk_4.appservice.js` 的结果页 | 首版只显示本次，不做完整历史。 |

### 两种结束路径（2026-09-23 核对）

- `domain/cyber-session-v3.js`：`extinguishCyberSessionV3` 将 `phase` 置为 `EXTINGUISHED`、`outcome` 置为 `extinguished`；自然消耗至 `remainingPermille === 0` 后置为 `FINISHED`、`finished`。两者都记录 `endedAt`。
- `components/session-experience/session-experience.js`：顶部“熄灭”按钮调用 `stopSession`，主动结束并走 `completeAndRoute`；自然燃尽在吸入结束或呼出结束后也进入 `completeAndRoute`。该函数停止声音与动画、提交记录，再导航结果页；有防重复标志。
- 会话页自身的结束提示不同：`FINISHED` 为“这根结束了”，`EXTINGUISHED` 为“已经熄灭”。
- `record-pages/chunk_4.appservice.js` 的**烟盒来源**结果模型并未按 `outcome` 更改单根结果标题：通常仍是“这一根，抽完了”；标题另受整盒是否用完、是否结算影响。**散烟盒来源**的副标题才按 `outcome` 显示“自然抽完”或“提前熄灭”。不要把旧代码说成烟盒结果页已按两种结束原因分别展示。

旧包的烟盒库存、烟票、历史分页、成就等模块存在，但第一版**不移植**，详见 `requirements.md`。

## 使用边界

- 旧包没有原始 `.ts`、`.vue`、`.wxml`、`.wxss` 或 sourcemap；其小程序页面运行时代码不能直接成为 Cocos 组件。
- 香烟本体、灰层和烟雾主要由旧代码程序绘制；不能假设有可直接拖入 Cocos 的整根香烟 PNG。
- 用户允许临时使用图片和音频，后续替换；导入时记录来源，勿修改旧包。
- 本文是旧包**已观察事实**；`architecture.md` 是新工程**设计方案**，不可混淆。
