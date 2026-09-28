# 旧包规则审计：业务、时间与绘制

审计日期：2026-09-24。源为只读编译包 `E:\json\smoke_wxd0b7dafebccb8110_unpacked`，不是原始 TypeScript。本文记录**从编译代码可直接证实**的规则；[122 个模块与可静态识别方法索引](legacy-module-index.md)覆盖全包入口，本文详细展开与三页演示及抽烟画面有关的函数。压缩包中的匿名回调、运行时函数和平台实际行为无法仅凭静态代码做到“所有方法语义 100% 证明”。下文路径均为旧包 `currentFile` 路径。

证据文件 SHA-256：`appservice.app.js = 57B60D1D95D5B5F4F608A33B473D6E8BF0F9A02E37C93D4C1E5CD4CEF644B38B`；`chunk_3.appservice.js = B75FED94A94A265CBC249CE1A4C6077FEE9E57F84D3DE11A8AD7F6237305567E`；`chunk_4.appservice.js = 257E6FA606AFB97BF8269E8964E201DBC6C42DE176DE98C0A49E7AACDA675D72`。旧包另有 `app-service.js` 聚合副本；索引以 `appservice.app.js + chunk_0…9.appservice.js` 去重。

## 旧包分辨率与画布像素

旧包**没有固定 750 × 1770 分辨率**。`components/session-experience/session-experience.js` 的 `prepareSessionCanvas` 通过 `#sessionCanvas` 节点查询取得实际布局宽高 `o.width/o.height`（CSS 像素），分别作为逻辑绘制宽高 `ey/eI`。它再计算倍率 `l = max(1, min(1.75, pixelRatio || 1, sqrt(1250000 / max(1, width × height))))`，将 Canvas 后备位图设为 `round(width × l) × round(height × l)`，并执行 `ctx.scale(l,l)`。因此旧包实际像素尺寸随设备、容器及 DPR 变化，`1250000` 是像素面积控制项，不是一个固定宽高。当前 Cocos 工程采用 750 × 1600 **设计分辨率**并按固定宽度适配浏览器实际高度；两者的设计坐标系不一致，比较烟身宽度/烟雾速度时必须先折算到屏幕 CSS 像素。

## 全包结构与边界

静态索引计 122 个非框架模块：app 1、behaviors 1、config 2、domain 33、presentation 31、services 33、components 16、pages 5。系统不止单根交互，还含烟盒库存、散烟、赠烟、每日解锁、成就、任务、烟票、真实吸烟记录、戒烟日志、历史、广告、分享、麦克风、环境音与烟雾实验室。各模块导出及组件方法名见索引；这些非首版系统在当前 Cocos 工程里大多不存在，**不能用“同名功能占位”宣称规则一致**。

## 会话领域：逐方法规则

### `domain/cyber-session.js`

| 方法／常量 | 旧包精确规则 |
| --- | --- |
| `MIN_INHALE_MS`、`MAX_INHALE_MS`、`EXHALE_THRESHOLD_MS` | 分别为 1、3000、300 ms；吐气判定是严格大于 300 ms。 |
| `FULL_CIGARETTE_PERMILLE`、`MAX_BURN_PERMILLE`、`MIN_BURN_PERMILLE` | 分别为 1000、100、1 千分点。 |
| `clampInhaleDuration(ms)` | 非有限数归零；四舍五入并截到 [0,3000] ms。 |
| `calculateBurnPreviewPermille(ms)` | <1 ms 为 0；否则 `max(1, round(100 × ms / 3000))`。 |
| `shouldExhaleAfterInhale(ms)` | 截断后的时长 >300 ms 才返回 true。 |
| `calculateSessionBurnPermille(session,ms)` | 根据**累计已记录吸气时长 + 本次时长**算目标总消耗 `round(100×总时长/3000)`，再减已消耗量；本次至少 1、至多剩余量。这避免每口单独取整造成累计漂移。 |

### `domain/cyber-session-v3.js`

| 方法 | 前置条件与效果 |
| --- | --- |
| `createCyberSessionV3` | 校验 ID、烟盒实例、包 ID、0–9 槽位及时间；以 `STICK_EXTRACTING`、1000‰、未扣槽、0 灰/口/烟圈创建会话，并附环境、皮肤、特效快照。 |
| `confirmSessionExtraction` | 仅取烟中可调用；确认槽位已扣，转 `IGNITION`。 |
| `igniteCyberStickV3` | 仅 `IGNITION` 且槽位已确认；转 `READY`。长按 680 ms 的判定在组件层，不在此方法。 |
| `startCyberInhaleV3` | `READY` **或 `EXHALE`** 可开始；烟未耗尽；转 `INHALE`。 |
| `completeCyberInhaleV3` | 仅吸气中；<1 ms 取消、回 `READY` 且不记口；否则按累计公式扣烟、长灰、追加含开始时间/时长/结束方式/消耗/视觉快照的 puff；>300 ms 转 `EXHALE`，否则回 `READY`；若已燃尽且无需吐气，直接 `FINISHED`。若已燃尽但仍需吐气，则吐气后才完成。 |
| `completeCyberExhaleV3` | 仅吐气中；若剩余 0，写结束时间并转 `FINISHED`；否则回 `READY`。 |
| `flickCyberAshV3` | `READY/INHALE/EXHALE` 可弹；调用物理层保留残灰，并按 ID/次数派生稳定随机值。不是“达到阈值才允许”。 |
| `recordSmokeRingV3` | 普通手势仅 `EXHALE`；编队型在 `READY/INHALE/EXHALE`；计数 +1。次数限制由组件层实施。 |
| `extinguishCyberSessionV3` | `IGNITION/READY/INHALE/EXHALE` 可熄灭，写 `endedAt` 和 `extinguished`。取烟未确认时不可调用。 |
| `isCyberSessionV3Ended` | 只识别 `FINISHED/EXTINGUISHED`。 |
| `smokingAshStateV3` | 提取灰长、掉灰量、阈值和弹灰次数。 |
| `isStoredCyberSessionV3` | 校验 schema、各 ID、槽位、状态、千分点、灰/烟圈计数、puff 列表、累计消耗守恒及结果/结束时间一致性；用于读盘时拒绝坏记录。 |

### `domain/smoking-physics.js`

| 方法／常量 | 旧包精确规则 |
| --- | --- |
| `CIGARETTE_FULL_LENGTH`、`DEFAULT_FILTER_RATIO`、`ASH_UNIT` | 物理基准长度 380、滤嘴比例 0.32、灰单位 68。 |
| `EMBER_MAX`、`CHAR_MAX` | 火点最大 7、焦黑段最大 10。 |
| `clampUnit`、`hashUnit` | 分别将有限数压到 [0,1]、用字符串哈希生成稳定 [0,1] 值。 |
| `computeAshFlickThreshold(random, reloaded)` | 初次阈值 0.56–0.70；后续阈值 0.36–0.50。它参与灰帽临界视觉/预警，**不作为 `canFlickSmokingAsh` 的硬门槛**。 |
| `createSmokingAshState(id)` | 0 灰、0 落灰、0 次数；首阈值由 ID 派生。 |
| `growSmokingAsh(state,burn‰)` | 灰长增量 = `burn‰ / 1000 × (0.0014 / 0.00075)`，压到 1；超出上限的部分增加 `ashDrop`。 |
| `canFlickSmokingAsh` | 灰长 >0 **或**已有弹灰历史即允许。 |
| `computeAshAfterFlick(ash,random)` | 残灰 = 原灰 × `(0.1 + 0.72×random)`，保留 10%–82%。 |
| `flickSmokingAsh(state,retainRnd,nextThresholdRnd)` | 不可弹时原样返回；可弹则更新残灰、下一阈值和次数。 |
| `computeCigaretteBurnGeometry` | 基于剩余比例、灰长、滤嘴比、落灰量，返回滤嘴/烟草/已燃/火点/焦黑/灰长度及燃烧中心、烟头坐标。 |

## 取烟与香烟几何

| 方法／位置 | 旧包规则 |
| --- | --- |
| `motion-timings.cigaretteExtractionMotionDuration` | 常规 1350 ms，减少动画 140 ms；前奏分别 220/80 ms；遮挡释放进度 0.28。 |
| `motion-timings.homeOpeningMotion` | 默认盒盖 500、取烟 1350、烟盒淡出 480 ms；short 为 240/760/240；reduceMotion 为 80/140/80；never 全 0。 |
| `session-entry-motion.sharedCigaretteEntryMotion` | 先从源点上提，遮挡解除后平滑移动到会话几何中心；X/Y 分别插值缩放，旋转从 π 到 0；包含轻微超越/回弹和 `maskRelease`。 |
| `session-experience.drawFrame/drawCigarette` 的取烟绘制 | 每帧先按会话视口求同一根烟的静止几何，再在 `drawCigarette` 内对**完整烟纸＋滤嘴**施加源烟到目标烟的平移、π→0 旋转及 X/Y 缩放；进度小于 0.28 时按白色内衬轨和前排烟包围盒裁剪。取烟中与进入游戏后调用的是同一个 `drawCigarette`，未点燃静态层可由 `unlitLayer` 缓存，滤嘴细节可由 `filterLayer` 缓存，而不是换一套过场烟贴图。 |
| `session-experience.finishEntryWarmupFrame/drawFrame` 的交接 | 会话画布有默认 220 ms 前奏及预热帧；`drawCigarette` 返回烟已越过遮挡边界后，`drawFrame` 连续两帧确认才触发 `entryclear`。首页接到事件后标记 Canvas 就绪并等待默认 480 ms 烟盒淡出，再将 `sceneReady` 置真；环境与粒子绘制受此状态门控。HUD 绘制透明度默认按进度 0.5–0.84 渐入，入场达终点后触发 `entrycomplete`。这几段不能合并成单一 1350 ms 定时器。 |
| `session-experience.drawCigarette/drawFilterDetail` 的静态材质 | 烟纸为五色横向渐变、裁剪后的约 4.2 px 横纹及随入场进度增长的阴影；滤嘴为主题底色、三段横向明暗、28 个稳定微斑、宽约 4% 的绿环、皮肤徽记、底端椭圆径向封口，并按皮肤键缓存。点火前取烟运动中和游戏内沿用同一绘制规则；后续点火、灰帽、烟头烟仅随会话状态变化。 |
| `session-cigarette-geometry.sessionCigaretteRestGeometry(w,h)` | 烟宽 `max(34,0.105w)`；滤嘴高 `max(98,0.145h)`；烟纸高 `max(218,0.325h)`；滤嘴顶部 `0.795h-filterHeight`，烟纸顶部再减烟纸高；水平居中。 |
| `pack-box` 的盒内烟槽与层序 | `pack-cigarette-deck` 相对烟盒左 22%、右 13%、顶 9%、高 52%；10 个槽按 `row=top/bottom` 各 5 个排列，每槽宽 20%，后排顶 2% 且 X 偏 -12.5%，前排顶 18% 且 X 偏 +12.5%。盒口深色凹槽在烟后、盒身前面与白色内衬在烟前，露出的主要是棕金滤嘴而非白色烟纸。后排滤嘴额外降低亮度/饱和度；空槽不画烟，预留槽变淡，取烟选中槽隐藏。 |
| `pack-box` 的王溪滤嘴材质 | `life` 皮肤以 `#b47f3f` 为底色，宽 104% 的滤嘴有左右暗化、中央微亮、两处细小斑点及内侧高光/暗影；顶部另有低矮椭圆端盖，使用径向明暗与深色边缘。绿色 `#173f37` 细环位于距顶部 26.4% 处，高约 1.5%（还有最小样式高度）；顶部约 12% 有 `#e0c097` 的小型倾斜叶形描边。数值来自旧包编译样式，换算到 Cocos 时需保留相对比例和层序，不把编译样式长度直接当设计单位。 |

首页入口还有额外的业务条件：`pages/index/index.js.startGame` 在加载错误时重试，烟盒锁定时走解锁提示，库存为空时跳选盒；盒盖未开时先 `animateLid`（默认 500 ms），之后 `launchStickSession`。`startExactStick` 只接受盒盖已开且槽位可用的精确选烟；`launchStickSession` 会先在库存中预留槽位并标记忙碌，再 `beginInlineSession` 测量烟盒中的源烟位置。`handleSessionEntryClear` 在会话 Canvas 准备好后，还等待 `packFadeMs` 才显示会话场景。因此 **1350 ms 是取烟运动时长，不是从点击“来一根”到可操作画面的完整固定总时长**；盒盖动画、Canvas 就绪和淡出均可能增加等待。

### 空盒入口、补盒页与广告（2026-09-28 补充审计）

| 旧包方法／模板 | 静态可证实规则 |
| --- | --- |
| `pages/index/index.js` 的首页状态与 `startGame` | 当前盒空或剩余 ≤0 时 `startLabel="补一盒"`，点击导航到 `/pack-skins/pages/pack-select/pack-select?packId=…`，并非禁用主按钮或直接重置 10 槽。 |
| 首页 `start-label` / `start-label-sweep`（`chunk_4.webview.js`） | 模板里并列两层同文字，扫光层 `aria-hidden=true`；底字 `#ffe0a2` 带暖色多重文字阴影，顶层 108° 透明—白金—暖金渐变，以 `start-gold-sweep 2.8s linear infinite` 将背景位置从 `140% 50%` 移到 `-40% 50%`。这是主按钮共用规则，不仅用于“补一盒”；取烟中暂停、减少动态效果时隐藏。 |
| `pack-skins/pages/pack-select/pack-select.js.onLoad/refreshPage` | URL 带 `packId` 时进入 `mode=supply`，检查选中盒与空盒实例，显示当前盒信息、10 空位及补盒方法；不满足补盒条件则回目录模式。 |
| `refillOrCheckIn` | 仅 `mode=supply`、未忙且可补时尝试烟票补盒；检查至少 1 张票，使用 `refill:<packInstanceId>` 交易 ID，经 `refillPackWithTicket` 成功后调用 `finishRefill`。 |
| `engagement-action` / `finishRefill` | 广告入口 `placement="pack:refill"`、`resource-id=packInstanceId`，只在组件确认完成后触发 `finishRefill`。`finishRefill` 选中补好的盒、提示“新的一盒已补满”，返回首页。仅点击广告或取消观看均不应补盒。 |
| `services/rewarded-video.js.requestRewardedVideo` | 返回含 `result` Promise 与 `cancel` 的请求；未配置、不可用、忙碌、取消等均非奖励完成；仅关闭回调 `isEnded===true` 形成 `completed`。 |
| `services/cyber-game-service.js` 的 `PACK_REFILL` 事务 | 核对 `pack:refill` 位置、目标盒实例、空盒和无活跃预留；旧事务不可重复，补盒归档旧盒并建序号 +1 的新盒，不是原地把十槽重置为满。 |
| 结果页主操作 | `packEmpty` 时文案为“去补一盒”，也导航到同一个选盒补盒页。 |

## 动画更新与输入时间

| 方法／位置 | 旧包规则 |
| --- | --- |
| `animation-runtime.AnimationRuntime` | active 每次 RAF；effects/ambient 约 30 FPS；reduced 50 ms 一帧；static 仅脏帧。单帧 `deltaMs` 最大 48。后台/隐藏暂停，重进恢复并防过期帧。 |
| `session-progress-checkpoint.SessionProgressCheckpoint` | 变更合并，最长约 10 秒落盘一次；`flush/dispose` 立即写待保存快照。 |
| `session-experience.updateTimers` | 点火、吸气、吐气文字约每 100 ms 更新；吸气到 3000 ms 自动收口，吐气到本口时长自动结束。 |
| `session-experience.startIgnition/endIgnition/cancelIgnition/finishIgnition` | 按住 680 ms；提前松开/取消不点燃，并显示重试提示；完成后振动、记录、切 `READY`。 |
| `session-experience.startInhale/beginInhale/endInhale/cancelInhale/finishInhale` | 跟踪触点 ID；松手按已过时长结算；取消手势按 0 ms 不扣烟；可在吐气中开始下一口（旧组件还有约 180 ms 的待吸入交接）。 |
| `session-experience.flickAsh/updateAshBreak` | 可弹时立即执行业务弹灰并喷粒子/音效；灰帽折断动效总约 140 ms，前 80 ms 可抖动。 |
| `session-experience.handleSmokeRing` | 非 `EXHALE` 不记数：`INHALE` 提示“还在吸气，吐气时再喷烟圈”，其他状态提示“吐气时才能喷烟圈”；普通每根最多 3 次，用完提示“这支烟的 3 次烟圈已用完”。成功时先 `recordSmokeRingV3` 记数，再按本口强度、`humanExhaleOrigin`、颜色/形状调用 `emitRing`。 |
| `cyber-session-v3.recordSmokeRingV3` | 默认手势仅允许 `EXHALE` 并加 1；编队专用入口才允许 `READY/INHALE/EXHALE`，不应误用编队规则放宽普通按钮。 |
| `flick-detector.createFlickDetector` | 加速度默认阈值 0.9、样本窗口 120 ms、样本最大间隔 600 ms、冷却 1000 ms；触摸按钮与晃动手势均可弹灰。 |
| `session-waveform.SessionWaveform` | 5 根动态条；提示时长：点火 360、弹灰 260、烟圈 460、编队 340、风 300、控制 220 ms；按优先级覆盖。 |

## Canvas/Graphics 绘制规则

旧包主要使用微信 Canvas 2D `CanvasRenderingContext2D`；当前 Cocos 使用 `cc.Graphics`。两者都有路径/圆/贝塞尔，但**API 相似不代表绘制一致**：旧包大量使用渐变、裁剪、缓存离屏位图、粒子纹理、阴影、混合与分层透明度，新版目前多为简单形状与纯色笔画。以下是旧包方法对应的视觉规则。

| 旧方法 | 精确可见行为 |
| --- | --- |
| `smoking-visual-policy.breathingHaloRadius` | 吸气最大半径 `min(0.36w,0.19h)`，常规按进度线性增大；减少动画模式固定为较小中等半径。 |
| `drawInhaleHalo/drawBreathingHalo` | 中心 `(w/2,0.47h)`；橙 `#ff7a1a`；径向渐变填充 + 两道细描边，外边线宽 `1.4+0.8×进度`。 |
| `drawExhaleHalo` | 白 `#eef0ed`；按本口强度 × 剩余吐气进度收缩，同用径向渐变。 |
| `smoking-visual-policy.humanExhaleOrigin` | 横向中心；纵向在约 `0.68h–0.78h`，受 `h-min(170,max(120,0.16h))` 限制。 |
| `smoking-visual-policy.advanceEmberHeat` | 火点热度上升时间常数 140 ms、下降 280 ms（指数逼近），而非瞬时开关。 |
| `smoking-visual-policy.burnContourOffset/charFoldContourOffset` | 由稳定哈希、插值噪声和燃烧进度决定焦边/折线，边界不规则但同状态可重现。 |
| `cigarette-tip-material.tipDisplayGeometry` | 以参考直径 37.065 和参考火点高 8.6 将物理段转换屏幕尺寸；灰、火、焦边沿同一个材质坐标系对齐。 |
| `CigaretteTipMaterial.drawEmber` | 火点轮廓细分路径、纵向橙红渐变、26 个固定煤点、18 处闪烁亮点及暖色阴影；受热度/时间影响。 |
| `CigaretteTipMaterial.drawEmber/drawBurningTip` 的尺寸 | 煤点不是飞散粒子：26 个稳定材质点宽约 `(0.055–0.175)×stickWidth`、高约 `(0.15–0.38)×emberHeight`，绘成不规则多边形；18 个热亮点椭圆半径约 `(0.75–1.19)×(stickWidth/37.065)`。焦黑折边由 `charTopAmplitude=max(0.65,0.025×stickWidth)`、`charBottomAmplitude=max(0.45,0.018×stickWidth)` 和燃烧进度相关稳定噪声控制，不是随机掉落粒子。 |
| `createCharFoldGradient` | 焦黑折线渐变从 `#221915`、`#100c09` 到 `#63422d`。 |
| `createAshMaterial / drawFragments / ensureTexture` | 生成 55×7 个带稳定随机纹理碎片；可用 1.75 倍离屏纹理缓存，失败时直接绘制。 |
| `CigaretteTipMaterial.traceAsh/drawAsh` | 灰帽左右边缘与上缘各自带噪声；底边延伸入火点顶部 `min(0.75×(stickWidth/37.065), 0.25×ashHeight)`，再覆盖绘制，避免两层共边漏背景；横向五段灰色渐变、裁剪纹理、裂纹；灰高 ≤0.45 CSS px 不绘。 |
| `session-experience.drawAshStack` | 灰帽先约 80 ms 摇动（角度幅值约 0.085 rad）；接近当前灰阈值时喷少量预警灰尘，普通约每 430 ms，减少动画约每 720 ms。 |
| `session-experience.drawCigarette/drawFilterDetail` | 烟纸细纹、焦边、火点、灰帽、滤嘴图纹按皮肤变化；未点燃体与滤嘴使用静态层缓存，烟盒取烟期间做局部遮挡裁剪。 |
| `session-experience.startIgnition/drawIgnitionEffect/drawCigarette/updateEmberHeat` | 普通打火机按下后以 680 ms 为进度；进度 `>0` 时，虽然业务仍处于 `IGNITION`，`drawCigarette` 已按点燃形态绘焦黑折边与燃烧端，热度目标约为 `0.82×进度` 并以 140 ms 时间常数上升。进度恰为 0 时仍可未点燃；680 ms 完成后进 `READY`、热度向 0.18 回落，才开始新增烟头细烟。提前松手/取消重置点火进度并回未点燃外观。 |
| `tip-smoke.TipSmokeRenderer` | 最多 4 条烟头轨迹、每条 96 点；常规每 75 ms 追加点、减少动画每 150 ms；点最多保留 6.8 秒，常规上升 48 px/s、减少动画 32 px/s；曲线可分叉，按 12/5/1.5 px 三层透明描边、纵向渐变绘。仅 `READY/EXHALE` 新增烟头烟轨。 |
| `smoking-particles.SmokingParticleEngine.emitExhale` | 由本口强度、烟雾量、风格决定 `max(4,floor((10+48×强度)×量倍率))` 颗；横向散布、向上速度，寿命随强度约从 1.35 秒起增加；最多 220 个活动粒子。 |
| `SmokingParticleEngine.emitAshFlick/emitAshWarningDust` | 弹灰生成大块灰、细尘并附 5 个火星；预警灰尘少量喷出。大块灰可落到底部后停留，细尘较快消散。 |
| `SmokingParticleEngine.emitSpark/update/drawSpark` | 点火/吸气火星从燃烧端中心附近发射，出生偏移 x±4、y±2.5 CSS px；初始半径 `1.2–3.4` CSS px、寿命 `0.62–0.96 s`、不透明度 `0.78–1`。速度大小 `28–100` CSS px/s，向上扇形发射；更新时重力约 `80` CSS px/s²、横向阻尼 `.98^(60dt)`、透明度阻尼 `.965^(60dt)`、热度每秒减约 `1.08`。绘制半径随寿命缩至初始约 45%，颜色按热度变化并带 `6–10` CSS px 模糊光晕。 |
| `SmokingParticleEngine.emitAshFlick/update/drawAsh`（经典灰） | 强度由本次断灰比例决定，约 `8–10` 大块灰及随强度变化的细尘，附 5 颗复用 `emitSpark` 的火星；出生中心取弹灰前的 `emberCenterY`。大块灰半径 `2.2–6.4` CSS px、椭圆纵半径 `max(0.8,0.46×size)`、寿命 `7–9 s`，可落底停留；细尘半径参数 `1–3.8` CSS px、初始缩放 `0.5`、寿命 `0.55–1.1 s`，缩放每秒增加 `1.8`、不透明度另乘 `.91^(60dt)`。`drawAsh` 用椭圆及 `opacity×(1-life/maxLife)`，不是菱形灰块或只按年龄放大的圆点。 |
| `SmokingParticleEngine.emitRing/startRingFormation` | 独立“吐烟圈”玩法，烟圈有增长、形变、掉烟和生命周期；编队最长 4400 ms，预设有隧道、追逐、螺旋、交叉。**不要与吸气橙色呼吸圈混为一谈。** |
| `SmokingParticleEngine.emitRing/update/drawRing` 默认圆形 | 发射初始半径约 `(12+8×强度)×随机倍率`、增长约 `(56+42×强度)×随机倍率` CSS px/s，初始管径约 `(4.8+3.2×强度)×随机倍率`；向上速度约 42–66 CSS px/s，普通圆形寿命约 4.4–5.8 秒。`drawRing` 用中心径向雾带和约 40 个径向渐变烟团，椭圆倾斜、3/5 波纹与轻微形变随时间变化。 |

### 粒子与静态层的方法职责

| 类／方法组 | 旧包职责 |
| --- | --- |
| `TipSmokeRenderer.clear/release/hasTrails/knotCount/update/draw` | `clear` 清轨迹，`release` 停止生成但旧轨迹仍老化，`hasTrails/knotCount` 给调度器判断是否仍需帧，`update` 积累/漂移采样点，`draw` 三层透明曲线绘制。 |
| `SmokingParticleEngine.clear/particleCount/hasActiveParticles/push` | 清场、报告活动数、决定是否继续帧循环、将粒子数限制在 220（编队占用名额）。 |
| `emitSpark/emitAshFlick/emitAshEffect/emitAshWarningDust` | 点火星、大块灰/灰尘、按灰样式分派、临界预警尘。 |
| `emitAshFirework/emitAshBubbles/emitFireworkBurst` | 非经典灰效果；非首版。 |
| `emitExhale/emitRing/deflectSmoke` | 吐气云、独立烟圈、风偏折。 |
| `startRingFormation/updateRingFormation/cancelRingFormation/hasActiveRingFormation` | 创建、更新、取消和查询编队；不属于普通吸气圆环。 |
| `update/draw` | 每帧推进各类粒子的物理/透明度/寿命，再按种类画到 Canvas。 |
| `drawSmoke/smokeSprite/formationSprite/drawFormationRing/drawRing/drawSpark/drawBubble/drawAsh/drawMeteor` | 各类形状、缓存精灵或纹理的绘制；当前火星已改用 Canvas 模糊光晕、经典灰块/细尘改为椭圆近似，其余特效及逐帧成像仍不能据此认定等效。 |
| `StaticCanvasLayer.clear/draw` | 缓存未点燃烟体、滤嘴等静态区域，按主题键和尺寸复用；不是每帧重绘所有静态细节。 |
| `CigaretteTipMaterial.drawEmber/traceAsh/drawFragments/ensureTexture/drawAsh` | 火点渐变、灰帽轮廓、碎片纹理、离屏缓存与最终灰帽合成，方法顺序影响层次。 |

### `cc.Graphics` 能力边界与等效实现方案

这里的“不能”专指 **Cocos Creator 3.8.6 `Graphics` 基础绘图接口不能直接表达旧包的 Canvas 2D 绘制指令**，不是 Cocos 引擎或浏览器无法呈现该效果。`Graphics` 本身可画路径、直线、圆、椭圆、二次/三次贝塞尔曲线，可设置纯色填充/描边、透明度与线宽；组件也支持自定义材质。不能把“当前没有移植的时间/物理规则”归咎于 `Graphics`，也不能把叠加纯色形状视为旧包渐变、纹理和柔边的最终等效实现。

| 旧包方法与 Canvas 操作 | `Graphics` 基础接口与当前实现的差异 | 计划的等效实现 | 需要的工作／验收证据 |
| --- | --- | --- | --- |
| `CigaretteTipMaterial.drawEmber`、`createCharFoldGradient`、`drawFilterDetail`、`drawIgnitionFlame`：线性/径向渐变、暖色 `shadowBlur`、封口与火焰光晕 | `Graphics` 基础接口无直接对应的渐变及 Canvas 模糊阴影；当前燃烧端和点火器已用 Canvas 运行时纹理绘制渐变/阴影，滤嘴仍由 `Graphics` 色条和细纹绘制。轮廓路径本身可由 `Graphics` 完成。 | 继续核对旧包几何、渐变色标、点火器与滤嘴材质；必要时将静态滤嘴改为缓存纹理。 | 逐状态核对点火 680 ms、吸气变亮、松手约 280 ms 回落，以及滤嘴横向明暗和底部封口；目前仅静态代码检查，未完成动态验收。 |
| `CigaretteTipMaterial.traceAsh/drawAsh/drawFragments/ensureTexture`：路径裁剪、五段灰渐变、1.75 倍离屏缓存和 55×7 稳定碎片 | `Graphics` 自身不提供 Canvas `clip()` 与 `drawImage()` 缓存流程；当前已用 Canvas 纹理做灰帽渐变、裁剪、稳定碎片与稳定材质坐标外轮廓，并按旧包公式让灰底轻微覆盖火点；仍没有旧包离屏缓存与完整断裂。 | 保持稳定轮廓，继续补灰碎片缓存、裂纹及折断时间轴。 | 核对灰长度到几何的转换、增长时纹理不跳、红灰交界、弹灰 80/140 ms 过程；未做画面验收。 |
| `TipSmokeRenderer.update/draw`：采样点、风偏、分叉、纵向渐变和 12/5/1.5 px 分层烟轨 | 当前已按旧包出生材质坐标、根部衰减、平滑噪声、分叉及整轨三层笔画改写；仍缺旧包环境风场。这是**模拟逻辑缺失**，不是绘图接口限制。 | 核对风场采样与不同环境/减弱动画参数，继续校准渐隐与烟轨层序。 | 统一 CSS 像素与 Cocos 设计坐标；由用户连续观察烟轨接续性。本轮按用户要求不由 Codex 打开浏览器。 |
| `SmokingParticleEngine.drawSmoke/smokeSprite`、`drawBreathingHalo`：离屏柔边烟纹、径向透明度、白烟 `screen` 合成 | 当前默认人物吐气烟已按旧包三团纹理、比例、颜色及缩放/透明度推进，并用灰度强度纹理与 Sprite `ONE / ONE_MINUS_SRC_COLOR` 复现 screen 算式；吸气圈用 Canvas 径向渐变与描边。可交互风场仍未接入，默认无手势时旧包风场本来为零。 | 核对 Cocos 与旧包 Canvas 的混合像素、粒子数量/寿命/速度；烟头烟与人物吐气烟保持分层。 | 以用户画面验收混合和动态表现；静态代码不能证明像素等效。 |
| `StaticCanvasLayer` 与烟纸/滤嘴静态绘制：离屏复用 | `Graphics` 可重画这些细节，但当前每帧重画，未对应旧包按尺寸/主题缓存静态层的策略。 | 将不随状态改变的烟体/滤嘴层预制为 Sprite 或缓存到 RenderTexture；动态焦边、灰、火、烟单独更新。 | 确认尺寸、皮肤或会话重置时正确重建，浏览器检查画质与帧耗。 |
| `advanceEmberHeat`、`emitSpark`、`growSmokingAsh`、`drawAshStack`：热度、向上火星、积灰和断裂时序 | **不是 `Graphics` 做不到。** 当前已有 140/280 ms 热度逼近和独立火星、连续弹灰与残灰；仍缺完整灰物理坐标和 140 ms 断裂。 | TypeScript 状态/粒子系统继续按旧包公式推进。 | 核对发射率、粒子寿命、松手后停止新增、弹灰前约 80 ms 抖动及弹后残灰。 |

实施顺序：先统一旧包 CSS 像素与 Cocos 设计坐标、状态和时间轴，再移植动态采样/粒子/积灰规则，随后替换渐变、纹理、裁剪与混合材质，最后在浏览器用同尺寸连续录像对照。旧包程序生成的灰碎片与软烟纹理可从现有方法重建，不以新增美术图片为开工前提；同尺寸旧包录屏有助于校准颜色、运动和层序，但不能替代代码规则审计。未做动态对照的条目仍记为“未验证”，不标为等效完成。

## 声音、环境与收尾

- `session-sound.sessionSoundAssetForCue`：点火可选打火机/火柴/煤油/电弧；吐气按本口强度 `>0.7` 深、`>0.35` 中、否则轻；弹灰可在吸/吐音效播放时作为低音量叠加。`SessionSoundController` 有预加载、停止、错误重试和销毁。
- `ignition-sound` 四种点火确认截断时长依次为 360、520、440、320 ms；音量 0.55、0.58、0.42、0.40。吸气音量 0.9；弹灰 0.58；三种吐气音量 0.9/0.52/0.42。环境音控制器切换时约 460 ms 等功率交叉淡入淡出。
- 本项目当前吸气文件与旧包完全相同，已改为状态结束时停止的主音轨（音量 0.9、非循环）；弹灰独立音轨在吸/吐音正播放时以 0.28 叠加，其他时候为 0.58。旧包的轻/中/深吐气分档、可在吐气中开始下一口、独立音效偏好、点火选型和环境声仍未移植；这是当前状态，不修改上述旧包规则。
- `session-experience.completeAndRoute` 停止输入、音频、特效并写记录后跳结果，有防重复；烟盒来源结果标题通常“这一根，抽完了”，不因主动熄灭就改标题。完整库存结算另有规则（见 [旧包参考](legacy-reference.md)）。

## 仍未达到“全包逐方法语义”的部分

索引列出其余 100 余模块的导出和静态方法，但库存、奖励、广告、登录权限、分享、好友、记录、实验室等没有逐内部函数做数据流审计，也没有在微信运行时验证。原因是当前交付仅三个页面、旧包为压缩编译产物。本文不会将这些模块的存在写成已迁移、已测试或图形等效。若后续把它们纳入需求，应以索引中的模块为入口逐个做同等级的规则审计。
