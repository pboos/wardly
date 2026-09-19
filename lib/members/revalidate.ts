import { revalidatePath } from "next/cache";

export function revalidateMemberViews() {
  revalidatePath("/members");
  revalidatePath("/tasks");
  revalidatePath("/meetings/sunday", "layout");
}
