export type RankingScope = 'seven-days' | 'all';

/** A successful local gift receipt. A future social store supplies these events. */
export interface ReceivedGiftEvent {
  eventId: string;
  senderLocalId: string;
  receivedAt: number;
  nicknameSnapshot: string;
  avatarUrl?: string;
  receiveAction?: 'direct' | 'stored';
  smokedAt?: number;
  discardedAt?: number;
  cancelledAt?: number;
}

export interface ReceiveRankingSource {
  readReceivedEvents(): ReadonlyArray<ReceivedGiftEvent> | null;
}

export interface ReceiveRankingItem {
  senderLocalId: string;
  rank: number;
  nickname: string;
  displayNickname: string;
  avatarUrl: string;
  count: number;
  latestReceivedAt: number;
  events: ReceivedGiftEvent[];
}

export const emptyReceiveRankingSource: ReceiveRankingSource = {
  readReceivedEvents: () => [],
};

export function buildReceiveRanking(events: ReadonlyArray<ReceivedGiftEvent>,
  scope: RankingScope, now = Date.now()): ReceiveRankingItem[] {
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 6);
  const groups = new Map<string, ReceivedGiftEvent[]>();
  for (const event of events) {
    if (!event.eventId || !event.senderLocalId || !Number.isFinite(event.receivedAt)
      || event.receivedAt > now || event.cancelledAt
      || (scope === 'seven-days' && event.receivedAt < cutoff.getTime())) continue;
    const group = groups.get(event.senderLocalId) ?? [];
    group.push(event);
    groups.set(event.senderLocalId, group);
  }
  const rows = [...groups.entries()].map(([senderLocalId, group]) => {
    const sorted = group.slice().sort((a, b) => b.receivedAt - a.receivedAt);
    const latest = sorted[0];
    const nickname = latest.nicknameSnapshot.trim().slice(0, 20) || '一位烟友';
    return { senderLocalId, rank: 0, nickname, displayNickname: nickname,
      avatarUrl: latest.avatarUrl ?? '', count: sorted.length,
      latestReceivedAt: latest.receivedAt, events: sorted };
  }).sort((a, b) => b.count - a.count || b.latestReceivedAt - a.latestReceivedAt
    || a.nickname.localeCompare(b.nickname, 'zh-CN')
    || a.senderLocalId.localeCompare(b.senderLocalId));
  const repeated = new Map<string, number>();
  return rows.map((row, index) => {
    const ordinal = (repeated.get(row.nickname) ?? 0) + 1;
    repeated.set(row.nickname, ordinal);
    return { ...row, rank: index + 1,
      displayNickname: ordinal === 1 ? row.nickname : `${row.nickname}（${ordinal}）` };
  });
}

export function receivedGiftStatus(event: ReceivedGiftEvent): string {
  return event.discardedAt ? '后来丢掉了'
    : event.receiveAction === 'direct' ? '直接抽了'
      : event.smokedAt ? '后来抽掉了' : '已存入散烟盒';
}
