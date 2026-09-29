# 旧微信小程序编译包参考（只读）

> **当前基准（2026-09-29）：V1.0.8。**参考目录为 `E:\json\wxd0b7dafebccb8110_unpacked`。下方原“实际目录”句只记录 V1.0.7 审计来源，已不再代表当前验收版本。

大目录是 V1.0.7 与 V1.0.8 的合并解包结果：V1.0.7 的 182 个文件仍以原名保留，V1.0.8 与旧文件冲突时多数以 `-1` 后缀保存，另有 239 个新增文件。两目录共有的 182 个路径 SHA-256 全部一致，因此不能把大目录中的无后缀旧文件误判为 V1.0.8。

V1.0.8 读取规则：优先使用 `app-config-1.json`、`app-wxss-1.js`、`app-service-1.js`、`appservice.app-1.js` 和同名 `*-1` 文件；首页使用 `chunk_6.webview-1.js`、`chunk_6.appservice-1.js`。`chunk_10`～`chunk_13`、`world-tools/`、`custom-tab-bar/` 是新增内容，按原名读取。若历史审计与这些文件冲突，以 V1.0.8 为准。

首页 UI 核对顺序：先从 V1.0.8 模板、最终级联样式和组件代码确定区域顺序、父子关系、百分比宽高、Flex/媒体查询、偏移与缩放，再换算至 Cocos。参考图片仅用于补齐大致区域与视觉组成，不用于量取按钮或烟盒的精确位置、宽高、间距；图片与代码不一致时以 V1.0.8 代码为准。无法从代码确认的数值应标为待确认，不从截图猜测。

V1.0.8 明确包含底部自定义导航，两个入口依次为“来一根”和“全服”；“全球”是此前误述。导航视觉参数与当前仅做静态 UI、点击无效果的范围见 `requirements.md`。

V1.0.7 历史审计目录：`E:\json\smoke_wxd0b7dafebccb8110_unpacked`。此前关于其他路径不存在的判断已被后续 V1.0.8 目录核对结果取代。

V1.0.7 历史包与 V1.0.8 都是“来一根再说”的微信小程序**编译产物**，不是 Cocos 工程，也不是可直接导入的源码。V1.0.7 的 `app-config.json` 与 V1.0.8 的 `app-config-1.json` 声明 `webview` 渲染和 `glass-easel` 组件框架；业务模块虽保留 `currentFile` 路径，但合并在应用服务和各 `chunk_*` 中。新项目按行为重新实现。

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
