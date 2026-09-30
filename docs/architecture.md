# Cocos 模块拆分（当前实现与后续扩展）

## 场景

第一版沿用 `assets/scenes/game.scene`，在一个场景中切换 `HomePanel`、`SessionPanel`、`ResultPanel`、`SupplyPanel`、`CheckInPanel`、`QuitPanel` 六组节点。共享 Canvas、音频控制和一次会话数据；以后页面增加再拆场景。

## 当前模块

当前代码统一放在 `assets/scripts/`；原有的拼写错误目录 `assets/scritpts/` 已移除。表中“后续”指尚未独立拆分的职责，不代表已经实现。

| 模块 | 当前目录 | 职责 |
| --- | --- | --- |
| `DemoFlow` | `scripts/app/` | 切换五个面板，传递会话快照；协调烟票和广告补盒写入。 |
| `SessionModel` | `scripts/domain/` | 与引擎无关的状态机、剩余量、灰/烟圈次数、吸入时长和交互准入。 |
| `HomeController` | `scripts/home/` | 烟盒展示、开盒、选烟和启动会话；0/10 时将主按钮切换成补盒入口，双层文字/Canvas 纹理绘制 2.8 秒扫光。 |
| `SessionController` | `scripts/session/` | 将长按与按钮输入转为模型事件，调度画面、音效及可见提示。 |
| `CigaretteView` | `scripts/session/view/` | 香烟、滤嘴、燃烧端、烟头烟、灰帽和弹灰粒子；后续可拆独立 AshEffect。 |
| `BreathEffects` | `scripts/session/effects/` | 中央呼吸圈、人物吐气烟及基础圆形吐烟圈。 |
| `CanvasTexture` | `scripts/session/effects/` | 浏览器 Canvas 2D 到 Cocos Sprite 的运行时纹理桥接，供渐变/柔边效果使用。 |
| `SessionInput`（后续） | `scripts/session/input/` | 目前输入仍在 `SessionController`；将来可拆长按、松开与晃动弹灰手势。 |
| `DemoAudio` | `scripts/audio/` | 可停止的吸气/吐气主音轨、独立弹灰叠加音轨、静音与临时素材加载；状态结束时由 `SessionController` 停止主音轨。 |
| `ResultController` | `scripts/result/` | 显示本次结果并返回首页；当前盒空时转补盒页。 |
| `SupplyController` | `scripts/supply/` | 空盒补盒页、本机烟票消费入口、换盒占位入口及广告预览弹层。 |
| `RewardedVideoGateway` | `scripts/services/` | 奖励广告接口，当前 `PreviewRewardedVideoGateway` 返回占位弹层的显式模拟完成/取消结果；真实平台适配器后续替换。 |
| `AssetCatalog` | `scripts/assets/` | 集中引用临时图片和音频，标注旧包来源。 |
| `ProgressStore` | `scripts/persistence/` | 通过可替换的键值存储接口读写带版本号的累计抽烟根数；按本根会话 ID 防止结束回调重复计数。未来钱包、任务使用各自的存储对象和接口，不提前并入本次计数。 |
| `PackStore` | `scripts/persistence/` | 独立保存当前王溪盒 10 个可用/空位槽、盒序号及盒盖开合状态；选中有效槽后在取烟动画前确认扣除，奖励完成且旧盒空时创建下一盒。兼容读取 V1 十槽及早期无盒盖字段的 V2 状态。库存数由槽位计算，不从累计根数倒推。 |
| `CheckInStore` | `scripts/persistence/` | 保存每日打卡、额外烟票领取与当前烟票余额；票补盒交易 ID 重放时不重复扣票。 |
| `QuitController` | `scripts/quit/` | 今日戒烟滑入页、真烟与未抽双页签、长按记录、确认弹层和本机历史摘要。 |
| `QuitStore` | `scripts/persistence/` | 用同一本机键保存真实抽烟和未抽确认，保证两者互斥；记录撤销、感受、烟价与按日统计。 |
| `TicketRefillStore` | `scripts/persistence/` | 王溪空盒用 1 张本机烟票补盒；先写待完成记录，再扣票并创建下一盒，重试或重启后继续未完成交易。 |

数据流：`SessionController → SessionModel → CigaretteView / BreathEffects`；`DemoFlow` 在有效取烟前由 `PackStore` 扣当前盒槽位，会话结束快照再交给 `ProgressStore` 结算累计根数，两个结果供 `HomeController / ResultController` 展示。空盒时可走 `SupplyController → TicketRefillStore → CheckInStore / PackStore`，只对当前空盒扣 1 张票并新建满盒；本地待完成记录使中断后可重试且不会重复扣票。广告路径为 `SupplyController → RewardedVideoGateway → DemoFlow → PackStore.refillAfterReward`，只有 `completed` 且旧盒实例 ID 仍匹配才新建满盒；占位广告的“模拟完成”不是实际广告奖励。`CanvasTexture` 只负责显示，不修改业务状态。真实广告、真实换盒和完整整盒结算仍未实现。浏览器存储只保障同一站点/浏览器当前设备的数据；不做完整会话历史、进行中恢复、云同步。票与盒的两个存储键通过待完成记录恢复，但不具备旧包单一事务写入及跨标签页并发原子性。

取烟入场：`HomeController` 绘制两排共 10 个可见烟槽，并把选中烟、内衬轨及前排烟的世界包围盒转换到过渡层坐标。点击后首页非烟盒内容在 180 ms 内渐隐并隐藏，烟盒保持完整不透明；`DemoFlow` 创建未点燃的 `CigaretteView` 入场实例，`EntryMotion.sharedEntryMotion` 移植旧包曲线（Cocos 向上 Y 轴），`Mask` 模板处理前 28% 遮挡。与会话背景共用 `paintCommunityBackground` 的单张覆盖纹理置于整个 `HomePanel` 上方、抽出的烟下方，清遮挡后用 480 ms 从透明渐至不透明。视觉上剩余的旧首页与烟盒作为整体退去，盒内各层不会互相透出；完全覆盖且运动终点到达后才关闭首页。当前仍是双烟实例交接，不是旧包单 Canvas。临时 Canvas 纹理在交接时显式释放。

首页盒内滤嘴由 `HomeController.paintWangXiFilter` 通过 `CanvasTexture` 逐槽生成渐变、纹理、顶盖和小标；槽节点的 `UITransform` 仍用来测量取烟源位置。首页销毁时释放十张运行时纹理。入场烟与会话烟各有一个 `CigaretteView`，但都用同一 `renderBodyMaterial` 绘制完整烟纸、滤嘴及阴影；不再使用覆盖整根源烟并提前淡出的盒内滤嘴贴层。旧包的盒内 CSS 滤嘴与入场烟的衔接仍是异材质交接。先前按烟盒各渲染节点、首页背景分别降透明度，会使盒面、内衬和烟支在中途互相透出，现已移除；只对上方新背景纹理设置单一透明度。选中烟槽仍独立隐藏。清遮挡进度达 0.28 后连续两次更新才启动 480 ms 覆盖渐入，HUD 随运动进度渐入；这仍只是基于进度的帧确认，不是旧包按实测出盒几何触发的 `entryclear`，也缺 Canvas 就绪握手。

`SessionModel` 位于 `assets/scripts/domain/SessionModel.ts`。当前首版状态为 `UNLIT → LIGHTING → IDLE ⇄ INHALING → EXHALING`，并分别以 `FINISHED`、`EXTINGUISHED` 结束。弹灰只在已点燃的待机/吸/吐阶段且有灰或已有弹灰记录时成功；基础烟圈只在吐气阶段成功，每根默认 3 次。所有燃烧和交互数值集中在 `SessionTuning`，视图只读取不可变快照。

当前场景保持 `Canvas + Camera` 的轻量结构，在 Canvas 上挂载 `GameBootstrap`。启动后由 `DemoFlow` 创建 `HomePanel`、`SessionPanel`、`ResultPanel`、`SupplyPanel`、`TransitionLayer` 与 `AudioRoot`。后续视觉稳定后可将面板固化为 `assets/prefabs/panels/` 下的预制体，不改变控制器职责。

布局基准为用户确认的 750×1600、固定宽度适配。`GameBootstrap` 设置设计分辨率；`DemoFlow` 用 Widget 使运行时面板填满 Canvas。`HomeController` 的底部“来一根／全服”导航用 Widget 固定贴底，并把旧包固定 CSS px 尺寸按实时视口宽度换算到设计坐标；普通首页内容只使用导航上方的剩余高度，短屏整体缩放并允许中部工作区继续纵向压缩。烟盒在内容组内再以 X/Y 不同倍率接近旧包左侧主视觉比例，盒身上沿与内衬接合，右侧五项信息为静态展示（未开放项无点击事件）。`SessionController` 将边缘按钮及顶部/右侧工具放入 `SafeArea` HUD，再逐个添加 Widget 约束；短屏隐藏两个暂缓工具。互动背景使用 `CanvasTexture` 按可见高度生成旧包默认场景的渐变、暖光和底部暗化，不再使用固定纯色地板。烟身、灰屑和呼吸特效读取 `view.getVisibleSize().height` 调整纵向几何与动态纹理尺寸，不给粒子逐个添加 Widget。首页/结果页内容在短屏整体缩放。底部导航当前只预留标准 57 CSS px，非零手机安全区仍需目标设备验收；本轮只有静态验证。

## 渲染与注释约定

- 固定 UI、烟盒封面：Sprite、Label、预制体。当前香烟轮廓/滤嘴仍有 Graphics；焦边暗色底层位于 Graphics 烟纸后，烟纸上缘按不规则路径绘制，前景的燃烧端/焦黑折边和灰帽另用 Canvas 纹理。烟头烟、点火火焰、呼吸圈和基础烟圈也采用浏览器 Canvas 2D 生成运行时纹理，再由 Cocos Sprite 显示。该桥接仅针对本阶段浏览器预览，其他发布平台需另行适配。
- 人物吐气烟使用程序生成的 96×96 灰度强度 Sprite 池，默认自然白以 `ONE / ONE_MINUS_SRC_COLOR` 做 screen 混合；灰块/细尘用 Graphics 绘制旋转椭圆近似；火星核心用 Graphics、模糊光晕用运行时 Canvas 纹理，防止纹理上传问题令全部火星不可见。离开互动页或重新开始时重置粒子和输入状态。
- 状态转换注释写清前置状态及拒绝原因，不只复述代码。
- 临时旧素材标注 `LEGACY_ASSET: <旧包相对路径>; TODO_REPLACE: <替代物>`。
- 尚待截图核对的视觉标注 `VISUAL_APPROX`；暂缓功能统一记录在 `requirements.md`，不留无归属的空按钮。
