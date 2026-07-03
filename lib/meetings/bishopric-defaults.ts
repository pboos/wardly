export type MeetingItem = {
  id: string;
  name: string;
  durationMin: number;
};

export const BISHOPRIC_DEFAULT_ITEMS: MeetingItem[] = [
  { id: "opening-prayer", name: "Opening prayer", durationMin: 2 },
  { id: "spiritual-thought", name: "Spiritual Thought", durationMin: 2 },
  { id: "next-sunday-activity", name: "Next Sunday & Activity", durationMin: 5 },
  { id: "interviews", name: "Interviews", durationMin: 5 },
  { id: "callings", name: "Callings", durationMin: 5 },
  { id: "members-in-need", name: "Members in need", durationMin: 10 },
  { id: "covenant-path", name: "Covenant path", durationMin: 5 },
  { id: "closing-prayer", name: "Closing prayer", durationMin: 2 },
];
