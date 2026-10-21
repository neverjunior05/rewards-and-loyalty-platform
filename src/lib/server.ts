import { db } from "@/db";
import { users, ledger, vouchers, checkins, notifications, missionProgress, userBadges, receipts, groupsTbl, groupMembers, contributions, campaigns, auditLogs, fraudFlags, referrals } from "@/db/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { TIERS, tierForQualifying } from "@/config/site";
import { MISSIONS } from "./data";

export const hashPw = (pw: string) => createHash("sha256").update("perkpilot::" + pw).digest("hex");
export const genCode = (p = "PP") => `${p}-${randomBytes(3).toString("hex").toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
export const genRef = (name: string) => name.replace(/[^a-zA-Z]/g, "").slice(0, 5).toUpperCase() + randomBytes(2).toString("hex").toUpperCase();
export const todayStr = (d = new Date()) => d.toISOString().slice(0, 10);
export function mockEmail(to: string, subject: string) { console.log(`[mock-email] to=${to} subject="${subject}"`); }

export async function getBalance(userId: number) {
  const rows = await db.select({ s: sql<number>`coalesce(sum(${ledger.amount}),0)` }).from(ledger).where(eq(ledger.userId, userId));
  return Number(rows[0]?.s || 0);
}
export async function getLifetime(userId: number) {
  const rows = await db.select({ s: sql<number>`coalesce(sum(case when ${ledger.amount}>0 then ${ledger.amount} else 0 end),0)` }).from(ledger).where(eq(ledger.userId, userId));
  return Number(rows[0]?.s || 0);
}
export async function getQualifying(userId: number) {
  const since = new Date(Date.now() - 365 * 864e5);
  const rows = await db.select({ s: sql<number>`coalesce(sum(case when ${ledger.amount}>0 and ${ledger.type}='earn' then ${ledger.amount} else 0 end),0)` }).from(ledger).where(and(eq(ledger.userId, userId), gte(ledger.createdAt, since)));
  return Number(rows[0]?.s || 0);
}
export async function notify(userId: number, title: string, body: string, type = "points") {
  const u = (await db.select().from(users).where(eq(users.id, userId)))[0];
  if (u?.pauseNotifications) return;
  await db.insert(notifications).values({ userId, title, body, type });
  if (u?.emailPrefs) mockEmail(u.email, title);
}
export async function addPoints(userId: number, amount: number, type: string, description: string, source = "", idempotencyKey?: string, expiryDays = 365) {
  if (idempotencyKey) {
    const ex = await db.select().from(ledger).where(eq(ledger.idempotencyKey, idempotencyKey));
    if (ex.length) return { duplicate: true, balance: ex[0].balanceAfter };
  }
  const bal = await getBalance(userId);
  const newBal = bal + amount;
  await db.insert(ledger).values({ userId, amount, type, description, source, balanceAfter: newBal, idempotencyKey: idempotencyKey || null, expiresAt: amount > 0 ? new Date(Date.now() + expiryDays * 864e5) : null });
  if (amount > 0) { await maybeBadges(userId); await maybeReferralQualify(userId); }
  return { duplicate: false, balance: newBal };
}
export async function bumpMission(userId: number, action: string, by = 1, absolute?: number) {
  for (const m of MISSIONS.filter((x) => x.action === action)) {
    const ex = (await db.select().from(missionProgress).where(and(eq(missionProgress.userId, userId), eq(missionProgress.missionId, m.id))))[0];
    if (!ex) await db.insert(missionProgress).values({ userId, missionId: m.id, progress: Math.min(m.target, absolute ?? by) });
    else if (!ex.claimed) await db.update(missionProgress).set({ progress: Math.min(m.target, absolute ?? ex.progress + by), updatedAt: new Date() }).where(eq(missionProgress.id, ex.id));
  }
}
export async function maybeBadges(userId: number) {
  const grant = async (badgeId: string) => { try { await db.insert(userBadges).values({ userId, badgeId }); await notify(userId, "Badge unlocked 🏅", `You earned the ${badgeId} badge.`, "badge"); } catch {} };
  const lifetime = await getLifetime(userId);
  const q = await getQualifying(userId);
  const tier = tierForQualifying(q).current.name;
  if (lifetime > 0) await grant("first-earn");
  if (lifetime >= 1000) await grant("thousand");
  if (tier !== "Spark") await grant("tier-glow");
  if (tier === "Blaze" || tier === "Nova") await grant("tier-blaze");
  if (tier === "Nova") await grant("tier-nova");
  const u = (await db.select().from(users).where(eq(users.id, userId)))[0];
  if (u && u.streak >= 7) await grant("streak-7");
  if (u && u.streak >= 14) await grant("streak-14");
  if (u && u.streak >= 30) await grant("streak-30");
  const day = new Date().getDay(); if (day === 0 || day === 6) await grant("weekend");
  if (new Date().getHours() < 9) await grant("early-bird");
}
async function maybeReferralQualify(userId: number) {
  const ref = (await db.select().from(referrals).where(and(eq(referrals.referredId, userId), eq(referrals.status, "Pending"))))[0];
  if (!ref) return;
  const lifetime = await getLifetime(userId);
  // qualifying action = earned beyond welcome bonus (welcome=250). Require >300 lifetime from non-welcome sources approx.
  if (lifetime >= 350) {
    await db.update(referrals).set({ status: "Qualified", bonusAwarded: true }).where(eq(referrals.id, ref.id));
    await addPointsInternalOnly(ref.referrerId, 300, "earn", "Referral bonus — your friend earned their first points", "referral", `ref-bonus-${ref.id}`);
    await bumpMission(ref.referrerId, "referral", 1);
    try { await db.insert(userBadges).values({ userId: ref.referrerId, badgeId: "referrer" }); } catch {}
    await notify(ref.referrerId, "+300 referral bonus", "Your friend completed their first qualifying action.", "points");
    await notify(userId, "+150 referral welcome boost", "Thanks for joining via a friend — bonus unlocked after your first earn.", "points");
    await addPointsInternalOnly(userId, 150, "earn", "Referral friend bonus (after first qualifying action)", "referral", `ref-friend-${ref.id}`);
  }
}
// avoid recursion into referral check for the bonus itself
async function addPointsInternalOnly(userId: number, amount: number, type: string, description: string, source: string, key: string) {
  const ex = await db.select().from(ledger).where(eq(ledger.idempotencyKey, key)); if (ex.length) return;
  const bal = await getBalance(userId);
  await db.insert(ledger).values({ userId, amount, type, description, source, balanceAfter: bal + amount, idempotencyKey: key, expiresAt: new Date(Date.now() + 365 * 864e5) });
}
export async function userPayload(userId: number) {
  const u = (await db.select().from(users).where(eq(users.id, userId)))[0];
  if (!u) return null;
  const [balance, lifetime, qualifying] = await Promise.all([getBalance(userId), getLifetime(userId), getQualifying(userId)]);
  const tier = tierForQualifying(qualifying);
  // expiring soon: positive earn entries expiring in 30d (FIFO approx, capped at balance)
  const soon = await db.select().from(ledger).where(eq(ledger.userId, userId)).orderBy(desc(ledger.id)).limit(200);
  const in30 = soon.filter((l) => l.amount > 0 && l.expiresAt && +new Date(l.expiresAt) - Date.now() < 30 * 864e5 && +new Date(l.expiresAt) > Date.now()).reduce((a, b) => a + b.amount, 0);
  return { id: u.id, name: u.name, email: u.email, role: u.role, merchantSlug: u.merchantSlug, displayName: u.displayName, referralCode: u.referralCode, streak: u.streak, streakFreezes: u.streakFreezes, lastCheckin: u.lastCheckin, lastSpinDay: u.lastSpinDay, leaderboardOptin: u.leaderboardOptin, pauseNotifications: u.pauseNotifications, takeBreak: u.takeBreak, emailPrefs: u.emailPrefs, birthday: u.birthday, hasOnboarded: u.hasOnboarded, memberSince: u.createdAt, balance, lifetime, qualifying, expiringSoon: Math.min(in30, Math.max(balance, 0)), tier: tier.current.name, tierColor: tier.current.color, multiplier: tier.current.multiplier, nextTier: tier.next?.name || null, toNext: tier.toNext, tierProgress: tier.progress };
}

let seeding = false;
export async function ensureSeed() {
  if (seeding) return; seeding = true;
  try {
    const existing = await db.select().from(users).limit(1);
    if (existing.length) return;
    const mk = async (name: string, email: string, role: string, extra: Record<string, unknown> = {}) => {
      const [u] = await db.insert(users).values({ name, email, role, password: hashPw("demo1234"), displayName: name.split(" ")[0] + "_" + Math.floor(Math.random() * 90 + 10), referralCode: genRef(name), hasOnboarded: true, ...extra } as never).returning();
      return u;
    };
    const maya = await mk("Maya Nova", "maya@demo.perkpilot", "member", { streak: 9, lastCheckin: todayStr(new Date(Date.now() - 864e5)), birthday: todayStr() });
    const leo = await mk("Leo Glow", "leo@demo.perkpilot", "member", { streak: 4, lastCheckin: todayStr(new Date(Date.now() - 864e5)) });
    const sam = await mk("Sam Streak", "sam@demo.perkpilot", "member", { streak: 14, lastCheckin: todayStr(new Date(Date.now() - 864e5)), streakFreezes: 2 });
    const ana = await mk("Ana Spark", "ana@demo.perkpilot", "member", {});
    const merchant = await mk("Vera Violet (Merchant)", "merchant@demo.perkpilot", "merchant", { merchantSlug: "violet-bean" });
    const admin = await mk("Ada Admin", "admin@demo.perkpilot", "admin", {});
    void admin; void merchant; void ana;
    const seedLedger = async (uid: number, entries: [number, string, string, number][], expirySoonPts = 0) => {
      let bal = 0;
      for (const [amt, type, descText, daysAgo] of entries) {
        bal += amt;
        await db.insert(ledger).values({ userId: uid, amount: amt, type, description: descText, source: "seed", balanceAfter: bal, createdAt: new Date(Date.now() - daysAgo * 864e5), expiresAt: amt > 0 ? new Date(Date.now() + 300 * 864e5) : null });
      }
      if (expirySoonPts) { bal += expirySoonPts; await db.insert(ledger).values({ userId: uid, amount: expirySoonPts, type: "earn", description: "Partner checkout — Harvest Halo (expiring soon demo batch)", source: "purchase", balanceAfter: bal, createdAt: new Date(Date.now() - 350 * 864e5), expiresAt: new Date(Date.now() + 6 * 864e5) }); }
    };
    await seedLedger(maya.id, [[250, "earn", "Welcome bonus", 200], [5200, "earn", "Partner purchases (seeded history)", 120], [4800, "earn", "Challenges, receipts & referrals (seeded)", 60], [2900, "earn", "Partner checkout — Skyferry Travel", 20], [-1100, "redeem", "Redeemed: Cinema Ticket + Popcorn", 9], [-800, "redeem", "Redeemed: Donate 10 School Meals", 4], [-120, "expiry", "Points expired (FIFO, oldest batch)", 30], [100, "adjustment", "Goodwill adjustment — support (reason logged)", 15]], 420);
    await seedLedger(leo.id, [[250, "earn", "Welcome bonus", 90], [2100, "earn", "Partner purchases (seeded)", 40], [-500, "redeem", "Redeemed: $5 Bakery Voucher", 6]], 150);
    await seedLedger(sam.id, [[250, "earn", "Welcome bonus", 30], [900, "earn", "Check-ins & surveys (seeded)", 10], [-450, "redeem", "Redeemed: Free Violet Latte", 2]]);
    await seedLedger(ana.id, [[250, "earn", "Welcome bonus", 3], [180, "earn", "Daily check-ins", 1]]);
    // sam 14-day checkins ending yesterday (today still available to demo)
    for (let i = 14; i >= 1; i--) await db.insert(checkins).values({ userId: sam.id, day: todayStr(new Date(Date.now() - i * 864e5)), points: 10 }).catch(() => {});
    for (const b of ["first-earn", "thousand", "streak-7", "streak-14", "cafe-hopper", "giver", "tier-glow", "tier-blaze", "tier-nova", "redeemer"]) await db.insert(userBadges).values({ userId: maya.id, badgeId: b }).catch(() => {});
    for (const b of ["first-earn", "streak-7", "streak-14", "redeemer"]) await db.insert(userBadges).values({ userId: sam.id, badgeId: b }).catch(() => {});
    // vouchers in every status for Maya
    await db.insert(vouchers).values([
      { userId: maya.id, rewardId: "r16", rewardTitle: "Cinema Ticket + Popcorn", merchant: "Starlane Cinema", code: "PP-DEMO1001", status: "Active", pointsCost: 1100, expiresAt: new Date(Date.now() + 20 * 864e5) },
      { userId: maya.id, rewardId: "r1", rewardTitle: "Free Violet Latte", merchant: "Violet Bean Roasters", code: "PP-DEMO1002", status: "Used", pointsCost: 450, expiresAt: new Date(Date.now() + 5 * 864e5), usedAt: new Date(Date.now() - 2 * 864e5) },
      { userId: maya.id, rewardId: "r2", rewardTitle: "$5 Bakery Voucher", merchant: "Crumb & Crown Bakery", code: "PP-DEMO1003", status: "Expired", pointsCost: 500, expiresAt: new Date(Date.now() - 3 * 864e5) },
      { userId: sam.id, rewardId: "r1", rewardTitle: "Free Violet Latte", merchant: "Violet Bean Roasters", code: "PP-DEMO1004", status: "Active", pointsCost: 450, expiresAt: new Date(Date.now() + 25 * 864e5) },
    ]);
    await db.insert(receipts).values([
      { userId: maya.id, merchant: "Harvest Halo Grocery", amount: 42, imageUrl: "https://picsum.photos/seed/receipt1/400/300", imageHash: "seed-r1", status: "Pending", points: 0 },
      { userId: leo.id, merchant: "Violet Bean Roasters", amount: 18, imageUrl: "https://picsum.photos/seed/receipt2/400/300", imageHash: "seed-r2", status: "Approved", points: 216 },
      { userId: sam.id, merchant: "Noodle Comet", amount: 25, imageUrl: "https://picsum.photos/seed/receipt3/400/300", imageHash: "seed-r3", status: "Rejected", points: 0, note: "Image too blurry — please re-upload (demo)" },
    ]);
    const [g] = await db.insert(groupsTbl).values({ name: "The Nova Family Pool", ownerId: maya.id, goalReward: "Family Movie Night Bundle (×4)", goalPoints: 3800, poolPoints: 1350, inviteCode: "NOVA-FAM1" }).returning();
    await db.insert(groupMembers).values([{ groupId: g.id, userId: maya.id, role: "owner" }, { groupId: g.id, userId: leo.id }, { groupId: g.id, userId: sam.id }]);
    await db.insert(contributions).values([{ groupId: g.id, userId: maya.id, userName: "Maya", points: 800 }, { groupId: g.id, userId: leo.id, userName: "Leo", points: 350 }, { groupId: g.id, userId: sam.id, userName: "Sam", points: 200 }]);
    await db.insert(campaigns).values([
      { merchant: "Violet Bean Roasters", title: "Double-Points Weekend ☕", budget: 20000, spent: 6400, multiplier: 2, startDate: todayStr(), endDate: todayStr(new Date(Date.now() + 6 * 864e5)), createdBy: merchant.id },
      { merchant: "Starlane Cinema", title: "Family Friday Films", budget: 15000, spent: 3200, multiplier: 2, startDate: todayStr(), endDate: todayStr(new Date(Date.now() + 13 * 864e5)), createdBy: merchant.id },
      { merchant: "Harvest Halo Grocery", title: "Fresh Week Boost", budget: 8000, spent: 7900, multiplier: 3, startDate: todayStr(new Date(Date.now() - 10 * 864e5)), endDate: todayStr(new Date(Date.now() + 864e5)), createdBy: merchant.id },
    ]);
    await db.insert(missionProgress).values([{ userId: maya.id, missionId: "m-cafe3", progress: 2 }, { userId: maya.id, missionId: "m-spend50", progress: 38 }, { userId: sam.id, missionId: "m-checkin7", progress: 7 }]);
    await db.insert(fraudFlags).values({ userId: ana.id, reason: "3 receipt uploads in 60s from same device (demo pattern) — review", status: "Open" });
    await db.insert(auditLogs).values([{ actor: "system", action: "seed", detail: "Demo data seeded: 6 users, ledgers, vouchers, group, campaigns" }, { actor: "Ada Admin", action: "adjustment", detail: "Maya Nova +100 goodwill adjustment. Reason: support case #1042 (demo)" }]);
    for (const uid of [maya.id, leo.id, sam.id]) {
      await db.insert(notifications).values([
        { userId: uid, title: "Welcome to PerkPilot 💜", body: "Demo account ready. Explore Earn, Missions and the Lucky Spin.", type: "info" },
        { userId: uid, title: "Points expiring soon", body: "A demo batch expires within 30 days. Check your dashboard.", type: "expiry" },
      ]);
    }
    void TIERS;
  } finally { seeding = false; }
}
export async function fullState(userId: number) {
  const me = await userPayload(userId);
  const [led, vouch, checks, notifs, mp, badges, recs, myGroups, camps, allUsersRaw, allVouch, allRecs, audits, frauds, custom] = await Promise.all([
    db.select().from(ledger).where(eq(ledger.userId, userId)).orderBy(desc(ledger.id)).limit(300),
    db.select().from(vouchers).where(eq(vouchers.userId, userId)).orderBy(desc(vouchers.id)),
    db.select().from(checkins).where(eq(checkins.userId, userId)).orderBy(desc(checkins.id)).limit(60),
    db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.id)).limit(50),
    db.select().from(missionProgress).where(eq(missionProgress.userId, userId)),
    db.select().from(userBadges).where(eq(userBadges.userId, userId)),
    db.select().from(receipts).where(eq(receipts.userId, userId)).orderBy(desc(receipts.id)),
    db.select().from(groupMembers).where(eq(groupMembers.userId, userId)),
    db.select().from(campaigns).orderBy(desc(campaigns.id)),
    db.select().from(users),
    db.select().from(vouchers).orderBy(desc(vouchers.id)).limit(100),
    db.select().from(receipts).orderBy(desc(receipts.id)).limit(100),
    db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(50),
    db.select().from(fraudFlags).orderBy(desc(fraudFlags.id)),
    db.select().from((await import("@/db/schema")).customRewards).orderBy(desc(sql`id`)),
  ]);
  const groupIds = myGroups.map((g) => g.groupId);
  const allGroups = groupIds.length ? await db.select().from(groupsTbl) : [];
  const groups = allGroups.filter((g) => groupIds.includes(g.id));
  const contribs = groups.length ? await db.select().from(contributions).orderBy(desc(contributions.id)).limit(100) : [];
  const members = groups.length ? await db.select().from(groupMembers) : [];
  // leaderboard: weekly earn (approx from ledger 7d) for opt-in users + seeded display names in UI merge
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const weekly = await db.select({ userId: ledger.userId, s: sql<number>`coalesce(sum(case when ${ledger.amount}>0 then ${ledger.amount} else 0 end),0)` }).from(ledger).where(gte(ledger.createdAt, weekAgo)).groupBy(ledger.userId);
  const leaderboard = weekly.map((w) => { const u = allUsersRaw.find((x) => x.id === w.userId); return u && u.leaderboardOptin ? { name: u.displayName || u.name, points: Number(w.s), you: u.id === userId } : null; }).filter(Boolean).sort((a, b) => (b!.points - a!.points));
  const publicUsers = allUsersRaw.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, displayName: u.displayName, streak: u.streak, referralCode: u.referralCode, memberSince: u.createdAt }));
  // admin liability
  const allLedgerSum = await db.select({ s: sql<number>`coalesce(sum(${ledger.amount}),0)` }).from(ledger);
  return { me, ledger: led, vouchers: vouch, checkins: checks, notifications: notifs, missionProgress: mp, badges: badges.map((b) => b.badgeId), receipts: recs, groups, contributions: contribs, groupMembers: members, campaigns: camps, leaderboard, users: publicUsers, allVouchers: allVouch, allReceipts: allRecs, audits, frauds, customRewards: custom, liability: { outstanding: Number(allLedgerSum[0]?.s || 0), valueUSD: Number(allLedgerSum[0]?.s || 0) * 0.01 } };
}
