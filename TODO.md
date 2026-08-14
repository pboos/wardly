# Next features
-> FOR SUNDAY MEETING -> on task_type status have a boolean if that status is to be presented in sacrament. Maybe even as what? Not sure on that one. But at least something to be clear it is the state to be done in sacrament meeting.
Fixes on sunday planning list
- do not automatically generate past and future sundays
  - have a button at the bottom to add a new one after last existing sunday.
  - have a button at the top to add a new one before first sunday
  - earlier/later buttons on the screen do not generate new ones if none on that page. they are hidden in case there are no previous / next sundays
- on a page only show 16 sundays. by default show previous 3, current 12

- different background colors for the rows
  - today or upcoming sunday with bold text and border around whole row
  - all non sacrament or fast and testimony ones with a slightly yellow background
  - the sacrament/fast and testimony ones have no background as they are now
- keep date frozen on left when scrolling right

- editing
  - on edit hymn: no dialog, in line edit. when pressing enter, save it. on enter in text field it should save it. instead of d
  - TODO maybe each sell just to be a text field (or similar). if person, then it lists the members and one can type. If enter without selecting a member, then it will be a non member. And if multiple are possible, then have it shown as a badge. backspace will delete the previous one, after it allows again adding one (member or non member from ward).

- when loading, can we load them quicker instead of loading each and then for each doing another load for the rows. can we not just get sundays and then all items for all sundays and those then correctly split up again for each sunday? so that we can reduce quries to db which slows the page load down. find ways to improve the loading speed without making the code difficult to read.
- TODO meeting leader: just allow selecting from ???

on leading view
- no previous / next
- have go back schedule at top left
- TODO assignment history in wrong place


- Sunday sacrament meeting schedule (an entry for each sunday, but if not exist, there is already a sunday. Can have type sacrament/fast and testimony/ward conference/stake conference / stake conference (stake and general confere would have no schedule for the meeting)
  - Hymns just enter number - list of hymns with texts in json file
  - Talks/Prayers (also sacrament bless, pass, ...) can be member id (show name) but also free text in case of missionary, visitor, ...
    - For talks maybe even have a field for the topic assigned
  - Visitors (multiple) -> Stake president, High Council, ... (drop down of what they are? that could automatically show who is presiding) but also free text, and name free text always
  - Leading (member id or even user-id as this is someone from the bishopric normaly, but sometimes can be elders quorum as well), organist (member id, can be multiple ones), music conductor (member id, can be multiple ones)
  - on the sarcament meeting itself have also an info field that we can show
  - Two views
    - List all sundays in a table (similar to tasks right now)
      - Date, Type (Sacrament, Fast, Ward conference, Stake conference, General conference), Leading, Organist(s), Conductor(s), Opening Hymn, Sacrament Hymn, Interlude Hymn, Closing Hymn, Information, Opening Prayer, Closing Prayer, Speaker 1, Speaker 2, Speaker 3
      - Here we should be able to edit everything (Except the date) directly by clicking. It should open dropdown for member names (but also allowing entering a non member name in free text), or editing the free text (Information)
        - For organists, conductors have a (+) that allows adding one. But also allow already added one.
    - Meeting leading view (by default the one today if sunday or upcoming)
      - have everything in the right order to lead through the meeting
      - Can also show texts for everything for persons who can't speak well. Maybe even allow for adding custom texts in between items (maybe by having a meeting item of type text that also has a "after_????_item_id" to make sure it is in the right place. And we don't allow two such items right after each other as that can cause problems)
      - Maybe have a switch at the right top that will show/hide texts that help more to lead throught he meeting.
      - We should also be able to adjust things (like prayers)
  - There can also be other things that need to go into the plan in sacrament meeting
    - Naming and blessing of children
    - Welcome of new members in the ward
    - Confirming new converts
    - From tasks (Callings, Caling releases, Priesthood)
      - Texts for calling & release pre defined for languages (from ward language, json files with those translations? or translation framework directly? but site could be used in english but ward language be in another language)
  - We want to know when which member gave their last talk or prayer. So we can have a list who has not done it for a while and that we could ask again.
  - For callings (linked tasks). Allow easy moving them (or maybe even other ones like welcoming members, ...) to the next meeting (next normal sacrament or fast-&testimony meeting. never general conference or stake conference). e.g. for callings if the person is not there, we just quickly want to move it to the next possible sunday to have it done there.
- Callings
  - Have a separate schema for callings planning. Each row should have ward_id, organization, calling, member_id (optional) (maybe also a non_member_name for allowing to give callings to non members), state, task_id
    - we would allow to create a task for the calling directly. this task would then be linked here with task_id
- Also Sunday school (young men, young women) and Primary attendance (together with above?)
  - Meaning who from bishopric will be with which class. And if they need to prepare the lesson or not.
- Activities
  - Not sure yet how to do these.
- Tasks
  - Task Type to have icon (svg) that we can show in table?
  - Priority and due date nowhere yet
  - hide until date (do not show task until given date) - option to show it in list?
    - easy way on sunday to quickly hide some (e.g. they are not there). but then to show those hidden
  - dialog to edit a task (title / description) instead of having edit in the list possible?
    - dialog should also show all the other fields and allow editing them. maybe status change to specific state only possible in here?
  - when filtering by single type, should we group by status? last status top?
  - priority whenever -> better name (this is probably for the backlog that we don't really show by default and hide?)
- Backup / Import
  - For now a simple json backup/import so that we can export all the data into a json and import it again. We can do that for example if we want to completely reset the db but then recreate last state.
- Sync
  - Show a button for both scripts?
  - Should we also sync the uuid from lcr (we get it in one of the scripts - but that script doesn't keep working it seems)?

# Future Improvements

## Auth
- Rate limiting on `requestLogin` (per email + per IP).
- "Resend" code / "Change email"

## API
- zed for api schema
- in setup if something bad, instead of error correct response and nicer error shown
