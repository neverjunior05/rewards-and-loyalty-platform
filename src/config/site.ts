export const SITE = {
  name: "PerkPilot",
  tagline: "Every everyday spend earns its wings.",
  currency: "USD",
  currencySymbol: "$",
  pointsPerDollarValue: 100, // 100 pts = $1 demo value
  pointValueUSD: 0.01,
  demoDisclaimer:
    "Demo platform — all merchants & rewards are fictional. Points, vouchers & codes are test data with no real monetary value.",
};
export const TIERS = [
  { name: "Spark", threshold: 0, multiplier: 1, color: "#2EE6A6", perks: ["1× base earn", "Daily check-in & Lucky Spin", "Access to Spark rewards", "Birthday bonus 100 pts"] },
  { name: "Glow", threshold: 2000, multiplier: 1.25, color: "#6EC1FF", perks: ["1.25× earn multiplier", "Free-shipping vouchers", "Early access to new rewards", "Bonus double-points days", "Birthday bonus 250 pts"] },
  { name: "Blaze", threshold: 6000, multiplier: 1.5, color: "#FF7A45", perks: ["1.5× earn multiplier", "Blaze-only experiences", "Priority receipt review", "Extra streak freeze each month", "Birthday bonus 500 pts"] },
  { name: "Nova", threshold: 12000, multiplier: 2, color: "#FFC83D", perks: ["2× earn multiplier", "Nova foil card & concierge picks", "Exclusive Nova drops", "Points + cash best rates", "Birthday bonus 1,000 pts", "Grace-period tier protection"] },
] as const;
export type TierName = (typeof TIERS)[number]["name"];
export function tierForQualifying(q: number) {
  let cur: (typeof TIERS)[number] = TIERS[0];
  for (const t of TIERS) if (q >= t.threshold) cur = t;
  const idx = TIERS.indexOf(cur);
  const next = TIERS[idx + 1] || null;
  return { current: cur, next, progress: next ? Math.min(100, Math.round(((q - cur.threshold) / (next.threshold - cur.threshold)) * 100)) : 100, toNext: next ? next.threshold - q : 0 };
}
export const SPIN_SEGMENTS = [
  { label: "10 pts", points: 10, weight: 30, color: "#7C3AED" },
  { label: "25 pts", points: 25, weight: 25, color: "#FFC83D" },
  { label: "Try tomorrow", points: 0, weight: 15, color: "#2E2248" },
  { label: "50 pts", points: 50, weight: 14, color: "#A275FF" },
  { label: "100 pts", points: 100, weight: 9, color: "#F5A524" },
  { label: "Streak Freeze", points: 15, weight: 4, color: "#2EE6A6" },
  { label: "250 pts", points: 250, weight: 2, color: "#FF7A45" },
  { label: "500 Jackpot", points: 500, weight: 1, color: "#FFD966" },
];
