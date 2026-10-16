# 全服主页

`WorldController` 位于 `assets/scripts/world/`，由 `DemoFlow` 创建为 `WorldPanel`。首页通过 `HomeController.setBottomNavigationHandlers` 的 `onWorldTab` 进入；全服页底部“来一根”回到首页，当前选中项点击不重置列表。

## 页面与导航

- Graphics/Label 绘制品牌、全服标题、连接状态、在线人数、正在抽烟人数、累计吸烟数及呼气次数。
- 正文纵向滚动，以 375px 手机布局为参考宽，整体缩放到当前游戏画布宽度；文字、卡片、间距同步放大，不受桌面网页 520px 内容宽度上限限制。941 宽画布中倍率为 `941/375≈2.51`，左右内边距为 `24×2.51≈60` 设计单位。实际窗口小于 375 CSS px 时使用实际宽度，≤360px 保留 18px 内边距等窄屏规则。
- 全服／个人影响入口与商店、商品卡遵循旧包主要尺寸；背景、图标和“祖国”展示插画为当前 Graphics 近似。
- 从用户 bottom 实例克隆 `ui底板` 和 `buttons/Node`、`Node2`，保留原变换与 bg 点击区域；不复制主按钮和标语，不改变首页 bottom。全服项图文着色并添加橙色选中指示条。
- 正文按导航底板上沿预留空间，导航不随正文滚动。

## 数据接口

```ts
interface WorldSnapshot {
  connected: boolean;
  online?: number;
  smoking?: number;
  total?: { extracted: string; puffs: string };
  personalUnlocked?: boolean;
}
interface WorldSource {
  readSnapshot(): Readonly<WorldSnapshot>;
  refresh(): Promise<Readonly<WorldSnapshot>>;
}
```

`WorldController.setSource(source)` 可替换数据源。当前使用 `emptyWorldSource`，只返回未连接状态，没有网络请求、模拟数字或本机计数替代。在线值只在已连接且为非负安全整数时显示；累计数使用十进制字符串，支持超出 JavaScript 安全整数范围并加千位分隔。缺失或非法值显示“—”。

数据源可以在离线时提供上次累计值；页面本身尚不持久缓存。刷新期间禁止重复点击；离开页面、销毁或替换数据源后，迟到结果不再更新页面。刷新失败保留已有累计值并显示未连接。

## 二级入口

`initialize(navigation, source)` 或 `setNavigationHandlers(navigation)` 配置以下回调：

| 回调 | 用途 |
| --- | --- |
| `onHome` | 必填，返回首页 |
| `onWorldImpact` | 全服影响，有效累计值就绪后启用 |
| `onPersonalImpact` | 个人影响，由 `personalUnlocked` 决定是否启用 |
| `onShop` | 已接入全服商店 |
| `onProduct` | “祖国·山河锦绣”商品详情 |

当前 DemoFlow 配置 `onHome` 和 `onShop`；其余可用入口在没有回调时提示“暂未开放”。不自动解锁个人影响、不改烟票、不进行商品交易。接入完整全服影响页面后，再按旧包完成首次进入的解锁记录。

## 全服商店

“查看更多”打开 `WorldShopController`，使用 375px 手机布局适配画布；固定顶部返回导航，正文可纵向滚动，分类栏横向滚动。返回时保留全服主页及其滚动位置。商店完整盖住全服导航，只有页面子节点参与 0.3 秒滑入/退出，根节点 Widget 不参与动画。

分类为“全部、套装、烟盒、烟圈、烟灰、颜色、打火机”；全部及套装显示“祖国·山河锦绣”，打火机显示专用未上架文案，其余显示通用空状态。商品卡绘制旧包标题、副标题、典藏说明、截止日期与 Graphics 近似插画。日期为旧包展示文案，不代表已接入活动服务。

`WorldShopActions.readTickets` 读取现有本机打卡存档余额，失败显示“—”；`readCollectionCount` 预留山河系列收藏数来源，尚未提供时显示“— / 6 件”。`onProduct` 和 `onShare` 为后续商品详情、活动分享回调，当前未配置时提示暂未开放，不修改烟票和收藏状态。分享按钮阻止触摸向商品卡传播。

## 验收范围

旧包来源：根目录 `chunk_11.webview.js`、`chunk_11.appservice.js`，以及 `appservice.app-1.js` 的 world-demo/world-offline；导航目的页由 `app-config-1.json` 确认。仅做必要的编译、静态与业务逻辑检查，画面、滚动、图标与设备安全区效果由用户验收。
