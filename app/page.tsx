import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME, CLAIM_NAME } from "@/lib/auth/constants";

export default async function Home() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifyJwt(token);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-3xl font-semibold">
        {payload ? `Hello ${payload[CLAIM_NAME]}` : "Wardly"}
      </h1>
      {payload && (
        <a href="/logout" className="text-sm text-muted-foreground underline">
          Log out
        </a>
      )}
    </main>
  );
}
