/** Legacy smoke-tools catalog. UI choices and rendered smoke share these IDs. */
export interface LabOption { id: string; label: string; description: string; hex?: string; task?: string; national?: boolean; }
export const LAB_TABS = [
  { id: 'idle', label: '余烟颜色' }, { id: 'exhale-color', label: '呼出颜色' },
  { id: 'ring-color', label: '烟圈颜色' }, { id: 'style', label: '吐雾方式' },
  { id: 'ring', label: '烟圈形状' }, { id: 'restore', label: '恢复默认' },
] as const;
export type LabTab = typeof LAB_TABS[number]['id'];
export type LabScope = 'box' | 'type' | 'global';
export interface SmokeScheme {
  idleSmokeColor: string; exhaleColor: string; ringColor: string;
  exhaleStyle: string; smokeAmount: string; ringShape: string;
}
export const DEFAULT_SMOKE_SCHEME: Readonly<SmokeScheme> = Object.freeze({
  idleSmokeColor: 'natural-white', exhaleColor: 'natural-white', ringColor: 'natural-white',
  exhaleStyle: 'soft', smokeAmount: 'standard', ringShape: 'circle',
});
export const SMOKE_COLORS: readonly LabOption[] = [
  { id: 'zuguo-ring', label: '流金烟圈', description: '红金流转的烟圈', hex: '#d3b073', national: true },
  { id: 'zuguo-exhale', label: '山河云烟', description: '朱红古金交融', hex: '#a44345', national: true },
  { id: 'zuguo-tip', label: '金缕余烟', description: '金红细烟袅袅', hex: '#cfa663', national: true },
  { id: 'natural-white', label: '自然白', description: '低饱和默认白', hex: '#d9dad6' },
  { id: 'warm-gray', label: '暖雾灰', description: '柔和暖灰白', hex: '#c8bfb5' },
  { id: 'ice-blue', label: '冰川蓝', description: '清透冷蓝调', hex: '#8cb8d0' },
  { id: 'mint', label: '薄荷青', description: '低饱和浅青', hex: '#8bbfa8' },
  { id: 'lavender', label: '淡紫', description: '克制淡紫调', hex: '#ad96cc' },
  { id: 'cloud-pink', label: '云霞粉', description: '轻柔通透粉', hex: '#d39bab' },
  { id: 'amber', label: '琥珀金', description: '温暖浅金调', hex: '#cbaa64' },
  { id: 'lava-red', label: '熔岩红', description: '克制熔岩红', hex: '#b85f58' },
  { id: 'ink-black', label: '墨夜黑', description: '可见炭墨黑', hex: '#6a6e72' },
  { id: 'pine-green', label: '松柏绿', description: '沉稳松柏绿', hex: '#548667' },
  { id: 'deep-sea-blue', label: '深海蓝', description: '冷静深海蓝', hex: '#4f7da5' },
  { id: 'terracotta', label: '赤陶橙', description: '温暖赤陶橙', hex: '#c17852' },
];
export const EXHALE_STYLES: readonly LabOption[] = [
  { id: 'soft', label: '轻雾', description: '烟雾柔和向上扩散，作为默认方式' },
  { id: 'stream', label: '直吹', description: '烟雾集中向前移动，横向扩散较窄' },
  { id: 'cloud', label: '云团', description: '先形成数团烟雾，再缓慢向周围散开' },
  { id: 'spiral', label: '螺旋', description: '烟雾围绕中心轻微旋转上升' },
  { id: 'ripple', label: '波纹', description: '烟雾分层向外扩张' },
  { id: 'twin', label: '双股', description: '烟雾向左右分成两股，再逐渐融合' },
];
export const SMOKE_AMOUNTS: readonly LabOption[] = [
  { id: 'light', label: '清淡', description: '约 7 成 · 轻透散开' },
  { id: 'standard', label: '标准', description: '默认量 · 平衡停留' },
  { id: 'dense', label: '浓郁', description: '约 1.3 倍 · 更浓郁' },
];
export const RING_SHAPES: readonly LabOption[] = [
  { id: 'circle', label: '圆形', description: '默认烟圈轮廓' },
  { id: 'heart', label: '爱心', description: '爱心形烟圈' },
  { id: 'square', label: '方形', description: '四边轮廓烟圈' },
  { id: 'petal', label: '花瓣', description: '花瓣状烟圈' },
  { id: 'droplet', label: '水滴', description: '上尖下圆的水滴轮廓', task: 'T01' },
  { id: 'cloud', label: '云朵', description: '蓬松云朵轮廓', task: 'T02' },
  { id: 'crescent', label: '月牙', description: '弯弯的新月轮廓', task: 'T05' },
  { id: 'infinity', label: '无限符号', description: '交错的双环；不含无限次数', task: 'T07' },
  { id: 'clover', label: '四叶草', description: '四片圆润叶瓣', task: 'T06' },
  { id: 'butterfly', label: '蝴蝶', description: '成对展开的蝶翼', task: 'T04' },
  { id: 'smiley', label: '笑脸', description: '带着双眼和微笑的烟圈', task: 'T03' },
  { id: 'snowflake', label: '雪花', description: '六角分枝的雪晶轮廓', task: 'T09' },
  { id: 'note', label: '音符', description: '符头、符干与旗尾组成一枚音符', task: 'T08' },
  { id: 'text', label: '字里山河', description: '四字祝愿，成字停留后轻轻散去', national: true },
];
export const RING_FORMATIONS: readonly LabOption[] = [
  { id: 'tunnel', label: '套圈隧道', description: '小圈穿过大圈，层层展开烟雾隧道' },
  { id: 'chase', label: '追逐穿环', description: '后圈追上前圈，穿过后轮流领跑' },
  { id: 'helix', label: '双螺旋', description: '两列烟圈前后交织，盘旋着向上升' },
  { id: 'weave', label: '交叉回旋', description: '向两侧展开，再回到中央交错穿行' },
];
export const SCHEME_FIELDS = Object.keys(DEFAULT_SMOKE_SCHEME) as Array<keyof SmokeScheme>;
export function sameScheme(a: SmokeScheme, b: SmokeScheme): boolean {
  return SCHEME_FIELDS.every((field) => a[field] === b[field]);
}
export function validScheme(value: unknown): value is SmokeScheme {
  if (!value || typeof value !== 'object') return false;
  const s = value as SmokeScheme;
  return [s.idleSmokeColor, s.exhaleColor, s.ringColor].every((id) => SMOKE_COLORS.some((o) => o.id === id))
    && EXHALE_STYLES.some((o) => o.id === s.exhaleStyle)
    && SMOKE_AMOUNTS.some((o) => o.id === s.smokeAmount) && RING_SHAPES.some((o) => o.id === s.ringShape);
}
export function colorHex(id: string): string { return SMOKE_COLORS.find((o) => o.id === id)?.hex ?? '#d9dad6'; }
export function amountMultiplier(id: string): number { return id === 'light' ? 0.68 : id === 'dense' ? 1.34 : 1; }
export function placementFor(field: keyof SmokeScheme, scheme: SmokeScheme): string {
  return field === 'idleSmokeColor' ? 'lab:idle' : field === 'exhaleColor' ? 'lab:exhale-color'
    : field === 'ringColor' ? 'lab:ring-color' : field === 'ringShape' ? `ring:${scheme.ringShape}` : 'lab:style';
}
export interface LabContext { boxId: string | null; typeId: string; packName: string; sequence: number | null; }
export interface LabInteraction { handSmoke: boolean; formationEnabled: boolean; formation: string; }
export interface LabSchemeEvent {
  scheme: SmokeScheme; context: LabContext; preview: boolean;
}
/** UI emits data only. Future effects can consume these hooks without owning the option nodes. */
export interface SmokeLabUIHooks {
  onSelectionChanged?(event: LabSchemeEvent & { field: keyof SmokeScheme }): void;
  onSaveScheme?(event: LabSchemeEvent & { scope: LabScope }): void;
  onRestoreScheme?(event: LabSchemeEvent & { scope: LabScope }): void;
  onInteractionChanged?(event: { interaction: LabInteraction; context: LabContext; preview: boolean }): void;
}
export interface LabRuntime {
  scheme: SmokeScheme; days: number; handSmoke: boolean; unlimitedRings: boolean; directionalRing: boolean;
  formation: string | null;
}
