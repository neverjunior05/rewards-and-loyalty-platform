import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, referrals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureSeed, hashPw, genRef, addPoints, userPayload, notify } from "@/lib/server";
export async function POST(req: Request) {
  await ensureSeed();
  const b = await req.json();
  const email = String(b.email || "").trim().toLowerCase();
  if (!email.includes("@") || !b.password) return NextResponse.json({ error: "Valid email & password required" }, { status: 400 });
  if (b.mode === "register") {
    const name = String(b.name || "Member").slice(0, 60);
    const ex = await db.select().from(users).where(eq(users.email, email));
    if (ex.length) return NextResponse.json({ error: "Account already exists — log in instead." }, { status: 409 });
    let referrer = null as null | typeof users.$inferSelect;
    if (b.referralCode) { referrer = (await db.select().from(users).where(eq(users.referralCode, String(b.referralCode).trim())))[0] || null; }
    const [u] = await db.insert(users).values({ name, email, password: hashPw(String(b.password)), role: b.role === "merchant" ? "merchant" : "member", merchantSlug: b.merchantSlug || "", displayName: String(b.displayName || name.split(" ")[0] + "_Pilot").slice(0, 30), referralCode: genRef(name), referredBy: referrer ? String(referrer.id) : "", birthday: b.birthday || "" }).returning();
    await addPoints(u.id, 250, "earn", "Welcome bonus 🎉 Thanks for joining PerkPilot (demo)", "welcome", `welcome-${u.id}`);
    if (referrer) { await db.insert(referrals).values({ referrerId: referrer.id, referredId: u.id }); await notify(referrer.id, "A friend joined with your link", `${name.split(" ")[0]} joined. You both earn a bonus after their first qualifying earn.`, "referral"); }
    await notify(u.id, "Welcome to PerkPilot 💜", "+250 welcome points added. Take the 30-second tour to see how earning works.", "info");
    return NextResponse.json({ user: await userPayload(u.id) });
  }
  const u = (await db.select().from(users).where(eq(users.email, email)))[0];
  if (!u || u.password !== hashPw(String(b.password))) return NextResponse.json({ error: "Incorrect email or password. Try a demo account (demo1234)." }, { status: 401 });
  return NextResponse.json({ user: await userPayload(u.id) });
}
