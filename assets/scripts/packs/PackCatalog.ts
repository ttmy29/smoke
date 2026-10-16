/** V1.0.8 catalogue data. Unlock copy is reference text, not a local unlock decision. */
export const PACK_CATALOG = [
  { id: 'life', name: '王溪', code: 'WANG·XI', flavor: '清甜回甘 · 雪松香', accent: '#d8c08a', secondary: '#173f37', rule: '首盒免费' },
  { id: 'flowing-gold', name: '华孑', code: 'HUA·JIE', flavor: '醇厚 · 焦甜香', accent: '#c6a45c', secondary: '#343329', rule: '用 2 张烟票兑换' },
  { id: 'night-voyage', name: '黄鹊楼', code: 'HUANG·QUE·LOU', flavor: '清雅 · 木质香', accent: '#ddbd7f', secondary: '#173764', rule: '连续打卡 2 天' },
  { id: 'fog-harbor', name: '云姻', code: 'YUN·YIN', flavor: '轻柔 · 云木香', accent: '#d8dde0', secondary: '#46545e', rule: '分享累计达到 10 次' },
  { id: 'zero-hour', name: '红搭山', code: 'HONG·DA·SHAN', flavor: '浓郁 · 烘烤香', accent: '#c7ad86', secondary: '#182f3d', rule: '抽够 50 根赛博烟' },
  { id: 'neon-bridge', name: '煊赤门', code: 'XUAN·CHI·MEN', flavor: '醇和 · 蜜甜香', accent: '#cab8b2', secondary: '#4a2949', rule: '成就数达到 30 个' },
  { id: 'slow-tide', name: '英蓉王', code: 'YING·RONG·WANG', flavor: '荷香 · 淡甜味', accent: '#8bb49a', secondary: '#234b38', rule: '连续打卡 7 天' },
  { id: 'red-equator', name: '欢囍', code: 'HUAN·XI', flavor: '喜甜 · 果木香', accent: '#e9e3d7', secondary: '#852d32', rule: '连续打卡 14 天' },
  { id: 'shadowless', name: '无影烟', code: 'WU·YING·YAN', flavor: '有烟无影， 有形无踪', accent: '#c7ccc9', secondary: '#303635', rule: '隐藏款' },
  { id: 'zuguo', name: '祖国', code: 'ZU·GUO', flavor: '山河锦绣 · 掌心珍藏', accent: '#d3b073', secondary: '#802b35', rule: '首盒免费' },
] as const;

export type PackCatalogItem = typeof PACK_CATALOG[number];
