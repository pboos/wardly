import { getSessionUser } from "@/lib/auth/dal";

export async function GET() {
  const user = await getSessionUser();
  return Response.json(
    user ? { userId: user.id, wardId: user.ward_id } : null,
    { status: user ? 200 : 401, headers: { "Cache-Control": "no-store" } },
  );
}
