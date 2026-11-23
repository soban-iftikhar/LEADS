// Market intelligence rules (ADMIN_BUILD 6.2). The crawler pipeline writes snapshots in these size bands.

/** Buyers for each home on sale: Hot at 1.8 or more, Warm at 1.2 or more, else Cool. */
export const DEMAND_LEVELS = { hot: 1.8, warm: 1.2 } as const;

/** The demand meter is full at this many buyers per home. */
export const DEMAND_METER_MAX = 2.6;

/** A buyer counts as "looking" if they replied, filled a form or enquired this recently. */
export const BUYER_ACTIVE_DAYS = 30;

/** Lines on the price-trend chart at most. */
export const MAX_TREND_AREAS = 8;

export const MARLA_SQFT = 225;

export const MARKET_TYPES = [
  { value: "house", label: "Houses", category: "HOUSE", portal: "house" },
  { value: "plot", label: "Plots", category: "PLOT", portal: "residential_plot" },
] as const;

export const SIZE_BANDS = [
  { value: "5", label: "5 Marla", min: 4, max: 6 },
  { value: "10", label: "10 Marla", min: 8, max: 12 },
  { value: "20", label: "1 Kanal", min: 18, max: 22 },
] as const;

export const TREND_PERIODS = [
  { value: "day", label: "Day", points: 14, unit: "day" },
  { value: "week", label: "Week", points: 12, unit: "week" },
  { value: "month", label: "Month", points: 12, unit: "month" },
  { value: "year", label: "Year", points: 6, unit: "year" },
] as const;

export type MarketType = (typeof MARKET_TYPES)[number]["value"];
export type SizeBand = (typeof SIZE_BANDS)[number]["value"];
export type TrendPeriod = (typeof TREND_PERIODS)[number]["value"];
export type DemandLevel = "Hot" | "Warm" | "Cool";

export function demandLevel(buyersPerHome: number): DemandLevel {
  return buyersPerHome >= DEMAND_LEVELS.hot ? "Hot" : buyersPerHome >= DEMAND_LEVELS.warm ? "Warm" : "Cool";
}

/** Buyers looking / homes on sale; 0 when nothing is on sale. */
export const buyersPerHome = (buyers: number, homes: number) => (homes > 0 ? buyers / homes : 0);

/** Filled blocks of the 10-block meter. */
export const meterBlocks = (bph: number) => Math.round(Math.min(1, bph / DEMAND_METER_MAX) * 10);

/** Relative change from `from` to `to`; null without a starting value. */
export const changeRatio = (from: number | null | undefined, to: number | null | undefined) => (from && to ? to / from - 1 : null);

/** One line of advice for the area drawer. */
export function areaAdvice(level: DemandLevel, vsMedian: number | null): string {
  const cheap = vsMedian !== null && vsMedian < -0.05;
  const dear = vsMedian !== null && vsMedian > 0.05;
  if (level === "Hot") return cheap ? "Many buyers and priced under the city: invite sellers here first." : "Many buyers for each home: sellers here get leads fast.";
  if (level === "Warm") return dear ? "Steady demand, but above the city price: pick well-priced homes." : "Steady demand: a good second area for campaigns.";
  return "Few buyers for each home: keep campaigns small here for now.";
}
