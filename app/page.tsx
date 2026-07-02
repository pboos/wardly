import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME, CLAIM_NAME } from "@/lib/auth/constants";

export default async function Home() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifyJwt(token);

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">
        {payload ? `Hello, ${payload[CLAIM_NAME]}` : "Welcome to Wardly"}
      </h1>
      <p className="text-muted-foreground">
        The assistant to any ward or branch.
      </p>
    </div>
  );
}
