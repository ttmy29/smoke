import { _decorator, AudioClip, AudioSource, Component, Node, resources } from 'cc';
import { AssetCatalog } from '../assets/AssetCatalog';

const { ccclass } = _decorator;

export type DemoSound = 'ignition' | 'inhale' | 'exhale' | 'ashTap';

@ccclass('DemoAudio')
export class DemoAudio extends Component {
  private readonly clips = new Map<DemoSound, AudioClip>();
  private primarySource!: AudioSource;
  private accentSource!: AudioSource;
  private activePrimary: DemoSound | null = null;
  private pendingPrimary: DemoSound | null = null;
  private muted = false;

  protected onLoad(): void {
    const primaryNode = new Node('PrimarySound');
    const accentNode = new Node('AccentSound');
    this.node.addChild(primaryNode);
    this.node.addChild(accentNode);
    this.primarySource = primaryNode.addComponent(AudioSource);
    this.accentSource = accentNode.addComponent(AudioSource);
    this.primarySource.loop = false;
    this.accentSource.loop = false;
    this.load('ignition', AssetCatalog.ignition);
    this.load('inhale', AssetCatalog.inhale);
    this.load('exhale', AssetCatalog.exhale);
    this.load('ashTap', AssetCatalog.ashTap);
  }

  public play(sound: DemoSound): void {
    if (this.muted) return;
    if (sound === 'ashTap') {
      const clip = this.clips.get(sound);
      if (!clip) return;
      this.accentSource.stop();
      this.accentSource.clip = clip;
      this.accentSource.volume = this.primarySource.playing
        && (this.activePrimary === 'inhale' || this.activePrimary === 'exhale') ? 0.28 : 0.58;
      this.accentSource.currentTime = 0;
      this.accentSource.play();
      return;
    }
    this.primarySource?.stop();
    this.activePrimary = sound;
    this.pendingPrimary = sound;
    this.startPrimaryIfLoaded(sound);
  }

  /** A phase exit stops only its own primary cue, never the ash accent. */
  public stop(sound?: DemoSound): void {
    if (sound && sound !== this.activePrimary) return;
    this.activePrimary = null;
    this.pendingPrimary = null;
    this.primarySource?.stop();
    if (!sound) this.accentSource?.stop();
  }

  public toggleMuted(): boolean {
    this.muted = !this.muted;
    if (this.muted) this.stop();
    return this.muted;
  }

  public get isMuted(): boolean {
    return this.muted;
  }

  private load(key: DemoSound, path: string): void {
    resources.load(path, AudioClip, (error, clip) => {
      if (!error && clip) {
        this.clips.set(key, clip);
        if (this.pendingPrimary === key) this.startPrimaryIfLoaded(key);
      }
    });
  }

  private startPrimaryIfLoaded(sound: DemoSound): void {
    if (this.muted || this.activePrimary !== sound) return;
    const clip = this.clips.get(sound);
    if (!clip) return;
    this.pendingPrimary = null;
    this.primarySource.clip = clip;
    this.primarySource.volume = sound === 'inhale' || sound === 'exhale' ? 0.9 : 1;
    this.primarySource.currentTime = 0;
    this.primarySource.play();
  }
}
