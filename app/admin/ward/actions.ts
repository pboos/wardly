"use server";

import { revalidatePath } from "next/cache";
import { authenticatedAction } from "@/lib/auth/action";
import type { SessionIdentity } from "@/lib/auth/action-result";
import { prisma } from "@/lib/prisma";
import { isHymnLocale } from "@/lib/hymns/locales";
import { isIanaTimeZone, isMeetingTime } from "@/lib/tasks/reminder-schedule";

export async function updateWardSettings(
  identity: SessionIdentity | null,
  formData: FormData,
) {
  return authenticatedAction(
    identity,
    async (user): Promise<{ ok: true } | { ok: false; error: string }> => {
      const name = formData.get("wardName");
      const contentLocale = formData.get("contentLocale");
      const timeZone = formData.get("timeZone");
      const startTime = formData.get("sacramentStartTime");

      if (typeof name !== "string" || !name.trim()) {
        return { ok: false, error: "Please enter a ward name." };
      }
      if (!isHymnLocale(contentLocale)) {
        return { ok: false, error: "Please select a supported ward language." };
      }
      if (!isIanaTimeZone(timeZone)) {
        return { ok: false, error: "Please select a valid IANA time zone." };
      }
      if (!isMeetingTime(startTime)) {
        return {
          ok: false,
          error: "Please enter a valid sacrament meeting start time.",
        };
      }

      await prisma.ward.update({
        where: { id: user.ward_id },
        data: {
          name: name.trim(),
          content_locale: contentLocale,
          time_zone: timeZone,
          sacrament_start_time: startTime,
          updated_at: new Date(),
        },
      });

      revalidatePath("/admin/ward");
      revalidatePath("/meetings/sunday");
      revalidatePath("/meetings/sunday/[date]", "page");
      revalidatePath("/meetings/sunday/upcoming");
      return { ok: true };
    },
  );
}
