import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { SessionProvider } from "@/components/session-provider";
import { getSessionUser } from "@/lib/auth/dal";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wardly",
  description: "The assistant to any ward or branch.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();
  const userName = user?.name;

  return (
    <html lang="en" className={cn("h-full", "antialiased", geistSans.variable)}>
      <body className="min-h-svh flex flex-col">
        <SessionProvider
          key={user ? `${user.id}:${user.ward_id}` : "anonymous"}
          identity={
            user
              ? {
                  userId: user.id,
                  wardId: user.ward_id,
                }
              : null
          }
        >
          {userName && <SiteHeader userName={userName} />}
          {userName ? (
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
              {children}
            </main>
          ) : (
            children
          )}
          <Toaster position="bottom-center" />
        </SessionProvider>
      </body>
    </html>
  );
}
