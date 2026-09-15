export function TempleRecommendIcon({
  limited = false,
}: {
  limited?: boolean;
}) {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={
          limited
            ? "M12 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6"
            : "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        }
      />
      {/* A central spire and stepped silhouette stay readable at list size. */}
      <path d="M6 16v-4h3v-2l2-3 2 3v2h3v4H6Z" />
      {limited && <path d="M18 16v6h4" />}
    </svg>
  );
}
