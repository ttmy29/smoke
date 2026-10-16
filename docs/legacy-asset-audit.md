# 旧包 audio 与 packs 素材及功能差异

最新补充：为按旧包完善选盒 UI，已取得并导入祖国 `pack-v1.jpg`，大小和 MD5 与旧包清单一致，来源见 [导入记录](../legacy-assets/v1.0.8-merged/zuguo-import.json)。目前选盒页使用八款普通本地图及祖国图；无影烟按旧包隐藏盒体。广告解锁、派烟与散烟盒显示旧包原样入口，未实现的业务保留静默接口，不显示开发占位文案。下文关于祖国图本地不存在的条目是原审计记录，已由本补充更新，其余远程资源仍未获取。

选盒 UI 接入进度（2026-10-16）：八款本地皮肤已用于新 [选盒目录页](pack-select.md)，首页换盒入口已接通；其他九款烟盒的实际解锁、兑换、切换及独立库存仍未实现。下文原审计的“图片、选盒页面未接”应按此更新区分展示与业务。未进行画面验收。

审计日期：2026-10-16。范围为音频、烟盒图片及其直接关联功能，不是全包功能完成度审计。本轮仅做文件、代码引用和哈希检查；未试听、未打开图片或浏览器、未下载远程资源，未导入素材或修改业务代码。

后续复制记录（2026-10-16）：已按用户要求将当前缺少的 **29 个本地音频、7 张烟盒图片**复制到 [项目素材暂存目录](../legacy-assets/v1.0.8-merged/README.md)，合计 295642 字节，复制后 SHA-256 全部一致。仅暂存于 Cocos `assets` 之外，未导入或接入运行逻辑。来源、去重及不同版本去向见 [manifest.json](../legacy-assets/v1.0.8-merged/manifest.json)；下文“当前使用／缺少的接入”仍指运行时状态。

最新导入记录（2026-10-16）：上述 36 份素材已进一步导入 `assets/legacy-temp/` 独立 Bundle，Creator 元数据、library 产物及 7 个图片 SpriteFrame 均已核对；详见 [导入清单](../legacy-assets/v1.0.8-merged/cocos-import.json)。未替换原有资源或接入业务，下文“缺少的素材”应区分原审计时缺文件与目前仍缺功能接入。

## 来源和统计口径

- 旧包：`E:/json/wxd0b7dafebccb8110_unpacked`，按 [V1.0.8 文件选择规则](legacy-reference.md) 读取 `appservice.app-1.js`、`pack-skins/app-service-1.js` 等；新增 `world-tools` 使用原名。
- 当前引用：[AssetCatalog.ts](../assets/scripts/assets/AssetCatalog.ts)、[DemoAudio.ts](../assets/scripts/audio/DemoAudio.ts)、[PackStore.ts](../assets/scripts/persistence/PackStore.ts)、[HomeController.ts](../assets/scripts/home/HomeController.ts)。
- 合并旧包共有 **36 个本地音频文件**；仅将文件名末尾的 `-1` 合并后为 **25 个路径**。这不代表 25 种独立功能：环境音在主包和子包各有一组，不同版本也可能有不同内容。
- 当前 `assets` 中只有 **4 个音频文件**；普通烟盒皮肤只有 **1 款**接入。
- 普通皮肤共 **8 款**：王溪 1 款加 `pack-skins/assets` 7 款。每款均有原名和 `-1` 文件，8 对图片的内容一致；不要按 16 款统计。
- 音频不能同样视为重复：例如 `ember-wheel.mp3` 为 5769 字节，`ember-wheel-1.mp3` 为 4128 字节，哈希不同；`ash-tap`、`silver-flame` 的两版本文件则相同。不能统一删除后缀或只凭后缀替换资源，须结合最终代码中的逻辑路径、远程映射和内容确认。

## 当前真正使用的五份素材

以下映射经 SHA-256 对比确认，不只根据文件名推断。

| 当前文件（相对 assets/resources） | 对应旧包文件 | 当前用途 |
| --- | --- | --- |
| `audio/ignition.mp3` | `audio/ignition/ember-wheel.mp3` | 唯一点火音 |
| `audio/inhale.mp3` | `audio/actions/inhale.mp3` | 唯一吸气音；对应 V1.0.8 的经典音源／声音 2 |
| `audio/exhale.mp3` | `audio/actions/exhale-soft.mp3` | 所有吐气统一使用轻吐气音 |
| `audio/ash-tap.mp3` | `audio/actions/ash-tap.mp3`，与 `-1` 相同 | 弹灰音，可叠加在吸／吐音轨上 |
| `textures/packs/wang-xi.jpg` | `assets/packs/life/skin.jpg`，与 `skin-1.jpg` 相同 | 王溪烟盒 |

## 音频：旧包多出的资源做什么

下表使用去除版本后缀的逻辑文件名；同一行涉及的旧、新版本不重复列为功能。

| 分类与位置 | 文件 | 旧包实际用途 | 当前缺少的接入 |
| --- | --- | --- | --- |
| `audio/ignition` | `paper-match.mp3` | 火柴划擦／点燃声 | 点火器具选择、对应音效和表现 |
| 同上 | `silver-flame.mp3` | 煤油打火机翻盖／拨轮／点燃声 | 同上 |
| 同上 | `night-arc.mp3` | 电弧打火机接通声 | 同上 |
| 同上 | `flame-burning.mp3` | 普通打火机、火柴、煤油打火机的点火首段播放完且仍按住时，接续火焰燃烧声；电弧不走此分支 | 点火首段与燃烧段交接、取消停止处理 |
| `audio/actions` | `inhale-current.mp3` | V1.0.8 默认吸气音，设置值 `1`；`inhale.mp3` 为经典音／设置值 `2` | 当前只接了声音 2，缺声音 1及持久化选择 |
| 同上 | `exhale-steady.mp3` | 中等强度吐气 | 根据实际强度分档选音 |
| 同上 | `exhale-deep.mp3` | 强吐气，也被一口模式／战舰模式的彩蛋吐气复用 | 强度分档；彩蛋模式及其专用调度 |
| `audio/ambience` 与 `settings-tools/audio/ambience` | `lamp-crickets.mp3` | 田间虫鸣环境，配置含虫鸣和风声 | 环境选择、环境图形、独立环境音开关和循环 |
| 同上 | `night-tide.mp3` | 海边夜晚，海浪／海风 | 同上 |
| 同上 | `eaves-downpour.mp3` | 屋檐大雨，持续雨声 | 同上 |
| 同上 | `blue-key-rain.mp3` | 黑客世界，键盘／鼠标／重按声 | 同上 |
| `settings-tools/assets` | `real-smoking-ding.mp3` | “真烟”长按记录成功后播放提示音 | 已有真烟记录业务，但未接这份成功音 |
| `world-tools/audio` | `cough.mp3`、`cough-male.mp3`、`cough-female.mp3` | 影响体验中按时间表与声音类型播放咳嗽 | 影响二级体验、事件时间轴与声音选择 |
| 同上 | `bullet-time-clean.mp3` | 影响体验中进入解体后的子弹时间阶段时播放 | 同上，含阶段同步、重试和退出清理 |
| 同上 | `collection-exhale.mp3` | 国庆集藏活动互动使用的吐气声，控制器单次最多播放 3 秒 | 集藏活动页、交互与奖励流程 |

已确认的音频规则还包括：

- 吐气强度 `> 0.7` 选 deep，`> 0.35` 选 steady，其余选 soft；配置音量分别为 `0.42 / 0.52 / 0.9`。当前统一使用 soft、音量 0.9。
- 旧包有点火、吸气、吐气、弹灰四类独立偏好，环境音另有开关；当前设置只接总开关，不保存这些独立偏好。
- 默认环境 `community`（小区楼下）没有背景音；另外四种环境不是进入会话就应该同时播放的背景音乐。
- V1.0.8 环境定义实际引用 `settings-tools/audio/ambience`，并由远程媒体层处理；主包 `audio/ambience` 的同名文件不能据此算成另一套场景。
- `SmokingAmbientController` 有双播放器管理循环、460 ms 交叉淡化和退出清理；导入 MP3 仍不足以还原这套行为。
- `SessionSoundController.playLongInhale` 还存在长吸气时先用新音、3 秒后交接经典音的路径；这是额外模式能力，不能直接给当前普通会话打开无限吸气。

上述用途来自代码配置和调用，不表示已经试听确认实际听感。

## 烟盒：七款未接入图片及其业务

下表图片位于 `pack-skins/assets/<ID>.jpg`，每款的 `-1.jpg` 都与原图哈希一致。中文名按旧包代码保留，不替换为现实品牌名称。

| 旧包 ID | 名称 | 解锁条件 | 当前状态 |
| --- | --- | --- | --- |
| `life` | 王溪 | 默认可用，首盒免费 | 已接图片；当前内部 ID 为 `wang-xi` |
| `flowing-gold` | 华孑 | 2 张烟票兑换解锁 | 图片、兑换解锁、切换与库存未接 |
| `night-voyage` | 黄鹊楼 | 最长连续打卡达到 2 天 | 图片、解锁、切换与库存未接 |
| `fog-harbor` | 云姻 | 累计分享 10 次 | 同上；还缺真实分享计数 |
| `zero-hour` | 红搭山 | 完成 50 根赛博烟 | 图片、解锁、切换与库存未接 |
| `neon-bridge` | 煊赤门 | 成就数达到 30 个 | 同上 |
| `slow-tide` | 英蓉王 | 最长连续打卡达到 7 天 | 同上 |
| `red-equator` | 欢囍 | 最长连续打卡达到 14 天 | 同上 |

旧包主题还分别配置盒盖颜色、滤嘴底色／色带／印记、烟盒代码及默认视觉类型。**这些 JPG 是烟盒皮肤，不是完整烟盒交互或整根香烟的替代图。**

当前不仅缺图片导入，还缺以下链路：

1. 换盒／选盒页面及首页侧栏入口，展示锁态、进度、选中盒和库存。
2. 各烟盒独立实例、剩余槽位和开盖状态；当前 `PackSnapshot.packId` 限定为 `wang-xi`。
3. 解锁指标更新、烟票兑换的去重与恢复，以及已解锁状态保存。
4. 切换后的皮肤、主题、滤嘴和会话配置联动。
5. 旧 ID `life` 与当前 `wang-xi` 的映射和既有存档迁移方案。

## 两款没有普通本地 JPG 的特殊烟盒

旧包 `PACKS` 总共定义 **10 款**，除上面的 8 款普通皮肤外，还包括：

| ID | 名称 | 资源方式和用途 | 当前差距 |
| --- | --- | --- | --- |
| `shadowless` | 无影烟 | 隐藏款，皮肤映射明确为空字符串，选择页显示“有烟无影，有形无踪”；没有对应 JPG 并不代表解包漏图 | 当前有相关成就条目／图标，但没有可选烟盒、库存及对应表现；特殊解锁路径需单独审计 |
| `zuguo` | 祖国 | 国庆活动款，皮肤为远程 `zuguo/pack-v1.jpg`，还有色调、滤嘴与配色定制；活动奖励及邀请规则由独立模块管理 | 当前商店有套装展示，尚未接完整活动、领取、烟盒库存与自定义表现 |

“祖国”不只是第九张待复制的本地皮肤；“无影烟”也不应简单记成缺图。

## 本地目录以外还有远程素材

V1.0.8 的 `config/remote-audio.js` 虽然名称含 audio，也登记图片；`services/remote-media.js` 负责下载、大小／MD5 校验和缓存。该层在资源准备期间可返回原逻辑路径，不能仅以本地文件推断实际最终播放版本。

| 远程登记项 | 用途 | 本地核查结果 |
| --- | --- | --- |
| `world-tools/audio/canon-full.m4a` | 影响体验配乐；代码按前段、后段及片尾配置不同时间偏移 | 合并解包目录未找到本地 m4a，清单登记 5611887 字节；只确认引用，未下载验证 |
| `zuguo/pack-v1.jpg` | 祖国烟盒皮肤 | 本地未找到该图片 |
| `zuguo/ashSalute-v1.png` | 活动礼炮烟灰资源 | 本地未找到 |
| `zuguo/exhalePalette-v1.png`、`ringPalette-v1.png`、`tipPalette-v1.png` | 活动吐气／烟圈／烟头配色条目资源 | 本地未找到；不能仅凭条目图认定最终烟雾由 PNG 直接绘制 |
| `zuguo/textRing-v1.png` | 活动文字烟圈条目资源 | 本地未找到 |
| `zuguo/activity-share-v1.jpg` | 活动分享图 | 本地未找到 |

注意：吸气和吐气有额外例外。V1.0.8 `SessionSoundController.assetSource` 对 inhale／exhale 类直接返回本地逻辑路径，其他类别才交给 `audioSource`。因此远程清单中存在同名动作音频，不代表该普通会话一定使用远程版。

## 对当前项目缺口的结论

| 顺序建议 | 功能缺口 | 原因 |
| --- | --- | --- |
| 先处理会话音效 | 默认吸气声音 1、吐气分档、火焰接续声 | 直接影响已有核心互动；不必先做完整商店或活动 |
| 再完善设置 | 点火方式、吸气音选择、独立音效偏好及持久化 | 决定额外音效在什么条件下使用 |
| 再做多烟盒 | 7 款普通皮肤、选盒页、解锁指标、多盒库存和主题联动 | 图片已经存在，主要缺业务及渲染接入 |
| 独立安排环境 | 4 种环境及背景音、循环和清理 | 需要场景表现与音频同时接入 |
| 补已有记录反馈 | 真烟记录成功提示音 | 已有业务可直接对应，但仍需明确音效开关规则 |
| 按范围安排全服内容 | 影响体验、集藏活动、祖国和无影烟 | 属于独立功能链路，不因素材存在就自动纳入本轮开发 |

所以当前少的既有“可直接利用但未导入的素材”，也有“未实现的功能链路”和“本地没有、由远程媒体管理的资源”。不能通过整包复制 audio 和 packs 就补齐。

## 可复查证据

- `appservice.app-1.js`：`presentation/session-sound.js`、`presentation/ignition-sound.js`、`presentation/smoking-environment.js`、`presentation/smoking-ambient.js`、`presentation/pack-theme.js`、`domain/cyber-types.js`、`domain/tasks.js`、`domain/national-day.js`、`config/remote-audio.js`、`services/remote-media.js`。
- `pack-skins/app-service-1.js`：`pack-skins/components/pack-skin-host/pack-skin-host.js`、`pack-skins/pages/pack-select/pack-select.js`。
- `settings-tools/appservice.app-1.js`：`settings-tools/services/real-smoking-page.js` 的记录提交成功与提示音调用。
- `world-tools/appservice.app.js`：`world-tools/presentation/impact-sound.js`、`impact-music.js`、`collection-breath-sound.js`；`world-tools/app-service.js` 另含集藏页实例化调用。
- 当前 [DemoFlow.ts](../assets/scripts/app/DemoFlow.ts) 全服页仅传入首页、商店回调，商店未传商品／活动回调；[SettingsController.ts](../assets/scripts/settings/SettingsController.ts) 的 `openSound` 仅接总开关。

相关待办见 [项目待优化事项](optimization-backlog.md)。以上均为静态审计结论，不代表声音或视觉效果已验收。
