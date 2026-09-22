import { getCurrentUser } from "@/lib/auth/dal";

export default async function LoginCompletePage() {
  await getCurrentUser();
  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 py-12">
      <h1 className="text-2xl font-semibold">You’re logged in</h1>
      <p className="text-muted-foreground">
        Return to your original tab and retry your change. You can close this
        tab.
      </p>
    </div>
  );
}
