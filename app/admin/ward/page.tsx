import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { WardSettingsForm } from "./ward-settings-form";

export default async function WardSettingsPage() {
  const user = await getCurrentUser();
  const ward = await prisma.ward.findUniqueOrThrow({
    where: { id: user.ward_id },
    select: {
      name: true,
      content_locale: true,
      time_zone: true,
      sacrament_start_time: true,
    },
  });

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Ward settings</h1>
      <WardSettingsForm
        ward={ward}
        timeZones={Intl.supportedValuesOf("timeZone")}
      />
    </div>
  );
}
