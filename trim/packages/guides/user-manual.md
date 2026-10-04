# Serenity Universal user manual

This manual matches the signed-in workspace. The top bar **Facility** switcher is the site every list uses. When **Newton** is selected, the rooms are dry room **D1** and flower rooms **F1** through **F9**. **Noble** is the other facility (dry **D1**, flower **F1**, **Mother Room**, and **Veg 1**). Room names below are Newton examples.

Use **Search the user manual** at the top of this page. Each card is one area. Serenity reads these same sections when you ask how to do something. The operating procedures are a separate page at `/sop`.

The left menu shows only what your role allows. A full menu is **Dashboard**, **Users**, **Facility**, **Rooms** (marked Center), **Tasks**, **Time clock**, **Compliance**, **Harvests**, **Operations**, **Reports**, **Serenity**, **Messages**, **Email**, **User manual**, and **Settings**. On a phone the bottom bar is **Dashboard**, **Rooms**, **Tasks**, **Harvests**, and **More**. **More** and **Open navigation** open the full list.

## Sign in, forgot password, and the top bar

1. Open the Serenity address your organization gave you. The page title is **Your cultivation workspace**. The welcome line is “Know which rooms are yours before the day starts.”
2. Type **Email** and **Password**, then press **Sign in**. Use the account your organization issued. This manual does not list passwords.
3. If the password is wrong, the form shows the error and stays on **Sign in**.
4. Press **Forgot password?** to open **Reset your password**. Enter **Email** and press **Send reset link**. If the email matches an account, Serenity sends a one-hour link. **Back to sign in** returns to the sign-in form.
5. Open the link from the email. The page is **Choose a new password**. Enter **New password** and **Confirm password**, then save. **Back to sign in** returns you to the form. A missing link shows **Reset link missing** and **Request a reset link**.
6. After sign-in you land on **Dashboard**. The drawer shows your organization name under the Serenity wordmark.
7. In the top bar, open **Facility** and choose the site you are working, such as **Newton** or **Noble**. Rooms, tasks, the facility board, harvests, and operations follow that choice.
8. Next to Facility, the clock shows **Out**, **In**, or **Lunch**. The button beside it is **Clock in**, **Lunch**, **End lunch**, or **Clock out**, depending on your current state. Pressing the status opens **Time clock**. The clock is hidden when your role does not include timeclock.punch.
9. On the right, press your photo, or your initials if no photo is saved. The menu is **User Profile** and **Logout**. **User Profile** opens your own phone, address, and photo. **Logout** ends the session and returns you to **Sign in**.

## Dashboard

1. Open **Dashboard** in the left menu, or the bottom bar on a phone. The page title is **Dashboard**. The kicker is your organization name.
2. Confirm the facility in the top bar. The introduction says which facility is selected and that yield charts, rooms, and tasks due today use that facility.
3. Read the four counts: **Facilities**, **Rooms**, **Active crops**, and **Tasks due**.
4. Read the charts for the selected facility: **Estimated Yield Graph**, **COGS Breakdown**, **Top Performing Strains**, **Plant Forecast**, and **Packages by Item**.
5. Under **Rooms**, press a room card to open that room. On Newton a flower card is named like **F1** and the dry card is **D1**.
6. Under **Tasks due today**, press a task to open it, or press **Tasks** for the full list. Empty days say “Nothing is due for you today.” Kinds are marked **Cycle**, **Room**, or **Duty**.
7. If the top bar has no facility, the page asks you to choose one before rooms appear.

## Facility and Rooms

1. Open **Facility**. The title is your organization name. Each card is a facility you can open. Press a card to select it in the top bar and go to **Rooms**.
2. Organization admins can press **Add facility**, fill **Name**, **Street**, **City**, and **Region**, then save. **Edit** changes an existing card. People without facilities.write see the cards and cannot add or edit them.
3. Open **Rooms**. The kicker is the facility code (Newton is **HARBOR**). The title is **Rooms**.
4. Press **Open room** on a card, or the room name, to open that room’s dashboard. Press **Open cycle** when the card shows an active crop.
5. People with rooms.write can press **Add room**, enter **Name** and **Type** (flower, veg, mother, or dry), then **Add room**. **Cancel** closes the form. **Edit** on a room changes **Name** and **Type**.
6. On the room page the title is the room name, such as **F1**. The kicker is the facility and the room type. Tabs are **Dashboard**, **Tasks**, **Notes**, **Zones**, **Settings**, and, on a flower room, **Trolmaster settings**.
7. **Dashboard** shows **Current crop** and **Open cycle**, the Trolmaster chart, and **Operating history**. If there is no crop, the card says to use **Reset room**. If there is no history, it says “This room has no operating history.”
8. **Tasks** lists room chores due in this room. Press **Finished** on an open task when the work is done. Press **Add task** to enter a **Title**, due date, one-time or recurring cadence, and an assignee, then **Add task**. Crop-cycle work and recurring duties also appear on **Tasks** in the left menu.
9. **Notes** lists notes for the active crop. Press **Add note**, choose **Category** (General, Environment, Irrigation, Canopy, Pests, Nutrients, Equipment, or Harvest), set **Date** and **Time**, type **Note**, and press **Add note**. A room with no active crop says so and does not take a note.
10. **Zones** lists zone chips. Type **Zone name** and press **Add zone**. **View** shows the zone code. **Edit** changes **Name**. Delete removes the zone.
11. **Settings** holds **Latest environmental readings**, **Active alerts**, **Record a reading**, **Import a CSV**, **Alert rules**, **Defoliation schedule**, **Transplant schedule**, **IPM schedule**, archived crops, **Last successful Metrc sync**, and **Environment gateway**. Dry rooms omit defoliation and transplant.
12. On **Defoliation schedule**, press **Add defoliation**, enter **Defoliation day** (day 1 is the crop start), and press **Save schedule**. These days become **D** columns on the Facility board.
13. On **Transplant schedule**, a crop must already be started. Press **Add transplant**, pick a date on or after the crop start, and press **Save schedule**. Saved days show as **T** on the Facility board.
14. On **IPM schedule**, check exactly two weekdays (Tuesday and Friday are suggested) and press **Save schedule**. Scout findings are recorded under **Operations** → **IPM**, not on this card.
15. On **Record a reading**, enter **Device**, **Metric** (Temperature, Relative humidity, CO₂, or Substrate), **Value**, **Unit**, **Timestamp**, and **Quality** (Good, Suspect, or Bad). Check **Sample data** only for a sample. Press **Save reading**. **Import readings** accepts a CSV. A reading older than the stale window is marked stale. Times use the facility time zone.
16. On **Alert rules**, choose **Metric** and **Kind**, enter **Minimum** and **Maximum**, and press **Save alert rule**. **Active alerts** lists anything currently outside a rule. “No active alerts.” means the room is inside its rules.
17. **Environment gateway** names the site gateway when one is registered. **Post gateway reading** stores a live reading (not sample data). If none is registered, the card says “No environment gateway is registered for this site.” A gateway from another facility cannot write this room.
18. On a flower room, open **Trolmaster settings**. Turn the switch to **Trolmaster on** or **Trolmaster off**. Enter **TrolMaster controller id** and **API credential**, then **Save**. The Dashboard chart reads temperature, humidity, CO₂, VPD, and light for that controller.
19. **Reset room** is on the room header when your role includes rooms.write or workflows.manage. Press **Reset room**, enter **Strain**, **Plant count**, **Stage**, **Start date**, and **Cycle duration in days**. The end date is calculated; the start date is day 1. **Harvest date** is optional and is stored on the crop being closed. Press **Reset room** to close the current crop into **Archived crops**. Zones, readings, and alert rules stay. **Cancel** closes the form without resetting. Reset does not create plant tags.

## Crop cycle

1. From the room **Dashboard**, press **Open cycle**, or press the crop name. The page title is the crop name. Chips show the status, the cycle day, and the workflow template version when one is attached.
2. The link at the top is the room name, such as **F1**. Press it to go back to that room.
3. Open **Crop details** to change **Name**, **Cultivar**, **Stage**, **Start**, and **Cycle duration in days**. Saving requires permission to edit the crop. Deleting an active crop is on the same panel.
4. **Generated tasks** lists the tasks created from the template. Open one to work it, or use **Add task** with **Task title** and **Due**.
5. **Reschedule** changes the crop start. Enter **New start date**, press **Preview**, read the shifted due dates, then press **Confirm reschedule**. Preview does not move dates until you confirm. Reschedule requires workflows.manage.
6. The **Harvest** panel is harvest prep. Stay on this page. **Reset room** only plans the next crop; it does not create tags.
7. Read **1. Plants on this crop**. Tags already on the crop appear as chips. **None yet.** means you still need tags.
8. Under **2. Add tags**, choose **License**, type **Plant tags**, and press **Add tags to crop**. **Compliance** opens the license list if you need the inventory first. Adding tags requires inventory permission.
9. Under **3. Cut the crop**, press **Harvest this crop** only when the tags are on the crop and you are ready to open a harvest. That button requires harvests.write. It creates the harvest record; weights and packages are entered on the harvest page.

## Tasks and the Facility board

1. Open **Tasks**. The title is **All tasks due today**. The introduction names the selected facility and today’s date.
2. If no facility is selected, the page says to choose one in the top bar before the board loads.
3. Read the **Facility board**. The line under the title names the facility, for example Newton, and says the grid is rooms by milestones. Scroll sideways for every column.
4. Rows are rooms. Dry rooms such as Newton **D1** are left off the milestone grid. Flower rooms such as **F1** are rows.
5. Columns, in order, are **1st** (crop start), defoliation days such as **D21** and **D35**, then chores **Sul.**, **Side Net**, **Filters AC**, **LS**, harvest **H**, transplant **T**, **Garden Clean**, **Water Filters**, and **Fans / AC**. Hover a column header for the full name.
6. The legend is **Done**, **Due**, **Overdue**, and **Scheduled**. A date in a cell is the month and day for that room. Press a room name to open the room.
7. Press **Full screen** to fill the screen. Press **Exit full screen** or the Escape key to leave it. The board is read-only; change dates on the room **Settings** tab or by completing the matching task.
8. Below the board, three lists show work due that day: **Crop cycle tasks**, **Room tasks**, and **Recurring duties**. Each card is marked **Cycle**, **Room**, or **Duty**.
9. Press **Finished** when the work is done. If the card asks for **Notes**, **Photo**, **Measurement**, **Sign-off**, or **Supervisor approval**, fill those before it will finish. **Open room** jumps to the room.
10. A finished card shows **Finished** and drops off the open list. You cannot finish another person’s task unless it is assigned to you or your role can write tasks.

## Time clock

1. Open **Time clock**, or press the status in the top bar. The kicker is the selected facility, such as Newton. The title is **Time clock**.
2. Read your state: **Out**, **In**, or **Lunch**.
3. From **Out**, press **Clock in**. The state becomes **In**.
4. From **In**, press **Lunch** to start lunch, or **Clock out** to leave. Lunch is unpaid.
5. From **Lunch**, press **End lunch** to return to **In**.
6. The same buttons sit in the top bar and punch the facility selected there.
7. **Who’s in** lists people who are **On the clock** or **On lunch**, with the facility and the time they punched. An empty list says “Nobody is clocked in right now.”
8. **Serenity payroll & accounting** appears only with timeclock.manage. Set **From** and **To**, press **Refresh payroll**, and read **Employees**, **Regular hrs**, **OT hrs**, and **Gross**. Overtime uses a California-style daily and weekly 1.5× rule. This is hours and gross pay, not tax filing or a bank deposit.
9. Under **Pay rates**, enter **Employee name** and **Hourly $**, then **Save rate**.
10. Type a question and press **Ask Serenity** to ask about the payroll period you selected.

## Compliance, plants, and licenses

1. Open **Compliance**. The kicker is **Licenses** and the title is **Compliance**. You need compliance.read. The page lists licenses for facilities you can open.
2. Press **Open inventory** on a license. The inventory page has **Batches** and plants. Press **Add batch** or **Add plant** when you have inventory.write. Without that permission the lists are visible and the add buttons stay off.
3. A license card shows the latest inventory comparison: matched count and discrepancies. **No discrepancies.** means the last file matched. **No inventory file has been compared for this license.** means none has been imported yet.
4. Open a plant tag from a crop or from inventory. The title is the tag. Change **Stage** and save when you can write inventory. **Move to room** chooses **Room** and **Move plant** places the tag in a room on a facility you can open.
5. **Submissions** lists reviewed sandbox changes. Status lines are **Waiting for a manager**, **Success**, **Definite failure**, and **Uncertain**.
6. A manager presses **Approve** or **Reject**. Reject can include a **Rejection note**. **Sandbox says landed** and **Sandbox says it did not land** record what the sandbox reported. **Queue again** creates a new reviewed submission after a definite failure. Nothing here is a live Metrc send.

## Harvests and packages

1. Open **Harvests**. The kicker is **Postharvest** and the title is **Harvests**. The list is harvests for facilities you can open.
2. Press a harvest name. The back link is **Harvests**. The title is the harvest name and the kicker is the license number.
3. Read **Steps** and the weight figures: **Wet weight**, **Dry weight**, **Packaged**, **Waste**, and **Unaccounted**.
4. Enter **Wet weight (g)** and press **Start drying** when wet weight is recorded.
5. Enter **Dry weight (g)** and press **Record trimming** when the dry weight is known.
6. Under **Package**, enter **Package weight (g)** and **Package tag**, include source tags with **Include harvested tags** or **Scan a source tag**, then press **Create package**. The button stays off until a tag, a label, and a weight are present.
7. **Packages** lists labels already created. Press one to open it. The package title is the label. **Open harvest** returns to the harvest. **Queue for review** sends the package change into the Compliance submission queue. Status words are **Success**, **Definite failure**, and **Uncertain**.
8. **Source tags** lists the plant tags on the harvest. You need harvests.write to record weights and create packages. People with only harvests.read can open the pages and cannot save those steps.

## Operations

1. Open **Operations**. The first area is **Irrigation and feed**. The row of buttons is **Irrigation and feed**, **IPM**, **Maintenance**, **Purchasing**, **Sanitation**, **Training**, **Room calendar**, **Recurring tasks**, and **SOP library**. You need operations.read to open the page and operations.write to save a record.
2. If no facility is selected, the page says “Choose a facility you can open.”
3. **Irrigation and feed**: choose **Room** (a Newton room such as **F1**), **Date**, **Kind** (**Irrigation** or **Feed**), **Method**, **Volume (L)**, **EC**, **pH**, **Nutrient**, and **Note**. Press **Save record**. The list shows earlier passes for this facility.
4. **IPM**: choose **Room**, **Date**, **Target**, **Finding** (**Clear** or **Present**), **Response**, and **Note**. Press **Save record**. A clear scout is still a record. The room **IPM schedule** only picks the two scout days.
5. **Maintenance**: set **Room** (or leave it as a facility-wide job), **Date**, **Asset**, **Kind** (**Preventive** or **Repair**), **Summary**, and **Next due**. Press **Save record**.
6. **Purchasing**: enter **Vendor**, **Ordered on**, **Status** (**Requested** or **Received**), **Description**, **Quantity**, and **Unit cost (cents)**. Press **Save purchase**.
7. **Sanitation**: enter **Date**, **Area**, **Method**, and **Outcome** (**Done** or **Needs follow-up**). Press **Save record**.
8. **Training**: enter **Trainee**, **Title**, **Procedure**, **Status** (**Assigned** or **Completed**), and **Completed on** when it is done. Press **Save training**.
9. **Room calendar**: the month grid shows which cultivar and medium occupy each room. Press **Previous**, **Next**, or **Today**. A quiet day has no stay. Press **Save stay** after you set **Label**, **Cultivar**, **Medium**, **Starts**, and **Ends**. This calendar is manual stays only. It does not copy the Facility board.
10. **Recurring tasks**: enter **Title**, **Cadence** (**Daily** or **Weekly**), **Next due**, **Assignee**, **Room**, and **Procedure**. Press **Save recurring task**. Press **Mark done** on a row to complete it and move the next due date. The same duties appear on **Tasks** when they are due today.
11. **SOP library**: the list is procedures cited by a template task or a cycle task. Edit **Title** and **Summary**, then save. “No procedures are stored yet.” means the library is empty. “Not linked to a task yet.” means the procedure exists but no task cites it. This library is the stored procedure records, not the operating-procedures page at `/sop`.

## Reports

1. Open **Reports**. The kicker is **Analytics** and the title is **Cultivar and room comparison**.
2. Each block is one stored crop cycle for a facility you can open. The number and the formula under it come from stored harvest, labor, and cost rows.
3. If you can open more than one facility, both appear. A facility you cannot open is omitted. An empty list says “No crop cycles are stored for the facilities you can open.”
4. Open a facility report from a cycle when a site link is shown. A facility with no stored cycles says “This facility has no stored crop cycles.”
5. Yield and cost stay on **Reports** and on the **Dashboard** charts. Serenity does not replace those figures.

## Serenity

1. Open **Serenity** in the left menu. The title is **Serenity** and the kicker is the selected facility, such as Newton. You need coach.use.
2. If no facility is selected, the page says “Choose a facility to open Serenity.”
3. Type in the chat and send. Serenity can quote this manual and the operating procedures, generate tasks from stored procedures, train workers, and remember a note you start with “Remember that…”.
4. A defoliation change is a proposal. Read it and confirm before the room schedule changes. She does not change the schedule from a casual sentence.
5. **Room notices** lists active alerts for this facility. The same notices appear on **Tasks**. “No active room alert is stored.” means there is nothing open.
6. **Readiness** lists stored license checks for the facility. It is not a state certification. “This facility has no license stored.” means no license is on file.
7. The round **Serenity** button floats on every signed-in page. Press it to open the small chat. **Open full Serenity page** jumps to the **Serenity** menu item. **Close Serenity chat** hides the panel. The floating chat uses the facility in the top bar.

## Messages and Email

1. Open **Messages**. The title is **Internal messages and Serenity**. You need messages.use.
2. Press a person to start a direct conversation. “No other people yet.” means no one else is in the directory you can message.
3. The list on the left is your conversations. “No conversations yet. Message a person or open Serenity.” is the empty state.
4. Press a conversation, type in the box, and press **Send**. **Choose a conversation** is the prompt before one is selected.
5. **Chat with Serenity** in this list opens the assistant inside Messages. Facility alerts and procedures still follow the facility in the top bar.
6. Open **Email** for **Marketing & announcements**. You need communications.manage. Without it, **Email** is not in the menu.
7. Under **Compose announcement**, enter **Subject** and the body, then press **Send to organization**. The send uses the Marketing branded template. People with email notifications off are skipped.
8. **Custom email templates** covers the branded layouts, including password reset and task notification mail.
9. **Recent sends** lists broadcasts. “No broadcasts yet.” means none have been sent.

## Users and User Profile

1. Open **Users**. The title is **Users, roles, and permissions**. You need access.manage. Other roles do not see **Users**.
2. Tabs are **Users**, **Roles**, and **Permissions**. The **Users** tab starts with **Activity**, **Daily activity**, and **Most active people**.
3. The user table columns are **Name** (photo or initials), **Email**, **Phone**, **Role**, **Facilities**, and **Actions**. Search the box above the table. “No users match that search.” means the filter excluded everyone.
4. Press **View** to read email, phone, **Address**, role, and facilities. Press **Edit** to change them. Delete removes the user.
5. Press **Add user**. Enter **Name**, **Email**, **Password** (at least 8 characters), **Phone**, **Street**, **City**, **Region**, **Postal code**, and **Role**. Press **Choose photo** before you save if you have a picture. Saving creates the account and then stores the photo.
6. On an existing user, **Edit** shows **Upload photo** and **Remove photo**. Leave **Password** blank to keep the current password.
7. **Audit logs** under the table records sign-ins and signed-in actions. Columns are **When**, **Who**, **Action**, and **Summary**.
8. **Roles** lists each role, its description, and its permissions. **Add role** sets **Name**, **Description**, and **Opens every facility** when the role should see every site. **Permissions** lists keys such as the ones that show or hide menu items. **Add permission** adds a key and a description. Changing a role changes what that person sees the next time they load the app.
9. Everyone, including people who cannot open **Users**, updates their own record from the photo menu. Press your photo or initials, then **User Profile**.
10. The page kicker is **Account** and the title is **User Profile**. Press **Change photo** and choose a JPEG, PNG, WebP, or GIF. Edit **Phone**, **Street**, **City**, **Region**, and **Postal code**, then press **Save profile**. Name and email are shown and are not edited on this page.

## Settings

1. Open **Settings**. The title is your organization name. You need settings.manage. Without it, **Settings** is not in the menu. Your own phone and photo are on **User Profile**, not here.
2. **General** holds **Company name**, **Title**, and **Description**. Press **Save changes**. A note says only a manager can change settings when the form is locked.
3. **Workflow templates** on General links to the template builder. Templates are the blueprints that generate crop-cycle tasks. Open one, edit tasks, and press **Save template**. **SOP record** and **Save SOP** attach a procedure to a task. **Team** and **Save team** set who receives generated work. Building templates requires workflows.manage.
4. **API's** holds **Metrc API's** (**Integrator API key**, **User API key**, **Facility license number**, then **Save**) and **Serenity · OpenAI** (**OpenAI API key**, **Model**, then **Save Serenity OpenAI**). Saving a key stores it. It does not call Metrc or OpenAI until a later action needs that service.

## This manual and the SOP

1. Open **User manual** in the left menu. Anyone who can open **Dashboard** can open it.
2. The box at the top is **Search the user manual**. Type a section name, such as **Time clock** or **Reset room**. Matching cards stay on the page. The count under the box says how many sections matched. “Nothing in this guide matches that search.” means no section contains those words. Clear the box to see every section again.
3. Each card is one section of this manual, with the numbered steps. The icon matches the area (rooms, tasks, harvests, and the rest).
4. Open the operating procedures at `/sop` (add that path to the Serenity address). You need operations.read or workflows.manage. The box there is **Search operating procedures**. Search works the same way: one card per procedure, with **Who**, **When**, **Steps**, and **Done**.
5. Ask Serenity, from the **Serenity** page or the floating chat, how to do a job described here. She prefers these sections and names the one she used.
