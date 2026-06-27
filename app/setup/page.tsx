import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { setupInitialWard } from "./actions";
import { Button } from "@/components/ui/button";

export default async function SetupPage() {
  const wardCount = await prisma.ward.count();

  if (wardCount > 0) {
    notFound();
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <form action={setupInitialWard} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Set up your ward</h1>
        <div className="space-y-2">
          <label htmlFor="wardName" className="text-sm font-medium">
            Ward name
          </label>
          <input
            id="wardName"
            name="wardName"
            type="text"
            required
            className="w-full rounded-md border px-3 py-2"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="userName" className="text-sm font-medium">
            Your name
          </label>
          <input
            id="userName"
            name="userName"
            type="text"
            required
            className="w-full rounded-md border px-3 py-2"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="userEmail" className="text-sm font-medium">
            Your email
          </label>
          <input
            id="userEmail"
            name="userEmail"
            type="email"
            required
            className="w-full rounded-md border px-3 py-2"
          />
        </div>
        <Button type="submit" className="w-full">
          Create
        </Button>
      </form>
    </main>
  );
}
