import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return ["", "/rewards", "/tiers", "/merchants", "/blog", "/finder", "/spin", "/missions"].map((p) => ({ url: base + p, lastModified: new Date(), changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 }));
}
