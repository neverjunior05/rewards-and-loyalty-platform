"use client";
import { useEffect, useState } from "react";
export const Coin = ({ size = 28, label = "P" }: { size?: number; label?: string }) => (
  <span aria-hidden className="coin inline-grid shrink-0 place-items-center rounded-full font-mono2 font-bold" style={{ width: size, height: size, fontSize: size * 0.42 }}>{label}</span>
);
export const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n || 0));
export function Countdown({ to, dark = false }: { to: number; dark?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((to - now) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const urgent = s < 3600;
  const txt = d > 0 ? `${d}d ${h}h ${m}m` : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return <span className={`font-mono2 tabular ${urgent ? "text-[#A86F00] animate-pulse font-bold" : dark ? "text-[#C9B3FF]" : "text-[#5F5478]"}`} aria-label={`Time remaining ${txt}`}>{urgent ? "⏰ " : ""}{txt}</span>;
}
export const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 0); return +d; };
export const endOfWeek = () => { const d = new Date(); const add = (7 - d.getDay()) % 7 || 7; d.setDate(d.getDate() + add); d.setHours(23, 59, 59, 0); return +d; };
export const endOfMonth = () => { const d = new Date(); return +new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); };
export function TierRing({ pct, tier, color, size = 190 }: { pct: number; tier: string; color: string; size?: number }) {
  const r = 80, c = 2 * Math.PI * r;
  const [draw, setDraw] = useState(0);
  useEffect(() => { const t = setTimeout(() => setDraw(pct), 120); return () => clearTimeout(t); }, [pct]);
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${tier} tier, ${pct}% of the way to the next tier`}>
      <svg viewBox="0 0 190 190" className="h-full w-full -rotate-90">
        <circle cx="95" cy="95" r={r} fill="none" stroke="#2E2248" strokeWidth="14" />
        <circle cx="95" cy="95" r={r} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * draw) / 100} style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)", filter: `drop-shadow(0 0 8px ${color})` }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div><div className="font-display text-3xl font-extrabold text-white">{tier}</div><div className="font-mono2 text-sm text-[#FFC83D]">{pct}%</div><div className="text-[11px] uppercase tracking-widest text-[#A99CC4]">to next tier</div></div>
      </div>
    </div>
  );
}
export function Progress({ value, max, gold = true, label }: { value: number; max: number; gold?: boolean; label?: string }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="h-3 overflow-hidden rounded-full bg-[#EDE5F8]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label || "Progress"}>
        <div className="shimmer h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: gold ? "linear-gradient(90deg,#F5A524,#FFC83D,#FFD966)" : "linear-gradient(90deg,#4C1D95,#7C3AED,#A275FF)" }} />
      </div>
      <span className="sr-only">{pct}% complete, {value} of {max}</span>
    </div>
  );
}
export function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => { let raf = 0; const start = performance.now(); const tick = (t: number) => { const p = Math.min(1, (t - start) / 1400); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, [to]);
  return <span className="tabular">{fmt(v)}{suffix}</span>;
}
export const TierCardMini = ({ name, color, member, tierIdx }: { name: string; color: string; member: string; tierIdx: number }) => (
  <div className="relative aspect-[1.58] w-full overflow-hidden rounded-[18px] p-5 text-white shadow-[0_20px_50px_rgba(124,58,237,.35)]" style={{ background: tierIdx === 3 ? "linear-gradient(120deg,#1E1435,#4C1D95 30%,#7C3AED 52%,#FFC83D 82%)" : `linear-gradient(125deg,#140C24,#1E1435 55%,${color}55)` }}>
    <div className="starfield absolute inset-0 opacity-70" aria-hidden />
    <div className="relative flex h-full flex-col justify-between">
      <div className="flex items-start justify-between"><span className="font-display text-lg font-extrabold">PerkPilot</span><Coin size={34} /></div>
      <div><div className="text-[11px] uppercase tracking-[0.25em] text-white/70">Member</div><div className="font-display font-bold">{member}</div></div>
      <div className="flex items-end justify-between"><span className="rounded-full px-3 py-1 text-xs font-bold text-[#0B0614]" style={{ background: color }}>{name} TIER</span><span className="font-mono2 text-xs text-white/80">PP •••• {String(1000 + tierIdx * 111)}</span></div>
    </div>
  </div>
);
export const MerchantLogo = ({ name, color, monogram, size = 48 }: { name: string; color: string; monogram: string; size?: number }) => (
  <span className="inline-grid shrink-0 place-items-center rounded-2xl font-display font-extrabold text-white" style={{ width: size, height: size, background: `linear-gradient(135deg,${color},#4C1D95)`, fontSize: size * 0.34 }} aria-label={`${name} logo (fictional monogram)`} role="img">{monogram}</span>
);
