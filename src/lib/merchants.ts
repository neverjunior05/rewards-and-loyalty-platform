import { MERCHANTS } from "./data";
/**
 * MerchantAdapter — the seam where a real POS / receipt-verification provider plugs in.
 * Implement these four methods against a real provider (e.g. POS webhook, card-linked
 * offer network, OCR receipt API) and swap `merchantAdapter` below. Nothing else changes.
 */
export interface MerchantAdapter {
  listMerchants(): Promise<typeof MERCHANTS>;
  verifyPurchase(input: { merchantSlug: string; amount: number; reference?: string }): Promise<{ verified: boolean; earnRate: number; merchantName: string }>;
  issueVoucher(input: { rewardId: string; userId: number }): Promise<{ code: string }>;
  redeemVoucher(input: { code: string }): Promise<{ ok: boolean; message: string }>;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export class DemoMerchantAdapter implements MerchantAdapter {
  async listMerchants() { await sleep(60); return MERCHANTS; }
  async verifyPurchase({ merchantSlug, amount }: { merchantSlug: string; amount: number }) {
    await sleep(180); // simulated POS latency
    const m = MERCHANTS.find((x) => x.slug === merchantSlug);
    if (!m || amount <= 0 || amount > 5000) return { verified: false, earnRate: 0, merchantName: "" };
    return { verified: true, earnRate: m.earnRate, merchantName: m.name };
  }
  async issueVoucher() {
    const { randomBytes } = await import("crypto");
    const code = "PP-" + randomBytes(4).toString("hex").toUpperCase() + "-" + randomBytes(2).toString("hex").toUpperCase();
    return { code };
  }
  async redeemVoucher() { return { ok: true, message: "Demo adapter accepted (DB status is source of truth)" }; }
}
export const merchantAdapter: MerchantAdapter = new DemoMerchantAdapter();
export function simpleHash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return "h" + Math.abs(h); }
export function timingSafeEqualStr(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
