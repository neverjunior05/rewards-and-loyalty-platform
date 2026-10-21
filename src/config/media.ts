// All media URLs grouped by page/section. Swap here only. Each has CSS gradient fallback in UI.
export const MEDIA = {
  home: {
    heroCelebration: "https://images.pexels.com/photos/30692825/pexels-photo-30692825.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    shoppingFriends: "https://images.pexels.com/photos/6567447/pexels-photo-6567447.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    confetti: "https://images.pexels.com/photos/30692831/pexels-photo-30692831.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    spaGift: "https://images.pexels.com/photos/6690195/pexels-photo-6690195.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    birthday: "https://images.pexels.com/photos/30682919/pexels-photo-30682919.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    bubbleTea: "https://images.pexels.com/photos/19996404/pexels-photo-19996404.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  rewards: {
    coffee: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80&auto=format&fit=crop",
    groceries: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80&auto=format&fit=crop",
    cinema: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80&auto=format&fit=crop",
    travel: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80&auto=format&fit=crop",
    fashion: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80&auto=format&fit=crop",
    spa: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80&auto=format&fit=crop",
    food: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80&auto=format&fit=crop",
    tech: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80&auto=format&fit=crop",
    charity: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80&auto=format&fit=crop",
    gift: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&q=80&auto=format&fit=crop",
  },
  fallback: "linear-gradient(135deg,#140C24,#7C3AED 55%,#FFC83D)",
};
export const CREDITS = [
  "Photography: Pexels (Tim Douglas, Jonathan Valdes, Tara Winstead, George Frewat) — Pexels Licence, free to use",
  "Photography: Unsplash contributors — Unsplash Licence",
  "Avatars: DiceBear API (CC BY 4.0 styles)",
  "Fonts: Lexend, Public Sans, Martian Mono — Google Fonts (OFL)",
  "Icons: Lucide (ISC) • Reward artwork: original inline SVG/CSS in violet/gold/white",
  "3D-style coins & tier cards: procedural CSS/SVG (no external GLB) with image fallback",
  "QR codes: generated client-side with the `qrcode` library — no external service",
];
export const avatarFor = (seed: string) => `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=7c3aed,ffc83d,4c1d95&fontWeight=700`;
