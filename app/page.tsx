import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME, CLAIM_NAME } from "@/lib/auth/constants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function Home() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifyJwt(token);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-heading">
            {payload ? `Hello ${payload[CLAIM_NAME]}` : "Wardly"}
          </CardTitle>
          {payload && (
            <CardDescription>
              The assistant to any ward or branch.
            </CardDescription>
          )}
        </CardHeader>
        {payload && (
          <CardContent className="flex justify-center">
            <Button asChild variant="outline" size="sm">
              <a href="/logout">Log out</a>
            </Button>
          </CardContent>
        )}
      </Card>
    </main>
  );
}
