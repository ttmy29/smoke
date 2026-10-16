import { _decorator, Component, instantiate, isValid, Node, Prefab, ResolutionPolicy, UITransform, view } from 'cc';
import { BundleLoader } from '../assets/BundleLoader';
import { alignWidget, DESIGN_HEIGHT, DESIGN_WIDTH } from '../common/UiFactory';
import { DemoFlow } from './DemoFlow';
import { debugLog } from '../services/DebugLog';

const { ccclass } = _decorator;

/** Loads the home prefabs before starting the application flow. */
@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
  private readonly prefabAssets: Prefab[] = [];
  private readonly mountedNodes: Node[] = [];
  private appRoot: Node | null = null;

  protected onLoad(): void {
    view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, ResolutionPolicy.FIXED_WIDTH);
    void this.startApplication().catch((error: unknown) => {
      if (isValid(this, true)) console.error('[GameBootstrap] Home bundle initialization failed', error);
    });
  }

  private async startApplication(): Promise<void> {
    const names = ['bottom', 'side', 'top', 'smokePack'] as const;
    const prefabs = await Promise.all(names.map((name) =>
      BundleLoader.loadPrefab('prefabs', `common/${name}`)));
    if (!isValid(this, true)) return;

    const nodes = new Map<string, Node>();
    names.forEach((name, index) => {
      const prefab = prefabs[index];
      prefab.addRef();
      this.prefabAssets.push(prefab);
      let node = this.node.getChildByName(name);
      if (!node) {
        node = instantiate(prefab);
        node.name = name;
        this.node.addChild(node);
        this.mountedNodes.push(node);
      }
      // The authored smokePack is currently a reference; the interactive pack is generated.
      node.active = name !== 'smokePack';
      nodes.set(name, node);
    });

    const stale = this.node.getChildByName('AppRoot');
    if (stale) {
      stale.active = false;
      stale.destroy();
    }
    const appRoot = new Node('AppRoot');
    this.appRoot = appRoot;
    appRoot.active = false;
    this.node.addChild(appRoot);
    appRoot.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
    alignWidget(appRoot, { left: 0, right: 0, top: 0, bottom: 0 });
    const flow = appRoot.addComponent(DemoFlow);
    flow.attachTopPrefab(nodes.get('top')!);
    flow.attachBottomPrefab(nodes.get('bottom')!);
    flow.attachSidePrefab(nodes.get('side')!);
    appRoot.active = true;
    debugLog('首页预制体已加载并挂载', names);
  }

  protected onDestroy(): void {
    this.appRoot?.destroy();
    for (const node of this.mountedNodes) if (isValid(node, true)) node.destroy();
    for (const prefab of this.prefabAssets) prefab.decRef();
  }
}
