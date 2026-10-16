export type NavigationLink = {
  readonly kind: "link";
  readonly label: string;
  readonly href: string;
};

type NavigationGroup = {
  readonly kind: "group";
  readonly label: string;
  readonly match: string;
  readonly items: readonly NavigationLink[];
};

export type NavigationItem = NavigationLink | NavigationGroup;

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { kind: "link", label: "Members", href: "/members" },
  { kind: "link", label: "Tasks", href: "/tasks" },
  {
    kind: "group",
    label: "Meetings",
    match: "/meetings",
    items: [
      { kind: "link", label: "Sunday", href: "/meetings/sunday" },
      { kind: "link", label: "Bishopric", href: "/meetings/bishopric" },
      { kind: "link", label: "Ward council", href: "/meetings/ward-council" },
    ],
  },
  {
    kind: "group",
    label: "Admin",
    match: "/admin",
    items: [
      { kind: "link", label: "Users", href: "/admin/users" },
      { kind: "link", label: "Ward settings", href: "/admin/ward" },
      { kind: "link", label: "Sync", href: "/admin/sync" },
    ],
  },
];

export function getNavigationCurrent({
  pathname,
  path,
}: {
  pathname: string;
  path: string;
}): "page" | "location" | undefined {
  if (pathname === path) return "page";
  if (path !== "/" && pathname.startsWith(path + "/")) return "location";
  return undefined;
}
