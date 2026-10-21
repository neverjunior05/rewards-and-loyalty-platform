"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import QRCode from "qrcode";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts";
import { Bell, Coins, Gift, Home, Target, User, Flame, Receipt, Search, X, Copy, Check, ChevronRight, Sparkles, Trophy, Users, Store, Shield, LogOut, Menu, Ticket, Wallet, BookOpen, Heart, Download, ScanLine, Plus, Star, Clock, BadgeCheck, Send, Settings, Crown, Zap, CalendarCheck, CircleHelp } from "lucide-react";
import { MERCHANTS, REWARDS, MISSIONS, BADGES, SURVEYS, BLOG, CATEGORIES, LEADERBOARD_SEED, type Reward } from "@/lib/data";
import { TIERS, SPIN_SEGMENTS, SITE } from "@/config/site";
import { MEDIA, CREDITS, avatarFor } from "@/config/media";
import { Coin, fmt, Countdown, TierRing, Progress, Counter, TierCardMini, MerchantLogo, endOfToday, endOfWeek, endOfMonth } from "./perk-ui";

type View = "home" | "auth" | "dashboard" | "earn" | "rewards" | "reward" | "vouchers" | "scan" | "spin" | "missions" | "ledger" | "groups" | "leaderboard" | "notifications" | "profile" | "tiers" | "merchants" | "merchant" | "admin" | "blog" | "finder" | "policies";
const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const chartData = Array.from({ length: 8 }, (_, i) => ({ week: `W${i + 1}`, issued: 1200 + i * 420 + (i % 3) * 300, redeemed: 800 + i * 310 + (i % 2) * 200, members: 40 + i * 18 }));

export default function PerkPilotApp({ initialView = "home" }: { initialView?: View }) {
  const [view, setViewRaw] = useState<View>(initialView);
  const [userId, setUserId] = useState<number>(0);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: string } | null>(null);
  const [pointsFx, setPointsFx] = useState<{ pts: number; key: number } | null>(null);
  const [preloader, setPreloader] = useState(true);
  const [preloadPct, setPreloadPct] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [confirmRedeem, setConfirmRedeem] = useState<Reward | null>(null);
  const [issuedVoucher, setIssuedVoucher] = useState<any>(null);
  const [onboardStep, setOnboardStep] = useState<number>(-1);
  const [tierCelebrate, setTierCelebrate] = useState<string | null>(null);
  const prevTier = useRef<string>("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [cursor, setCursor] = useState<{ x: number; y: number; label: string } | null>(null);

  const me = data?.me;
  const setView = (v: View) => { setViewRaw(v); setMenuOpen(false); if (typeof window !== "undefined") { history.replaceState(null, "", v === "home" ? "/" : `/?view=${v}`); window.scrollTo({ top: 0 }); } };
  const say = (msg: string, kind = "ok") => { setToast({ msg, kind }); setTimeout(() => setToast(null), 4200); };
  const fireConfetti = () => { if (reduced) return; confetti({ particleCount: 110, spread: 75, origin: { y: 0.65 }, colors: ["#FFC83D", "#7C3AED", "#A275FF", "#FFD966", "#ffffff"] }); };

  const refresh = useCallback(async (uid = userId) => {
    if (!uid) return;
    const r = await fetch(`/api/state?userId=${uid}`);
    if (r.ok) { const d = await r.json(); if (prevTier.current && d.me && d.me.tier !== prevTier.current) { setTierCelebrate(d.me.tier); fireConfetti(); } if (d.me) prevTier.current = d.me.tier; setData(d); }
  }, [userId]);

  useEffect(() => {
    const id = Number(localStorage.getItem("pp_user_id") || 0);
    const params = new URLSearchParams(location.search);
    const v = params.get("view") as View | null; if (v) setViewRaw(v);
    if (params.get("ref")) { localStorage.setItem("pp_ref", params.get("ref")!); }
    if (id) { setUserId(id); fetch(`/api/state?userId=${id}`).then((r) => r.ok && r.json()).then((d) => { if (d) { prevTier.current = d.me?.tier || ""; setData(d); if (d.me && !d.me.hasOnboarded) setOnboardStep(0); } }); }
    if (sessionStorage.getItem("pp_preloaded") || reduced) { setPreloader(false); }
    else { const t = setInterval(() => setPreloadPct((p) => { if (p >= 100) { clearInterval(t); sessionStorage.setItem("pp_preloaded", "1"); setTimeout(() => setPreloader(false), 450); return 100; } return p + 7; }), 70); }
    const onMove = (e: MouseEvent) => { const el = (e.target as HTMLElement).closest?.("[data-cursor]") as HTMLElement | null; setCursor({ x: e.clientX, y: e.clientY, label: el?.dataset.cursor || "" }); };
    if (window.matchMedia("(pointer:fine)").matches && !reduced) window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(action: string, payload: any = {}, opts: { silent?: boolean } = {}) {
    if (!userId) { setView("auth"); say("Sign in to do that — demo accounts are one tap away.", "info"); return null; }
    setLoading(true);
    try {
      const r = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, action, payload }) });
      const j = await r.json();
      if (!r.ok) { say(j.error || "Something went wrong", "error"); return null; }
      if (!opts.silent && j.message) say(j.message);
      if (typeof j.points === "number" && j.points !== 0) setPointsFx({ pts: j.points, key: Date.now() });
      if (j.points > 0) fireConfetti();
      await refresh();
      return j;
    } finally { setLoading(false); }
  }
  async function doAuth(mode: string, payload: any) {
    setLoading(true);
    try {
      const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, ...payload }) });
      const j = await r.json();
      if (!r.ok) { say(j.error, "error"); return; }
      localStorage.setItem("pp_user_id", String(j.user.id)); setUserId(j.user.id); prevTier.current = j.user.tier;
      await fetch(`/api/state?userId=${j.user.id}`).then((x) => x.json()).then(setData);
      say(mode === "register" ? `Welcome aboard, ${j.user.name.split(" ")[0]}! +250 welcome points 🎉` : `Welcome back, ${j.user.name.split(" ")[0]}!`);
      if (mode === "register") setOnboardStep(0);
      setView(j.user.role === "admin" ? "admin" : j.user.role === "merchant" ? "merchant" : "dashboard");
    } finally { setLoading(false); }
  }
  const logout = () => { localStorage.removeItem("pp_user_id"); setUserId(0); setData(null); setView("home"); say("Signed out. See you soon, Pilot."); };
  const allRewards: Reward[] = useMemo(() => [...REWARDS, ...((data?.customRewards || []).map((c: any) => ({ id: `c${c.id}`, title: c.title, merchant: c.merchant, category: c.category, type: "Voucher", pointsCost: c.pointsCost, cashTopup: c.cashTopup, stock: c.stock, tierRequired: c.tierRequired, description: c.description || "Merchant-published demo reward.", terms: "Demo reward. No monetary value.", image: MEDIA.rewards.gift })))], [data]);
  const unread = (data?.notifications || []).filter((n: any) => !n.isRead).length;
  const charityImpact = (data?.vouchers || []).filter((v: any) => ["Donate", "Plant", "Community"].some((k) => v.rewardTitle.includes(k))).length;

  const navBtn = "rounded-full px-3.5 py-2 text-sm font-semibold text-[#EDE9F7] hover:bg-[#1E1435] hover:text-white transition min-h-[44px]";
  return (
    <div className="min-h-screen bg-[#0B0614] text-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-[#FFC83D] focus:px-4 focus:py-2 focus:text-[#0B0614]">Skip to content</a>
      <div aria-live="polite" className="sr-only">{me ? `Balance ${me.balance} points. Tier ${me.tier}.` : ""} {toast?.msg || ""}</div>
      {cursor && !reduced && <div aria-hidden className="pointer-events-none fixed z-[90] hidden lg:flex -translate-x-1/2 -translate-y-1/2 items-center gap-1" style={{ left: cursor.x, top: cursor.y }}><span className={`coin block rounded-full transition-all ${cursor.label ? "h-14 w-14" : "h-3.5 w-3.5"}`} />{cursor.label && <span className="rounded-full bg-[#FFC83D] px-2.5 py-1 text-xs font-bold text-[#0B0614] shadow-lg">{cursor.label}</span>}</div>}
      <AnimatePresence>{preloader && (
        <motion.div className="fixed inset-0 z-[95] grid place-items-center bg-[#0B0614]" exit={{ opacity: 0 }} role="status" aria-label="Loading PerkPilot">
          <div className="text-center">
            <motion.div initial={{ rotateY: 0, scale: 0.4 }} animate={{ rotateY: 720, scale: 1 }} transition={{ duration: 1.1 }} className="mx-auto"><Coin size={92} /></motion.div>
            <div className="font-display mt-5 text-3xl font-extrabold">Perk<span className="text-[#FFC83D]">Pilot</span></div>
            <div className="font-mono2 mt-2 text-[#A99CC4]">{Math.min(preloadPct, 100)}%</div>
            <div className="mx-auto mt-3 h-1.5 w-52 overflow-hidden rounded-full bg-[#2E2248]"><div className="h-full bg-gradient-to-r from-[#7C3AED] to-[#FFC83D]" style={{ width: `${Math.min(preloadPct, 100)}%` }} /></div>
          </div>
        </motion.div>)}
      </AnimatePresence>

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-[#2E2248] bg-[#0B0614]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 lg:px-8">
          <button onClick={() => setView("home")} className="flex items-center gap-2.5" aria-label="PerkPilot home"><Coin size={38} /><span className="font-display text-xl font-extrabold">Perk<span className="text-[#FFC83D]">Pilot</span></span><span className="hidden rounded-full border border-[#FFC83D]/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#FFC83D] sm:inline">Demo</span></button>
          <nav className="ml-4 hidden items-center lg:flex" aria-label="Primary">
            <button className={navBtn} onClick={() => setView("rewards")}>Rewards</button>
            <button className={navBtn} onClick={() => setView("earn")}>Earn</button>
            <button className={navBtn} onClick={() => setView("missions")}>Missions</button>
            <button className={navBtn} onClick={() => setView("tiers")}>Tiers</button>
            <button className={navBtn} onClick={() => setView("merchants")}>Merchants</button>
            <button className={navBtn} onClick={() => setView("blog")}>Blog</button>
            {me?.role === "merchant" && <button className={navBtn} onClick={() => setView("merchant")}>Merchant portal</button>}
            {me?.role === "admin" && <button className={navBtn} onClick={() => setView("admin")}>Admin</button>}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {me ? <>
              <div className="relative">
                <button onClick={() => setView("dashboard")} className="flex items-center gap-2 rounded-full border border-[#FFC83D]/40 bg-[#140C24] py-1.5 pl-1.5 pr-3.5 shadow-[0_0_24px_rgba(255,200,61,.15)]" aria-label={`Balance ${me.balance} points`}>
                  <motion.span key={me.balance} initial={{ rotateY: 0 }} animate={{ rotateY: 360 }} transition={{ duration: 0.6 }}><Coin size={28} /></motion.span>
                  <span className="font-mono2 text-sm font-bold text-[#FFC83D] tabular">{fmt(me.balance)}</span><span className="hidden text-xs text-[#A99CC4] sm:inline">pts</span>
                </button>
                <AnimatePresence>{pointsFx && <motion.span key={pointsFx.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: -18 }} exit={{ opacity: 0 }} onAnimationComplete={() => setPointsFx(null)} className={`absolute -top-2 right-0 font-mono2 text-sm font-bold ${pointsFx.pts > 0 ? "text-[#FFC83D]" : "text-[#A275FF]"}`}>{pointsFx.pts > 0 ? "+" : ""}{pointsFx.pts}</motion.span>}</AnimatePresence>
              </div>
              <button onClick={() => setView("notifications")} className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-[#1E1435]" aria-label={`Notifications, ${unread} unread`}><Bell size={20} />{unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#FFC83D] px-1 text-[11px] font-bold text-[#0B0614]">{unread}</span>}</button>
              <button onClick={() => setView("profile")} aria-label="Your profile"><img src={avatarFor(me.name)} alt="" className="h-11 w-11 rounded-full border-2 border-[#7C3AED]" width={44} height={44} /></button>
              <button onClick={logout} className="hidden h-11 w-11 place-items-center rounded-full hover:bg-[#1E1435] sm:grid" aria-label="Sign out"><LogOut size={18} /></button>
            </> : <>
              <button onClick={() => { setAuthMode("login"); setView("auth"); }} className={navBtn}>Log in</button>
              <button onClick={() => { setAuthMode("register"); setView("auth"); }} className="min-h-[44px] rounded-full bg-[#FFC83D] px-5 font-bold text-[#0B0614] shadow-[0_8px_24px_rgba(255,200,61,.35)] hover:bg-[#FFD966]">Join free — +250 pts</button>
            </>}
            <button className="grid h-11 w-11 place-items-center rounded-full hover:bg-[#1E1435] lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu /></button>
          </div>
        </div>
        {me && <div className="border-t border-[#2E2248] bg-[#140C24] px-4 py-1.5 text-center text-xs text-[#C9B3FF] sm:hidden"><Flame className="mr-1 inline text-[#FF7A45]" size={14} /> {me.streak}-day streak · <span className="text-[#FFC83D] font-mono2">{fmt(me.balance)} pts</span> · {me.tier} tier</div>}
      </header>
      <AnimatePresence>{menuOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-[#0B0614] p-6 lg:hidden" role="dialog" aria-label="Menu">
          <button className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-[#1E1435]" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X /></button>
          <div className="mt-16 flex flex-col gap-1">
            {(["home", "dashboard", "earn", "rewards", "missions", "spin", "vouchers", "ledger", "groups", "leaderboard", "tiers", "merchants", "blog", "profile"] as View[]).map((v) => <button key={v} onClick={() => setView(v)} className="font-display rounded-2xl px-4 py-3 text-left text-3xl font-extrabold capitalize hover:bg-[#140C24] hover:text-[#FFC83D]">{v}</button>)}
            {(me?.role === "merchant" || me?.role === "admin") && <button onClick={() => setView(me.role === "admin" ? "admin" : "merchant")} className="font-display rounded-2xl px-4 py-3 text-left text-3xl font-extrabold text-[#FFC83D]">{me.role === "admin" ? "Admin" : "Merchant portal"}</button>}
          </div>
        </motion.div>)}
      </AnimatePresence>

      <main id="main">
        <AnimatePresence mode="wait"><motion.div key={view} initial={{ opacity: 0, y: reduced ? 0 : 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          {view === "home" && <HomeView go={setView} me={me} rewards={allRewards} openReward={(r) => { setSelectedReward(r); setView("reward"); }} />}
          {view === "auth" && <AuthView mode={authMode} setMode={setAuthMode} doAuth={doAuth} loading={loading} />}
          {view === "dashboard" && (me ? <Dashboard data={data} act={act} go={setView} loading={loading} /> : <NeedAuth go={setView} />)}
          {view === "earn" && (me ? <EarnView data={data} act={act} go={setView} loading={loading} say={say} /> : <NeedAuth go={setView} />)}
          {view === "rewards" && <RewardsView rewards={allRewards} me={me} open={(r) => { setSelectedReward(r); setView("reward"); }} />}
          {view === "reward" && selectedReward && <RewardDetail r={selectedReward} me={me} back={() => setView("rewards")} redeem={() => me ? setConfirmRedeem(selectedReward) : setView("auth")} />}
          {view === "vouchers" && (me ? <VouchersView data={data} go={setView} /> : <NeedAuth go={setView} />)}
          {view === "scan" && <ScanView act={act} me={me} />}
          {view === "spin" && (me ? <SpinView me={me} act={act} go={setView} /> : <NeedAuth go={setView} />)}
          {view === "missions" && (me ? <MissionsView data={data} act={act} loading={loading} /> : <NeedAuth go={setView} />)}
          {view === "ledger" && (me ? <LedgerView data={data} /> : <NeedAuth go={setView} />)}
          {view === "groups" && (me ? <GroupsView data={data} act={act} me={me} /> : <NeedAuth go={setView} />)}
          {view === "leaderboard" && <LeaderboardView data={data} me={me} />}
          {view === "notifications" && (me ? <NotificationsView data={data} act={act} go={setView} /> : <NeedAuth go={setView} />)}
          {view === "profile" && (me ? <ProfileView data={data} me={me} act={act} go={setView} charityImpact={charityImpact} /> : <NeedAuth go={setView} />)}
          {view === "tiers" && <TiersView me={me} go={setView} />}
          {view === "merchants" && <MerchantsView go={setView} rewards={allRewards} />}
          {view === "merchant" && (me && (me.role === "merchant" || me.role === "admin") ? <MerchantPortal data={data} act={act} me={me} /> : <NeedAuth go={setView} role="merchant" />)}
          {view === "admin" && (me?.role === "admin" ? <AdminView data={data} act={act} /> : <NeedAuth go={setView} role="admin" />)}
          {view === "blog" && <BlogView />}
          {view === "finder" && <FinderView rewards={allRewards} open={(r) => { setSelectedReward(r); setView("reward"); }} />}
          {view === "policies" && <PoliciesView />}
        </motion.div></AnimatePresence>
      </main>

      <Footer go={setView} />
      {me && <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-[#2E2248] bg-[#0B0614]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Mobile">
        {([["dashboard", Home, "Home"], ["earn", Coins, "Earn"], ["rewards", Gift, "Rewards"], ["missions", Target, "Missions"], ["profile", User, "Profile"]] as const).map(([v, Icon, label]) => (
          <button key={v} onClick={() => setView(v as View)} className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${view === v ? "text-[#FFC83D]" : "text-[#A99CC4]"}`}><Icon size={21} />{label}</button>))}
      </nav>}
      <div className="h-16 lg:hidden" />

      {/* Redeem confirm */}
      <AnimatePresence>{confirmRedeem && me && <RedeemSheet r={confirmRedeem} me={me} close={() => setConfirmRedeem(null)} loading={loading} confirm={async (pointsOnly: boolean) => { const j = await act("redeem", { rewardId: confirmRedeem.id, pointsOnly, idempotencyKey: `redeem-${me.id}-${confirmRedeem.id}-${Date.now()}` }); if (j?.voucher) { setConfirmRedeem(null); setIssuedVoucher(j.voucher); } }} />}</AnimatePresence>
      <AnimatePresence>{issuedVoucher && <IssuedTicket v={issuedVoucher} close={() => { setIssuedVoucher(null); setView("vouchers"); }} />}</AnimatePresence>
      <AnimatePresence>{onboardStep >= 0 && <Onboarding step={onboardStep} setStep={setOnboardStep} done={async () => { setOnboardStep(-1); await act("onboard", {}, { silent: true }); setView("dashboard"); }} />}</AnimatePresence>
      <AnimatePresence>{tierCelebrate && me && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] grid place-items-center bg-[#0B0614]/95 p-4" role="dialog" aria-label="Tier up celebration">
          <div className="w-full max-w-md text-center">
            <motion.div initial={{ rotateY: 180, scale: 0.7 }} animate={{ rotateY: 0, scale: 1 }} transition={{ type: "spring", stiffness: 90 }}><TierCardMini name={tierCelebrate} color={TIERS.find((t) => t.name === tierCelebrate)?.color || "#FFC83D"} member={me.name} tierIdx={TIERS.findIndex((t) => t.name === tierCelebrate)} /></motion.div>
            <h2 className="font-display mt-6 text-4xl font-extrabold">You reached <span className="text-[#FFC83D]">{tierCelebrate}</span>! 🎉</h2>
            <ul className="mx-auto mt-4 max-w-xs space-y-1.5 text-left text-[#EDE9F7]">{TIERS.find((t) => t.name === tierCelebrate)?.perks.map((p) => <li key={p} className="flex gap-2"><BadgeCheck className="mt-0.5 text-[#FFC83D]" size={17} />{p}</li>)}</ul>
            <button onClick={() => setTierCelebrate(null)} className="mt-6 min-h-[48px] rounded-full bg-[#FFC83D] px-8 font-bold text-[#0B0614]">Keep flying →</button>
            <button onClick={() => setTierCelebrate(null)} className="ml-3 text-sm text-[#A99CC4] underline">Skip</button>
          </div>
        </motion.div>)}
      </AnimatePresence>
      <AnimatePresence>{toast && <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className={`fixed bottom-24 left-1/2 z-[85] w-[min(92vw,520px)] -translate-x-1/2 rounded-2xl border px-5 py-3.5 text-center font-semibold shadow-2xl lg:bottom-8 ${toast.kind === "error" ? "border-[#F04438] bg-[#2A0E1C] text-[#FFD3CF]" : "border-[#FFC83D]/50 bg-[#1E1435] text-white"}`} role="status">{toast.msg}</motion.div>}</AnimatePresence>
      {loading && <div className="fixed right-4 top-24 z-[85] flex items-center gap-2 rounded-full bg-[#1E1435] px-4 py-2 text-sm shadow-xl"><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFC83D] border-t-transparent" /> Working…</div>}
    </div>
  );
}

/* ---------- shared UI ---------- */
const btnGold = "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#FFC83D] px-6 font-bold text-[#0B0614] shadow-[0_10px_28px_rgba(255,200,61,.30)] transition hover:bg-[#FFD966] disabled:opacity-50";
const btnViolet = "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#7C3AED] px-6 font-bold text-white shadow-[0_10px_28px_rgba(124,58,237,.35)] transition hover:bg-[#A275FF] disabled:opacity-50";
const inputCls = "w-full rounded-[10px] border border-[#E0D6EE] bg-white px-3.5 text-[#0B0614] placeholder:text-[#5F5478]";
const inputDark = "w-full rounded-[10px] border border-[#2E2248] bg-[#140C24] px-3.5 text-white placeholder:text-[#A99CC4]";
const cardL = "rounded-[18px] bg-white p-5 shadow-[0_10px_36px_rgba(76,29,149,.10)]";
const cardD = "rounded-[18px] border border-[#2E2248] bg-[#140C24] p-5";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-[#5F5478]";
const labelD = "mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-[#A99CC4]";
function NeedAuth({ go, role }: { go: (v: View) => void; role?: string }) {
  return <section className="mx-auto max-w-xl px-4 py-24 text-center"><Coin size={72} /><h1 className="font-display mt-5 text-4xl font-extrabold">{role ? `${role === "admin" ? "Admin" : "Merchant"} account needed` : "Sign in, Pilot"}</h1><p className="mt-3 text-[#A99CC4]">This area lives behind sign-in. Use a one-tap demo account — no card, no real data, no monetary value. Ever.</p><button className={`${btnGold} mt-6`} onClick={() => go("auth")}>Sign in / Join free</button></section>;
}
function Empty({ icon, title, body, cta }: { icon: string; title: string; body: string; cta?: React.ReactNode }) {
  return <div className="rounded-[18px] border-2 border-dashed border-[#E0D6EE] bg-[#F7F3FC] p-8 text-center text-[#0B0614]"><div className="text-4xl" aria-hidden>{icon}</div><h3 className="font-display mt-2 text-xl font-bold">{title}</h3><p className="mx-auto mt-1 max-w-sm text-[#5F5478]">{body}</p>{cta && <div className="mt-4">{cta}</div>}</div>;
}
function LightWrap({ title, sub, children, kicker }: { title: string; sub?: string; children: React.ReactNode; kicker?: string }) {
  return <section className="light-zone diag bg-[#F7F3FC] pb-20 pt-16 text-[#0B0614]"><div className="mx-auto max-w-7xl px-4 lg:px-8">{kicker && <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#A86F00]">{kicker}</p>}<h1 className="font-display mt-1 text-4xl font-extrabold sm:text-5xl">{title}</h1>{sub && <p className="mt-2 max-w-2xl text-[#5F5478]">{sub}</p>}<div className="mt-8">{children}</div></div></section>;
}

/* ---------- HOME ---------- */
function HomeView({ go, me, rewards, openReward }: { go: (v: View) => void; me: any; rewards: Reward[]; openReward: (r: Reward) => void }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const headline = "EVERY SPEND EARNS ITS WINGS.";
  return (
    <div>
      <section className="starfield rays relative overflow-hidden" onMouseMove={(e) => { if (!reduced) { const r = e.currentTarget.getBoundingClientRect(); setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 14, y: -((e.clientY - r.top) / r.height - 0.5) * 10 }); } }}>
        <div className="pointer-events-none absolute left-1/2 top-24 h-96 w-96 -translate-x-1/2 rounded-full bg-[#7C3AED]/35 blur-[110px]" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-20 pt-14 lg:grid-cols-2 lg:px-8 lg:pt-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#FFC83D]">PerkPilot · Loyalty, but joyful · Demo</p>
            <h1 className="font-display mt-4 text-[clamp(2.6rem,7.5vw,5.6rem)] font-extrabold leading-[0.98]">{headline.split(" ").map((w, i) => <span key={i} className="inline-block overflow-hidden pb-1"><motion.span className={`inline-block ${["WINGS."].includes(w) ? "text-[#FFC83D]" : ""}`} initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ delay: 0.08 * i, type: "spring", stiffness: 120 }}>{w}&nbsp;</motion.span></span>)}</h1>
            <p className="mt-5 max-w-xl text-lg text-[#CFC4E8]">Earn points at 25 fictional partner merchants, on receipts, streaks, missions & surveys. Climb <b className="text-white">Spark → Glow → Blaze → Nova</b> and redeem vouchers, experiences and charity gifts. Free forever in this demo — points have no monetary value, and we say so everywhere.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button className={btnGold} onClick={() => go(me ? "dashboard" : "auth")}>{me ? "Open my dashboard" : "Join free — get 250 pts"} <ChevronRight size={18} /></button>
              <button className={btnViolet} onClick={() => go("rewards")}>Browse 40 rewards</button>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {["Earn on every purchase", "Streaks that pay", "Redeem anywhere", "Honest odds, always"].map((c, i) => <motion.span key={c} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + i * 0.12, type: "spring" }} className="rounded-full border border-[#2E2248] bg-[#140C24] px-3.5 py-2 text-sm font-semibold"><span className="mr-1.5 text-[#FFC83D]">✦</span>{c}</motion.span>)}
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-4 text-center sm:text-left">
              {([[12840, "demo members"], [2400000, "demo pts earned"], [96400, "demo rewards claimed"]] as const).map(([n, l]) => <div key={l}><dt className="sr-only">{l}</dt><dd className="font-mono2 text-2xl font-bold text-[#FFC83D] sm:text-3xl"><Counter to={n} suffix="+" /></dd><dd className="text-xs uppercase tracking-widest text-[#A99CC4]">{l}*</dd></div>)}
            </dl>
            <p className="mt-2 text-[11px] text-[#A99CC4]">*Demo statistics for illustration — fictional platform data.</p>
          </div>
          <div className="relative mx-auto w-full max-w-[520px]" style={{ perspective: 1100 }}>
            <motion.div animate={{ rotateY: tilt.x, rotateX: tilt.y }} transition={{ type: "spring", stiffness: 60, damping: 16 }} className="relative" aria-label="Fan of PerkPilot tier cards: Spark, Glow, Blaze and Nova" role="img">
              <div className="absolute inset-x-8 top-6 rotate-[-9deg] opacity-80"><TierCardMini name="Spark" color="#2EE6A6" member="Future You" tierIdx={0} /></div>
              <div className="absolute inset-x-4 top-3 rotate-[5deg] opacity-90"><TierCardMini name="Glow" color="#6EC1FF" member="Future You" tierIdx={1} /></div>
              <div className="relative mt-24"><TierCardMini name="Nova" color="#FFC83D" member={me?.name || "Future You"} tierIdx={3} /></div>
              <span className="floaty absolute -left-2 top-16"><Coin size={46} /></span><span className="floaty absolute -right-2 top-40" style={{ animationDelay: "1.2s" }}><Coin size={34} /></span><span className="floaty absolute bottom-2 left-10" style={{ animationDelay: "2s" }}><Coin size={26} /></span>
            </motion.div>
            <div className="mt-6 overflow-hidden rounded-[18px] border border-[#2E2248]"><img src={MEDIA.home.shoppingFriends} alt="Friends laughing with shopping gift bags outside a café (demo photograph)" className="h-44 w-full object-cover" loading="lazy" /></div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#2E2248] bg-[#140C24] py-14" aria-label="How it works">
        <div className="mx-auto max-w-7xl px-4 lg:px-8"><h2 className="font-display text-center text-3xl font-extrabold sm:text-4xl">One coin, four stops 🪙</h2>
          <div className="relative mt-10 grid gap-6 sm:grid-cols-4">{([["1 · Earn", "Partner checkouts, receipts, check-ins, missions, surveys & referrals.", "earn"], ["2 · Level up", "Qualifying points in a rolling 12 months climb Spark → Nova with multipliers.", "tiers"], ["3 · Unlock", "Tier-locked rewards, bonus days, members-only drops & streak freezes.", "missions"], ["4 · Redeem", "Tickets with QR codes, charity gifts and family-pooled goals.", "rewards"]] as const).map(([t, b, v], i) => (
            <motion.button key={t} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }} onClick={() => go(v as View)} className={`${cardD} tilt text-left`}><Coin size={40} label={String(i + 1)} /><h3 className="font-display mt-3 text-xl font-bold text-[#FFC83D]">{t}</h3><p className="mt-1 text-sm text-[#CFC4E8]">{b}</p></motion.button>))}
          </div>
        </div>
      </section>

      <section className="light-zone diag bg-white py-16 text-[#0B0614]" aria-label="Featured rewards">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.28em] text-[#A86F00]">Featured · demo rewards</p><h2 className="font-display mt-1 text-3xl font-extrabold sm:text-4xl">Tickets worth flying for</h2></div><button onClick={() => go("rewards")} className="font-bold text-[#4C1D95] underline underline-offset-4">See all 40 →</button></div>
          <div className="no-scrollbar -mx-4 mt-7 flex snap-x gap-5 overflow-x-auto px-4 pb-2">{rewards.slice(0, 8).map((r) => <div key={r.id} className="w-[300px] shrink-0 snap-start"><RewardCard r={r} me={me} open={openReward} /></div>)}</div>
        </div>
      </section>

      <section className="py-16" aria-label="Tiers showcase"><div className="mx-auto max-w-7xl px-4 lg:px-8">
        <h2 className="font-display text-center text-3xl font-extrabold sm:text-4xl">Four tiers. Zero fine-print fog.</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{TIERS.map((t, i) => <motion.div key={t.name} whileHover={{ y: reduced ? 0 : -6 }} className="space-y-3"><TierCardMini name={t.name} color={t.color} member="PerkPilot Member" tierIdx={i} /><p className="text-center text-sm text-[#CFC4E8]">{t.multiplier}× earn · from <span className="font-mono2 text-[#FFC83D]">{fmt(t.threshold)}</span> qualifying pts / 12 mo</p></motion.div>)}</div>
        <div className="mt-8 text-center"><button className={btnViolet} onClick={() => go("tiers")}>Compare tiers & perks</button></div>
      </div></section>

      <section className="light-zone bg-[#F7F3FC] py-16 text-[#0B0614]" aria-label="Ways to earn">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 lg:grid-cols-2 lg:px-8">
          <img src={MEDIA.home.confetti} alt="Friends celebrating with confetti at a party (demo photograph)" className="h-80 w-full rounded-[18px] object-cover shadow-xl" loading="lazy" />
          <div><p className="text-xs font-bold uppercase tracking-[0.28em] text-[#A86F00]">Ways to earn</p><h2 className="font-display mt-1 text-3xl font-extrabold sm:text-4xl">Points for the life you already live</h2>
            <ul className="mt-5 space-y-3">{[["🛍️ Partner purchases", "5–14 pts per $1 at 25 fictional merchants, boosted by tier & campaigns."], ["🧾 Receipts", "Snap or link a receipt; a mock review queue approves it (fraud-checked by hash)."], ["🔥 Daily streaks", "Check in daily, unlock milestone chests, protect slips with streak freezes."], ["🎡 One free spin a day", "Open odds on the page. No buying spins. Break mode available anytime."], ["👨‍👩‍👧 Family pooling", "Pool toward one shared reward with full contribution history."]].map(([t, b]) => <li key={t} className="flex gap-3"><span aria-hidden>{t.split(" ")[0]}</span><span><b>{t.slice(t.indexOf(" ") + 1)}:</b> <span className="text-[#5F5478]">{b}</span></span></li>)}</ul>
            <button className={`${btnGold} mt-6`} onClick={() => go(me ? "earn" : "auth")}>Start earning</button>
            <button className="ml-2 font-bold text-[#4C1D95] underline underline-offset-4" onClick={() => go("finder")}>Take the Reward Finder quiz →</button>
          </div>
        </div>
      </section>

      <section className="py-16" aria-label="Partner merchants"><div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex items-end justify-between"><h2 className="font-display text-3xl font-extrabold">25 fictional partners</h2><button className="font-bold text-[#FFC83D] underline underline-offset-4" onClick={() => go("merchants")}>All merchants →</button></div>
        <div className="no-scrollbar -mx-4 mt-6 flex gap-4 overflow-x-auto px-4 pb-2">{MERCHANTS.map((m) => <button key={m.slug} onClick={() => go("merchants")} className={`${cardD} w-56 shrink-0 text-left`}><MerchantLogo {...m} /><div className="font-display mt-3 font-bold leading-tight">{m.name}</div><div className="mt-1 text-xs text-[#A99CC4]">{m.category}</div><div className="font-mono2 mt-2 text-sm text-[#FFC83D]">{m.earnRate} pts / $1</div></button>)}</div>
      </div></section>

      <section className="border-t border-[#2E2248] bg-[#140C24] py-16 text-center">
        <h2 className="font-display mx-auto max-w-2xl px-4 text-3xl font-extrabold sm:text-5xl">Your first <span className="text-[#FFC83D]">250 points</span> are on the runway.</h2>
        <button className={`${btnGold} mt-7`} onClick={() => go(me ? "earn" : "auth")}>Take off — it&apos;s a free demo</button>
        <p className="mx-auto mt-4 max-w-xl px-4 text-sm text-[#A99CC4]">{SITE.demoDisclaimer}</p>
      </section>
    </div>
  );
}

/* ---------- AUTH ---------- */
function AuthView({ mode, setMode, doAuth, loading }: { mode: "login" | "register"; setMode: (m: "login" | "register") => void; doAuth: (m: string, p: any) => void; loading: boolean }) {
  const [f, setF] = useState({ name: "", email: "", password: "", referralCode: typeof window !== "undefined" ? localStorage.getItem("pp_ref") || "" : "", birthday: "", displayName: "" });
  const demo = [["Maya — Nova member", "maya@demo.perkpilot"], ["Sam — 14-day streak", "sam@demo.perkpilot"], ["Leo — Glow member", "leo@demo.perkpilot"], ["Ana — new Spark member", "ana@demo.perkpilot"], ["Vera — Merchant", "merchant@demo.perkpilot"], ["Ada — Admin", "admin@demo.perkpilot"]];
  return (
    <section className="light-zone diag bg-[#F7F3FC] py-16 text-[#0B0614]"><div className="mx-auto grid max-w-6xl gap-8 px-4 lg:grid-cols-2">
      <div><p className="text-xs font-bold uppercase tracking-[0.28em] text-[#A86F00]">Welcome aboard</p><h1 className="font-display mt-1 text-4xl font-extrabold sm:text-5xl">{mode === "login" ? "Welcome back, Pilot" : "Join & pocket 250 pts"}</h1>
        <p className="mt-3 text-[#5F5478]">Demo accounts below use password <code className="font-mono2 rounded bg-[#EDE5F8] px-2 py-0.5">demo1234</code>. New accounts get a welcome bonus + 30-second tour. Have a friend&apos;s code? Add it at sign-up — you both earn after your first qualifying earn.</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">{demo.map(([label, email]) => <button key={email} disabled={loading} onClick={() => doAuth("login", { email, password: "demo1234" })} className="flex min-h-[52px] items-center justify-between rounded-[14px] bg-white px-4 text-left font-semibold shadow hover:shadow-lg disabled:opacity-50">{label}<ChevronRight size={17} className="text-[#7C3AED]" /></button>)}</div>
        <img src={MEDIA.home.birthday} alt="Friends celebrating a birthday with balloons (demo photograph)" className="mt-6 h-48 w-full rounded-[18px] object-cover" loading="lazy" />
      </div>
      <form className={`${cardL} h-fit`} onSubmit={(e) => { e.preventDefault(); doAuth(mode, f); }} aria-label={mode === "login" ? "Log in form" : "Register form"}>
        <div className="grid grid-cols-2 rounded-full bg-[#F1EAFF] p-1">{(["login", "register"] as const).map((m) => <button type="button" key={m} onClick={() => setMode(m)} className={`min-h-[44px] rounded-full font-bold capitalize ${mode === m ? "bg-[#7C3AED] text-white" : "text-[#4C1D95]"}`}>{m === "login" ? "Log in" : "Sign up"}</button>)}</div>
        <div className="mt-5 space-y-4">
          {mode === "register" && <><div><label className={labelCls} htmlFor="a-name">Full name</label><input id="a-name" required className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Jordan Miles" /></div>
            <div><label className={labelCls} htmlFor="a-dn">Public display name (leaderboards)</label><input id="a-dn" className={inputCls} value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} placeholder="e.g. CoinPilot_J" /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><label className={labelCls} htmlFor="a-bd">Birthday (bonus day!)</label><input id="a-bd" type="date" className={inputCls} value={f.birthday} onChange={(e) => setF({ ...f, birthday: e.target.value })} /></div>
            <div><label className={labelCls} htmlFor="a-ref">Friend&apos;s referral code</label><input id="a-ref" className={inputCls} value={f.referralCode} onChange={(e) => setF({ ...f, referralCode: e.target.value })} placeholder="Optional" /></div></div></>}
          <div><label className={labelCls} htmlFor="a-email">Email</label><input id="a-email" type="email" required className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@example.com" /></div>
          <div><label className={labelCls} htmlFor="a-pw">Password</label><input id="a-pw" type="password" required minLength={6} className={inputCls} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="6+ characters" /></div>
          <button className={`${btnGold} w-full`} disabled={loading}>{mode === "login" ? "Log in" : "Create account & claim 250 pts"}</button>
          <p className="text-center text-xs text-[#5F5478]">Passwords are hashed server-side. This is a demo — never reuse a real password. Google sign-in can be added via Auth.js (see README).</p>
        </div>
      </form>
    </div></section>
  );
}

/* ---------- DASHBOARD ---------- */
function Dashboard({ data, act, go, loading }: { data: any; act: any; go: (v: View) => void; loading: boolean }) {
  const me = data.me; const checkedToday = me.lastCheckin === new Date().toISOString().slice(0, 10);
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(Date.now() - (6 - i) * 864e5); return { label: d.toLocaleDateString("en", { weekday: "narrow" }), day: d.getDate(), iso: d.toISOString().slice(0, 10), done: (data.checkins || []).some((c: any) => c.day === d.toISOString().slice(0, 10)) }; });
  const activeMissions = MISSIONS.slice(0, 3).map((m) => ({ m, p: (data.missionProgress || []).find((x: any) => x.missionId === m.id) }));
  return (
    <div>
      <section className="starfield relative overflow-hidden py-12"><div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
          <div><p className="text-xs font-bold uppercase tracking-[0.28em] text-[#FFC83D]">Member since {new Date(me.memberSince).toLocaleDateString()}</p>
            <h1 className="font-display mt-1 text-4xl font-extrabold sm:text-5xl">Hi, {me.name.split(" ")[0]} 👋</h1>
            <div className="mt-5 flex items-end gap-3"><Coin size={52} /><div><div className="font-mono2 text-5xl font-bold text-[#FFC83D] tabular">{fmt(me.balance)}</div><div className="text-sm text-[#A99CC4]">points ≈ ${(me.balance * 0.01).toFixed(2)} demo value (100 pts = $1)</div></div></div>
            <div className="mt-5 grid max-w-md grid-cols-3 gap-3">
              <div className={cardD}><div className="text-[11px] uppercase tracking-widest text-[#A99CC4]">Lifetime</div><div className="font-mono2 mt-1 font-bold tabular">{fmt(me.lifetime)}</div></div>
              <div className={cardD}><div className="text-[11px] uppercase tracking-widest text-[#A99CC4]">Qualifying (12mo)</div><div className="font-mono2 mt-1 font-bold tabular">{fmt(me.qualifying)}</div></div>
              <div className={cardD}><div className="text-[11px] uppercase tracking-widest text-[#F5A524]">Expiring ≤30d</div><div className="font-mono2 mt-1 font-bold text-[#FFC83D] tabular">{fmt(me.expiringSoon)}</div></div>
            </div>
            {me.nextTier ? <p className="mt-4 text-[#CFC4E8]"><span className="font-mono2 font-bold text-[#FFC83D]">{fmt(me.toNext)}</span> qualifying pts to <b className="text-white">{me.nextTier}</b> · rolling 12-month window · 60-day grace if you dip.</p> : <p className="mt-4 text-[#FFC83D]">👑 Top tier — Nova. Keep earning to stay shining (60-day grace protects you).</p>}
          </div>
          <TierRing pct={me.tierProgress} tier={me.tier} color={me.tierColor} />
          <div className="w-full max-w-sm justify-self-end"><TierCardMini name={me.tier} color={me.tierColor} member={me.name} tierIdx={TIERS.findIndex((t) => t.name === me.tier)} />
            <p className="mt-2 text-center text-xs text-[#A99CC4]">Your wallet-style member card · {me.multiplier}× earn multiplier · code {me.referralCode}</p></div>
        </div>
      </div></section>

      <section className="light-zone diag bg-[#F7F3FC] py-12 text-[#0B0614]"><div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={cardL}>
            <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Daily check-in</h2><span className="flex items-center gap-1 font-bold"><span className="flame text-2xl" aria-hidden>🔥</span><span className="font-mono2">{me.streak}</span> day{me.streak === 1 ? "" : "s"}</span></div>
            <div className="mt-4 grid grid-cols-7 gap-1.5" aria-label="Last 7 days check-in calendar">{weekDays.map((d) => <div key={d.iso} className={`rounded-xl py-2 text-center ${d.done ? "bg-[#7C3AED] text-white" : "bg-[#F1EAFF] text-[#5F5478]"}`}><div className="text-[10px] font-bold">{d.label}</div><div className="font-mono2 text-sm">{d.day}</div>{d.done && <Check size={13} className="mx-auto text-[#FFC83D]" />}</div>)}</div>
            <p className="mt-3 text-sm text-[#5F5478]">🧊 Streak freezes: <b className="text-[#0B0614]">{me.streakFreezes}</b> — auto-used if you miss one day. No shame, life happens. Milestones every 3 & 7 days unlock bonus chests.</p>
            <button className={`${btnGold} mt-4 w-full`} disabled={loading || checkedToday} onClick={() => act("checkin")}>{checkedToday ? "✅ Checked in today — see you tomorrow" : <><CalendarCheck size={19} /> Stamp today&apos;s check-in</>}</button>
            <button className="mt-3 w-full font-bold text-[#4C1D95] underline underline-offset-4" onClick={() => act("birthday_bonus")}>Claim birthday / anniversary bonus 🎂</button>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className={cardL}>
            <h2 className="font-display text-xl font-bold">Quick earn</h2>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {([["Partner checkout", "earn"], ["Upload receipt", "earn"], ["Lucky Spin (1/day)", "spin"], ["Surveys", "earn"], ["Missions", "missions"], ["Refer friends", "earn"]] as const).map(([t, v]) => <button key={t} onClick={() => go(v as View)} className="min-h-[52px] rounded-2xl bg-[#F1EAFF] px-3 text-left font-semibold hover:bg-[#EDE5F8]">{t} <ChevronRight size={15} className="inline text-[#7C3AED]" /></button>)}
            </div>
            <h3 className="font-display mt-5 font-bold">Mission progress</h3>
            <div className="mt-2 space-y-3">{activeMissions.map(({ m, p }) => <div key={m.id}><div className="flex justify-between text-sm"><span>{m.title}</span><span className="font-mono2 text-[#5F5478]">{Math.min(p?.progress || 0, m.target)}/{m.target}</span></div><Progress value={p?.progress || 0} max={m.target} label={m.title} /></div>)}</div>
            <button className="mt-4 font-bold text-[#4C1D95] underline underline-offset-4" onClick={() => go("missions")}>All missions →</button>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className={cardL}>
            <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Recent activity</h2><button className="text-sm font-bold text-[#4C1D95] underline" onClick={() => go("ledger")}>Full ledger</button></div>
            <ul className="mt-3 divide-y divide-[#EDE5F8]">{(data.ledger || []).slice(0, 6).map((l: any) => <li key={l.id} className="flex items-center gap-3 py-2.5"><Coin size={26} label={l.amount > 0 ? "+" : "−"} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{l.description}</div><div className="text-xs text-[#5F5478]">{new Date(l.createdAt).toLocaleDateString()}</div></div><span className={`font-mono2 text-sm font-bold ${l.amount > 0 ? "text-[#A86F00]" : "text-[#4C1D95]"}`}>{l.amount > 0 ? "+" : ""}{fmt(l.amount)}</span></li>)}</ul>
            {(data.ledger || []).length === 0 && <p className="py-4 text-[#5F5478]">No activity yet — your first earn will sparkle here.</p>}
          </motion.div>
        </div>
      </div></section>
    </div>
  );
}

/* ---------- EARN ---------- */
function EarnView({ data, act, go, loading, say }: { data: any; act: any; go: (v: View) => void; loading: boolean; say: any }) {
  const me = data.me;
  const [merchantSlug, setMerchantSlug] = useState("violet-bean"); const [amount, setAmount] = useState(24);
  const [rec, setRec] = useState({ merchant: "Harvest Halo Grocery", amount: 36, imageUrl: "" });
  const [activeSurvey, setActiveSurvey] = useState<any>(null); const [answers, setAnswers] = useState<any>({});
  const [refs, setRefs] = useState<any[]>([]);
  const m = MERCHANTS.find((x) => x.slug === merchantSlug)!;
  const est = Math.round(amount * m.earnRate * (me.multiplier || 1));
  const refLink = typeof window !== "undefined" ? `${location.origin}/?view=auth&ref=${me.referralCode}` : "";
  useEffect(() => { act("referral_info", {}, { silent: true }).then((j: any) => j && setRefs(j.referrals || [])); /* eslint-disable-next-line */ }, []);
  const onFile = (file: File) => { const r = new FileReader(); r.onload = () => setRec((s) => ({ ...s, imageUrl: String(r.result) })); r.readAsDataURL(file); say("Receipt image attached (stored as demo data URL)."); };
  const doneSurveys = new Set((data.ledger || []).filter((l: any) => l.source === "survey").map((l: any) => l.description));
  return (
    <LightWrap title="Earn points, every way" kicker="Earn hub" sub="Every method is capped server-side for fairness, written to your immutable ledger, and labelled demo. Server decides the points — never the browser.">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className={cardL}>
          <h2 className="font-display flex items-center gap-2 text-2xl font-bold"><Store className="text-[#7C3AED]" /> Partner checkout <span className="rounded-full bg-[#FFF4D6] px-2 py-0.5 text-[11px] font-bold text-[#A86F00]">SIMULATED POS</span></h2>
          <p className="mt-1 text-sm text-[#5F5478]">Simulates a real point-of-sale call through our <code className="font-mono2">MerchantAdapter.verifyPurchase()</code> — swap in a real POS later without touching this page.</p>
          <div className="mt-4 space-y-4">
            <div><label className={labelCls} htmlFor="e-merchant">Merchant</label><select id="e-merchant" className={inputCls} value={merchantSlug} onChange={(e) => setMerchantSlug(e.target.value)}>{MERCHANTS.map((x) => <option key={x.slug} value={x.slug}>{x.name} — {x.earnRate} pts/$1 ({x.category})</option>)}</select></div>
            <div><label className={labelCls} htmlFor="e-amount">Basket total ($)</label><input id="e-amount" type="number" min={1} max={2000} className={inputCls} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
            <div className="rounded-2xl bg-[#F7F3FC] p-4 text-sm"><div className="flex justify-between"><span>Basket × rate × your {me.tier} multiplier</span><span className="font-mono2">${amount} × {m.earnRate} × {me.multiplier}</span></div><div className="mt-1 flex justify-between font-bold"><span>You&apos;ll earn</span><span className="font-mono2 text-[#A86F00]">≈ {fmt(est)} pts</span></div><p className="mt-1 text-xs text-[#5F5478]">Live campaigns may multiply this further — exact total confirmed after checkout. Cap: 2,000 purchase pts/day.</p></div>
            <div className="flex flex-wrap gap-2"><button className={btnGold} disabled={loading} onClick={() => act("purchase", { merchantSlug, amount, idempotencyKey: `purchase-${me.id}-${Date.now()}` })}>Pay ${amount} (demo) & earn</button>
            <button className="min-h-[48px] rounded-full border border-[#E0D6EE] px-5 font-bold" disabled={loading} onClick={() => act("refund-demo")}>Refund last purchase (clawback demo)</button></div>
          </div>
        </div>
        <div className={cardL}>
          <h2 className="font-display flex items-center gap-2 text-2xl font-bold"><Receipt className="text-[#7C3AED]" /> Receipt upload</h2>
          <p className="mt-1 text-sm text-[#5F5478]">Mock verification queue: a merchant/admin demo account approves it. Duplicate images are caught by hashing. Max 5/day.</p>
          <div className="mt-4 space-y-4">
            <div><label className={labelCls} htmlFor="r-merchant">Merchant on receipt</label><select id="r-merchant" className={inputCls} value={rec.merchant} onChange={(e) => setRec({ ...rec, merchant: e.target.value })}>{MERCHANTS.map((x) => <option key={x.slug}>{x.name}</option>)}</select></div>
            <div><label className={labelCls} htmlFor="r-amt">Amount printed ($)</label><input id="r-amt" type="number" min={1} className={inputCls} value={rec.amount} onChange={(e) => setRec({ ...rec, amount: Number(e.target.value) })} /></div>
            <div><label className={labelCls} htmlFor="r-url">Receipt image URL</label><input id="r-url" className={inputCls} placeholder="https://… or upload below" value={rec.imageUrl.startsWith("data:") ? "" : rec.imageUrl} onChange={(e) => setRec({ ...rec, imageUrl: e.target.value })} /></div>
            <div><label className={labelCls} htmlFor="r-file">…or upload an image</label><input id="r-file" type="file" accept="image/*" className={inputCls + " pt-2"} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></div>
            {rec.imageUrl && <img src={rec.imageUrl} alt="Preview of your uploaded receipt" className="max-h-40 rounded-xl border" />}
            <button className={btnViolet} disabled={loading} onClick={() => act("receipt_submit", rec)}>Submit for review</button>
          </div>
          <h3 className="font-display mt-5 font-bold">Your receipts</h3>
          <ul className="mt-2 space-y-2">{(data.receipts || []).map((r: any) => <li key={r.id} className="flex items-center gap-3 rounded-xl bg-[#F7F3FC] p-3 text-sm"><Receipt size={17} className="text-[#7C3AED]" /><span className="flex-1">{r.merchant} · ${r.amount} {r.note ? <em className="block text-xs text-[#5F5478]">{r.note}</em> : null}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${r.status === "Approved" ? "bg-green-100 text-green-800" : r.status === "Rejected" ? "bg-red-100 text-red-800" : "bg-[#FFF4D6] text-[#A86F00]"}`}>{r.status}{r.status === "Approved" ? ` · +${r.points}` : ""}</span></li>)}</ul>
          {(data.receipts || []).length === 0 && <p className="mt-2 text-sm text-[#5F5478]">None yet. Tip: log in as Merchant or Admin to review your own demo queue.</p>}
        </div>
        <div className={cardL}>
          <h2 className="font-display text-2xl font-bold">📣 Surveys & quizzes</h2>
          <div className="mt-4 space-y-3">{SURVEYS.map((s) => { const done = [...doneSurveys].some((d: any) => String(d).includes(s.title)); return <div key={s.id} className="flex items-center gap-3 rounded-2xl bg-[#F7F3FC] p-4"><div className="flex-1"><div className="font-bold">{s.title}</div><div className="font-mono2 text-sm text-[#A86F00]">+{s.points} pts</div></div><button disabled={done} onClick={() => { setActiveSurvey(s); setAnswers({}); }} className={`${btnViolet} !min-h-[44px] !px-4 text-sm`}>{done ? "Done ✅" : "Start"}</button></div>; })}</div>
          <button className="mt-4 font-bold text-[#4C1D95] underline underline-offset-4" onClick={() => go("finder")}>Or take the Reward Finder quiz →</button>
        </div>
        <div className={cardL}>
          <h2 className="font-display text-2xl font-bold">🧲 Refer friends, both earn</h2>
          <p className="mt-1 text-sm text-[#5F5478]">When a friend joins with your link <b>and completes a first qualifying earn</b>, you get <span className="font-mono2 font-bold text-[#A86F00]">+300</span> and they get <span className="font-mono2 font-bold text-[#A86F00]">+150</span>. No bonus for sign-ups alone — that keeps it honest.</p>
          <div className="mt-3 flex gap-2"><input readOnly className={inputCls + " font-mono2 text-xs"} value={refLink} aria-label="Your referral link" /><button className={btnGold + " shrink-0 !px-4"} onClick={() => { navigator.clipboard?.writeText(refLink); say("Referral link copied!"); }}><Copy size={17} /> Copy</button></div>
          <p className="mt-3 text-sm">Your code: <span className="font-mono2 font-bold">{me.referralCode}</span> · Referrals: <b>{refs.length}</b> ({refs.filter((r) => r.status === "Qualified").length} qualified)</p>
          <ul className="mt-2 space-y-1.5 text-sm">{refs.map((r) => <li key={r.id} className="rounded-lg bg-[#F7F3FC] px-3 py-2">Friend #{r.referredId} — <b>{r.status}</b>{r.bonusAwarded ? " · +300 paid ✅" : " · waiting for first earn"}</li>)}</ul>
          <div className="mt-4 flex flex-wrap gap-2"><button className={btnViolet} onClick={() => go("spin")}>🎡 Today&apos;s free Lucky Spin</button><button className="min-h-[48px] rounded-full border border-[#E0D6EE] px-5 font-bold" onClick={() => go("dashboard")}>🔥 Daily check-in</button></div>
        </div>
      </div>
      <AnimatePresence>{activeSurvey && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] grid place-items-center bg-[#0B0614]/70 p-4" role="dialog" aria-label={activeSurvey.title}>
          <div className="w-full max-w-lg rounded-[18px] bg-white p-6 text-[#0B0614]"><div className="flex items-start justify-between"><h3 className="font-display text-2xl font-bold">{activeSurvey.title}</h3><button onClick={() => setActiveSurvey(null)} aria-label="Close survey" className="grid h-11 w-11 place-items-center rounded-full bg-[#F1EAFF]"><X /></button></div>
            {activeSurvey.questions.map((q: any, qi: number) => <fieldset key={qi} className="mt-4"><legend className="font-bold">{q.q}</legend><div className="mt-2 flex flex-wrap gap-2">{q.opts.map((o: string) => <button type="button" key={o} onClick={() => setAnswers({ ...answers, [qi]: o })} className={`min-h-[44px] rounded-full px-4 font-semibold ${answers[qi] === o ? "bg-[#7C3AED] text-white" : "bg-[#F1EAFF] text-[#4C1D95]"}`} aria-pressed={answers[qi] === o}>{o}</button>)}</div></fieldset>)}
            <button className={`${btnGold} mt-6 w-full`} disabled={Object.keys(answers).length < activeSurvey.questions.length} onClick={async () => { const j = await act("survey", { surveyId: activeSurvey.id, answers }); if (j) setActiveSurvey(null); }}>Submit & earn +{activeSurvey.points} pts</button>
          </div>
        </motion.div>)}
      </AnimatePresence>
    </LightWrap>
  );
}

/* ---------- REWARDS ---------- */
function RewardCard({ r, me, open }: { r: Reward; me: any; open: (r: Reward) => void }) {
  const afford = me && me.balance >= r.pointsCost;
  const need = me ? r.pointsCost - me.balance : 0;
  return (
    <motion.article whileHover={reduced ? undefined : { y: -4 }} className="ticket tilt relative flex h-full flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_10px_36px_rgba(76,29,149,.10)]">
      {afford && <span className="absolute left-3 top-3 z-10 rounded-full bg-[#16B364] px-2.5 py-1 text-[11px] font-bold text-white shadow">✓ Affordable</span>}
      {r.endsInHours && <span className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-[#0B0614]/80 px-2.5 py-1 text-[11px] font-bold text-[#FFC83D]"><Clock size={12} /> ends in {r.endsInHours}h (demo)</span>}
      <img src={r.image} alt={`${r.title} — reward artwork`} className="h-36 w-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.background = MEDIA.fallback; (e.target as HTMLImageElement).removeAttribute("src"); }} />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2"><div><h3 className="font-display font-bold leading-tight text-[#0B0614]">{r.title}</h3><p className="mt-0.5 text-xs text-[#5F5478]">{r.merchant} · {r.type} · {r.stock} left</p></div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#FFF4D6] py-1 pl-1 pr-2.5"><Coin size={20} /><span className="font-mono2 text-sm font-bold text-[#A86F00]">{fmt(r.pointsCost)}</span></span></div>
        <div className="perf my-3" aria-hidden />
        <div className="mt-auto space-y-2.5">
          <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${r.tierRequired === "Spark" ? "bg-[#F1EAFF] text-[#4C1D95]" : "bg-[#0B0614] text-[#FFC83D]"}`}>{r.tierRequired}+ {r.cashTopup ? `· or Points + $${r.cashTopup}` : ""}</span>
          {me && !afford && <div><div className="mb-1 text-xs font-semibold text-[#5F5478]">{fmt(need)} pts to go</div><Progress value={me.balance} max={r.pointsCost} label={`Progress to ${r.title}`} /></div>}
          <button data-cursor="Redeem" onClick={() => open(r)} className="min-h-[46px] w-full rounded-full bg-[#7C3AED] font-bold text-white hover:bg-[#4C1D95]">View & redeem</button>
        </div>
      </div>
    </motion.article>
  );
}
function RewardsView({ rewards, me, open }: { rewards: Reward[]; me: any; open: (r: Reward) => void }) {
  const [q, setQ] = useState(""); const [cat, setCat] = useState("All"); const [merchant, setMerchant] = useState("All"); const [tier, setTier] = useState("All"); const [maxPts, setMaxPts] = useState(15000); const [affordOnly, setAffordOnly] = useState(false); const [endingSoon, setEndingSoon] = useState(false); const [sort, setSort] = useState("popular"); const [showFilters, setShowFilters] = useState(false);
  const merchants = [...new Set(rewards.map((r) => r.merchant))];
  const cats = ["All", ...CATEGORIES, "Charity", "Perks"];
  let list = rewards.filter((r) => (cat === "All" || r.category === cat) && (merchant === "All" || r.merchant === merchant) && (tier === "All" || r.tierRequired === tier) && r.pointsCost <= maxPts && (!affordOnly || (me && me.balance >= r.pointsCost)) && (!endingSoon || r.endsInHours) && (!q || (r.title + r.merchant + r.category).toLowerCase().includes(q.toLowerCase())));
  list = [...list].sort((a, b) => sort === "cheap" ? a.pointsCost - b.pointsCost : sort === "pricey" ? b.pointsCost - a.pointsCost : sort === "ending" ? (a.endsInHours || 999) - (b.endsInHours || 999) : b.stock - a.stock);
  const Filters = (<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
    <div><label className={labelCls}>Category</label><select className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)}>{cats.map((c) => <option key={c}>{c}</option>)}</select></div>
    <div><label className={labelCls}>Merchant</label><select className={inputCls} value={merchant} onChange={(e) => setMerchant(e.target.value)}><option>All</option>{merchants.map((m) => <option key={m}>{m}</option>)}</select></div>
    <div><label className={labelCls}>Tier required</label><select className={inputCls} value={tier} onChange={(e) => setTier(e.target.value)}><option>All</option>{TIERS.map((t) => <option key={t.name}>{t.name}</option>)}</select></div>
    <div><label className={labelCls}>Max points: <span className="font-mono2">{fmt(maxPts)}</span></label><input type="range" min={300} max={15000} step={100} value={maxPts} onChange={(e) => setMaxPts(Number(e.target.value))} className="w-full accent-[#7C3AED]" aria-label="Maximum points" /></div>
    <div><label className={labelCls}>Sort</label><select className={inputCls} value={sort} onChange={(e) => setSort(e.target.value)}><option value="popular">Most stocked</option><option value="cheap">Points: low → high</option><option value="pricey">Points: high → low</option><option value="ending">Ending soon</option></select></div>
    <div className="flex items-end gap-4 pb-1"><label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-[#7C3AED]" checked={affordOnly} onChange={(e) => setAffordOnly(e.target.checked)} /> Affordable now</label><label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-[#7C3AED]" checked={endingSoon} onChange={(e) => setEndingSoon(e.target.checked)} /> Ending soon</label></div>
  </div>);
  return (
    <LightWrap title="Rewards catalog" kicker="Redeem" sub={me ? `Your balance: ${fmt(me.balance)} pts (${me.tier} tier). Exact cost and resulting balance are shown before you confirm — always.` : "40 fictional demo rewards. Sign in to see what you can afford and redeem."}>
      <div className="relative"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F5478]" size={19} /><input className={inputCls + " !pl-11 !rounded-full !py-0 h-[52px] shadow"} placeholder="Search rewards, merchants, categories…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search rewards" /></div>
      <button className="mt-4 min-h-[44px] rounded-full bg-[#0B0614] px-5 font-bold text-white lg:hidden" onClick={() => setShowFilters(!showFilters)}>{showFilters ? "Hide filters" : "Filters & sort"}</button>
      <div className="mt-4 hidden rounded-[18px] bg-white p-4 shadow lg:block">{Filters}</div>
      {showFilters && <div className="mt-3 rounded-[18px] bg-white p-4 shadow lg:hidden">{Filters}</div>}
      <p className="mt-5 text-sm text-[#5F5478]" aria-live="polite">{list.length} reward{list.length === 1 ? "" : "s"} found</p>
      {list.length ? <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{list.map((r) => <RewardCard key={r.id} r={r} me={me} open={open} />)}</div> : <Empty icon="🎟️" title="No rewards match" body="Try widening the points range or clearing a filter. New demo drops land weekly." cta={<button className={btnViolet} onClick={() => { setQ(""); setCat("All"); setTier("All"); setMerchant("All"); setAffordOnly(false); }}>Clear filters</button>} />}
    </LightWrap>
  );
}
function RewardDetail({ r, me, back, redeem }: { r: Reward; me: any; back: () => void; redeem: () => void }) {
  return (
    <section className="light-zone diag bg-[#F7F3FC] py-14 text-[#0B0614]"><div className="mx-auto max-w-5xl px-4">
      <button onClick={back} className="font-bold text-[#4C1D95] underline underline-offset-4">← All rewards</button>
      <div className="mt-5 grid gap-6 overflow-hidden rounded-[18px] bg-white shadow-xl lg:grid-cols-2">
        <div className="relative"><img src={r.image} alt={`${r.title} reward image`} className="h-full min-h-72 w-full object-cover" />{r.endsInHours && <span className="absolute left-4 top-4 rounded-full bg-[#0B0614] px-3 py-1.5 text-xs font-bold text-[#FFC83D]">Ends in {r.endsInHours}h (demo timing)</span>}</div>
        <div className="p-6 lg:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#A86F00]">{r.category} · {r.type}</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold sm:text-4xl">{r.title}</h1>
          <p className="mt-1 text-[#5F5478]">at {r.merchant} (fictional demo merchant)</p>
          <p className="mt-4 leading-relaxed">{r.description}</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-[#F7F3FC] p-3"><dt className="text-[#5F5478]">Points cost</dt><dd className="font-mono2 text-lg font-bold text-[#A86F00]">{fmt(r.pointsCost)} pts</dd></div>
            <div className="rounded-xl bg-[#F7F3FC] p-3"><dt className="text-[#5F5478]">Tier required</dt><dd className="font-display text-lg font-bold">{r.tierRequired}+</dd></div>
            <div className="rounded-xl bg-[#F7F3FC] p-3"><dt className="text-[#5F5478]">Stock (real count)</dt><dd className="font-mono2 text-lg font-bold">{r.stock}</dd></div>
            <div className="rounded-xl bg-[#F7F3FC] p-3"><dt className="text-[#5F5478]">Points + cash option</dt><dd className="font-mono2 text-lg font-bold">{r.cashTopup ? `${fmt(Math.round(r.pointsCost * 0.6))} + $${r.cashTopup}` : "—"}</dd></div>
          </dl>
          {me && <p className="mt-4 rounded-xl bg-[#FFF4D6] p-3 text-sm">Your balance <span className="font-mono2 font-bold">{fmt(me.balance)}</span> → after redeeming <span className="font-mono2 font-bold">{fmt(me.balance - r.pointsCost)}</span> pts{me.balance < r.pointsCost ? ` — you need ${fmt(r.pointsCost - me.balance)} more.` : "."}</p>}
          <p className="mt-4 text-xs text-[#5F5478]"><b>Terms:</b> {r.terms} Voucher valid 30 days from issue; expiry shown on the voucher.</p>
          <button data-cursor="Redeem" className={`${btnGold} mt-5 w-full sm:w-auto`} onClick={redeem}>{me ? "Redeem this reward" : "Sign in to redeem"}</button>
        </div>
      </div>
    </div></section>
  );
}
function RedeemSheet({ r, me, close, confirm, loading }: { r: Reward; me: any; close: () => void; confirm: (pointsOnly: boolean) => void; loading: boolean }) {
  const [pointsOnly, setPointsOnly] = useState(true);
  const cost = pointsOnly || !r.cashTopup ? r.pointsCost : Math.round(r.pointsCost * 0.6);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[72] grid items-end bg-[#0B0614]/70 p-0 sm:place-items-center sm:p-4" role="dialog" aria-label="Confirm redemption">
      <motion.div initial={{ y: 60 }} animate={{ y: 0 }} className="light-zone w-full max-w-lg rounded-t-[22px] bg-white p-6 text-[#0B0614] sm:rounded-[18px]">
        <div className="flex items-start justify-between"><h2 className="font-display text-2xl font-extrabold">Confirm redemption</h2><button onClick={close} aria-label="Cancel" className="grid h-11 w-11 place-items-center rounded-full bg-[#F1EAFF]"><X /></button></div>
        <p className="mt-1 text-[#5F5478]">{r.title} · {r.merchant}</p>
        {r.cashTopup > 0 && <div className="mt-4 grid grid-cols-2 gap-2">{([true, false] as const).map((po) => <button key={String(po)} onClick={() => setPointsOnly(po)} className={`min-h-[52px] rounded-2xl border-2 px-3 font-bold ${pointsOnly === po ? "border-[#7C3AED] bg-[#F1EAFF]" : "border-[#E0D6EE]"}`} aria-pressed={pointsOnly === po}>{po ? `${fmt(r.pointsCost)} pts only` : `${fmt(Math.round(r.pointsCost * 0.6))} pts + $${r.cashTopup} (demo cash)`}</button>)}</div>}
        <div className="mt-4 space-y-2 rounded-2xl bg-[#F7F3FC] p-4 font-mono2 text-sm">
          <div className="flex justify-between"><span>Your balance now</span><span>{fmt(me.balance)} pts</span></div>
          <div className="flex justify-between text-[#4C1D95]"><span>This ticket costs</span><span>−{fmt(cost)} pts</span></div>
          <div className="flex justify-between border-t border-[#E0D6EE] pt-2 font-bold"><span>Balance after</span><span className="text-[#A86F00]">{fmt(me.balance - cost)} pts</span></div>
        </div>
        <div className="mt-3 flex gap-1" aria-hidden>{Array.from({ length: 8 }, (_, i) => <span key={i} className="coin block rounded-full transition-all" style={{ width: 26, height: 26, opacity: i < Math.max(1, Math.round(8 * (me.balance - cost) / Math.max(me.balance, 1))) ? 1 : 0.15 }} />)}</div>
        <p className="mt-3 text-xs text-[#5F5478]">Instant e-voucher with QR + code, valid 30 days. Double-clicks are protected by an idempotency key; stock & tier are re-checked on the server.</p>
        <div className="mt-5 flex gap-2"><button className="min-h-[48px] flex-1 rounded-full border border-[#E0D6EE] font-bold" onClick={close}>Not yet</button><button className={`${btnGold} flex-1`} disabled={loading || me.balance < cost} onClick={() => confirm(pointsOnly || !r.cashTopup)}>{me.balance < cost ? `Need ${fmt(cost - me.balance)} more pts` : `Print my ticket −${fmt(cost)}`}</button></div>
      </motion.div>
    </motion.div>
  );
}
function IssuedTicket({ v, close }: { v: any; close: () => void }) {
  const [qr, setQr] = useState("");
  useEffect(() => { QRCode.toDataURL(`PERKPILOT-DEMO:${v.code}`, { width: 260, margin: 1, color: { dark: "#0B0614", light: "#ffffff" } }).then(setQr); }, [v.code]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[73] grid place-items-center bg-[#0B0614]/80 p-4" role="dialog" aria-label="Your voucher">
      <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring" }} className="w-full max-w-sm rounded-[18px] bg-white p-6 text-center text-[#0B0614]">
        <div className="text-4xl" aria-hidden>🎟️</div><h2 className="font-display mt-1 text-2xl font-extrabold">Ticket printed!</h2>
        <p className="font-bold">{v.rewardTitle}</p><p className="text-sm text-[#5F5478]">{v.merchant}</p>
        {qr && <img src={qr} alt={`QR code for demo voucher ${v.code}`} className="mx-auto mt-3 h-52 w-52 rounded-xl border-4 border-[#0B0614]" width={208} height={208} />}
        <p className="font-mono2 mt-3 text-xl font-bold tracking-wider">{v.code}</p>
        <p className="text-xs text-[#5F5478]">Valid until {new Date(v.expiresAt).toLocaleDateString()} · Demo code, no monetary value · saved in My Vouchers</p>
        <button className={`${btnGold} mt-5 w-full`} onClick={close}>Open my wallet</button>
      </motion.div>
    </motion.div>
  );
}

/* ---------- VOUCHERS & SCAN ---------- */
function VouchersView({ data, go }: { data: any; go: (v: View) => void }) {
  const [tab, setTab] = useState("Active"); const [open, setOpen] = useState<any>(null); const [qrs, setQrs] = useState<any>({});
  useEffect(() => { (data.vouchers || []).forEach((v: any) => QRCode.toDataURL(`PERKPILOT-DEMO:${v.code}`, { width: 220, margin: 1 }).then((u) => setQrs((s: any) => ({ ...s, [v.id]: u })))); }, [data.vouchers]);
  const list = (data.vouchers || []).filter((v: any) => v.status === tab);
  return <LightWrap title="My vouchers" kicker="Wallet" sub="Tap a voucher for a big, brightness-friendly QR. Merchants confirm use on the Scan page — codes are checked with constant-time comparison on the server.">
    <div className="flex flex-wrap gap-2">{["Active", "Used", "Expired"].map((t) => <button key={t} onClick={() => setTab(t)} className={`min-h-[46px] rounded-full px-5 font-bold ${tab === t ? "bg-[#7C3AED] text-white" : "bg-white text-[#4C1D95] shadow"}`} aria-pressed={tab === t}>{t} ({(data.vouchers || []).filter((v: any) => v.status === t).length})</button>)}
      <button className="ml-auto min-h-[46px] rounded-full bg-[#0B0614] px-5 font-bold text-[#FFC83D]" onClick={() => go("scan")}><ScanLine className="mr-1 inline" size={17} /> Merchant scan demo</button></div>
    {list.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((v: any) => (
      <button key={v.id} onClick={() => setOpen(v)} className="ticket tilt rounded-[18px] bg-white p-5 text-left shadow" data-cursor="Show QR">
        <div className="flex items-start justify-between"><div><div className="font-display font-bold leading-tight">{v.rewardTitle}</div><div className="text-sm text-[#5F5478]">{v.merchant}</div></div><Ticket className="text-[#7C3AED]" /></div>
        <div className="perf my-3" /><div className="font-mono2 font-bold">{v.code}</div>
        <div className="mt-1 text-sm text-[#5F5478]">{v.status} · cost {fmt(v.pointsCost)} pts · {v.expiresAt ? `expires ${new Date(v.expiresAt).toLocaleDateString()}` : ""}</div>
      </button>))}</div>
      : <div className="mt-5"><Empty icon="🎫" title={`No ${tab.toLowerCase()} vouchers`} body="Redeem a reward and your ticket lands here instantly." cta={<button className={btnGold} onClick={() => go("rewards")}>Browse rewards</button>} /></div>}
    <AnimatePresence>{open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] grid place-items-center bg-white p-4 text-center text-[#0B0614]" role="dialog" aria-label={`Voucher ${open.code}`}>
      <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-[#A86F00]">Show at till (demo)</p><h2 className="font-display mt-1 text-3xl font-extrabold">{open.rewardTitle}</h2><p className="text-[#5F5478]">{open.merchant} · {open.status}</p>
        {qrs[open.id] && <img src={qrs[open.id]} alt={`QR code for voucher ${open.code}`} className="mx-auto mt-4 h-72 w-72 max-w-[80vw] rounded-2xl border-8 border-[#0B0614]" width={288} height={288} />}
        <p className="font-mono2 mt-4 text-2xl font-bold">{open.code}</p><button className={`${btnViolet} mt-5`} onClick={() => setOpen(null)}>Done</button></div>
    </motion.div>}</AnimatePresence>
  </LightWrap>;
}
function ScanView({ act, me }: { act: any; me: any }) {
  const [code, setCode] = useState("PP-DEMO1001"); const [result, setResult] = useState<any>(null);
  return <section className="py-16"><div className="mx-auto max-w-xl px-4 text-center">
    <ScanLine className="mx-auto text-[#FFC83D]" size={52} /><h1 className="font-display mt-3 text-4xl font-extrabold">Scan to redeem</h1>
    <p className="mt-2 text-[#A99CC4]">Mock merchant scanner. Type/paste a voucher code (try <span className="font-mono2 text-[#FFC83D]">PP-DEMO1001</span> on Maya&apos;s account, or any code from My Vouchers). Merchant & admin accounts confirm use in one tap; members can validate or self-scan in demo mode.</p>
    <div className={`${cardD} mt-6 text-left`}><label className={labelD} htmlFor="scan-code">Voucher code</label><input id="scan-code" className={inputDark + " font-mono2 uppercase"} value={code} onChange={(e) => setCode(e.target.value)} />
      <div className="mt-4 flex gap-2"><button className={`${btnGold} flex-1`} onClick={async () => setResult(await act("voucher_scan", { code }))}>Validate code</button>
      <button className={`${btnViolet} flex-1`} onClick={async () => setResult(await act("voucher_scan", { code, confirmUse: true }))}>Mark used{me?.role === "member" ? " (demo self-scan)" : ""}</button></div>
      {result?.voucher && <div className="mt-4 rounded-2xl bg-[#1E1435] p-4"><div className="font-display font-bold">{result.voucher.rewardTitle}</div><div className="text-sm text-[#C9B3FF]">{result.voucher.merchant} · status: <b className="text-white">{result.voucher.status}</b> · {fmt(result.voucher.pointsCost)} pts</div></div>}
    </div></div></section>;
}

/* ---------- SPIN ---------- */
function SpinView({ me, act, go }: { me: any; act: any; go: (v: View) => void }) {
  const [rotation, setRotation] = useState(0); const [spinning, setSpinning] = useState(false); const [win, setWin] = useState<any>(null);
  const spunToday = me.lastSpinDay === new Date().toISOString().slice(0, 10);
  const segAngle = 360 / SPIN_SEGMENTS.length;
  const gradient = `conic-gradient(${SPIN_SEGMENTS.map((s, i) => `${s.color} ${i * segAngle}deg ${(i + 1) * segAngle}deg`).join(",")})`;
  async function spin() {
    if (spinning) return; setWin(null);
    const j = await act("spin", {}, { silent: true }); if (!j) return;
    setSpinning(true);
    const target = 360 * 6 + (360 - (j.index * segAngle + segAngle / 2));
    setRotation((r) => r - (r % 360) + target);
    setTimeout(() => { setSpinning(false); setWin(j); if (j.points > 0) confetti({ particleCount: 70, spread: 60, colors: ["#FFC83D", "#A275FF", "#fff"] }); }, reduced ? 100 : 4200);
  }
  return <section className="starfield py-14"><div className="mx-auto grid max-w-7xl items-center gap-10 px-4 lg:grid-cols-2 lg:px-8">
    <div className="text-center">
      <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Lucky Spin 🎡</h1>
      <p className="mx-auto mt-2 max-w-md text-[#A99CC4]">One <b className="text-white">free</b> spin per day. Demo points only. Odds are printed right here — no purchasable spins, no pressure loops.</p>
      <div className="relative mx-auto mt-8 h-[320px] w-[320px] max-w-[86vw] sm:h-[380px] sm:w-[380px]" role="img" aria-label="Prize wheel with 8 segments">
        <div className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 text-4xl drop-shadow" aria-hidden>▼</div>
        <motion.div animate={{ rotate: rotation }} transition={reduced ? { duration: 0.1 } : { duration: 4.2, ease: [0.12, 0.8, 0.08, 1] }} className="relative h-full w-full rounded-full border-8 border-[#FFC83D] shadow-[0_0_70px_rgba(255,200,61,.30)]" style={{ background: gradient }}>
          {SPIN_SEGMENTS.map((s, i) => <span key={s.label} className="absolute left-1/2 top-1/2 origin-left text-[11px] font-bold text-white drop-shadow sm:text-xs" style={{ transform: `rotate(${i * segAngle + segAngle / 2}deg) translateX(58px)`, width: 92 }}>{s.label}</span>)}
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"><Coin size={62} /></span>
        </motion.div>
      </div>
      {me.takeBreak ? <div className={`${cardD} mx-auto mt-6 max-w-md`}>🌿 <b>Break mode is on.</b> You asked us to pause games — spin & streak prompts are hidden. Turn it off anytime in Profile settings.<button className={`${btnViolet} mt-3 w-full`} onClick={() => go("profile")}>Open settings</button></div>
        : spunToday && !win ? <div className={`${cardD} mx-auto mt-6 max-w-md`}><b>That&apos;s today&apos;s spin done.</b><br /><span className="text-[#A99CC4]">Next free spin in </span><Countdown to={endOfToday()} dark /><p className="mt-1 text-sm text-[#A99CC4]">Meanwhile, missions & check-ins keep paying.</p></div>
        : <button className={`${btnGold} pulse-gold mt-7 !px-10 !text-lg`} disabled={spinning} onClick={spin} aria-label="Spin the wheel (button)">{spinning ? "Spinning…" : "SPIN — free today"}</button>}
      <AnimatePresence>{win && <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`${cardD} mx-auto mt-5 max-w-md border !border-[#FFC83D]`} role="status"><div className="text-3xl" aria-hidden>{win.points ? "🏆" : "🌙"}</div><b>{win.message}</b><p className="text-sm text-[#A99CC4]">Written to your ledger. Come back tomorrow for the next free spin.</p></motion.div>}</AnimatePresence>
    </div>
    <div className={cardD}>
      <h2 className="font-display text-2xl font-bold">Open odds & rules</h2>
      <table className="mt-4 w-full text-left text-sm"><caption className="sr-only">Lucky Spin prize odds</caption><thead><tr className="text-[#A99CC4]"><th className="py-1.5">Prize</th><th>Chance</th><th /></tr></thead>
        <tbody>{SPIN_SEGMENTS.map((s) => <tr key={s.label} className="border-t border-[#2E2248]"><td className="py-2"><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ background: s.color }} aria-hidden />{s.label}</td><td className="font-mono2">{s.weight}%</td><td className="w-28"><div className="h-2 rounded bg-[#2E2248]"><div className="h-full rounded bg-[#FFC83D]" style={{ width: `${s.weight * 3}%` }} /></div></td></tr>)}</tbody></table>
      <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-[#CFC4E8]"><li>Exactly one free spin per member per day (server-enforced by date).</li><li>Prize is decided server-side with cryptographic randomness at these weights; the wheel animation just reveals it.</li><li>Demo points only — no cash value, no entry fee, not gambling. Still, take breaks: Profile → “Take a break from games”.</li><li>Expected value ≈ 38 pts/spin. The 500 jackpot lands ~1 day in 100.</li></ul>
    </div>
  </div></section>;
}

/* ---------- MISSIONS ---------- */
function MissionsView({ data, act, loading }: { data: any; act: any; loading: boolean }) {
  const prog = (id: string) => (data.missionProgress || []).find((x: any) => x.missionId === id);
  const groups = ["Daily", "Weekly", "Monthly"] as const;
  const endFor = (k: string) => k === "Daily" ? endOfToday() : k === "Weekly" ? endOfWeek() : endOfMonth();
  return <LightWrap title="Missions hub" kicker="Quests" sub="Progress updates automatically as you earn. Completed missions pay out when you claim — countdowns run to real day/week/month ends.">
    {groups.map((g) => <div key={g} className="mb-8"><div className="flex flex-wrap items-center gap-3"><h2 className="font-display text-2xl font-extrabold">{g} board</h2><span className="rounded-full bg-[#0B0614] px-3 py-1 text-sm">resets in <Countdown to={endFor(g)} /></span></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{MISSIONS.filter((m) => m.kind === g).map((m) => { const p = prog(m.id); const cur = m.action === "streak" ? Math.min(data.me.streak, m.target) : Math.min(p?.progress || 0, m.target); const done = cur >= m.target; return (
        <motion.div key={m.id} layout className={`${cardL} relative ${done && !p?.claimed ? "ring-2 ring-[#FFC83D]" : ""}`} data-cursor={done && !p?.claimed ? "Claim" : undefined}>
          {done && <span className="absolute right-4 top-4 rotate-6 rounded-lg border-2 border-[#16B364] px-2 py-0.5 text-xs font-extrabold text-[#16B364]">{p?.claimed ? "CLAIMED ✅" : "COMPLETE 🎉"}</span>}
          <h3 className="font-display pr-24 text-lg font-bold">{m.title}</h3><p className="mt-0.5 text-sm text-[#5F5478]">{m.desc}</p>
          <div className="mt-3"><Progress value={cur} max={m.target} label={m.title} /><div className="mt-1.5 flex justify-between text-sm"><span className="font-mono2 text-[#5F5478]">{fmt(cur)}/{fmt(m.target)}</span><span className="flex items-center gap-1.5 font-bold text-[#A86F00]"><Coin size={18} /> +{m.reward}</span></div></div>
          <button className={`${done && !p?.claimed ? btnGold + " pulse-gold" : btnViolet} mt-3 w-full !min-h-[46px] text-sm`} disabled={loading || p?.claimed || !done} onClick={() => act("mission_claim", { missionId: m.id })}>{p?.claimed ? "Claimed" : done ? `Claim +${m.reward} pts` : `In progress — ${Math.round((cur / m.target) * 100)}%`}</button>
        </motion.div>); })}</div></div>)}
  </LightWrap>;
}

/* ---------- LEDGER ---------- */
function LedgerView({ data }: { data: any }) {
  const [type, setType] = useState("all"); const [q, setQ] = useState("");
  const rows = (data.ledger || []).filter((l: any) => (type === "all" || l.type === type) && (!q || l.description.toLowerCase().includes(q.toLowerCase())));
  const csv = () => { const head = "Date,Type,Description,Amount,BalanceAfter,Source,ExpiresAt\n"; const body = rows.map((l: any) => [new Date(l.createdAt).toISOString(), l.type, `"${l.description.replaceAll('"', '""')}"`, l.amount, l.balanceAfter, l.source, l.expiresAt ? new Date(l.expiresAt).toISOString() : ""].join(",")).join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([head + body], { type: "text/csv" })); a.download = "perkpilot-ledger.csv"; a.click(); };
  return <LightWrap title="Points ledger" kicker="Immutable history" sub="Your balance is derived from these entries — it's never a number anyone can just edit. Earns glow gold, redemptions violet. Points expire FIFO 12 months after they're earned.">
    <div className={`${cardL}`}>
      <div className="flex flex-wrap gap-3"><input className={inputCls + " max-w-xs"} placeholder="Search descriptions…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search ledger" />
        <select className={inputCls + " max-w-[220px]"} value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type"><option value="all">All types</option>{["earn", "redeem", "expiry", "adjustment", "refund", "pool", "transfer_in", "transfer_out"].map((t) => <option key={t}>{t}</option>)}</select>
        <button className={`${btnGold} ml-auto !min-h-[44px] text-sm`} onClick={csv}><Download size={16} /> Export CSV</button></div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><caption className="sr-only">Points ledger with running balance</caption>
        <thead><tr className="border-b text-[#5F5478]"><th className="py-2">Date</th><th>Entry</th><th>Type</th><th className="text-right">Amount</th><th className="text-right">Balance</th></tr></thead>
        <tbody>{rows.map((l: any, i: number) => <motion.tr key={l.id} initial={{ opacity: 0, x: reduced ? 0 : -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }} className={`border-b border-[#F1EAFF] ${l.amount > 0 ? "bg-[#FFF4D6]/50" : "bg-[#F1EAFF]/50"}`}>
          <td className="whitespace-nowrap py-2.5 pr-3 text-[#5F5478]">{new Date(l.createdAt).toLocaleDateString()}</td><td className="pr-3 font-medium">{l.description}{l.expiresAt && l.amount > 0 ? <span className="block text-[11px] text-[#5F5478]">batch expires {new Date(l.expiresAt).toLocaleDateString()}</span> : null}</td>
          <td><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold shadow">{l.type}</span></td>
          <td className={`text-right font-mono2 font-bold ${l.amount > 0 ? "text-[#A86F00]" : "text-[#4C1D95]"}`}>{l.amount > 0 ? "+" : ""}{fmt(l.amount)}</td>
          <td className="text-right font-mono2">{fmt(l.balanceAfter)}</td></motion.tr>)}</tbody></table></div>
      {rows.length === 0 && <Empty icon="🧾" title="No entries match" body="Adjust the filters, or go earn your next gold row." />}
    </div>
  </LightWrap>;
}

/* ---------- GROUPS ---------- */
function GroupsView({ data, act, me }: { data: any; act: any; me: any }) {
  const [form, setForm] = useState({ name: "The Weekend Pool", goalReward: "Family Movie Night Bundle (×4)", goalPoints: 3800 });
  const [joinCode, setJoinCode] = useState("NOVA-FAM1"); const [contrib, setContrib] = useState<any>({});
  return <LightWrap title="Family & friends pooling" kicker="Groups" sub="Pool points toward one shared goal. Every contribution is logged; owners can remove members; leaving never deletes history. Try the seeded invite code NOVA-FAM1.">
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <div className="space-y-5">
        <form className={cardL} onSubmit={(e) => { e.preventDefault(); act("group_create", form); }}><h2 className="font-display text-xl font-bold">Create a group</h2>
          <div className="mt-3 space-y-3"><div><label className={labelCls}>Group name</label><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className={labelCls}>Goal reward</label><input className={inputCls} value={form.goalReward} onChange={(e) => setForm({ ...form, goalReward: e.target.value })} /></div>
          <div><label className={labelCls}>Goal points</label><input type="number" min={100} className={inputCls} value={form.goalPoints} onChange={(e) => setForm({ ...form, goalPoints: Number(e.target.value) })} /></div>
          <button className={`${btnGold} w-full`}>Create group</button></div></form>
        <div className={cardL}><h2 className="font-display text-xl font-bold">Join with a code</h2><div className="mt-3 flex gap-2"><input className={inputCls + " font-mono2"} value={joinCode} onChange={(e) => setJoinCode(e.target.value)} aria-label="Invite code" /><button className={btnViolet} onClick={() => act("group_join", { inviteCode: joinCode })}>Join</button></div></div>
      </div>
      <div className="space-y-5">{(data.groups || []).map((g: any) => { const members = (data.groupMembers || []).filter((m: any) => m.groupId === g.id); const contribs = (data.contributions || []).filter((c: any) => c.groupId === g.id); const isOwner = g.ownerId === me.id; return (
        <div key={g.id} className={cardL}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display flex items-center gap-2 text-2xl font-bold"><Users className="text-[#7C3AED]" /> {g.name}</h2><p className="text-sm text-[#5F5478]">Goal: <b className="text-[#0B0614]">{g.goalReward}</b> · invite <span className="font-mono2 font-bold">{g.inviteCode}</span></p></div>
          <span className="flex items-center gap-1.5 rounded-full bg-[#FFF4D6] px-3 py-1.5 font-mono2 font-bold text-[#A86F00]"><Coin size={20} /> {fmt(g.poolPoints)} / {fmt(g.goalPoints)}</span></div>
          <div className="mt-3"><Progress value={g.poolPoints} max={g.goalPoints} label={`${g.name} pool progress`} /></div>
          {g.poolPoints >= g.goalPoints && <p className="mt-2 rounded-xl bg-green-50 p-2.5 font-bold text-green-800">🎉 Goal reached! The owner can redeem the shared reward from the catalog (demo flow).</p>}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><h3 className="font-bold">Members ({members.length})</h3><ul className="mt-1.5 space-y-1.5 text-sm">{members.map((m: any) => { const u = (data.users || []).find((x: any) => x.id === m.userId); return <li key={m.id} className="flex items-center gap-2"><img src={avatarFor(u?.name || "Member")} alt="" className="h-7 w-7 rounded-full" width={28} height={28} /><span className="flex-1">{u?.name || `Member #${m.userId}`}{m.role === "owner" ? " 👑" : ""}</span>{isOwner && m.userId !== me.id && <button className="text-xs font-bold text-red-700 underline" onClick={() => act("group_remove", { groupId: g.id, memberId: m.userId })}>Remove</button>}</li>; })}</ul></div>
            <div><h3 className="font-bold">Contributions</h3><ul className="mt-1.5 space-y-1 text-sm text-[#5F5478]">{contribs.slice(0, 6).map((c: any) => <li key={c.id}>{c.userName} pooled <span className="font-mono2 font-bold text-[#A86F00]">{fmt(c.points)}</span> · {new Date(c.createdAt).toLocaleDateString()}</li>)}{contribs.length === 0 && <li>No contributions yet.</li>}</ul></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2"><input type="number" min={10} className={inputCls + " max-w-[150px]"} placeholder="Points" value={contrib[g.id] || 100} onChange={(e) => setContrib({ ...contrib, [g.id]: Number(e.target.value) })} aria-label={`Points to pool into ${g.name}`} />
            <button className={btnGold} onClick={() => act("group_contribute", { groupId: g.id, points: contrib[g.id] || 100 })}>Pool points</button>
            <button className="min-h-[44px] font-bold text-red-700 underline underline-offset-4" onClick={() => act("group_leave", { groupId: g.id })}>Leave group</button></div>
        </div>); })}
        {(data.groups || []).length === 0 && <Empty icon="👨‍👩‍👧" title="No groups yet" body="Create one or join the demo family with code NOVA-FAM1." />}
      </div>
    </div>
  </LightWrap>;
}

/* ---------- smaller views ---------- */
function LeaderboardView({ data, me }: { data: any; me: any }) {
  const rows = [...(data?.leaderboard || []), ...LEADERBOARD_SEED.map((x) => ({ ...x, you: false }))].sort((a: any, b: any) => b.points - a.points).slice(0, 12);
  return <LightWrap title="Weekly leaderboard" kicker="Opt-in · privacy-safe" sub="Only display names (never emails), only for members who opted in. Seeded demo rivals are labelled. Resets weekly.">
    <div className={`${cardL} mx-auto max-w-2xl`}><ol className="divide-y divide-[#F1EAFF]">{rows.map((r: any, i: number) => <li key={i} className={`flex items-center gap-3 py-3 ${r.you ? "rounded-xl bg-[#FFF4D6] px-3" : "px-3"}`}><span className="w-8 text-center text-xl" aria-hidden>{["🥇", "🥈", "🥉"][i] || <span className="font-mono2 text-sm">{i + 1}</span>}</span><img src={avatarFor(r.name)} alt="" className="h-9 w-9 rounded-full" width={36} height={36} /><span className="flex-1 font-bold">{r.name}{r.you ? " (you)" : ""}{!data?.leaderboard?.includes?.(r) && i > 2 ? <span className="ml-1 text-[10px] uppercase text-[#5F5478]">demo</span> : ""}</span><span className="font-mono2 font-bold text-[#A86F00]">{fmt(r.points)} pts</span></li>)}</ol>
      <p className="mt-3 text-center text-sm text-[#5F5478]">{me ? (me.leaderboardOptin ? "You're opted in — change anytime in Profile." : "You're opted out, so you won't appear publicly.") : "Sign in and opt in to join the board."} Ends in <Countdown to={endOfWeek()} /></p></div>
  </LightWrap>;
}
function NotificationsView({ data, act, go }: { data: any; act: any; go: (v: View) => void }) {
  return <LightWrap title="Notifications" kicker="Inbox" sub="Points, tiers, expiry warnings, missions & vouchers. Mock emails are logged server-side to the console when email prefs are on.">
    <button className={btnViolet} onClick={() => act("notif_read")}>Mark all read</button>
    <button className="ml-2 min-h-[48px] rounded-full border border-[#E0D6EE] bg-white px-5 font-bold" onClick={() => go("profile")}>Notification preferences</button>
    <ul className="mx-auto mt-5 max-w-3xl space-y-2.5">{(data.notifications || []).map((n: any) => <li key={n.id} className={`rounded-[16px] p-4 shadow ${n.isRead ? "bg-white" : "bg-[#FFF4D6]"}`}><div className="flex justify-between gap-3"><b>{n.title}</b><span className="shrink-0 text-xs text-[#5F5478]">{new Date(n.createdAt).toLocaleString()}</span></div><p className="mt-0.5 text-sm text-[#5F5478]">{n.body}</p></li>)}</ul>
    {(data.notifications || []).length === 0 && <div className="mt-5"><Empty icon="🔔" title="All quiet" body="Earn some points and we'll celebrate here (only if notifications are on)." /></div>}
  </LightWrap>;
}
function ProfileView({ data, me, act, go, charityImpact }: { data: any; me: any; act: any; go: (v: View) => void; charityImpact: number }) {
  const [prefs, setPrefs] = useState({ displayName: me.displayName, leaderboardOptin: me.leaderboardOptin, pauseNotifications: me.pauseNotifications, takeBreak: me.takeBreak, emailPrefs: me.emailPrefs, birthday: me.birthday || "" });
  const [transfer, setTransfer] = useState({ toEmail: "leo@demo.perkpilot", points: 100 });
  const earned = new Set(data.badges || []);
  const Toggle = ({ k, label, help }: { k: string; label: string; help: string }) => <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-[#F7F3FC] p-4"><input type="checkbox" className="mt-1 h-6 w-6 shrink-0 accent-[#7C3AED]" checked={(prefs as any)[k]} onChange={(e) => setPrefs({ ...prefs, [k]: e.target.checked })} /><span><b>{label}</b><span className="block text-sm text-[#5F5478]">{help}</span></span></label>;
  return <LightWrap title="Profile & settings" kicker="You, the Pilot" sub="">
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <div className="space-y-5">
        <div className="overflow-hidden rounded-[18px] bg-[#0B0614] p-5 text-white shadow-xl">
          <div className="flex items-center gap-4"><img src={avatarFor(me.name)} alt={`Avatar for ${me.name}`} className="h-16 w-16 rounded-full border-2 border-[#FFC83D]" width={64} height={64} /><div><h2 className="font-display text-2xl font-extrabold">{me.name}</h2><p className="text-sm text-[#A99CC4]">@{me.displayName} · member since {new Date(me.memberSince).toLocaleDateString()}</p><span className="mt-1 inline-block rounded-full px-3 py-1 text-xs font-bold text-[#0B0614]" style={{ background: me.tierColor }}>{me.tier} TIER · {me.multiplier}×</span></div></div>
          <div className="mt-4"><TierCardMini name={me.tier} color={me.tierColor} member={me.name} tierIdx={TIERS.findIndex((t) => t.name === me.tier)} /></div>
          <p className="mt-3 text-sm text-[#CFC4E8]">💛 Charity impact: <b className="text-white">{charityImpact}</b> demo donation{charityImpact === 1 ? "" : "s"} · streak 🔥 {me.streak} · referral code <span className="font-mono2 text-[#FFC83D]">{me.referralCode}</span></p>
          <p className="text-xs text-[#A99CC4]">Tip: “Add to home screen” from your browser menu for a wallet-pass style shortcut (PWA manifest included).</p>
        </div>
        <div className={cardL}><h2 className="font-display text-xl font-bold">Send points to a member</h2><p className="text-sm text-[#5F5478]">10–500 pts, 500/day cap, written to both ledgers.</p>
          <div className="mt-3 space-y-3"><input className={inputCls} value={transfer.toEmail} onChange={(e) => setTransfer({ ...transfer, toEmail: e.target.value })} aria-label="Recipient email" placeholder="friend@demo.perkpilot" />
          <input type="number" className={inputCls} value={transfer.points} onChange={(e) => setTransfer({ ...transfer, points: Number(e.target.value) })} aria-label="Points to send" />
          <button className={`${btnGold} w-full`} onClick={() => act("transfer", transfer)}><Send size={17} /> Send points</button></div></div>
      </div>
      <div className="space-y-5">
        <div className={cardL}><h2 className="font-display flex items-center gap-2 text-xl font-bold"><Trophy className="text-[#A86F00]" /> Badges ({earned.size}/20)</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{BADGES.map((b) => <div key={b.id} className={`rounded-2xl p-3.5 text-center ${earned.has(b.id) ? "bg-[#FFF4D6] ring-1 ring-[#FFC83D]" : "bg-[#F7F3FC] opacity-55"}`}><div className="text-3xl" aria-hidden>{b.icon}</div><div className="font-display mt-1 text-sm font-bold leading-tight">{b.name}</div><div className="mt-0.5 text-xs text-[#5F5478]">{earned.has(b.id) ? "Unlocked ✅" : b.desc}</div></div>)}</div></div>
        <form className={cardL} onSubmit={(e) => { e.preventDefault(); act("prefs", prefs); }}><h2 className="font-display flex items-center gap-2 text-xl font-bold"><Settings className="text-[#7C3AED]" /> Preferences & wellbeing</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><label className={labelCls}>Public display name</label><input className={inputCls} value={prefs.displayName} onChange={(e) => setPrefs({ ...prefs, displayName: e.target.value })} /></div>
          <div><label className={labelCls}>Birthday (for bonus)</label><input type="date" className={inputCls} value={prefs.birthday?.slice(0, 10) || ""} onChange={(e) => setPrefs({ ...prefs, birthday: e.target.value })} /></div></div>
          <div className="mt-3 grid gap-3">
            <Toggle k="leaderboardOptin" label="Show me on leaderboards" help="Only your display name & weekly points — never your email." />
            <Toggle k="pauseNotifications" label="Pause rewards notifications" help="Silences in-app & mock-email nudges. Ledger still records everything." />
            <Toggle k="takeBreak" label="🌿 Take a break from games" help="Disables Lucky Spin & streak prompts until you turn it back off." />
            <Toggle k="emailPrefs" label="Mock email updates" help="Demo only: 'emails' are console.log lines on the server." />
          </div><button className={`${btnGold} mt-4`}>Save preferences</button>
          <button type="button" className="ml-2 font-bold text-[#4C1D95] underline underline-offset-4" onClick={() => go("policies")}>Privacy & points terms</button></form>
      </div>
    </div>
  </LightWrap>;
}
function TiersView({ me, go }: { me: any; go: (v: View) => void }) {
  return <section className="py-14"><div className="mx-auto max-w-7xl px-4 lg:px-8">
    <p className="text-center text-xs font-bold uppercase tracking-[0.3em] text-[#FFC83D]">Status tiers</p><h1 className="font-display mt-1 text-center text-4xl font-extrabold sm:text-6xl">Climb the violet ladder</h1>
    <p className="mx-auto mt-3 max-w-2xl text-center text-[#A99CC4]">Tiers are based on <b className="text-white">qualifying points earned in a rolling 12-month window</b> (redeeming never demotes you mid-window). If the window slides you below a threshold, a <b className="text-white">60-day grace period</b> keeps your perks while warnings land at 30 & 7 days.</p>
    <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">{TIERS.map((t, i) => <motion.div key={t.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className={me?.tier === t.name ? "rounded-[20px] ring-4 ring-[#FFC83D]" : ""}>
      <TierCardMini name={t.name} color={t.color} member={me?.name || "PerkPilot Member"} tierIdx={i} />
      <div className={cardD + " -mt-3 !rounded-t-none"}><div className="flex items-center justify-between"><b className="font-display text-lg">{t.name}</b><span className="font-mono2 text-sm text-[#FFC83D]">{t.multiplier}× earn</span></div>
        <p className="text-sm text-[#A99CC4]">From {fmt(t.threshold)} qualifying pts / 12 mo</p>
        <ul className="mt-3 space-y-1.5 text-sm">{t.perks.map((p) => <li key={p} className="flex gap-2"><Star size={15} className="mt-0.5 shrink-0" style={{ color: t.color }} />{p}</li>)}</ul>
        {me?.tier === t.name && <span className="mt-3 inline-block rounded-full bg-[#FFC83D] px-3 py-1 text-xs font-bold text-[#0B0614]">YOU ARE HERE</span>}
      </div></motion.div>)}</div>
    <div className="mt-10 text-center"><button className={btnGold} onClick={() => go(me ? "earn" : "auth")}>Earn qualifying points</button></div>
  </div></section>;
}
function MerchantsView({ go, rewards }: { go: (v: View) => void; rewards: Reward[] }) {
  const [cat, setCat] = useState("All"); const [sel, setSel] = useState<any>(null);
  const list = MERCHANTS.filter((m) => cat === "All" || m.category === cat);
  return <LightWrap title="Partner merchants" kicker="25 fictional partners" sub="Every merchant here is invented for this demo — any resemblance to real brands is coincidental. Earn rates are points per $1 before your tier multiplier.">
    <div className="flex flex-wrap gap-2">{["All", ...CATEGORIES].map((c) => <button key={c} onClick={() => setCat(c)} className={`min-h-[44px] rounded-full px-4 text-sm font-bold ${cat === c ? "bg-[#7C3AED] text-white" : "bg-white text-[#4C1D95] shadow"}`} aria-pressed={cat === c}>{c}</button>)}</div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{list.map((m) => <button key={m.slug} onClick={() => setSel(m)} className={`${cardL} tilt text-left`}>
      <div className="flex items-center gap-3"><MerchantLogo {...m} size={54} /><div><h3 className="font-display font-bold leading-tight">{m.name}</h3><p className="text-xs text-[#5F5478]">{m.category}</p></div></div>
      <p className="mt-2.5 text-sm text-[#5F5478]">{m.description}</p><p className="font-mono2 mt-2.5 font-bold text-[#A86F00]">{m.earnRate} pts / $1</p></button>)}</div>
    <AnimatePresence>{sel && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] grid place-items-center bg-[#0B0614]/70 p-4" role="dialog" aria-label={sel.name}>
      <div className="light-zone max-h-[88vh] w-full max-w-lg overflow-auto rounded-[18px] bg-white p-6 text-[#0B0614]"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><MerchantLogo {...sel} size={60} /><div><h2 className="font-display text-2xl font-extrabold">{sel.name}</h2><p className="text-sm text-[#5F5478]">{sel.category} · fictional demo merchant</p></div></div><button onClick={() => setSel(null)} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-[#F1EAFF]"><X /></button></div>
        <p className="mt-3">{sel.description}</p><p className="font-mono2 mt-2 font-bold text-[#A86F00]">Earn rate: {sel.earnRate} pts per $1 (× your tier multiplier, × live campaigns)</p>
        <h3 className="font-display mt-4 font-bold">Rewards here</h3><ul className="mt-1.5 space-y-1.5 text-sm">{rewards.filter((r) => r.merchant === sel.name).map((r) => <li key={r.id} className="flex justify-between rounded-lg bg-[#F7F3FC] px-3 py-2"><span>{r.title}</span><span className="font-mono2 font-bold">{fmt(r.pointsCost)} pts</span></li>)}{rewards.filter((r) => r.merchant === sel.name).length === 0 && <li className="text-[#5F5478]">Earn-only partner for now (demo).</li>}</ul>
        <button className={`${btnGold} mt-5 w-full`} onClick={() => go("earn")}>Shop the demo checkout</button></div></motion.div>}</AnimatePresence>
  </LightWrap>;
}
function BlogView() {
  const [sel, setSel] = useState<any>(null);
  if (sel) return <section className="light-zone diag bg-white py-16 text-[#0B0614]"><article className="mx-auto max-w-3xl px-4"><button className="font-bold text-[#4C1D95] underline" onClick={() => setSel(null)}>← All posts</button><p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-[#A86F00]">{sel.tag} · {sel.mins} min read</p><h1 className="font-display mt-1 text-4xl font-extrabold">{sel.title}</h1><p className="mt-5 text-lg leading-relaxed text-[#3D3358]">{sel.body}</p><p className="mt-4 leading-relaxed text-[#3D3358]">PerkPilot is a fictional demo, so treat every number as an illustration — but the habits are real anywhere: automatic check-ins, shared family goals, and redeeming small treats often beat hoarding for a someday splurge while batches quietly expire.</p></article></section>;
  return <LightWrap title="The Perk Post" kicker="Blog" sub="Guides to earning fairly, pooling with family, and never letting good points expire.">
    <div className="grid gap-5 md:grid-cols-3">{BLOG.map((b) => <button key={b.slug} onClick={() => setSel(b)} className={`${cardL} tilt text-left`}><BookOpen className="text-[#7C3AED]" /><p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-[#A86F00]">{b.tag} · {b.mins} min</p><h2 className="font-display mt-1 text-xl font-bold leading-snug">{b.title}</h2><p className="mt-2 line-clamp-3 text-sm text-[#5F5478]">{b.body}</p><span className="mt-3 inline-block font-bold text-[#4C1D95]">Read →</span></button>)}</div>
  </LightWrap>;
}
function FinderView({ rewards, open }: { rewards: Reward[]; open: (r: Reward) => void }) {
  const [vibe, setVibe] = useState("Foodie"); const [budget, setBudget] = useState(3000);
  const vibeCats: any = { Cosy: ["Cafés & Bakeries", "Home & Tech"], Adventurous: ["Travel & Transport", "Entertainment"], Foodie: ["Restaurants", "Grocery", "Cafés & Bakeries"], Pampered: ["Beauty & Wellness"], Generous: ["Charity"] };
  const picks = rewards.filter((r) => vibeCats[vibe]?.includes(r.category) && r.pointsCost <= budget).slice(0, 4);
  return <LightWrap title="Reward Finder" kicker="2-question quiz" sub="Tell us the vibe and the budget — we'll surface demo rewards that fit. No points are charged for looking.">
    <div className={`${cardL} mx-auto max-w-3xl`}><p className="font-display text-lg font-bold">1 · Pick a vibe</p><div className="mt-2 flex flex-wrap gap-2">{Object.keys(vibeCats).map((v) => <button key={v} onClick={() => setVibe(v)} className={`min-h-[46px] rounded-full px-5 font-bold ${vibe === v ? "bg-[#7C3AED] text-white" : "bg-[#F1EAFF] text-[#4C1D95]"}`} aria-pressed={vibe === v}>{v}</button>)}</div>
      <p className="font-display mt-6 text-lg font-bold">2 · Max points: <span className="font-mono2 text-[#A86F00]">{fmt(budget)}</span></p><input type="range" min={300} max={14000} step={100} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="mt-2 w-full accent-[#F5A524]" aria-label="Maximum points budget" />
      <h2 className="font-display mt-6 text-lg font-bold">Your picks ({picks.length})</h2><div className="mt-3 grid gap-4 sm:grid-cols-2">{picks.map((r) => <RewardCard key={r.id} r={r} me={null} open={open} />)}</div>
      {picks.length === 0 && <p className="mt-3 text-[#5F5478]">Nothing fits that combo — raise the budget a little.</p>}</div>
  </LightWrap>;
}
function PoliciesView() {
  const sections: [string, string][] = [["Points terms (demo)", "Points are fictional test data with no monetary value; they cannot be bought, sold, or exchanged for cash. Earned batches expire 12 months after earning (FIFO). We may claw back points for refunded purchases, shown transparently as refund entries. Daily caps apply per earning method."], ["Privacy (demo)", "This demo stores the account details you type in a local database for demonstration only. Never enter real passwords or personal data. Leaderboards only ever show opt-in display names. A production launch requires a full privacy notice, lawful-basis mapping, retention schedules and DSR tooling under applicable law (e.g. UK/EU GDPR, CCPA)."], ["Lucky Spin & fair play", "The spin is free once per day, awards demo points, and prints its odds. It is designed to avoid gambling mechanics (no stake, no purchasable spins, no cash-out). Gambling and promotional laws vary by country — take legal advice before any real launch, especially where chance-based promotions are regulated."], ["Children", "This demo is intended for adults. A production service must apply age-appropriate design, parental consent where required, and stricter data minimisation for children."], ["Tax & consumer law", "In some jurisdictions loyalty rewards can have tax or consumer-protection implications (expiry disclosure, unfair terms, prize promotions). Requirements vary by country; seek professional advice before going live. Nothing here is legal advice."]];
  return <LightWrap title="Policies & fine print" kicker="Written plainly" sub={SITE.demoDisclaimer}>{sections.map(([t, b]) => <div key={t} className={`${cardL} mx-auto mb-4 max-w-3xl`}><h2 className="font-display text-xl font-bold">{t}</h2><p className="mt-1.5 leading-relaxed text-[#3D3358]">{b}</p></div>)}</LightWrap>;
}

/* ---------- MERCHANT / ADMIN ---------- */
function MerchantPortal({ data, act, me }: { data: any; act: any; me: any }) {
  const [camp, setCamp] = useState({ merchant: "Violet Bean Roasters", title: "Double-Points Week", budget: 10000, multiplier: 2, startDate: new Date().toISOString().slice(0, 10), endDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) });
  const [rule, setRule] = useState({ merchant: "Violet Bean Roasters", pointsPerUnit: 12, bonusDays: "Saturday,Sunday" });
  const [rew, setRew] = useState({ title: "", merchant: "Violet Bean Roasters", category: "Cafés & Bakeries", pointsCost: 600, cashTopup: 0, stock: 50, tierRequired: "Spark", description: "" });
  const [scanCode, setScanCode] = useState("");
  const redemptions = (data.allVouchers || []).slice(0, 12);
  const pie = [{ name: "Redeemed", value: (data.allVouchers || []).filter((v: any) => v.status === "Used").length + 18 }, { name: "Active", value: (data.allVouchers || []).filter((v: any) => v.status === "Active").length + 24 }, { name: "Expired", value: (data.allVouchers || []).filter((v: any) => v.status === "Expired").length + 5 }];
  return <LightWrap title="Merchant portal" kicker={`Signed in as ${me.name}`} sub="Launch campaigns via the same MerchantAdapter seam a real POS would use. Demo analytics mix your live actions with labelled seeded engagement.">
    <div className="grid gap-5 lg:grid-cols-2">
      <div className={cardL}><h2 className="font-display text-xl font-bold">Points issued vs redeemed (demo weeks)</h2><div className="mt-3 h-64" role="img" aria-label="Bar chart: issued points grow from 1200 to about 4600 over 8 weeks; redemptions grow from 800 to about 3300"><ResponsiveContainer><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" /><YAxis /><Tooltip /><Legend /><Bar dataKey="issued" fill="#FFC83D" radius={[6, 6, 0, 0]} /><Bar dataKey="redeemed" fill="#7C3AED" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
        <div className="grid grid-cols-3 gap-3 text-center">{[["Active members", "312"], ["Campaign ROI (demo)", "2.4×"], ["Top reward", "Violet Latte"]].map(([l, v]) => <div key={l} className="rounded-xl bg-[#F7F3FC] p-3"><div className="font-mono2 font-bold">{v}</div><div className="text-[11px] uppercase tracking-wide text-[#5F5478]">{l}</div></div>)}</div></div>
      <div className={cardL}><h2 className="font-display text-xl font-bold">Voucher mix</h2><div className="h-64" role="img" aria-label="Pie chart of voucher statuses"><ResponsiveContainer><PieChart><Pie data={pie} dataKey="value" nameKey="name" outerRadius={85} label>{pie.map((_, i) => <Cell key={i} fill={["#7C3AED", "#FFC83D", "#C9B3FF"][i]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
        <h3 className="font-display font-bold">Scan / enter a voucher code</h3><div className="mt-2 flex gap-2"><input className={inputCls + " font-mono2 uppercase"} placeholder="PP-…" value={scanCode} onChange={(e) => setScanCode(e.target.value)} aria-label="Voucher code" /><button className={btnGold} onClick={() => act("voucher_scan", { code: scanCode, confirmUse: true })}>Redeem</button></div></div>
      <form className={cardL} onSubmit={(e) => { e.preventDefault(); act("campaign_create", camp); }}><h2 className="font-display flex items-center gap-2 text-xl font-bold"><Zap className="text-[#A86F00]" /> Launch a campaign</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><label className={labelCls}>Title</label><input required className={inputCls} value={camp.title} onChange={(e) => setCamp({ ...camp, title: e.target.value })} /></div>
        <div><label className={labelCls}>Merchant</label><select className={inputCls} value={camp.merchant} onChange={(e) => setCamp({ ...camp, merchant: e.target.value })}>{MERCHANTS.map((m) => <option key={m.slug}>{m.name}</option>)}</select></div>
        <div><label className={labelCls}>Multiplier</label><select className={inputCls} value={camp.multiplier} onChange={(e) => setCamp({ ...camp, multiplier: Number(e.target.value) })}>{[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}× points</option>)}</select></div>
        <div><label className={labelCls}>Budget (points)</label><input type="number" className={inputCls} value={camp.budget} onChange={(e) => setCamp({ ...camp, budget: Number(e.target.value) })} /></div>
        <div className="grid grid-cols-2 gap-2"><div><label className={labelCls}>Start</label><input type="date" className={inputCls} value={camp.startDate} onChange={(e) => setCamp({ ...camp, startDate: e.target.value })} /></div><div><label className={labelCls}>End</label><input type="date" className={inputCls} value={camp.endDate} onChange={(e) => setCamp({ ...camp, endDate: e.target.value })} /></div></div></div>
        <button className={`${btnGold} mt-4`}>Launch campaign</button>
        <ul className="mt-4 space-y-2">{(data.campaigns || []).map((c: any) => <li key={c.id} className="rounded-xl bg-[#F7F3FC] p-3 text-sm"><b>{c.title}</b> · {c.merchant} · {c.multiplier}× · <span className="font-mono2">{fmt(c.spent)}/{fmt(c.budget)}</span> pts · {c.status} · ends <Countdown to={+new Date(c.endDate + "T23:59:59")} /><Progress value={c.spent} max={c.budget} label={`${c.title} budget`} /></li>)}</ul></form>
      <div className="space-y-5">
        <form className={cardL} onSubmit={(e) => { e.preventDefault(); act("earn_rule", rule); }}><h2 className="font-display text-xl font-bold">Earn rules</h2><div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div><label className={labelCls}>Merchant</label><select className={inputCls} value={rule.merchant} onChange={(e) => setRule({ ...rule, merchant: e.target.value })}>{MERCHANTS.map((m) => <option key={m.slug}>{m.name}</option>)}</select></div>
          <div><label className={labelCls}>Points per $1</label><input type="number" min={1} max={50} className={inputCls} value={rule.pointsPerUnit} onChange={(e) => setRule({ ...rule, pointsPerUnit: Number(e.target.value) })} /></div>
          <div><label className={labelCls}>Bonus days</label><input className={inputCls} value={rule.bonusDays} onChange={(e) => setRule({ ...rule, bonusDays: e.target.value })} /></div></div>
          <button className={`${btnViolet} mt-3`}>Save earn rule</button><p className="mt-2 text-xs text-[#5F5478]">Applied server-side at checkout on top of tier multipliers; daily caps still apply.</p></form>
        <form className={cardL} onSubmit={(e) => { e.preventDefault(); act("reward_publish", rew); }}><h2 className="font-display flex items-center gap-2 text-xl font-bold"><Plus className="text-[#7C3AED]" /> Publish a reward</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><label className={labelCls}>Title</label><input required className={inputCls} placeholder="e.g. Free Iced Violet Cooler" value={rew.title} onChange={(e) => setRew({ ...rew, title: e.target.value })} /></div>
          <div><label className={labelCls}>Merchant</label><select className={inputCls} value={rew.merchant} onChange={(e) => setRew({ ...rew, merchant: e.target.value })}>{MERCHANTS.map((m) => <option key={m.slug}>{m.name}</option>)}</select></div>
          <div><label className={labelCls}>Points cost</label><input type="number" className={inputCls} value={rew.pointsCost} onChange={(e) => setRew({ ...rew, pointsCost: Number(e.target.value) })} /></div>
          <div><label className={labelCls}>Tier</label><select className={inputCls} value={rew.tierRequired} onChange={(e) => setRew({ ...rew, tierRequired: e.target.value })}>{TIERS.map((t) => <option key={t.name}>{t.name}</option>)}</select></div>
          <div><label className={labelCls}>Stock</label><input type="number" className={inputCls} value={rew.stock} onChange={(e) => setRew({ ...rew, stock: Number(e.target.value) })} /></div></div>
          <button className={`${btnGold} mt-3`}>Publish to catalog</button></form>
      </div>
      <div className={`${cardL} lg:col-span-2`}><h2 className="font-display text-xl font-bold">🧾 Receipt review queue</h2><ReceiptQueue data={data} act={act} /></div>
      <div className={`${cardL} lg:col-span-2`}><h2 className="font-display text-xl font-bold">Recent redemptions (all members)</h2>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b text-[#5F5478]"><th className="py-2">Code</th><th>Reward</th><th>Merchant</th><th>Status</th><th className="text-right">Points</th></tr></thead>
        <tbody>{redemptions.map((v: any) => <tr key={v.id} className="border-b border-[#F1EAFF]"><td className="py-2 font-mono2">{v.code}</td><td>{v.rewardTitle}</td><td>{v.merchant}</td><td><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${v.status === "Active" ? "bg-[#FFF4D6] text-[#A86F00]" : v.status === "Used" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>{v.status}</span></td><td className="text-right font-mono2">{fmt(v.pointsCost)}</td></tr>)}</tbody></table></div></div>
    </div>
  </LightWrap>;
}
function ReceiptQueue({ data, act }: { data: any; act: any }) {
  const pending = (data.allReceipts || []).filter((r: any) => r.status === "Pending");
  if (!pending.length) return <p className="mt-2 text-[#5F5478]">Queue is clear 🎉 Submit a receipt as a member to see it land here.</p>;
  return <ul className="mt-3 space-y-3">{pending.map((r: any) => { const u = (data.users || []).find((x: any) => x.id === r.userId); return <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#F7F3FC] p-3.5">
    {r.imageUrl && <img src={r.imageUrl} alt={`Receipt from ${u?.name || "member"} at ${r.merchant}`} className="h-14 w-14 rounded-lg object-cover" loading="lazy" />}
    <div className="min-w-0 flex-1"><b>{r.merchant}</b> · ${r.amount} · by {u?.name || `#${r.userId}`}<div className="text-xs text-[#5F5478]">Would award {r.points} pts · hash {r.imageHash} · {new Date(r.createdAt).toLocaleString()}</div></div>
    <button className="min-h-[44px] rounded-full bg-[#16B364] px-4 font-bold text-white" onClick={() => act("receipt_review", { receiptId: r.id, approve: true })}>Approve +{r.points}</button>
    <button className="min-h-[44px] rounded-full border border-red-300 px-4 font-bold text-red-700" onClick={() => act("receipt_review", { receiptId: r.id, approve: false, note: "We couldn't read this one — a flatter, brighter photo usually works. (Demo)" })}>Reject kindly</button></li>; })}</ul>;
}
function AdminView({ data, act }: { data: any; act: any }) {
  const [adj, setAdj] = useState({ targetUserId: "", amount: 100, reason: "" });
  const engagement = chartData.map((d) => ({ ...d, checkins: 60 + d.members * 2 }));
  return <LightWrap title="Admin console" kicker="Ada's control room" sub="Liability is computed live from the ledger. Every adjustment needs a reason and lands in the audit log.">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Outstanding points (liability)", fmt(data.liability?.outstanding || 0), `≈ $${(data.liability?.valueUSD || 0).toFixed(2)} at 100pts=$1`], ["Members & staff", String((data.users || []).length), "incl. merchant + admin"], ["Open fraud flags", String((data.frauds || []).filter((f: any) => f.status === "Open").length), "review below"], ["Pending receipts", String((data.allReceipts || []).filter((r: any) => r.status === "Pending").length), "queue below"]].map(([l, v, s]) => <div key={l} className={cardL}><div className="text-[11px] font-bold uppercase tracking-widest text-[#5F5478]">{l}</div><div className="font-mono2 mt-1 text-3xl font-bold text-[#A86F00]">{v}</div><div className="text-xs text-[#5F5478]">{s}</div></div>)}</div>
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <div className={cardL}><h2 className="font-display text-xl font-bold">Engagement (demo series + live actions)</h2><div className="mt-3 h-60" role="img" aria-label="Line chart of members and check-ins growing over 8 weeks"><ResponsiveContainer><LineChart data={engagement}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="members" stroke="#7C3AED" strokeWidth={3} /><Line type="monotone" dataKey="checkins" stroke="#F5A524" strokeWidth={3} /></LineChart></ResponsiveContainer></div>
        <button className={`${btnViolet} mt-2`} onClick={() => act("worker_run")}><Sparkles size={17} /> Run worker jobs now (expiry · vouchers · tiers)</button><p className="mt-2 text-xs text-[#5F5478]">In production these run on a cron worker (see <code className="font-mono2">/worker</code> in the README). FIFO expiry, voucher expiry, streak & tier jobs are idempotent.</p></div>
      <form className={cardL} onSubmit={(e) => { e.preventDefault(); act("admin_adjust", adj); }}><h2 className="font-display flex items-center gap-2 text-xl font-bold"><Shield className="text-[#7C3AED]" /> Manual points adjustment</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><label className={labelCls}>Member</label><select required className={inputCls} value={adj.targetUserId} onChange={(e) => setAdj({ ...adj, targetUserId: e.target.value })}><option value="">Choose…</option>{(data.users || []).map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}</select></div>
        <div><label className={labelCls}>Amount (±)</label><input type="number" className={inputCls} value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: Number(e.target.value) })} /></div>
        <div className="sm:col-span-2"><label className={labelCls}>Reason (required, audited)</label><input required className={inputCls} placeholder="e.g. Goodwill for delayed voucher, ticket #…" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} /></div></div>
        <button className={`${btnGold} mt-3`}>Apply adjustment</button></form>
      <div className={cardL}><h2 className="font-display text-xl font-bold">🧾 Receipt queue</h2><ReceiptQueue data={data} act={act} /></div>
      <div className={cardL}><h2 className="font-display text-xl font-bold">🚩 Fraud flags</h2>
        <ul className="mt-3 space-y-2.5">{(data.frauds || []).map((f: any) => { const u = (data.users || []).find((x: any) => x.id === f.userId); return <li key={f.id} className="rounded-2xl bg-[#F7F3FC] p-3.5 text-sm"><b>{u?.name || `#${f.userId}`}</b> — {f.reason}<div className="mt-1.5 flex items-center gap-2"><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold shadow">{f.status}</span>{f.status === "Open" && <><button className="font-bold text-[#4C1D95] underline" onClick={() => act("fraud_resolve", { flagId: f.id, status: "Reviewed — OK" })}>Mark reviewed OK</button><button className="font-bold text-red-700 underline" onClick={() => act("fraud_resolve", { flagId: f.id, status: "Action taken" })}>Action taken</button></>}</div></li>; })}{(data.frauds || []).length === 0 && <li className="text-[#5F5478]">No flags. Duplicate receipts, velocity & referral rings auto-flag here.</li>}</ul></div>
      <div className={`${cardL} lg:col-span-2`}><h2 className="font-display text-xl font-bold">Members</h2><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b text-[#5F5478]"><th className="py-2">Member</th><th>Email</th><th>Role</th><th>Streak</th><th>Since</th></tr></thead>
        <tbody>{(data.users || []).map((u: any) => <tr key={u.id} className="border-b border-[#F1EAFF]"><td className="py-2 font-semibold">{u.name} <span className="text-xs text-[#5F5478]">@{u.displayName}</span></td><td>{u.email}</td><td><span className="rounded-full bg-[#F1EAFF] px-2 py-0.5 text-xs font-bold text-[#4C1D95]">{u.role}</span></td><td>🔥 {u.streak}</td><td>{new Date(u.memberSince).toLocaleDateString()}</td></tr>)}</tbody></table></div></div>
      <div className={`${cardL} lg:col-span-2`}><h2 className="font-display text-xl font-bold">Audit log</h2><ul className="mt-3 space-y-2 text-sm">{(data.audits || []).map((a: any) => <li key={a.id} className="rounded-xl bg-[#F7F3FC] px-3.5 py-2.5"><b>{a.actor}</b> · {a.action} — {a.detail} <span className="block text-xs text-[#5F5478]">{new Date(a.createdAt).toLocaleString()}</span></li>)}{(data.audits || []).length === 0 && <li className="text-[#5F5478]">No audit entries yet.</li>}</ul></div>
    </div>
  </LightWrap>;
}

/* ---------- onboarding & footer ---------- */
const TOUR = [["🪙 Earn everywhere", "Partner checkouts, receipts, check-ins, missions, surveys & referrals all pay into one honest ledger."], ["🔥 Streaks & missions", "Check in daily, protect slips with freezes, and claim mission chests. Break mode is always one toggle away."], ["🎟️ Redeem & pool", "Tickets land instantly with QR codes. Pool points with family toward one shared goal."], ["👑 Climb to Nova", "Rolling 12-month qualifying points, clear grace periods, multipliers that actually multiply."]];
function Onboarding({ step, setStep, done }: { step: number; setStep: (n: number) => void; done: () => void }) {
  const [t, b] = TOUR[step];
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[82] grid place-items-center bg-[#0B0614]/90 p-4" role="dialog" aria-label="Welcome tour">
    <motion.div key={step} initial={{ x: reduced ? 0 : 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="starfield w-full max-w-md rounded-[22px] border border-[#2E2248] bg-[#140C24] p-7 text-center">
      <Coin size={66} /><h2 className="font-display mt-4 text-3xl font-extrabold">{t}</h2><p className="mt-2 text-[#CFC4E8]">{b}</p>
      <div className="mt-5 flex justify-center gap-1.5">{TOUR.map((_, i) => <span key={i} className={`h-2 rounded-full transition-all ${i === step ? "w-8 bg-[#FFC83D]" : "w-2 bg-[#2E2248]"}`} aria-hidden />)}</div>
      <p className="mt-1 text-xs text-[#A99CC4]">Step {step + 1} of {TOUR.length} — your +250 welcome points are already in.</p>
      <div className="mt-5 flex gap-2"><button className="min-h-[48px] flex-1 rounded-full border border-[#2E2248] font-bold" onClick={done}>Skip tour</button>
      <button className={`${btnGold} flex-1`} onClick={() => step === TOUR.length - 1 ? done() : setStep(step + 1)}>{step === TOUR.length - 1 ? "Open my dashboard" : "Next"}</button></div>
    </motion.div></motion.div>;
}
function Footer({ go }: { go: (v: View) => void }) {
  return <footer className="border-t border-[#2E2248] bg-[#0B0614] py-12 text-sm text-[#A99CC4]"><div className="mx-auto grid max-w-7xl gap-8 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
    <div><div className="flex items-center gap-2"><Coin size={30} /><span className="font-display text-lg font-extrabold text-white">Perk<span className="text-[#FFC83D]">Pilot</span></span></div><p className="mt-3">{SITE.tagline}</p><p className="mt-2 rounded-xl border border-[#FFC83D]/40 bg-[#140C24] p-3 text-[#FFD966]">⚠️ {SITE.demoDisclaimer} No real company names, logos or trademarks are used for merchants.</p></div>
    <nav aria-label="Explore"><h3 className="font-display font-bold text-white">Explore</h3>{([["Rewards", "rewards"], ["Earn", "earn"], ["Missions", "missions"], ["Lucky Spin", "spin"], ["Tiers", "tiers"], ["Merchants", "merchants"], ["Reward Finder", "finder"], ["Blog", "blog"]] as const).map(([t, v]) => <button key={v} className="mt-1.5 block min-h-[32px] hover:text-[#FFC83D]" onClick={() => go(v as View)}>{t}</button>)}</nav>
    <nav aria-label="Account"><h3 className="font-display font-bold text-white">Account</h3>{([["Dashboard", "dashboard"], ["My vouchers", "vouchers"], ["Ledger & CSV", "ledger"], ["Groups & pooling", "groups"], ["Leaderboard", "leaderboard"], ["Notifications", "notifications"], ["Scan a voucher", "scan"], ["Policies", "policies"]] as const).map(([t, v]) => <button key={v} className="mt-1.5 block min-h-[32px] hover:text-[#FFC83D]" onClick={() => go(v as View)}>{t}</button>)}</nav>
    <div><h3 className="font-display font-bold text-white">Demo logins (demo1234)</h3><ul className="font-mono2 mt-2 space-y-1 text-[13px]"><li>maya@demo.perkpilot — Nova</li><li>sam@demo.perkpilot — 🔥14 streak</li><li>leo@demo.perkpilot — Glow</li><li>merchant@demo.perkpilot</li><li>admin@demo.perkpilot</li></ul><h3 className="font-display mt-5 font-bold text-white">Credits</h3><ul className="mt-2 space-y-1 text-xs">{CREDITS.map((c) => <li key={c}>{c}</li>)}</ul></div>
  </div><p className="mx-auto mt-10 max-w-7xl px-4 text-center text-xs lg:px-8">© {new Date().getFullYear()} PerkPilot Demo · 100 pts = $1 demo value · Points expire 12 months after earning (FIFO) · Built with Next.js, Drizzle + PostgreSQL · <button className="underline hover:text-[#FFC83D]" onClick={() => go("policies")}>Legal notes</button></p></footer>;
}
