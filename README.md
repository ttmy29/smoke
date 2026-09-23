# Smoke：Cocos Creator 3.8.6 2D 演示项目

本工程从空白 Cocos Creator 3.8.6 竖屏 2D 工程开始，重新实现一个“首页烟盒 → 抽烟互动 → 本次结果”的演示闭环。旧微信小程序的编译包只作为行为与画面参考，不能直接导入 Cocos。

新窗口接手时，依次阅读：

1. [需求与状态](docs/requirements.md)：已确定范围、待做、暂缓、验收条件。
2. [模块设计](docs/architecture.md)：场景、脚本职责和依赖。
3. [旧包参考](docs/legacy-reference.md)：证据、素材位置与不能直接复用的部分。
4. [素材与待确认项](docs/assets-and-decisions.md)：需要用户提供的截图，以及图片、音频替换标记。
5. [四张画面参考](docs/visual-reference.md)：首页、取烟过渡、点火前互动、结果的可见布局与首版取舍。原图保存在 `docs/reference/`。

当前状态：仅完成需求拆分文档；场景、脚本和素材尚未实现。不要把文档中的设计方案误认为已落地代码。
