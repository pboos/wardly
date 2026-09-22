import {
  IconBabyCarriage,
  IconBook,
  IconBuildingChurch,
  IconClipboardList,
  IconDroplet,
  IconFileCertificate,
  IconMessages,
  IconTag,
  IconWorld,
} from "@tabler/icons-react";
import { CallingIcon } from "./calling-icon";
import { TempleRecommendIcon } from "./temple-recommend-icon";
import { YouthInterviewIcon } from "./youth-interview-icon";

const icons = {
  todo: IconClipboardList,
  priesthood_aaronic: IconBook,
  priesthood_melchizedek: IconBook,
  check_in: IconMessages,
  temple_endowment_living: IconBuildingChurch,
  temple_sealing_living: IconBuildingChurch,
  patriarchal_blessing_recommend: IconFileCertificate,
  child_baptism: IconDroplet,
  child_naming_blessing: IconBabyCarriage,
  missionary_recommendation: IconWorld,
};
const markers: Record<string, string> = {
  priesthood_aaronic: "AP",
  priesthood_melchizedek: "MP",
};

export function TaskTypeIcon({ type }: { type: string }) {
  const Icon = icons[type as keyof typeof icons] ?? IconTag;
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center gap-0.5"
    >
      {type === "calling" || type === "calling_release" ? (
        <CallingIcon release={type === "calling_release"} />
      ) : type === "temple_recommend" || type === "temple_recommend_limited" ? (
        <TempleRecommendIcon limited={type === "temple_recommend_limited"} />
      ) : type === "youth_interview" ? (
        <YouthInterviewIcon />
      ) : (
        <Icon className="size-4" />
      )}
      {markers[type] && (
        <span className="text-[10px] font-semibold">{markers[type]}</span>
      )}
    </span>
  );
}
