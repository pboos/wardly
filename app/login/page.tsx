import { sanitizeRedirect } from "@/lib/auth/redirect";
import { LoginForm } from "./login-form";
import { localAuthBypassEnabled } from "@/lib/auth/local-development";
import { LOCAL_LOGIN_CODE } from "@/lib/auth/constants";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const safe = sanitizeRedirect(redirect);

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <LoginForm
        redirect={safe}
        localCode={localAuthBypassEnabled() ? LOCAL_LOGIN_CODE : undefined}
      />
    </main>
  );
}
