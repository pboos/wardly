Here is the updated breakdown of the task and to-do architecture for Wardly, incorporating your new thoughts on completion tracking and meeting reviews.

## Wardly: Task and To-Do Architecture

### General Task Properties & Mechanics

All tasks and to-dos in the system share a core set of features and operate on a state-machine logic where changes in status can trigger automated actions.

* **Task Association:** Tasks link directly to a unique Member ID, eliminating the need to manually type member names into the task description.
* **Base Attributes:**
* **Task Type:** Defines the category (e.g., Temple Interview, Youth Interview, Calling).
* **Title/Description:** For callings, the title is the calling name. The description can hold multiple candidate names until a specific person is assigned.
* **Assigned Person:** The user responsible for the current state of the task.
* **Due date:** A specific due date for the task to be completed.
* **Priority Level:** Flags for urgency (e.g., "Urgent" or a specific "Low Priority" flag for inactive members).


* **Time Management (Durations):** Tasks have default, adjustable time durations for meeting planning:
* *Temple Interview:* 30 minutes
* *Tithing Interview (Optional feature):* 15 minutes
* *Calling Interview:* 10 minutes


* **State Machine Mechanics:** Each task type has a predefined sequence of allowed states. Changing a task's state can automatically reassign the task to a different user (e.g., moving from a bishopric interview state to an administrative state reassigns the task to the ward secretary).
* **Completion State & Date Tracking:** All tasks share a universal final state ("Done" or "Completed"). Moving a task into this final state does *not* trigger a user reassignment, but it automatically records the exact completion date in the system.

---

### Task Types and Workflows

The system categorizes tasks by type, each with its own specific workflow and status progression.

#### 1. Temple Interviews

* **Standard Temple Interview:**
1. *To Do* (Assigned to Bishopric)
2. *Organize/Set up with Stake* (Auto-assigns to Ward Secretary)
3. *Stake Interview*
4. *Print out and Handout*
5. *Done*


* **Limited Use Temple Interview (Youth / Baptisms only):**
1. *To Do*
2. *Print out and Handout*
3. *Done*



#### 2. General Interviews

These follow a simple two-step workflow: **To Do** $\rightarrow$ **Done**.

* **Youth Interviews:** Handled by the bishop or a counselor.
* **Check-in Interviews:** Routine conversations with members.
* **Tithing Interviews:** Optional to-do type.

#### 3. Calling Workflows

Tasks related to callings track the entire lifecycle of extending or releasing a calling.

* **Calling Process States:**
1. *To Do / Think About / Idea* (Discussing with organizations)
2. *Pray* (A specific name is assigned and being considered)
3. *Interview Person* (Talking to the member)
4. *In front of Ward* (Sustaining the member)
5. *Set Apart*
6. *Entering in System* (Auto-assigns to Ward Secretary to update official church records)
7. *Report* (Status used to bring it back up in bishopric meetings for review)
8. *Done*



---

### UI and View Features

* **Sunday View:** A focused interface used during Sunday meetings.
* Users can filter the view to see only tasks assigned to themselves.
* Includes a swipe-to-hide gesture to quickly dismiss to-dos for members who are not currently in attendance.
* Includes a hidden queue where swiped tasks can be recovered/swiped back into the active view.


* **Bishopric Meeting Review View:** A dedicated dashboard for bishopric meetings that filters tasks by their recorded completion date. This allows the leadership to quickly review all tasks marked as "Done" within specific recent timeframes (e.g., the last 7 days or 14 days) to track progress since the previous meeting.
* **Table Layout:** All tasks, regardless of type, are managed within a unified table view that tracks their current state.
* **Mobile Responsiveness:** The task interface, and the website as a whole, must be mobile-friendly for use on phones and tablets during meetings.
