# Site navigation

The signed-in header links to Members, Tasks, Meetings, and Admin.
Meetings contains Sunday, Bishopric, and Ward council. Admin contains Users,
Ward settings, and Sync.

- At `md` and above, Members and Tasks are direct links. Meetings and Admin
  each open a dropdown.
- Below `md`, the labeled Menu button opens one flat dropdown. Members and Tasks
  come first, followed by labeled Meetings and Admin groups. Rows have a minimum
  height of 44 pixels. The menu fits the viewport and scrolls vertically when needed.
- Active links and desktop section buttons have a visible background. Matching
  requires the exact path or a slash-delimited descendant. Links use
  `aria-current="page"` for exact paths and `aria-current="location"` for descendants.
- Sunday opens the [schedule](../sunday-meetings/schedule.md) at `/meetings/sunday`.
  The schedule's Open upcoming meeting action opens the next local meeting.
- The account button has an accessible name that includes the user's name,
  including when only the avatar is visible. Its menu contains Log out.

## Implementation and verification

[SiteHeader](../../../components/site-header.tsx) owns the brand and account menu.
The readonly link/group registry and path matcher live in
[site-navigation.ts](../../../components/site-navigation.ts).
[DesktopNavigation](../../../components/desktop-navigation.tsx) and
[MobileNavigation](../../../components/mobile-navigation.tsx) render that registry
with the shared Radix dropdown components.

Browser checks cover narrow and desktop widths, keyboard opening and dismissal,
link navigation, active states on dated Sunday pages, and vertical scrolling in
short viewports. Header navigation must not cause horizontal page scrolling.
