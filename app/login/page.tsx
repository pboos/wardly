import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <form className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Log in</h1>
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="w-full rounded-md border px-3 py-2"
        />
        <Button type="submit" className="w-full">
          Log in
        </Button>
      </form>
    </main>
  );
}
