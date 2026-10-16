import type { CheckInStore, TicketLedgerEntry } from '../persistence/CheckInStore';
import type { ProgressStore } from '../persistence/ProgressStore';
import type { QuitStore } from '../persistence/QuitStore';
import { recordDay, SmokingRecord, SmokingRecordSave, SmokingRecordStore } from '../persistence/SmokingRecordStore';

export type RecordsTab = 'checkins' | 'smoking' | 'quit' | 'tasks' | 'tickets';
export const RECORD_TABS: ReadonlyArray<{ id: RecordsTab; label: string }> = [
  { id: 'checkins', label: '打卡' }, { id: 'smoking', label: '抽烟' },
  { id: 'quit', label: '戒烟' }, { id: 'tasks', label: '任务' }, { id: 'tickets', label: '烟票' },
];

export interface EffectTaskGoal { metric: string; target: number; label: string; }
export interface EffectTaskDefinition { id: string; name: string; reward: string; goals: EffectTaskGoal[]; }
export const RECORD_EFFECT_TASKS: readonly EffectTaskDefinition[] = [
  { id: 'T01', name: '弹出一点星光', reward: '星屑烟灰 ＋ 水滴烟圈', goals: [{ metric: 'validAshFlicks', target: 30, label: '有效弹烟灰' }] },
  { id: 'T02', name: '云上练习', reward: '像素烟灰 ＋ 云朵烟圈', goals: [{ metric: 'successfulRings', target: 30, label: '成功吐圈' }] },
  { id: 'T03', name: '百圈成形', reward: '爱心烟灰 ＋ 笑脸烟圈', goals: [{ metric: 'successfulRings', target: 100, label: '成功吐圈' }] },
  { id: 'T04', name: '花落成蝶', reward: '落樱烟灰 ＋ 蝴蝶烟圈', goals: [{ metric: 'validAshFlicks', target: 100, label: '有效弹烟灰' }] },
  { id: 'T05', name: '七日微光', reward: '萤光烟灰 ＋ 月牙烟圈', goals: [{ metric: 'days', target: 5, label: '累计打卡' }] },
  { id: 'T06', name: '拨雾熟手', reward: '蒲公英烟灰 ＋ 四叶草烟圈', goals: [
    { metric: 'validHandSmokeGestures', target: 50, label: '有效拨烟' }, { metric: 'handDays', target: 3, label: '使用日期' }] },
  { id: 'T07', name: '左右自如', reward: '流星烟灰 ＋ 无限符号烟圈', goals: [
    { metric: 'directionalRings', target: 50, label: '指向总数' }, { metric: 'directionalLeft', target: 20, label: '左向' },
    { metric: 'directionalRight', target: 20, label: '右向' }] },
  { id: 'T08', name: '三百圈纪念', reward: '晶砂烟灰 ＋ 音符烟圈', goals: [{ metric: 'successfulRings', target: 300, label: '成功吐圈' }] },
  { id: 'T09', name: '双雪相逢', reward: '雪花烟灰 ＋ 雪花烟圈', goals: [{ metric: 'days', target: 7, label: '累计打卡' }] },
];

export interface RecordsQuitDay {
  day: string;
  at: number;
  count: number;
  costCents: number | null;
  feeling: string;
  updated: boolean;
}

export interface RecordsSnapshot {
  todayCount: number | null;
  last7Count: number | null;
  totalCount: number;
  completedPacks: number | null;
  totalPuffs: number | null;
  durationSeconds: number | null;
  favoritePack: string;
  cumulativeDays: number;
  checkinStreak: number;
  checkedToday: boolean;
  ticketBalance: number;
  ledger: TicketLedgerEntry[];
  ledgerIncomplete: boolean;
  ledgerArchived: boolean;
  sessions: SmokingRecord[];
  smokingIncomplete: boolean;
  packPriceCents: number | null;
  savingsCount: number | null;
  estimatedSavedCents: number | null;
  quitTotal: number;
  quitStreak: number;
  quitLongest: number;
  quitDays: RecordsQuitDay[];
  taskMetrics: Readonly<Record<string, number | undefined>>;
  completedTasks: readonly string[];
}

/** Extra task metrics/rewards can be injected when the effect service is implemented. */
export interface RecordsSource {
  read(now?: number): RecordsSnapshot | null;
  setPackPrice(cents: number | null): boolean;
  completeTask?(taskId: string): boolean;
}

export function createLocalRecordsSource(stores: { progress: ProgressStore; checkin: CheckInStore;
  smoking: SmokingRecordStore; quit: QuitStore; completedPacks: () => number | null }): RecordsSource {
  return {
    setPackPrice: (cents) => stores.smoking.setPackPrice(cents),
    read(now = Date.now()) {
      const total = stores.progress.readSmokedCount();
      const home = stores.progress.readHomeSmokingStatus(now);
      const checkin = stores.checkin.readSnapshot(now);
      const tickets = stores.checkin.readHistory();
      const smoking = stores.smoking.read();
      const quit = stores.quit.readSnapshot(now);
      const history = stores.quit.readHistory();
      if (total === null || !home || !checkin || !tickets || !smoking || !quit || !history) return null;
      const complete = total === smoking.totalCount;
      const first = new Date(now);
      first.setHours(0, 0, 0, 0); first.setDate(first.getDate() - 6);
      const firstDay = recordDay(first.getTime());
      const today = recordDay(now);
      const last7 = Object.keys(smoking.dayCounts).reduce((sum, day) =>
        sum + (day >= firstDay && day <= today ? smoking.dayCounts[day] : 0), 0);
      const days = new Map<string, RecordsQuitDay>();
      for (const item of history.quit) days.set(item.day, { day: item.day, at: item.confirmedAt,
        count: 0, costCents: 0, feeling: item.feeling, updated: (item.revision ?? 1) > 1 });
      for (const item of history.real) {
        const day = recordDay(item.at);
        const row = days.get(day) ?? { day, at: item.at, count: 0, costCents: 0, feeling: '', updated: false };
        const price = item.priceCents ?? history.packPriceCents;
        const sticks = item.priceCents === null || item.priceCents === undefined
          ? history.sticksPerPack : item.sticksPerPack ?? history.sticksPerPack;
        row.at = Math.max(row.at, item.at); row.count++;
        row.costCents = row.costCents === null || price === null ? null : row.costCents + price / sticks;
        days.set(day, row);
      }
      const savingsCount = recordedSavingsCount(smoking, now);
      return { todayCount: home.todaySmoked, last7Count: complete ? last7 : null, totalCount: total,
        completedPacks: stores.completedPacks(), totalPuffs: complete ? smoking.totalPuffs : null,
        durationSeconds: complete ? smoking.totalDurationSeconds : null,
        favoritePack: total === 0 ? '还没有' : complete ? '王溪' : '—',
        cumulativeDays: checkin.cumulativeDays, checkinStreak: checkin.streak, checkedToday: checkin.checkedToday,
        ticketBalance: checkin.ticketBalance, ledger: tickets.ledger, ledgerIncomplete: tickets.incomplete,
        ledgerArchived: tickets.archived, sessions: [...smoking.sessions].sort((a, b) => b.endedAt - a.endedAt).slice(0, 30),
        smokingIncomplete: !complete, packPriceCents: smoking.packPriceCents,
        savingsCount, estimatedSavedCents: savingsCount === null || smoking.packPriceCents === null
          ? null : Math.round(savingsCount * smoking.packPriceCents / 20),
        quitTotal: quit.totalDays, quitStreak: quit.currentStreak, quitLongest: quit.longestStreak,
        quitDays: [...days.values()].sort((a, b) => b.day.localeCompare(a.day)),
        taskMetrics: { days: checkin.cumulativeDays }, completedTasks: [] };
    },
  };
}

/** Count only evidenced endings at/before now; seed lifetime totals never enter the estimate. */
export function recordedSavingsCount(save: Pick<SmokingRecordSave, 'sessions' | 'dayCounts'>, now: number): number | null {
  const today = recordDay(now);
  const todayRecords = save.sessions.filter((record) => recordDay(record.endedAt) === today);
  // Older dates remain countable after the 500-row limit. If today's exact times were evicted,
  // their relation to now is unknown, so do not guess the estimate.
  if ((save.dayCounts[today] ?? 0) !== todayRecords.length) return null;
  const past = Object.keys(save.dayCounts).reduce((sum, day) => sum + (day < today ? save.dayCounts[day] : 0), 0);
  return past + todayRecords.filter((record) => record.endedAt > 0 && record.endedAt <= now).length;
}

export function recordsDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 60) return `${rounded} 秒`;
  const minutes = Math.floor(rounded / 60);
  return rounded % 60 ? `${minutes} 分 ${rounded % 60} 秒` : `${minutes} 分钟`;
}

export function parseRecordsPrice(text: string): { cents: number | null; error: string } {
  const value = text.trim();
  if (!value) return { cents: null, error: '' };
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return { cents: null, error: '请输入金额，最多保留两位小数。' };
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0.01 || amount > 10000) {
    return { cents: null, error: '每盒价格请填 0.01—10000 元。' };
  }
  return { cents: Math.round(amount * 100), error: '' };
}
