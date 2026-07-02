# Next features
- Meetings
  - For now just staic list of items + their duration
  - Allow adding items in that list (not stored to DB, for now just store them and their state in localstorage) and giving a duration
    - Allow "reset" to reset the meeting to the predefined items (from below)
  - Also allow removing items from that list.
  - Allow re-arranging the items
  - Then allow starting an item, which will start a timer for the duration of the item. At the end it should give an alarm, notifying we need to move to the next. There should be a popup/dialog for the alarm and then a way to dismiss it, or extend for 1-5min.
    - A timer can also be stopped before it is done.
    - When done that meeting item is marked as "done" (check mark in front?)
  - Meeting items
    - Opening prayer (2min)
    - Spiritual Thought (2min)
    - Next Sunday & Activity (5min)
    - Interviews (5min)
    - Callings (5min)
    - Members in need (10min)
    - Covenant path (5min)
    - Closing prayer (2min)
- Tasks

# Future Improvements

## Auth
- redirect - if they open a page and are not logged in -> after login they should be bac on that page (with both code & link in email)
- Rate limiting on `requestLogin` (per email + per IP).
- "Resend" code / "Change email"

## API
- zed for api schema
- in setup if something bad, instead of error correct response and nicer error shown
