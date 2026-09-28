# Smoke：Cocos Creator 3.8.6 2D 演示项目

本工程从空白 Cocos Creator 3.8.6 竖屏 2D 工程开始，重新实现一个“首页烟盒 → 抽烟互动 → 本次结果”的演示闭环。旧微信小程序的编译包只作为行为与画面参考，不能直接导入 Cocos。

新窗口接手时，依次阅读：

1. [需求与状态](docs/requirements.md)：已确定范围、待做、暂缓、验收条件。
2. [模块设计](docs/architecture.md)：场景、脚本职责和依赖。
3. [旧包参考](docs/legacy-reference.md)：证据、素材位置与不能直接复用的部分；进一步看 [逐方法规则](docs/legacy-rules.md)、[全包方法索引](docs/legacy-module-index.md) 和 [新旧差异表](docs/legacy-vs-current.md)。
4. [素材与待确认项](docs/assets-and-decisions.md)：需要用户提供的截图，以及图片、音频替换标记。
5. [四张画面参考](docs/visual-reference.md)：首页、取烟过渡、点火前互动、结果的可见布局与首版取舍。原图保存在 `docs/reference/`。

当前状态：`game.scene` 已挂载运行入口，首页、取烟过渡、互动页和结果页的首轮运行时画面已经实现。已临时导入王溪烟盒皮肤及四类音效，并通过 Creator 浏览器首轮闭环验证。旧包静态审计发现数项尚未对齐的业务与 Graphics 规则，见差异表；后续修改和验收应以该表为依据。

## 修改与文档同步约定

- 每次修改代码后，完成前必须检查相关 Markdown 是否仍与代码、当前需求和旧包差异一致；不一致时，同一轮同步修改 `docs/requirements.md`、`docs/legacy-rules.md`、`docs/legacy-vs-current.md` 等相关文档。若无需改动，也要明确确认已检查。
- 文档要区分“已编码”“已静态验证”“用户已看过效果”“达到旧包等效”；不能把编译通过或已有类似图形写成效果验收通过。
- 效果由用户在浏览器中查看；除非用户再次要求，代码修改后不由 Codex 打开浏览器确认画面。可进行 TypeScript 编译、纯逻辑测试和静态检查，并如实记录未验证的动态效果。
