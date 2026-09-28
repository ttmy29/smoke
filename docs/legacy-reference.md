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

### 会话动效与位置核对（2026-09-24）

- `presentation/motion-timings.js` 与 `presentation/session-entry-motion.js`：默认取烟过渡约 1350 ms，前奏 220 ms；先向上提烟，再朝会话页目标位置平移、放大、从 180° 转正，烟盒同时渐隐。
- `components/session-experience/session-experience.js`：点火长按阈值约 680 ms；吸气满 3000 ms 自动结束，松手可提前结束。吸气超过 300 ms 才进入吐气，吐气持续本次吸气时长。
- `presentation/smoking-visual-policy.js`：吸气橙色光圈中心约在画面宽度 50%、高度 47%，半径从 0 增至 `min(宽度×0.36, 高度×0.19)`；吐气白圈反向收缩。人物吐气起点横向居中、纵向约在画面高度 68%–78%。
- `presentation/tip-smoke.js`：烟头细烟最多四条轨迹，约每 75 ms 追加轨迹点、持续约 6.8 秒，向上漂移；只在待机或吐气阶段产生新细烟。
- `presentation/smoking-particles.js`：人物吐气烟雾从下方起点生成，粒子有横向散开与向上速度；寿命按 `(1.35+random×(0.65+2.1×强度))×烟量修正` 秒变化，并非固定 1.35–2.1 秒；强度随吸气时长变化。
- `domain/smoking-physics.js` 与互动组件的 `drawAshStack`：烟灰随燃烧量增长，首次灰帽临界/预警阈值原版在 0.56–0.70 随机；但 `canFlickSmokingAsh` 只要求已有灰或弹灰历史，**并不以该阈值禁止弹灰**。弹灰后留下 10%–82% 残灰；灰帽有断口、短暂抖动和下落碎屑。当前演示版把固定 0.56 错用成弹灰硬门槛，差异见 `legacy-vs-current.md`。

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
- 全包入口清单与可静态识别方法见 `legacy-module-index.md`；会话逐方法、时间与 Graphics 规则见 `legacy-rules.md`；当前实现差异见 `legacy-vs-current.md`。
