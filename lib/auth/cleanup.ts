import { prisma } from "@/lib/prisma";
import { LOGIN_TTL_MS } from "@/lib/auth/constants";

// Delete login rows older than the TTL. Called lazily from login actions and
// by the cron route.
export async function deleteExpiredLogins() {
  const cutoff = new Date(Date.now() - LOGIN_TTL_MS);
  await prisma.login.deleteMany({ where: { created_at: { lt: cutoff } } });
}
