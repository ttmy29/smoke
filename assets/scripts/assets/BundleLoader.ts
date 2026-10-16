import { assetManager, AssetManager, Prefab } from 'cc';

/** Reuses loaded bundles and shares concurrent bundle requests. */
export class BundleLoader {
  private static readonly pendingBundles = new Map<string, Promise<AssetManager.Bundle>>();

  public static loadBundle(name: string): Promise<AssetManager.Bundle> {
    const loaded = assetManager.getBundle(name);
    if (loaded) return Promise.resolve(loaded);
    const pending = this.pendingBundles.get(name);
    if (pending) return pending;

    const request = new Promise<AssetManager.Bundle>((resolve, reject) => {
      assetManager.loadBundle(name, (error, bundle) => {
        if (error || !bundle) reject(new Error(`Failed to load bundle "${name}": ${error?.message ?? 'missing bundle'}`));
        else resolve(bundle);
      });
    });
    this.pendingBundles.set(name, request);
    const clear = (): void => { this.pendingBundles.delete(name); };
    request.then(clear, clear);
    return request;
  }

  public static async loadPrefab(bundleName: string, path: string): Promise<Prefab> {
    const bundle = await this.loadBundle(bundleName);
    return new Promise<Prefab>((resolve, reject) => {
      bundle.load(path, Prefab, (error, prefab) => {
        if (error || !prefab) reject(new Error(`Failed to load prefab "${bundleName}/${path}": ${error?.message ?? 'missing prefab'}`));
        else resolve(prefab);
      });
    });
  }
}
