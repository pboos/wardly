# Ward settings

Every signed-in ward user can edit their own ward at **Admin → Ward settings**
(`/admin/ward`). There is no separate admin role.

The form starts with saved values and requires a nonblank name, a supported
content language (English/Deutsch), a sacrament start time (`HH:mm`), and a valid
IANA time zone. Names are trimmed. Missing legacy start times appear empty and
must be set to save. Pending submissions disable controls; failures retain the
draft for retry and successful saves show a toast.

Setup and settings use the same searchable time-zone field. It includes runtime
supported zones, UTC, and the current value. Setup defaults to the browser zone;
settings always prefer the saved ward zone, even when the device differs.

Only the authenticated user's ward row is updated. Sunday meeting dates remain
calendar strings and never shift when changing zones. Hymn numbers remain saved
as-is and titles resolve using the current content language, including historical
entries; see [hymns](../hymns/README.md). Page revalidation refreshes the schedule,
details, and upcoming selection. Time zones affect today/history classification;
start time and zone affect subsequent [reminder scheduling](../tasks/reminders.md).
No schema change or database reset is required.

## Implementation and verification

- [Page](../../../app/admin/ward/page.tsx) loads the authenticated ward.
- [Form](../../../app/admin/ward/ward-settings-form.tsx) handles submission and feedback.
- [Action](../../../app/admin/ward/actions.ts) validates, persists, and revalidates.
- [Shared time-zone field](../../../components/ward-time-zone-field.tsx) is also
  used by [setup meeting fields](../../../app/setup/meeting-fields.tsx).
- [Action tests](../../../app/admin/ward/actions.test.mjs), included in `npm test`,
  cover validation, authentication, ward isolation, and unchanged dates/hymn rows
  against temporary SQLite. Check the browser at desktop and mobile widths,
  including search, saved-zone precedence, persistence, and failed-save retry.

Authenticated client actions use the shared [session recovery flow](../login/README.md#session-recovery).
Components bind guarded `actions.ts` functions through `useAppMutation`;
authentication failures retain drafts for explicit retry after login. See the
[shared action architecture](../login/actions.md).
