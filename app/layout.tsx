import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { verifyJwt } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME, CLAIM_NAME } from "@/lib/auth/constants";

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
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifyJwt(token);
  const userName = payload?.[CLAIM_NAME];

  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable)}
    >
      <body className="min-h-svh flex flex-col">
        {userName && <SiteHeader userName={userName} />}
        {userName ? (
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
            {children}
          </main>
        ) : (
          children
        )}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
