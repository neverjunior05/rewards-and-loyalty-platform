/**
 * PerkPilot background worker (reference implementation).
 * In this container the same jobs can be run on demand from Admin → "Run worker jobs now"
 * (POST /api/action { action: "worker_run" }). To run standalone with cron:
 *
 *   npm i node-cron tsx   (dev tooling)
 *   npx tsx worker/index.ts
 *
 * Jobs (all idempotent, keyed by ledger idempotency keys):
 *  - expirePoints: FIFO — oldest earn batches past expiresAt are clawed back capped at balance.
 *  - expireVouchers: Active vouchers past expiresAt -> Expired.
 *  - recalcTiers: tiers are derived on read from rolling-12mo qualifying points; this job
 *    emits tier-drop warnings at 30/7 days before the window slides (notifications).
 *  - rotateMissions: daily/weekly/monthly boards reset by calendar boundaries (see app countdowns).
 *  - reminders: expiring-points notifications at 30/7 days (respecting pauseNotifications).
 *  - streaks: streak is recomputed server-side at check-in from lastCheckin + freezes (UTC day strings;
 *    production should store the member timezone and compute local days incl. DST).
 */
export const JOBS = ["expirePoints", "expireVouchers", "recalcTiers", "rotateMissions", "reminders", "streakResets"] as const;
if (process.argv[1]?.endsWith("index.ts")) {
  console.log("[perkpilot-worker] jobs registered:", JOBS.join(", "));
  console.log("[perkpilot-worker] demo: trigger via Admin → Run worker jobs now, or wire node-cron schedules here.");
}
