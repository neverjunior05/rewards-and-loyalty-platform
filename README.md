# PerkPilot 🪙💜 — *Every everyday spend earns its wings.*

A joyful, motion-rich **demo** rewards & loyalty platform: earn points at partner merchants, on receipts, daily check-ins, missions, surveys and referrals; climb **Spark → Glow → Blaze → Nova**; redeem vouchers, experiences and charity gifts; pool points with family; and run the whole thing from merchant + admin portals.

> ![PerkPilot hero screenshot](docs/screenshot-hero.png) *(placeholder — drop your screenshot/GIF here)*
> ![Dashboard GIF](docs/screenshot-dashboard.gif) *(placeholder)*

## ⚠️ Demo & fictional-merchants disclaimer (read first)

**This is a demo platform. All merchants and rewards are FICTIONAL, and all points, vouchers and codes are test data with no real monetary value.** No real company names, logos or trademarks are used for demo merchants (monogram logos are generated inline SVG). Demo statistics, countdown deals and engagement charts are labelled demo in the UI. Never enter real passwords or personal data.

## Features

**Members:** signup + animated welcome tour + 250-pt welcome bonus · public profile card (tier, badges, member-since) · dashboard (balance, expiring-soon, lifetime, tier ring) · partner-checkout earning via simulated POS · receipt upload (file or URL) with mock review queue · daily check-in with streaks, freezes & milestone bonuses · missions (daily/weekly/monthly, real countdowns) · surveys/quizzes · referrals (bonus for both sides *after* the friend's first qualifying earn) · birthday/anniversary bonus · 4 tiers with multipliers · 40-reward catalog (search, category/merchant/tier/points/affordable/ending-soon filters, sorting, Points+cash) · redemption with exact resulting balance, QR voucher, wallet (Active/Used/Expired) · merchant scan demo · immutable ledger with CSV export · honest Lucky Spin (odds printed, 1 free/day, no purchasable spins, break mode) · 20 badges · opt-in weekly leaderboard · family pooling groups · notifications + preferences (pause, take-a-break, mock email to console) · points transfers (capped) · Reward Finder quiz · charity impact · blog.

**Merchants:** earn rules, campaigns with budgets/dates/multipliers, publish rewards, redemption tables, voucher scanning, receipt approvals, Recharts analytics.
**Admins:** users, audited manual adjustments (reason required), receipt queue, fraud flags, audit log, points-liability dashboard, engagement analytics, on-demand worker run.

## Tech stack

Next.js (App Router) + TypeScript · Tailwind CSS v4 · Framer Motion · canvas-confetti · Recharts · qrcode (client-side QR) · Lucide icons · **PostgreSQL via Drizzle ORM** (this container's DB layer; schema maps 1:1 to the Prisma models listed below) · Next.js Route Handlers under `/api` · reference cron worker in `/worker`. Fonts via Google Fonts; avatars via DiceBear; photos via Pexels/Unsplash (URLs centralised in `src/config/media.ts`).

## Design system — “Violet Gold Arcade”

| Role | Hex | | Role | Hex |
|---|---|---|---|---|
| Stage bg | `#0B0614` | | Violet primary | `#7C3AED` |
| Dark surface / elevated | `#140C24` / `#1E1435` | | Violet bright / soft / deep | `#A275FF` / `#C9B3FF` / `#4C1D95` |
| Dark hairline / muted | `#2E2248` / `#A99CC4` | | Gold primary / bright | `#FFC83D` / `#FFD966` |
| Light bg / surface | `#FFFFFF` / `#F7F3FC` | | Amber / gold-deep (small text on white) | `#F5A524` / `#A86F00` |
| Light hairline / muted | `#E0D6EE` / `#5F5478` | | Gold tint | `#FFF4D6` |

Tiers: Spark `#2EE6A6`, Glow `#6EC1FF`, Blaze `#FF7A45`, Nova gold→violet foil. Status: success `#16B364`, warning `#F5A524`, error `#F04438`. **Blending rule:** violet-black + white ≈ 80% of surface; gold means *value* (balances, progress, celebration) and is never small text on white except deep-gold. Fonts: **Lexend** (600/800) headings, **Public Sans** body, **Martian Mono** for points/codes/countdowns (tabular numbers). Radius 18px cards / 10px inputs / 999px pills; perforated-ticket reward cards; foil tier cards; gold focus rings on dark, deep-violet on light. `prefers-reduced-motion` disables parallax/cursor/confetti flourishes.

## Folder structure

```
perkpilot/
├── README.md · docker-compose.yml · .env.example
├── worker/index.ts            # cron jobs (expiry, tiers, missions, reminders…) — also runnable from Admin
├── public/ (manifest.json PWA, favicon.svg, robots.txt)
└── src/
    ├── app/ (page + route shells: dashboard, earn, rewards, missions, spin, tiers, merchants,
    │         ledger, vouchers, groups, finder, blog, login, merchant, admin · api/auth|state|action|health · sitemap.ts)
    ├── components/ (PerkPilotApp.tsx — all views · perk-ui.tsx — Coin, TierRing, Progress, Countdown…)
    ├── config/ (site.ts — tiers/spin/currency · media.ts — every media URL + credits)
    ├── db/ (index.ts Drizzle pool · schema.ts all tables)
    └── lib/ (data.ts seed catalog: 25 merchants/40 rewards/12 missions/20 badges · merchants.ts MerchantAdapter · server.ts ledger engine + seeding)
```

## Run it

**Prerequisites:** Node 20+, PostgreSQL (or the provided docker-compose).

```bash
npm install
cp .env.example .env            # set DATABASE_URL
npx drizzle-kit push            # create tables
npm run build && npm run start  # http://localhost:3000  (demo data auto-seeds on first API call)
# dev: npm run dev
# worker (reference): npx tsx worker/index.ts   — or Admin → “Run worker jobs now”
```

| Env var | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `NEXT_PUBLIC_BASE_URL` | Canonical base for sitemap/referral links |
| `AUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET` | Only for a production Auth.js swap-in (see below) |

### Demo accounts (password `demo1234`)

| Account | Role |
|---|---|
| `maya@demo.perkpilot` | Nova member (birthday bonus ready today, expiring batch, vouchers in every status) |
| `sam@demo.perkpilot` | Member with a **14-day streak** |
| `leo@demo.perkpilot` | Glow member |
| `ana@demo.perkpilot` | New Spark member |
| `merchant@demo.perkpilot` | Merchant portal |
| `admin@demo.perkpilot` | Admin console |

**Sample voucher codes:** `PP-DEMO1001` (Active, Maya — cinema), `PP-DEMO1002` (Used), `PP-DEMO1003` (Expired), `PP-DEMO1004` (Active, Sam). Try them in Scan. **Demo group invite:** `NOVA-FAM1`.

## How the money (points) works

- **Ledger:** balances are *derived* by summing immutable `ledger` entries (earn/redeem/expiry/adjustment/refund/pool/transfer), each storing `balanceAfter` for a running balance. Nothing edits a balance directly. Writes carry **idempotency keys** (check-ins, spins, surveys, redemptions, referrals) so double-clicks/retries can't double-award. Server re-checks balance, tier and stock inside the redeem action.
- **Earn rules:** `points = basket × merchant pts-per-$ × tier multiplier × live-campaign multiplier`, then capped (purchases: 2,000 pts/day; receipts 5/day; transfers 500/day; spin & check-in 1/day). Merchant overrides live in `earn_rules`. Value config (`src/config/site.ts`): **100 pts = $1** demo.
- **Tiers:** qualifying points = `earn` entries in a **rolling 12-month window**. Spark 0 (1×) · Glow 2,000 (1.25×) · Blaze 6,000 (1.5×) · Nova 12,000 (2×). Intended production behaviour (documented & messaged in UI): 60-day grace after dropping below a threshold, warnings at 30/7 days — implement via the worker's `recalcTiers` job persisting a `tierGraceUntil`.
- **Expiry (FIFO):** each positive entry is a batch with `expiresAt = earn + 12 months`. The worker expires oldest batches first, capped at the current balance, writing negative `expiry` entries. “Expiring ≤30d” on the dashboard sums upcoming batches.
- **Streaks & timezones:** days are stored as UTC date strings; check-in compares today/yesterday server-side, auto-spends a streak freeze on a one-day gap, else resets to 1. *Production:* store the member's IANA timezone and compute local days (incl. DST) — never trust client dates.
- **Spin odds:** defined once in `SPIN_SEGMENTS` (`src/config/site.ts`) with weights summing to 100 (10pts 30% … 500 jackpot 1%); the server draws with `crypto.randomInt`, the wheel merely reveals the pre-decided segment. Odds, expected value and rules render beside the wheel; one free spin/day; `takeBreak` disables it.
- **Vouchers:** codes from `crypto.randomBytes`, verified with constant-time comparison; states Active → Used/Expired; already-used/expired scans fail with friendly errors.
- **Fraud:** duplicate receipt images (hash), per-method velocity caps, referral bonuses only after a qualifying earn (blunts rings), URL allow-listing (`http(s)`/image data-URL), audited admin adjustments, `fraud_flags` queue. Auth is demo-grade (hashed passwords, client-held id) — swap in Auth.js JWT sessions + role middleware + rate limiting for production.

## Database schema (Drizzle `src/db/schema.ts`)

`users, ledger, vouchers, checkins, spin_results, mission_progress, user_badges, survey_responses, receipts, groups_tbl, group_members, contributions, notifications, campaigns, earn_rules, custom_rewards, referrals, fraud_flags, audit_logs` — mapping to the brief's Prisma models (User/Member, PointsLedgerEntry, Redemption≈Voucher, MissionProgress, Group/GroupMember, Event≈AuditLog…). To use Prisma+SQLite instead, port these tables to `schema.prisma` 1:1; hosted Postgres free tiers: Neon/Supabase.

## API overview

- `POST /api/auth` — `{mode:"login"|"register", …}` (register grants +250 welcome, optional `referralCode`).
- `GET /api/state?userId=` — full member state (ledger, vouchers, missions, groups, leaderboard, liability…).
- `POST /api/action` — `{userId, action, payload}` dispatcher: `checkin, spin, purchase, refund-demo, receipt_submit, receipt_review, survey, redeem, voucher_scan, mission_claim, birthday_bonus, group_create/join/contribute/leave/remove, transfer, prefs, notif_read, campaign_create, earn_rule, reward_publish, admin_adjust, fraud_resolve, worker_run, onboard, referral_info`.
- `GET /api/health` — platform healthcheck.

## Writing a real MerchantAdapter

Everything merchant-shaped flows through `src/lib/merchants.ts`:

```ts
interface MerchantAdapter {
  listMerchants(): Promise<Merchant[]>;
  verifyPurchase(p: {merchantSlug: string; amount: number; reference?: string}):
    Promise<{verified: boolean; earnRate: number; merchantName: string}>;
  issueVoucher(p: {rewardId: string; userId: number}): Promise<{code: string}>;
  redeemVoucher(p: {code: string}): Promise<{ok: boolean; message: string}>;
}
```

`DemoMerchantAdapter` simulates POS latency. A real one would: verify a POS webhook signature / card-linked-offer transaction in `verifyPurchase`; call an OCR receipt-verification provider for receipts (returning verified totals instead of trusting the member-typed amount); mint codes in the merchant's POS in `issueVoucher`; and confirm at till in `redeemVoucher` (DB status stays the source of truth). Swap the exported `merchantAdapter` singleton — no UI changes.

## Adding content

- **Merchant:** add to `MERCHANTS` in `src/lib/data.ts` (fictional name, category, earn rate, colour) — it appears in checkout, filters and merchant pages automatically.
- **Reward:** add to `REWARDS`, or publish live from the Merchant portal (stored in `custom_rewards` and merged into the catalog).
- **Mission:** add to `MISSIONS` with a new `action` key, then call `bumpMission(userId, action)` wherever that behaviour happens in `/api/action`.
- **Badge:** add to `BADGES` + a grant rule in `maybeBadges()` (`src/lib/server.ts`).
- **Tier:** edit `TIERS` in `src/config/site.ts` (threshold, multiplier, perks, colour) — rings, cards and eligibility follow.

## Deployment

**App → Vercel** (set `DATABASE_URL`, run `npx drizzle-kit push` once). **DB → Neon or Supabase** free-tier Postgres. **Worker → Render/Railway** background service running `worker/index.ts` with `node-cron` schedules (or Vercel Cron hitting a secured route that invokes the same job logic). Add Auth.js (credentials + Google, JWT, role middleware), rate limiting (e.g. Upstash), and transactional email before any public launch.

## Legal & compliance notes (not legal advice)

Loyalty schemes touch consumer-protection law (clear expiry & terms, no misleading scarcity), privacy/data-protection law (lawful basis, retention, data-subject rights; extra care with **children's data** and age-appropriate design), promotional/gambling law for chance-based features like spins (this demo uses no stake and no purchasable spins, but rules **vary by country**), possible **tax treatment** of points/rewards, and anti-fraud/AML-adjacent obligations if value becomes transferable. Disclose point value and expiry before every transaction (this UI does). **Seek qualified legal advice in each launch market before going live.**

## Media & credits

Photos: Pexels (Tim Douglas, Jonathan Valdes, Tara Winstead, George Frewat) & Unsplash contributors — free licences; avatars: DiceBear; fonts: Google Fonts (OFL); icons: Lucide (ISC); reward art, coins & tier cards: original inline SVG/CSS (procedural “3D” with image fallback — no external GLB, so nothing to attribute); QR: `qrcode` lib, client-side. Full list in `src/config/media.ts` and the site footer.

## Future improvements

Real POS/card-linked adapters · OCR receipts · Auth.js + passkeys · member-timezone streaks · persisted tier-grace state · transactional outbox for ledger events · multi-currency display · seasonal double-points events engine · R3F coin scene behind a feature flag · Vitest suites for ledger math, FIFO expiry, streak/DST and spin distribution (the pure functions in `src/config/site.ts` & `src/lib/server.ts` are written to be lifted into tests).

## License

MIT — demo code; fictional brands are original to this project.
