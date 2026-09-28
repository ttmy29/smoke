import { _decorator, Component, Node, ResolutionPolicy, UITransform, view } from 'cc';
import { alignWidget, DESIGN_HEIGHT, DESIGN_WIDTH } from '../common/UiFactory';
import { DemoFlow } from './DemoFlow';

const { ccclass } = _decorator;

/** 场景只保留 Canvas/Camera；运行时入口负责创建可重复生成的演示节点树。 */
@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
  protected onLoad(): void {
    view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, ResolutionPolicy.FIXED_WIDTH);
    const stale = this.node.getChildByName('AppRoot');
    stale?.destroy();

    const appRoot = new Node('AppRoot');
    this.node.addChild(appRoot);
    appRoot.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
    alignWidget(appRoot, { left: 0, right: 0, top: 0, bottom: 0 });
    appRoot.addComponent(DemoFlow);
  }
}
