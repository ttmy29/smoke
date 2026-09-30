import { QuitStore } from '../persistence/QuitStore';

export interface TrendDay {
  day: string;
  count: number | null;
  costCents: number | null;
  incomplete: boolean;
}

export interface TrendData {
  days: TrendDay[];
  totalCount: number;
  totalCostCents: number | null;
  knownDays: number;
  unknownCosts: boolean;
}

function localDay(at: number): string {
  const date = new Date(at);
  const two = (value: number): string => value < 10 ? `0${value}` : String(value);
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

export function buildQuitTrend(history: NonNullable<ReturnType<QuitStore['readHistory']>>,
  range: 7 | 30, now = Date.now()): TrendData {
  const realByDay = new Map<string, { count: number; cost: number; priced: boolean }>();
  for (const record of history.real) {
    const day = localDay(record.at);
    const item = realByDay.get(day) ?? { count: 0, cost: 0, priced: true };
    item.count += 1;
    const price = record.priceCents ?? history.packPriceCents;
    const sticks = record.priceCents === null || record.priceCents === undefined
      ? history.sticksPerPack : record.sticksPerPack ?? history.sticksPerPack;
    if (price === null) item.priced = false;
    else item.cost += price / sticks;
    realByDay.set(day, item);
  }
  const quitDays = new Set(history.quit.map((item) => item.day));
  const days: TrendDay[] = [];
  for (let index = 0; index < range; index += 1) {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - range + 1 + index);
    const day = localDay(date.getTime());
    const real = realByDay.get(day);
    const known = !!real || quitDays.has(day);
    days.push({ day, count: known ? real?.count ?? 0 : null,
      costCents: known ? real?.priced === false ? null
        : Math.round(real?.cost ?? 0) : null,
    incomplete: index === range - 1 });
  }
  const known = days.filter((item) => item.count !== null);
  const unknownCosts = known.some((item) => item.costCents === null);
  return { days, totalCount: known.reduce((sum, item) => sum + (item.count ?? 0), 0),
    totalCostCents: unknownCosts ? null
      : Math.round(days.reduce((sum, item) => sum + (realByDay.get(item.day)?.cost ?? 0), 0)),
    knownDays: known.length, unknownCosts };
}
