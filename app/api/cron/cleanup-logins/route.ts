import { NextResponse } from "next/server";
import { deleteExpiredLogins } from "@/lib/auth/cleanup";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  await deleteExpiredLogins();
  return NextResponse.json({ ok: true });
}
