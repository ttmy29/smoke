# Cocos 模块拆分（当前实现与后续扩展）

## 场景

第一版沿用 `assets/scenes/game.scene`，在一个场景中切换首页、会话、结果、补盒、打卡、戒烟、排行、成就、设置、全服及全服商店面板，共享 Canvas、音频控制和一次会话数据。全服面板通过首页底部导航进入，隐藏首页预制体，使用导航副本返回；商店覆盖在全服页之上，返回保留原滚动位置。独立的数据和入口接口见 [全服主页](world-page.md)。

打卡解锁：`CheckInController → CheckInUnlockCatalog → CheckInUnlock`，只在新打卡成功后筛选跨过的累计天数门槛。弹层按钮经回调交给 `DemoFlow` 打开设置，设置返回目的地保存为打卡页；解锁弹层打开时，`DemoFlow` 暂停并隐藏成就提示，关闭后继续。弹层关闭仅释放展示资源，不写入打卡或奖励存档。

## 当前模块

UI 尺寸与输入框的开发检查项统一见 [UI 易错点与复用约定](ui-pitfalls.md)，包括比例换算、EditBox 初始化、键盘重排和延迟清理。新增输入页需显式接入这些处理，当前尚无自动覆盖所有页面的通用 EditBox 组件。

当前代码统一放在 `assets/scripts/`；原有的拼写错误目录 `assets/scritpts/` 已移除。表中“后续”指尚未独立拆分的职责，不代表已经实现。

| 模块 | 当前目录 | 职责 |
| --- | --- | --- |
| `GameBootstrap` | `scripts/app/` | 加载首页四个 Bundle 预制体并挂到 Canvas，资源就绪后启动 `DemoFlow`，管理实例及资源引用。 |
| `BundleLoader` | `scripts/assets/` | 按名称加载并复用 Bundle，合并并发 Bundle 请求，按路径加载 Prefab；失败请求允许重试。 |
| `DemoFlow` | `scripts/app/` | 协调首页、会话、结果、补盒、打卡、戒烟、排行、成就、设置和全服面板，传递会话快照、导航及设置回调。 |
| `InitialSettings` | `scripts/config/` | 初始配置入口：打卡四项、烟盒、个人数据、默认音效和开发预览；标注已接入／有限支持／预留，状态表见 initial-settings.md。 |
| `debugLog` | `scripts/services/` | 读取调试开关，控制应用初始化及预制体挂载的诊断日志；不抑制警告、错误或引擎日志。 |
| `SessionModel` | `scripts/domain/` | 与引擎无关的状态机、剩余量、灰/烟圈次数、吸入时长和交互准入。 |
| `HomeController` | `scripts/home/` | 烟盒展示、开盒、选烟和启动会话；为预制体绑定 UIButton 业务回调，为 TextSweep 设置文案与播放状态，0/10 时显示“补一盒”。 |
| `UIButton` | `scripts/common/` | 可复用按钮组件：bg 命中、按下反馈、可选缩放与音效、禁用状态、防连点、代码及 Inspector 业务回调。 |
| `TextSweep` | `scripts/common/` | 可复用单行 Label 扫光：读取字体设置，生成底字与亮带，管理计时、方向、颜色、暂停及纹理生命周期。 |
| `SettingsController` | `scripts/settings/` | Graphics 设置页，750rpx 布局换算、纵向滚动、背景色块横向滚动、页面滑入返回、音效总开关和本机占用估算。 |
| `DesktopGuide` | `scripts/common/` | 首页与设置共用的“添加到我的小程序”教程弹层，Graphics 两步示意、以 fillColor Alpha=209 绘制的半透明遮罩、固定头尾与可滚动正文；浏览器领取禁用。 |
| `WorldController` | `scripts/world/` | 全服主页、CSS px 布局换算、统计数据源及异步刷新、复用导航副本、影响和商店二级入口回调。 |
| `WorldShopController` | `scripts/world/` | 全服商店、七分类切换、本机烟票读取、套装展示、商品/分享接口及滑入返回。 |
| `SessionController` | `scripts/session/` | 将长按与按钮输入转为模型事件，调度画面、音效及可见提示。 |
| `CigaretteView` | `scripts/session/view/` | 香烟、滤嘴、燃烧端、烟头烟、灰帽和弹灰粒子；后续可拆独立 AshEffect。 |
| `BreathEffects` | `scripts/session/effects/` | 中央呼吸圈、人物吐气烟及基础圆形吐烟圈。 |
| `CanvasTexture` | `scripts/session/effects/` | 浏览器 Canvas 2D 到 Cocos Sprite 的运行时纹理桥接，供渐变/柔边效果使用。 |
| `SessionInput`（后续） | `scripts/session/input/` | 目前输入仍在 `SessionController`；将来可拆长按、松开与晃动弹灰手势。 |
| `DemoAudio` | `scripts/audio/` | 可停止的吸气/吐气主音轨、独立弹灰叠加音轨、启动默认静音与总音量、临时素材加载；状态结束时由 `SessionController` 停止主音轨。 |
| `ResultController` | `scripts/result/` | 显示本次结果并返回首页；当前盒空时转补盒页。 |
| `SupplyController` | `scripts/supply/` | 空盒补盒页、本机烟票消费入口、换盒占位入口及广告预览弹层。 |
| `RewardedVideoGateway` | `scripts/services/` | 奖励广告接口，当前 `PreviewRewardedVideoGateway` 返回占位弹层的显式模拟完成/取消结果；真实平台适配器后续替换。 |
| `AssetCatalog` | `scripts/assets/` | 集中引用临时图片和音频，标注旧包来源。 |
| `ProgressStore` | `scripts/persistence/` | 通过可替换的键值存储接口读写带版本号的累计抽烟根数；按本根会话 ID 防止结束回调重复计数。未来钱包、任务使用各自的存储对象和接口，不提前并入本次计数。 |
| `PackStore` | `scripts/persistence/` | 独立保存当前王溪盒 10 个可用/空位槽、盒序号及盒盖开合状态；选中有效槽后在取烟动画前确认扣除，奖励完成且旧盒空时创建下一盒。兼容读取 V1 十槽及早期无盒盖字段的 V2 状态。库存数由槽位计算，不从累计根数倒推。 |
| `CheckInStore` | `scripts/persistence/` | 保存每日打卡、额外烟票领取与当前烟票余额；票补盒交易 ID 重放时不重复扣票。 |
| 存档预览初始化 | `InitialSettings → DemoFlow → CheckInStore / PackStore / ProgressStore.initializePreview` | 重置开启时向空存档写入独立的打卡四项、实际烟盒槽位／盒盖、累计抽烟数；各 Store 验证约束，戒烟天数待接入。 |
| `CheckInController` | `scripts/checkin/` | 每日烟票页、成功打卡前后累计天数比较、广告预览及解锁弹层调度。 |
| `CheckInUnlockCatalog` | `scripts/checkin/` | V1.0.8 六项功能的累计天数门槛、标题、完整说明与跨门槛筛选。 |
| `CheckInUnlock` | `scripts/checkin/` | 完整打卡解锁弹层，半透明遮罩、渐变卡片、开锁断链、滚动功能列表与关闭／设置动作；持有并释放 CanvasTexture。 |
| `RecordsController` | `scripts/records/` | 赛博记录五页签、吸顶分类、统计与列表、烟费编辑、抽烟详情、复用戒烟详情／趋势。 |
| `SmokeLabController / SmokeLabModel / SmokeMotion` | `scripts/lab/` | 六分类实验室、方案草稿、范围确认、每日预览解锁及抽烟消费的目录／几何。 |
| `SmokeLabPreview / SmokeLabUIHooks` | `scripts/lab/` | 独立的运行内 UI 预览三层方案／互动状态；选择、保存、恢复回调提供数据和 preview 标记，默认不接渲染器。 |
| `SmokeLabStore` | `scripts/persistence/` | 三级方案和明确默认标记、每日授权／发现组、互动偏好、运行快照；损坏存档不覆盖。 |
| `RecordsModel / RecordsSource` | `scripts/records/` | 汇总本机数据、未知历史判断、9 项任务目录、单价规则，以及有效结束记录的独立估算根数／金额；预留任务指标／奖励接口。 |
| `SmokingRecordStore` | `scripts/persistence/` | 保存新结束会话的最近 500 条明细、逐日及累计汇总、估算单价；旧累计数不补造明细。 |
| `QuitController` | `scripts/quit/` | 今日戒烟滑入页、真烟与未抽双页签、长按记录、确认弹层和本机历史摘要。 |
| `QuitStore` | `scripts/persistence/` | 用同一本机键保存真实抽烟和未抽确认，保证两者互斥；记录撤销、感受、烟价与按日统计。 |
| `TicketRefillStore` | `scripts/persistence/` | 王溪空盒用 1 张本机烟票补盒；先写待完成记录，再扣票并创建下一盒，重试或重启后继续未完成交易。 |

记录页的 EditBox 在激活前配置输入模式并复用自建 Label；输入聚焦和失焦缓冲期间暂停高度重排。重建或关闭时先隐藏并移出输入节点，500ms 后销毁，避免 Creator 3.8.6 延迟滚动回调访问已清除的 DOM。此处仅对网页聚焦 input 设置 decimal 键盘提示和样式，价格校验仍由 RecordsModel 负责。

数据流：`SessionController → SessionModel → CigaretteView / BreathEffects`；`DemoFlow` 在有效取烟前由 `PackStore` 扣当前盒槽位，会话结束快照再交给 `ProgressStore` 结算累计根数，两个结果供 `HomeController / ResultController` 展示。空盒时可走 `SupplyController → TicketRefillStore → CheckInStore / PackStore`，只对当前空盒扣 1 张票并新建满盒；本地待完成记录使中断后可重试且不会重复扣票。广告路径为 `SupplyController → RewardedVideoGateway → DemoFlow → PackStore.refillAfterReward`，只有 `completed` 且旧盒实例 ID 仍匹配才新建满盒；占位广告的“模拟完成”不是实际广告奖励。`CanvasTexture` 只负责显示，不修改业务状态。真实广告、真实换盒和完整整盒结算仍未实现。浏览器存储只保障同一站点/浏览器当前设备的数据；不做完整会话历史、进行中恢复、云同步。票与盒的两个存储键通过待完成记录恢复，但不具备旧包单一事务写入及跨标签页并发原子性。

取烟入场：`HomeController` 绘制两排共 10 个可见烟槽，并把选中烟、内衬轨及前排烟的世界包围盒转换到过渡层坐标。点击后首页非烟盒内容在 180 ms 内渐隐并隐藏，烟盒保持完整不透明；`DemoFlow` 创建未点燃的 `CigaretteView` 入场实例，`EntryMotion.sharedEntryMotion` 移植旧包曲线（Cocos 向上 Y 轴），`Mask` 模板处理前 28% 遮挡。与会话背景共用 `paintCommunityBackground` 的单张覆盖纹理置于整个 `HomePanel` 上方、抽出的烟下方，清遮挡后用 480 ms 从透明渐至不透明。视觉上剩余的旧首页与烟盒作为整体退去，盒内各层不会互相透出；完全覆盖且运动终点到达后才关闭首页。当前仍是双烟实例交接，不是旧包单 Canvas。临时 Canvas 纹理在交接时显式释放。

首页盒内滤嘴由 `HomeController.paintWangXiFilter` 通过 `CanvasTexture` 逐槽生成渐变、纹理、顶盖和小标；槽节点的 `UITransform` 仍用来测量取烟源位置。首页销毁时释放十张运行时纹理。入场烟与会话烟各有一个 `CigaretteView`，但都用同一 `renderBodyMaterial` 绘制完整烟纸、滤嘴及阴影；不再使用覆盖整根源烟并提前淡出的盒内滤嘴贴层。旧包的盒内 CSS 滤嘴与入场烟的衔接仍是异材质交接。先前按烟盒各渲染节点、首页背景分别降透明度，会使盒面、内衬和烟支在中途互相透出，现已移除；只对上方新背景纹理设置单一透明度。选中烟槽仍独立隐藏。清遮挡进度达 0.28 后连续两次更新才启动 480 ms 覆盖渐入，HUD 随运动进度渐入；这仍只是基于进度的帧确认，不是旧包按实测出盒几何触发的 `entryclear`，也缺 Canvas 就绪握手。

`SessionModel` 位于 `assets/scripts/domain/SessionModel.ts`。当前首版状态为 `UNLIT → LIGHTING → IDLE ⇄ INHALING → EXHALING`，并分别以 `FINISHED`、`EXTINGUISHED` 结束。弹灰只在已点燃的待机/吸/吐阶段且有灰或已有弹灰记录时成功；基础烟圈只在吐气阶段成功，每根默认 3 次。所有燃烧和交互数值集中在 `SessionTuning`，视图只读取不可变快照。

场景在 Canvas 上挂载 `GameBootstrap`。`assets/prefabs.meta` 配置名称为 `prefabs` 的 Bundle；`BundleLoader` 先复用已加载 Bundle，或合并同名并发请求，再通过 `loadPrefab(bundleName, path)` 加载预制体。启动时并行加载 `common/bottom`、`common/side`、`common/top`、`common/smokePack`，全部成功后实例化为 Canvas 直接子节点，兼容复用场景中现有的同名节点；`smokePack` 保持隐藏参考状态。`GameBootstrap` 持有 Prefab 引用，销毁时释放；场景销毁后到达的异步结果不再创建节点，加载失败则报告资源路径并停止本次启动，不创建部分页面。

四个预制体挂载完成后，`GameBootstrap` 创建暂不激活的 `AppRoot`，添加 `DemoFlow` 并传入顶部、底部和侧栏节点，然后激活流程。`DemoFlow` 把 `HomePanel` 创建为 Canvas 最下层子节点，用于背景和运行时烟盒；顶部、底部和侧栏保留在 Canvas 下，`AppRoot` 中的其他页面与过渡层绘制在它们上方。`HomeController.onEnable/onDisable` 同步三个首页预制体的显隐，原有取烟渐隐仍作用于这些节点；`DemoFlow` 销毁时清理独立的 HomePanel。首页烟盒仍由 `HomeController` 绘制，显示尺寸固定为 502×728、画布中心坐标为 `(-185, -50)`；布局计算补偿工作区的纵向缩放与偏移。旧首页绘制节点仍会创建，但被对应预制体替换的区域隐藏。

资源逻辑检查：`node tools/test-home-bundle.cjs` 覆盖 Bundle 配置与四个路径、并发请求合并、缓存复用、全部就绪后启动、Canvas 直接父节点、同名节点去重、资源引用释放、加载中销毁、资源失败不挂部分页面，以及 Bundle 失败后重试。此检查不验证视觉效果；页面效果由用户验收。

成就页 `AchievementController.present` 先更新尺寸，再执行一次列表刷新。完整条目布局用于计算滚动高度和未读定位，实际行节点仅在可见区域与上下两行缓冲范围内创建；滚出范围后停止对应翻面 Tween 并释放节点，翻面结果保存在条目 ID 集合中。这样避免点击入口时同步创建全部 80 条成就。`node tools/test-achievement-list.cjs` 检查节点数量约束、滚动增删、翻面状态保留及屏外未读定位，不验证动画或像素效果。

当前可见底部来自 `bottom.prefab`，使用预制体保存的位置。`top`、`side`、`bottom` 均为 Canvas 直接子节点，运行时不再覆盖它们的坐标或缩放；编辑器中的预制体布局决定其位置。`HomeController.bindPrefabButton` 在各 `bg` 上接入 `UIButton`，停用父节点 Button，并通过 `setHandler` 提供现有业务回调；原生 Button 使用 NONE 过渡，由 UIButton 统一提供反馈。普通背景使用 Sprite 变色；没有 Sprite 的导航背景使用同组图标的变色与缩放，检测节点不缩放。UIButton 默认防连点间隔 0.2 秒，可通过属性配置视觉目标、禁用颜色、时间及音效。

`one/icon` 隐藏，`one/Label` 添加独立 `TextSweep`。该组件读取 Label 文案和系统字体设置，临时停用原 Label 渲染，以自身 CanvasTexture 同时绘制底字与亮带；按字形测量和发光边距调整纹理尺寸。组件更新计时，支持左右方向、颜色、周期、暂停和重启；停用时恢复原 Label，销毁时释放纹理。首页仅设置“来一根／补一盒／烟盒不可用”文案和播放状态；开盖、取烟或存档不可用时暂停，空盒可继续扫光。旧底部隐藏节点使用自己的 TextSweep，不再共用或搬移绘制节点。配置与复用示例见 [通用 UI 组件](ui-components.md)，视觉效果由用户验收。

右侧 `side.prefab` 保留预制体保存的位置与缩放，不再跟随旧工作区中心定位或按工作区高度缩放。预制体当前使用 `record2`、`record4` 命名，绑定时仍兼容旧名 `record-001`、`record-003`。`record`、`record2` 的锁图和解锁提示由累计打卡天数驱动；`record4` 的上次抽烟、今日根数、连续打卡及打卡状态由原有本机存档驱动。接入后旧右栏 Graphics 不再随布局重绘。

顶部 `button2～button6` 的 Button 组件挂在各自 `bg` 子节点上，按背景 UITransform 命中，直接沿用背景的尺寸、锚点及位置；父节点 Button 停用。`button2～5/bg` 绑定已有页面入口，`button6/bg` 保留按钮区域但无公告详情回调。

侧栏 `record`、`record2`、`record3` 的 Button 同样挂在 `bg` 子节点上，父节点 Button 停用，沿用背景 UITransform 作为矩形点击区；兼容旧预制体名称 `record-001`、`record-002`。记录按钮通过 HomeController 回调进入 RecordsController，累计打卡不足 3 天时提示；实验室通过独立回调进入 SmokeLabController，门槛为 2 天；换盒尚无业务回调。锁图和提示继续读取累计打卡数据。记录页位于打卡／戒烟层下方，从记录进入二级页后由 DemoFlow 保存返回来源，返回刷新并保留原页签／滚动位置；抽烟明细由新 SmokingRecordStore 保存，打卡与票流水在原 CheckInStore 同键写入。接口和缺失范围见 [记录页](records-page.md)。

实验室由 `DemoFlow → SmokeLabController → SmokeLabStore` 管理；存档键 `smoke.lab.v1` 加入重置及容量统计。`LabRuntime` 交给 SessionController，分别设置 CigaretteView 的余烟色和 BreathEffects 的吐雾／烟圈参数；SessionModel 单独接收无限圈权限，不改消耗和原有计数。抽烟中进入实验室暂停当前模型，返回继续当前会话。权限过期与方案继承、尚缺服务见 [烟雾实验室](smoke-lab.md)。

本轮按用户要求优先 UI：`ENABLE_SMOKE_LAB_UI_PREVIEW = true` 时，普通选择不受每日授权阻断，保存／恢复／互动经过独立 SmokeLabPreview，不写真实 Store，因而不改变 SessionController 读取的 LabRuntime。`SmokeLabUIHooks` 留给后续效果；关闭开关才回到原真实存档流程。颜色卡片改为圆色点／名称说明／独立勾选框、选中渐变和窄屏单列。无浏览器或效果验证，界面由用户验收。

颜色区统一尺寸基准：旧包 CSS px 以 375px 手机参考宽换算为 750 布局单位（×2），与 rpx 几何一并由 Stage 缩放至 941 设计宽。`cssWidth` 在颜色区只选窄屏列数，不再参与字体／最小高度／间距的反向缩放，避免编辑器大窗口中文字与色点比例失衡。单位对照表见实验室文档。

底部导航的点击组件分别挂在 `bottom/buttons/Node/bg` 和 `Node2/bg`，父节点 Button 停用；兼容 `bottons` 容器名称和旧 `Node-001` 名称。对外导出 `BottomNavigationHandlers`，通过 `HomeController.setBottomNavigationHandlers({ onSmokeTab, onWorldTab })` 连接后续页面；`onSmokeTab` 对应导航“来一根”，`onWorldTab` 对应“全球”。回调可在预制体接入前后设置或替换，传入 `{}` 清除。当前 `DemoFlow` 不注册这些回调，点击静默，不抽烟、不切换页面或选中态；开盖和取烟期间忽略导航点击。

布局基准为当前场景设置的 941×1672、固定宽度适配。旧包 750rpx 仍用于 CSS 换算，部分运行时图形仍使用原 750 设计单位，后续需逐屏适配。`GameBootstrap` 设置设计分辨率；`DemoFlow` 用 Widget 使运行时面板填满 Canvas。当前首页的 `top`、`side`、`bottom` 使用预制体保存的坐标与缩放；旧的运行时导航 Widget 和 CSS px 布局只用于被替换后隐藏的节点。运行时烟盒工作区仍按导航上方的剩余高度计算，并补偿烟盒的坐标与尺寸。烟盒在内容组内再以 X/Y 不同倍率接近旧包左侧主视觉比例，盒身上沿与内衬接合。`SessionController` 将边缘按钮及顶部/右侧工具放入 `SafeArea` HUD，再逐个添加 Widget 约束；短屏隐藏两个暂缓工具。互动背景使用 `CanvasTexture` 按可见高度生成旧包默认场景的渐变、暖光和底部暗化，不再使用固定纯色地板。烟身、灰屑和呼吸特效读取 `view.getVisibleSize().height` 调整纵向几何与动态纹理尺寸，不给粒子逐个添加 Widget。结果页内容在短屏整体缩放。预制体首页在不同屏幕比例及非零手机安全区的显示由用户验收；本轮只有静态验证。

## 渲染与注释约定

- 固定 UI、烟盒封面：Sprite、Label、预制体。当前香烟轮廓/滤嘴仍有 Graphics；焦边暗色底层位于 Graphics 烟纸后，烟纸上缘按不规则路径绘制，前景的燃烧端/焦黑折边和灰帽另用 Canvas 纹理。烟头烟、点火火焰、呼吸圈和基础烟圈也采用浏览器 Canvas 2D 生成运行时纹理，再由 Cocos Sprite 显示。该桥接仅针对本阶段浏览器预览，其他发布平台需另行适配。
- 人物吐气烟使用程序生成的 96×96 灰度强度 Sprite 池，默认自然白以 `ONE / ONE_MINUS_SRC_COLOR` 做 screen 混合；灰块/细尘用 Graphics 绘制旋转椭圆近似；火星核心用 Graphics、模糊光晕用运行时 Canvas 纹理，防止纹理上传问题令全部火星不可见。离开互动页或重新开始时重置粒子和输入状态。
- 状态转换注释写清前置状态及拒绝原因，不只复述代码。
- 临时旧素材标注 `LEGACY_ASSET: <旧包相对路径>; TODO_REPLACE: <替代物>`。
- 尚待截图核对的视觉标注 `VISUAL_APPROX`；暂缓功能统一记录在 `requirements.md`，不留无归属的空按钮。
