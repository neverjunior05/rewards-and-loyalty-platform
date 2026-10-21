import { NextResponse } from "next/server";
import { ensureSeed, fullState } from "@/lib/server";
export async function GET(req: Request) {
  await ensureSeed();
  const url = new URL(req.url);
  const userId = Number(url.searchParams.get("userId") || req.headers.get("x-user-id") || 0);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const state = await fullState(userId);
  if (!state.me) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(state);
}
