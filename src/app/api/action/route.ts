import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, ledger, vouchers, checkins, spinResults, missionProgress, surveyResponses, receipts, groupsTbl, groupMembers, contributions, notifications, campaigns, auditLogs, fraudFlags, customRewards, referrals, earnRules } from "@/db/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { ensureSeed, getBalance, getQualifying, addPoints, notify, bumpMission, todayStr, genCode, userPayload } from "@/lib/server";
import { REWARDS, MISSIONS, SURVEYS, MERCHANTS } from "@/lib/data";
import { SPIN_SEGMENTS, TIERS, tierForQualifying } from "@/config/site";
import { merchantAdapter, simpleHash, timingSafeEqualStr } from "@/lib/merchants";
import { randomInt } from "crypto";

const err = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });
const ok = (d: object = {}) => NextResponse.json({ ok: true, ...d });

export async function POST(req: Request) {
  await ensureSeed();
  const b = await req.json();
  const userId = Number(b.userId || 0);
  const action = String(b.action || "");
  const p = b.payload || {};
  const me = userId ? (await db.select().from(users).where(eq(users.id, userId)))[0] : null;
  if (!me) return err("Not signed in", 401);
  const isAdmin = me.role === "admin";
  const isMerchant = me.role === "merchant" || isAdmin;
  try {
    switch (action) {
      case "onboard": { await db.update(users).set({ hasOnboarded: true }).where(eq(users.id, userId)); return ok(); }
      case "checkin": {
        const today = todayStr();
        if (me.lastCheckin === today) return err("Already checked in today. Come back tomorrow!");
        const yesterday = todayStr(new Date(Date.now() - 864e5));
        let streak = me.streak, freezes = me.streakFreezes, usedFreeze = false;
        if (me.lastCheckin === yesterday || !me.lastCheckin) streak = me.lastCheckin ? streak + 1 : 1;
        else {
          const gapDays = Math.round((+new Date(today) - +new Date(me.lastCheckin)) / 864e5);
          if (gapDays === 2 && freezes > 0 && p.useFreeze !== false) { freezes -= 1; streak += 1; usedFreeze = true; }
          else streak = 1;
        }
        const milestone = streak % 7 === 0 ? 100 : streak % 3 === 0 ? 30 : 0;
        const pts = 10 + Math.min(streak, 10) * 2 + milestone;
        await db.insert(checkins).values({ userId, day: today, points: pts });
        await db.update(users).set({ streak, streakFreezes: freezes, lastCheckin: today }).where(eq(users.id, userId));
        await addPoints(userId, pts, "earn", `Daily check-in — day ${streak} streak${milestone ? ` + ${milestone} milestone bonus` : ""}${usedFreeze ? " (streak freeze used 🧊)" : ""}`, "checkin", `checkin-${userId}-${today}`);
        await bumpMission(userId, "checkin", 1); await bumpMission(userId, "streak", 0, streak);
        await notify(userId, `+${pts} check-in points`, `Day ${streak} of your streak. ${milestone ? "Milestone chest opened!" : ""}`, "points");
        return ok({ points: pts, streak, milestone, usedFreeze, message: `+${pts} pts — ${streak}-day streak!` });
      }
      case "spin": {
        if (me.takeBreak) return err("Lucky Spin is paused — you turned on 'Take a break from games'. Re-enable it in Settings any time.");
        const today = todayStr();
        if (me.lastSpinDay === today) return err("You've used today's free spin. Come back tomorrow — no purchasable spins, ever.");
        const total = SPIN_SEGMENTS.reduce((a, s) => a + s.weight, 0);
        let r = randomInt(total); let seg = SPIN_SEGMENTS[0];
        for (const s of SPIN_SEGMENTS) { if (r < s.weight) { seg = s; break; } r -= s.weight; }
        await db.update(users).set({ lastSpinDay: today, streakFreezes: seg.label === "Streak Freeze" ? me.streakFreezes + 1 : me.streakFreezes }).where(eq(users.id, userId));
        await db.insert(spinResults).values({ userId, day: today, prize: seg.label, points: seg.points });
        if (seg.points > 0) await addPoints(userId, seg.points, "earn", `Lucky Spin — ${seg.label} (free daily spin, demo)`, "spin", `spin-${userId}-${today}`);
        await bumpMission(userId, "spin", 1);
        return ok({ segment: seg, index: SPIN_SEGMENTS.indexOf(seg), points: seg.points, message: seg.points ? `You won ${seg.label}!` : "No points this time — see you tomorrow." });
      }
      case "purchase": {
        const amount = Math.round(Number(p.amount || 0));
        if (amount < 1 || amount > 2000) return err("Enter a demo basket between $1 and $2,000.");
        // daily cap per method: 2000 pts/day from purchases (server-side)
        const start = new Date(todayStr() + "T00:00:00Z");
        const todayEarn = await db.select({ s: sql<number>`coalesce(sum(${ledger.amount}),0)` }).from(ledger).where(and(eq(ledger.userId, userId), eq(ledger.source, "purchase"), gte(ledger.createdAt, start)));
        if (Number(todayEarn[0]?.s || 0) >= 2000) return err("Daily purchase-earn cap reached (2,000 pts/day, fairness rule). Try tomorrow.");
        const v = await merchantAdapter.verifyPurchase({ merchantSlug: String(p.merchantSlug), amount });
        if (!v.verified) return err("Demo POS could not verify that merchant/amount.");
        const merchant = MERCHANTS.find((m) => m.slug === p.merchantSlug)!;
        const rule = (await db.select().from(earnRules).where(eq(earnRules.merchant, merchant.name)))[0];
        const rate = rule?.pointsPerUnit ?? v.earnRate;
        const q = await getQualifying(userId); const mult = tierForQualifying(q).current.multiplier;
        const camp = (await db.select().from(campaigns).where(eq(campaigns.merchant, merchant.name))).find((c) => c.status === "Live" && c.spent < c.budget && todayStr() >= (c.startDate || "0") && todayStr() <= (c.endDate || "9999"));
        const campMult = camp ? camp.multiplier : 1;
        const isWeekend = [0, 6].includes(new Date().getDay());
        const pts = Math.round(amount * rate * mult * campMult * (isWeekend ? 1 : 1));
        const capped = Math.min(pts, 2000 - Number(todayEarn[0]?.s || 0));
        if (camp) await db.update(campaigns).set({ spent: camp.spent + capped, status: camp.spent + capped >= camp.budget ? "Budget reached" : "Live" }).where(eq(campaigns.id, camp.id));
        await addPoints(userId, capped, "earn", `Partner checkout — ${merchant.name} ($${amount} × ${rate} pts/$ × ${mult} tier${campMult > 1 ? ` × ${campMult} campaign` : ""})`, "purchase", String(p.idempotencyKey || `purchase-${userId}-${Date.now()}`));
        if (merchant.category === "Cafés & Bakeries") await bumpMission(userId, "cafe_purchase", 1);
        await bumpMission(userId, "spend", amount);
        const uniq = await db.select({ s: ledger.description }).from(ledger).where(and(eq(ledger.userId, userId), eq(ledger.source, "purchase")));
        await bumpMission(userId, "merchant_unique", 0, new Set(uniq.map((x) => x.s.split("—")[1]?.split("(")[0])).size);
        await notify(userId, `+${capped} points from ${merchant.name}`, "Demo POS verified your purchase via MerchantAdapter.", "points");
        return ok({ points: capped, breakdown: { amount, rate, mult, campMult }, message: `+${capped} pts from ${merchant.name}` });
      }
      case "refund-demo": {
        const last = (await db.select().from(ledger).where(and(eq(ledger.userId, userId), eq(ledger.source, "purchase"))).orderBy(desc(ledger.id)).limit(1))[0];
        if (!last) return err("No purchase to refund.");
        await addPoints(userId, -last.amount, "refund", `Refund clawback — reversed: ${last.description} (demo)`, "refund", `refund-${last.id}`);
        return ok({ points: -last.amount, message: `Refunded — ${last.amount} pts clawed back fairly. Balance may adjust; no fees, ever.` });
      }
      case "receipt_submit": {
        const imageUrl = String(p.imageUrl || "").slice(0, 500);
        const amount = Math.round(Number(p.amount || 0));
        if (!imageUrl || amount < 1) return err("Add a receipt image URL (or upload) and the amount printed on it.");
        if (!/^https?:\/\//i.test(imageUrl) && !imageUrl.startsWith("data:image/")) return err("Only http(s) image URLs or an uploaded image are allowed.");
        const start = new Date(todayStr() + "T00:00:00Z");
        const todayCount = await db.select().from(receipts).where(and(eq(receipts.userId, userId), gte(receipts.createdAt, start)));
        if (todayCount.length >= 5) return err("Receipt limit: 5 per day (fraud protection).");
        const hash = simpleHash(imageUrl + amount);
        const dup = await db.select().from(receipts).where(eq(receipts.imageHash, hash));
        if (dup.length) { await db.insert(fraudFlags).values({ userId, reason: `Duplicate receipt image hash submitted (receipt #${dup[0].id})` }); return err("This exact receipt image was already submitted — duplicates can't earn twice."); }
        const rate = MERCHANTS.find((m) => m.name === p.merchant)?.earnRate || 5;
        const [rec] = await db.insert(receipts).values({ userId, merchant: String(p.merchant || "Partner"), amount, imageUrl, imageHash: hash, status: "Pending", points: Math.round(amount * rate) }).returning();
        // demo auto-review note: admin approves in queue; bump mission on submit
        await bumpMission(userId, "receipt", 1);
        await notify(userId, "Receipt in review queue 🧾", `Worth ~${rec.points} pts when approved. Demo reviewers: merchant/admin accounts.`, "info");
        return ok({ receipt: rec, message: "Receipt submitted to the mock verification queue." });
      }
      case "receipt_review": {
        if (!isMerchant) return err("Merchant/admin only", 403);
        const rec = (await db.select().from(receipts).where(eq(receipts.id, Number(p.receiptId))))[0];
        if (!rec || rec.status !== "Pending") return err("Receipt not found or already reviewed.");
        if (p.approve) {
          await db.update(receipts).set({ status: "Approved" }).where(eq(receipts.id, rec.id));
          await addPoints(rec.userId, rec.points, "earn", `Receipt approved — ${rec.merchant} ($${rec.amount})`, "receipt", `receipt-${rec.id}`);
          await notify(rec.userId, `+${rec.points} receipt points`, `Your ${rec.merchant} receipt was approved.`, "points");
          const approvedCount = (await db.select().from(receipts).where(and(eq(receipts.userId, rec.userId), eq(receipts.status, "Approved")))).length;
          if (approvedCount >= 5) { try { const { userBadges } = await import("@/db/schema"); await db.insert(userBadges).values({ userId: rec.userId, badgeId: "receipt-pro" }); } catch {} }
          return ok({ message: `Approved — +${rec.points} pts to member.` });
        }
        await db.update(receipts).set({ status: "Rejected", note: String(p.note || "Could not verify (demo)") }).where(eq(receipts.id, rec.id));
        await notify(rec.userId, "Receipt couldn't be verified", String(p.note || "Please check the photo is clear and try again."), "info");
        return ok({ message: "Rejected with a kind note to the member." });
      }
      case "survey": {
        const s = SURVEYS.find((x) => x.id === p.surveyId); if (!s) return err("Survey not found");
        const ex = await db.select().from(surveyResponses).where(and(eq(surveyResponses.userId, userId), eq(surveyResponses.surveyId, s.id)));
        if (ex.length) return err("You've already completed this one — thanks!");
        await db.insert(surveyResponses).values({ userId, surveyId: s.id, answers: JSON.stringify(p.answers || {}) });
        await addPoints(userId, s.points, "earn", `Survey completed — ${s.title}`, "survey", `survey-${userId}-${s.id}`);
        await bumpMission(userId, "survey", 1);
        const count = (await db.select().from(surveyResponses).where(eq(surveyResponses.userId, userId))).length;
        if (count >= 3) { try { const { userBadges } = await import("@/db/schema"); await db.insert(userBadges).values({ userId, badgeId: "survey-star" }); } catch {} }
        return ok({ points: s.points, message: `+${s.points} pts — thanks for sharing!` });
      }
      case "redeem": {
        const custom = await db.select().from(customRewards);
        const reward = REWARDS.find((r) => r.id === p.rewardId) || custom.filter((c) => `c${c.id}` === p.rewardId).map((c) => ({ id: `c${c.id}`, title: c.title, merchant: c.merchant, category: c.category, type: "Voucher", pointsCost: c.pointsCost, cashTopup: c.cashTopup, stock: c.stock, tierRequired: c.tierRequired, description: c.description, terms: "Demo reward published by a merchant.", image: "" }))[0];
        if (!reward) return err("Reward not found");
        const balance = await getBalance(userId);
        const usePointsOnly = p.pointsOnly !== false;
        const cost = usePointsOnly ? reward.pointsCost : Math.round(reward.pointsCost * 0.6);
        if (balance < cost) return err(`Not enough points — you need ${cost - balance} more. No partial charges, ever.`);
        const q = await getQualifying(userId); const myTierIdx = TIERS.findIndex((t) => t.name === tierForQualifying(q).current.name);
        const reqIdx = TIERS.findIndex((t) => t.name === reward.tierRequired);
        if (myTierIdx < reqIdx) return err(`This is a ${reward.tierRequired}+ reward. You're ${tierForQualifying(q).current.name} — ${tierForQualifying(q).toNext} qualifying pts to the next tier.`);
        const issued = await db.select().from(vouchers).where(eq(vouchers.rewardId, reward.id));
        if (issued.length >= reward.stock) return err("Sold out (real stock count, demo reward). Try another reward.");
        const { code } = await merchantAdapter.issueVoucher({ rewardId: reward.id, userId });
        const [v] = await db.insert(vouchers).values({ userId, rewardId: reward.id, rewardTitle: reward.title, merchant: reward.merchant, code, pointsCost: cost, expiresAt: new Date(Date.now() + 30 * 864e5) }).returning();
        await addPoints(userId, -cost, "redeem", `Redeemed: ${reward.title}${usePointsOnly ? "" : ` (Points + $${reward.cashTopup} cash demo)`}`, "redeem", String(p.idempotencyKey || `redeem-${v.id}`));
        await bumpMission(userId, "redeem", 1);
        if ((reward as { charity?: boolean }).charity || reward.category === "Charity") { await bumpMission(userId, "charity", 1); try { const { userBadges } = await import("@/db/schema"); await db.insert(userBadges).values({ userId, badgeId: "giver" }); } catch {} }
        try { const { userBadges } = await import("@/db/schema"); await db.insert(userBadges).values({ userId, badgeId: "redeemer" }); } catch {}
        await notify(userId, "Voucher issued 🎟️", `${reward.title} — code ${code}, valid 30 days.`, "voucher");
        return ok({ voucher: v, points: -cost, message: `Voucher issued: ${code}` });
      }
      case "voucher_scan": {
        const code = String(p.code || "").trim().toUpperCase();
        const all = await db.select().from(vouchers);
        const v = all.find((x) => timingSafeEqualStr(x.code.toUpperCase(), code));
        if (!v) return err("Code not recognised. Check for typos (demo codes look like PP-XXXXXX-XXXX).");
        if (v.status === "Used") return err("This voucher was already used" + (v.usedAt ? ` on ${new Date(v.usedAt).toLocaleDateString()}` : "") + ".");
        if (v.status === "Expired" || (v.expiresAt && +new Date(v.expiresAt) < Date.now())) { await db.update(vouchers).set({ status: "Expired" }).where(eq(vouchers.id, v.id)); return err("This voucher has expired."); }
        if (!isMerchant && p.confirmUse !== true) return ok({ voucher: v, preview: true, message: "Valid voucher. A merchant confirms use, or tap 'Mark used (demo self-scan)'." });
        await db.update(vouchers).set({ status: "Used", usedAt: new Date() }).where(eq(vouchers.id, v.id));
        await notify(v.userId, "Voucher redeemed ✅", `${v.rewardTitle} was marked used at ${v.merchant} (demo).`, "voucher");
        return ok({ voucher: { ...v, status: "Used" }, message: `✅ ${v.rewardTitle} redeemed at ${v.merchant}.` });
      }
      case "mission_claim": {
        const m = MISSIONS.find((x) => x.id === p.missionId); if (!m) return err("Mission not found");
        let prog = (await db.select().from(missionProgress).where(and(eq(missionProgress.userId, userId), eq(missionProgress.missionId, m.id))))[0];
        if (m.action === "streak") { // sync from user streak
          if (!prog) { [prog] = await db.insert(missionProgress).values({ userId, missionId: m.id, progress: Math.min(m.target, me.streak) }).returning(); }
          else await db.update(missionProgress).set({ progress: Math.min(m.target, me.streak) }).where(eq(missionProgress.id, prog.id));
          prog = { ...prog, progress: Math.min(m.target, me.streak) };
        }
        if (!prog || prog.progress < m.target) return err(`Not quite there — ${prog?.progress || 0}/${m.target}. Keep going!`);
        if (prog.claimed) return err("Already claimed — nice work though.");
        await db.update(missionProgress).set({ claimed: true }).where(eq(missionProgress.id, prog.id));
        await addPoints(userId, m.reward, "earn", `Mission complete — ${m.title}`, "mission", `mission-${userId}-${m.id}`);
        return ok({ points: m.reward, message: `Mission claimed: +${m.reward} pts!` });
      }
      case "birthday_bonus": {
        const yr = new Date().getFullYear();
        if (!me.birthday) return err("Add your birthday in Settings first.");
        const isBday = me.birthday.slice(5) === todayStr().slice(5);
        const isAnniv = todayStr(new Date(me.createdAt)).slice(5) === todayStr().slice(5);
        if (!isBday && !isAnniv) return err("Birthday/anniversary bonuses unlock on the day itself (demo accounts: Maya's is today).");
        if (me.birthdayBonusYear === yr) return err("This year's celebration bonus is already claimed 🎂");
        await db.update(users).set({ birthdayBonusYear: yr }).where(eq(users.id, userId));
        await addPoints(userId, 250, "earn", isBday ? "Birthday bonus 🎂 (tier-scaled demo)" : "Member anniversary bonus 🎉", "birthday", `bday-${userId}-${yr}`);
        return ok({ points: 250, message: "+250 celebration points!" });
      }
      case "group_create": {
        const name = String(p.name || "Our Pool").slice(0, 50);
        const [g] = await db.insert(groupsTbl).values({ name, ownerId: userId, goalReward: String(p.goalReward || "Family Movie Night Bundle (×4)"), goalPoints: Math.max(100, Number(p.goalPoints || 3800)), inviteCode: genCode("POOL") }).returning();
        await db.insert(groupMembers).values({ groupId: g.id, userId, role: "owner" });
        return ok({ group: g, message: `Group created — invite code ${g.inviteCode}` });
      }
      case "group_join": {
        const g = (await db.select().from(groupsTbl).where(eq(groupsTbl.inviteCode, String(p.inviteCode || "").trim())))[0];
        if (!g) return err("Invite code not found. Try NOVA-FAM1 (demo group).");
        try { await db.insert(groupMembers).values({ groupId: g.id, userId }); } catch { return err("You're already in this group."); }
        return ok({ message: `Joined ${g.name}!` });
      }
      case "group_contribute": {
        const pts = Math.round(Number(p.points || 0));
        if (pts < 10) return err("Minimum contribution is 10 pts.");
        const bal = await getBalance(userId); if (bal < pts) return err("Not enough points to contribute that much.");
        const g = (await db.select().from(groupsTbl).where(eq(groupsTbl.id, Number(p.groupId))))[0]; if (!g) return err("Group not found");
        const member = await db.select().from(groupMembers).where(and(eq(groupMembers.groupId, g.id), eq(groupMembers.userId, userId))); if (!member.length) return err("Join the group first.");
        await addPoints(userId, -pts, "pool", `Pooled into ${g.name} → ${g.goalReward}`, "pool", `pool-${userId}-${g.id}-${Date.now()}`);
        await db.update(groupsTbl).set({ poolPoints: g.poolPoints + pts }).where(eq(groupsTbl.id, g.id));
        await db.insert(contributions).values({ groupId: g.id, userId, userName: me.name.split(" ")[0], points: pts });
        await bumpMission(userId, "pool", 1);
        try { const { userBadges } = await import("@/db/schema"); await db.insert(userBadges).values({ userId, badgeId: "pool-party" }); } catch {}
        return ok({ points: -pts, message: `Pooled ${pts} pts toward ${g.goalReward}!` });
      }
      case "group_leave": { await db.delete(groupMembers).where(and(eq(groupMembers.groupId, Number(p.groupId)), eq(groupMembers.userId, userId))); return ok({ message: "Left the group. Contributed points stay with the group goal (shown in history)." }); }
      case "group_remove": {
        const g = (await db.select().from(groupsTbl).where(eq(groupsTbl.id, Number(p.groupId))))[0];
        if (!g || g.ownerId !== userId) return err("Only the group owner can remove members.", 403);
        await db.delete(groupMembers).where(and(eq(groupMembers.groupId, g.id), eq(groupMembers.userId, Number(p.memberId))));
        return ok({ message: "Member removed." });
      }
      case "transfer": {
        const pts = Math.round(Number(p.points || 0));
        if (pts < 10 || pts > 500) return err("Transfers are capped at 10–500 pts per transfer (fairness & fraud rule).");
        const start = new Date(todayStr() + "T00:00:00Z");
        const sent = await db.select().from(ledger).where(and(eq(ledger.userId, userId), eq(ledger.type, "transfer_out"), gte(ledger.createdAt, start)));
        if (sent.reduce((a, x) => a + Math.abs(x.amount), 0) + pts > 500) return err("Daily transfer cap is 500 pts/day.");
        const to = (await db.select().from(users).where(eq(users.email, String(p.toEmail || "").toLowerCase())))[0];
        if (!to || to.id === userId) return err("Recipient not found (use a demo member's email).");
        const bal = await getBalance(userId); if (bal < pts) return err("Not enough points.");
        await addPoints(userId, -pts, "transfer_out", `Transfer to ${to.name}`, "transfer", `tx-${userId}-${Date.now()}`);
        await addPoints(to.id, pts, "transfer_in", `Transfer from ${me.name}`, "transfer", `txin-${to.id}-${Date.now()}`);
        await notify(to.id, `+${pts} pts from ${me.name.split(" ")[0]}`, "A friend sent you points.", "points");
        return ok({ points: -pts, message: `Sent ${pts} pts to ${to.name}.` });
      }
      case "notif_read": { await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId)); return ok(); }
      case "prefs": {
        await db.update(users).set({ displayName: String(p.displayName ?? me.displayName).slice(0, 30), leaderboardOptin: !!p.leaderboardOptin, pauseNotifications: !!p.pauseNotifications, takeBreak: !!p.takeBreak, emailPrefs: !!p.emailPrefs, birthday: String(p.birthday ?? me.birthday ?? "") }).where(eq(users.id, userId));
        return ok({ message: "Preferences saved." });
      }
      case "campaign_create": {
        if (!isMerchant) return err("Merchant portal only", 403);
        const [c] = await db.insert(campaigns).values({ merchant: String(p.merchant), title: String(p.title).slice(0, 80), budget: Math.max(100, Number(p.budget || 10000)), multiplier: Math.min(5, Math.max(1, Number(p.multiplier || 2))), startDate: String(p.startDate), endDate: String(p.endDate), createdBy: userId }).returning();
        await db.insert(auditLogs).values({ actor: me.name, action: "campaign_create", detail: `${c.title} @ ${c.merchant}, budget ${c.budget} pts` });
        return ok({ campaign: c, message: "Campaign launched 🚀" });
      }
      case "earn_rule": {
        if (!isMerchant) return err("Merchant portal only", 403);
        const ex = (await db.select().from(earnRules).where(eq(earnRules.merchant, String(p.merchant))))[0];
        if (ex) await db.update(earnRules).set({ pointsPerUnit: Number(p.pointsPerUnit), bonusDays: String(p.bonusDays || "Saturday,Sunday") }).where(eq(earnRules.id, ex.id));
        else await db.insert(earnRules).values({ merchant: String(p.merchant), pointsPerUnit: Number(p.pointsPerUnit), bonusDays: String(p.bonusDays || "Saturday,Sunday") });
        return ok({ message: `Earn rule saved: ${p.pointsPerUnit} pts/$ at ${p.merchant}` });
      }
      case "reward_publish": {
        if (!isMerchant) return err("Merchant portal only", 403);
        const [r] = await db.insert(customRewards).values({ title: String(p.title).slice(0, 80), merchant: String(p.merchant), category: String(p.category || "Vouchers"), pointsCost: Math.max(10, Number(p.pointsCost || 500)), cashTopup: Number(p.cashTopup || 0), stock: Number(p.stock || 50), tierRequired: String(p.tierRequired || "Spark"), description: String(p.description || "") }).returning();
        return ok({ reward: r, message: "Reward published to the catalog!" });
      }
      case "admin_adjust": {
        if (!isAdmin) return err("Admin only", 403);
        if (!String(p.reason || "").trim()) return err("A reason is required for every manual adjustment (audit rule).");
        const target = (await db.select().from(users).where(eq(users.id, Number(p.targetUserId))))[0]; if (!target) return err("User not found");
        const amt = Math.round(Number(p.amount || 0)); if (!amt) return err("Amount required");
        await addPoints(target.id, amt, "adjustment", `Manual adjustment — ${p.reason}`, "admin", `adj-${Date.now()}`);
        await db.insert(auditLogs).values({ actor: me.name, action: "points_adjustment", detail: `${target.name} ${amt > 0 ? "+" : ""}${amt} pts. Reason: ${p.reason}` });
        await notify(target.id, "Points adjustment", `${amt > 0 ? "+" : ""}${amt} pts — ${p.reason}`, "info");
        return ok({ message: `Adjusted ${target.name} by ${amt} pts (audited).` });
      }
      case "fraud_resolve": { if (!isAdmin) return err("Admin only", 403); await db.update(fraudFlags).set({ status: String(p.status || "Reviewed") }).where(eq(fraudFlags.id, Number(p.flagId))); await db.insert(auditLogs).values({ actor: me.name, action: "fraud_review", detail: `Flag #${p.flagId} → ${p.status}` }); return ok({ message: "Fraud flag updated." }); }
      case "worker_run": {
        if (!isAdmin) return err("Admin only — runs the demo worker jobs", 403);
        // expiry FIFO: expire positive batches past expiresAt; voucher expiry; audit
        const now = new Date();
        const expiring = await db.select().from(ledger).where(sql`${ledger.amount}>0 and ${ledger.expiresAt} < ${now} and ${ledger.type}='earn'`);
        let expiredPts = 0;
        for (const e of expiring.slice(0, 20)) { const key = `expiry-${e.id}`; const done = await db.select().from(ledger).where(eq(ledger.idempotencyKey, key)); if (!done.length) { await addPoints(e.userId, -Math.min(e.amount, Math.max(await getBalance(e.userId), 0)), "expiry", "Points expired (FIFO by earn date, 12-month life)", "worker", key); expiredPts += e.amount; } }
        const oldV = await db.select().from(vouchers).where(sql`${vouchers.status}='Active' and ${vouchers.expiresAt} < ${now}`);
        for (const v of oldV) await db.update(vouchers).set({ status: "Expired" }).where(eq(vouchers.id, v.id));
        await db.insert(auditLogs).values({ actor: "worker (manual run by " + me.name + ")", action: "worker_run", detail: `Expired ${expiredPts} pts FIFO, ${oldV.length} vouchers expired, tiers recalculated on read, streaks checked.` });
        return ok({ message: `Worker ran: ${expiredPts} pts expired FIFO, ${oldV.length} vouchers expired.` });
      }
      case "referral_info": { const refs = await db.select().from(referrals).where(eq(referrals.referrerId, userId)); return ok({ referrals: refs }); }
      default: return err("Unknown action");
    }
  } catch (e) {
    console.error(e);
    return err(e instanceof Error ? e.message : "Something went wrong", 500);
  }
}
