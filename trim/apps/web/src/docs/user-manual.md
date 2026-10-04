# Serenity Universal user manual

Serenity is the cultivation workspace for Harbor & Hill Cultivation. The room dashboard is the daily center. A license is not the same thing as a facility: plants and packages belong to a license, and rooms belong to a facility.

Open Serenity at https://available-kelly-labor-faculty.trycloudflare.com

The sign-in page says “Your cultivation workspace” and “Use the account issued by your organization.” Enter **Email** and **Password**, then **Sign in**. The page also says “Know which rooms are yours before the day starts” and “Access follows the site,” beside a greenhouse graphic. On a wide screen that welcome sits on the left. On a phone it sits above the form.

After sign-in, the page opens on **Dashboard**. The left navigation shows only the modules your role’s permissions allow. Typical organization-admin items start with **Dashboard**, then **Users**, Facility, Rooms, Tasks, Time clock, Compliance, Harvests, Operations, Reports, Serenity, Messages, User manual, and Settings. Each item has a small graphic. Rooms is marked Center. **Dashboard** follows the Facility switcher and shows facility charts, that facility’s rooms, and the tasks due for you today. The **Facility board** lives on **Tasks**. A site operator does not see **Users** or **Settings** unless those permissions are granted. Workflow templates stay at `/workflows` and are linked from Settings; they are blueprints for crop-cycle tasks, not the daily Tasks list. The operating procedures document stays at `/sop` and is linked from this manual. The drawer ends with “Room dashboards are the daily center of Serenity.” On a phone, Dashboard, Rooms, Tasks, and Harvests sit on the bottom bar when those modules are allowed, and **More** or **Open navigation** opens the full list. On a tablet and a desktop the list stays on the left.

The top bar has a **Facility** switcher, **Clock in** / **Lunch** / **End lunch** / **Clock out** for the selected facility (status shows Out, In, or Lunch), your name on a wider screen, and **Sign out**. The status dot opens **Time clock** for payroll and the full punch history.

## Who can open what

| Person | Email | Password | What opens |
| --- | --- | --- | --- |
| Avery Chen | `avery.chen@harborhill.example` | `HarborHill-admin` | Organization admin. Full permission catalog, both facilities, both licenses, Users, Settings, payroll, template editing, reschedule, and submission review. |
| Blake Ortiz | `blake.ortiz@harborhill.example` | `HarborHouse-only` | Site operator for Harbor House. Day-to-day modules only (no Users, Settings, workflow manage, or payroll manage). Hill Works stays hidden. |
| Casey Nguyen | `casey.nguyen@harborhill.example` | `HillWorks-only` | Site operator for Hill Works. Same day-to-day module set as Blake. Harbor House stays hidden. |

These are the seeded accounts for this workspace.

## Site access

A facility stays hidden until you have a membership, unless you are an organization admin. Facility says that in the page introduction.

Avery sees Harbor House (Astoria, OR, code HARBOR) and Hill Works (Hood River, OR, code HILL). Blake’s Facility page lists Harbor House. Casey’s lists Hill Works. Choosing a card on Facility sets the top-bar Facility switcher and opens Rooms.

Opening a room, crop cycle, harvest, package, plant, reading, or facility report for the other site does not show that site’s data. The page says you do not have access, or that it is not on a facility you can open. Examples:

- “You do not have access to this room.”
- “You do not have access to this crop cycle.”
- “You do not have access to this harvest.”
- “You do not have access to this package.”
- “You do not have access to this plant.”
- “You do not have access to this license.”
- “You do not have access to this report.”
- “You do not have access to this gateway.”

A Harbor House gateway cannot post a reading into a Hill Works room. The message is “This gateway cannot write that room.” That is true even for Avery.

**Tasks** says tasks from another facility stay off the list. Times on a room use that facility’s timezone, `America/Los_Angeles`. A timestamp you type without a timezone is read as local time at the facility.

## Changing a record

Lists show one page of rows. **Previous** and **Next** move between pages. The line between them reads “Page 1 of 2 · 6 rows.” **View** opens the row. **Edit** opens the stored fields. **Save changes** writes that row. **Delete** asks “Delete this record?” **Cancel** closes the question. Confirming uses **Delete** again.

You can change a row only for a facility you can open. Avery Chen can edit or delete a Hill Works room. Blake Ortiz cannot. The same rule covers zones, crop cycles, tasks, readings, alert rules, harvests, and every Operations list.

Rooms, zones, and Operations rows are removed. Plants, packages, harvest weights, and compliance submissions stay in history. Delete there says “This leaves the active list. The row and its actor stay in history.” A removed room says “This removes the row.”

Reports stay calculated. A report total has no **Delete**.

Add forms that were already on a page keep their buttons: **Add room**, **Save record**, **Save purchase**, **Save training**, **Save stay**, **Save recurring task**, **Save template**, **Save SOP**, **Save reading**, **Save alert rule**, and **Mark done**. New add buttons are **Add facility**, **Add zone**, **Start cycle**, **Add task**, **Add batch**, and **Add plant**.

## Dashboard

**Dashboard** is the first item in the left navigation. It follows the facility in the top bar.

Under the counts, the page shows facility charts built from stored rows.

Charts on Dashboard:

- **Estimated Yield Graph** — dry grams by week and cultivar. Harvested cycles use stored dry weight. Open cycles use plant count times this facility’s average grams per plant when that average exists.
- **COGS Breakdown** — labor, cannabis inputs, and non-cannabis inputs from stored labor rates and input costs.
- **Top Performing Strains** — harvest count and packaged grams by strain.
- **Plant Forecast** — active crop plant counts across the next four days.
- **Packaged (MTD)** and **Average g per plant** — month-to-date packaged weight and the dry-weight average.
- **Packages by Item** — package labels and weights.

Serenity does not store sales dollars on these charts. Below the charts are the facility’s rooms and your tasks due today. Open **Tasks** for the room × milestone **Facility board**.

## Facility

**Facility** opens on “Harbor & Hill Cultivation.” Each card shows the facility name, code, city, and how many rooms it has. Select a card to work in that facility. The top bar also has a **Facility** switcher that chooses the same site and opens Rooms.

**Add facility** opens when you hold `facilities.write`. The form asks for a name, street, city, region, and postal code. **Add facility** saves the facility on this organization and shows the card. **Cancel** closes the form without saving. The code is taken from the name. **Edit** opens the stored name and address. **Save changes** writes them, and the code stays the same. **Delete** asks “Delete this record?” and then removes the facility and its rooms. Avery Chen can add, edit, or delete Harbor House or Hill Works. Blake Ortiz and Casey Nguyen can open their assigned facilities but do not get **Add facility**, **Edit**, or **Delete** on the Facility page.

If an account has no membership, the page says “No facilities are assigned to this account.”

## Rooms

**Rooms** is titled Rooms. The kicker is the facility code, HARBOR or HILL. The line under the title names the facility and its address, then says “Open a room to see its zones, readings, and operating history.” Harbor House is 180 Cannery Road, Astoria, OR 97103. Hill Works is 42 Ridge Lane, Hood River, OR 97031. Choosing a facility in the top bar opens this page.

Each row shows the room name, the active crop name, cultivar, plant count, and day, or “No active crop.” **View** shows the room type, **Open room**, and **Open cycle** when a crop is active. Choose the room name to open the dashboard. The dashboard has a **Current crop** card with the same cycle link.

Seeded rooms:

- Harbor House: Flower 1 (Flower, East canopy and West canopy) and Dry Room (Dry, Hang bay).
- Hill Works: Veg 1 (Vegetative, North tables and South tables) and Mother Room (Mother, Stock bench).

Flower 1’s current crop is Cedar Nights flower. The plants from that crop have been harvested, so the row shows 0 plants. Veg 1’s current crop is Glass Orchard veg, with 86 plants still in the room. Dry Room and Mother Room say “No active crop.”

**Add room** opens the form above the list. Enter a name and choose a type: Flower, Vegetative, Mother, Dry, or Clone. **Add room** saves the room on the facility selected in the switcher and shows it in the list. **Cancel** closes the form without saving. **View**, **Edit**, **Save changes**, and **Delete** sit on each room. **Previous** and **Next** page the list. You can add, edit, or delete a room only for a facility you can open. Avery Chen can change a room at Harbor House and at Hill Works. Blake Ortiz can change a room at Harbor House. He cannot edit or delete a Hill Works room.

The room dashboard introduction says “The dashboard opens on the Trolmaster chart and operating history. Zones, Trolmaster settings, and room settings are on their own tabs.”

The room opens on **Dashboard**. Beside it are **Tasks**, **Notes**, **Zones**, and **Settings**. A flower room also has **Trolmaster settings**.

**Dashboard** shows the **Trolmaster** chart and **Operating history**. The chart plots Temp, Humid, CO2, VPD, and Light. **24 Hour**, **Week**, and **Month** change the window. Each parameter can be turned off. The legend shows that line’s max and min. Move across the chart to read the time and the values. When a crop has history, operating history has Timeline, Movements, Labor, and Harvest result. Observations for that crop are on **Notes**. A room with no history says “This room has no operating history.” The chart has **Trolmaster** and **Test** switches. **Trolmaster on** checks the saved credential with Trolmaster. When the controller is on that credential, the chart names the model and the controller id. Lines draw when history points come back. **Test on** draws a sample of that history and does not call Trolmaster. **Trolmaster off** says “Trolmaster is off.” A room with no saved controller says “Save a Trolmaster controller on Trolmaster settings.” The room does not show a current-crop card.

**Zones** lists the room’s zones. **Add zone** adds a zone. **View**, **Edit**, **Save changes**, and **Delete** sit on each zone.

**Settings** on the room holds alert rules, **Defoliation schedule**, **Transplant dates**, **IPM schedule**, readings, the gateway, the controller sample, and **Last successful Metrc sync**. **Defoliation schedule** takes a day number for each pass. Day 1 is the current crop’s start date, so day 10 is the tenth day of that crop. **Add defoliation** adds another day. **Save schedule** stores them and shows each date. **Remove** drops a day. A room with no crop still stores the day numbers, and the dates stay blank until a crop starts. A dry room does not show **Defoliation schedule** or **Transplant dates**. **Transplant dates** uses a calendar date picker once a crop is running; Serenity stores each pick as a day number from that crop’s start and fills the Facility board **T** column. Without an active crop, the picker stays off until a crop starts. **IPM schedule** is a twice-a-week scout cadence: choose exactly two weekdays (Tuesday and Friday are suggested), then **Save schedule**. **Clear schedule** turns it off. Log what you find under **Operations → IPM**.

**Reset room** sits in the top right of the room page for an organization admin. It opens a form: Strain, Plant count, Stage, Start date, Cycle duration in days, and an optional Harvest date. The start date is day 1, and the form shows the calculated end date for the next crop. Saving closes the current crop, lists it under **Archived crops**, and starts the next crop from the strain. The harvest date, when entered, is stored on the crop being closed. Zones stay on **Zones**. Readings and alert rules stay on **Settings**. An employee does not see **Reset room**.

**Last successful Metrc sync** sits on the room **Settings** tab. With nothing recorded, it says “No successful Metrc sync is recorded.” Serenity does not call live Metrc.

**Tasks** has **Add task**. The form asks for a title, an optional **Description**, **One time** or **Recurring**, and optional **Employees**. You can assign more than one employee to the same task from the **Employees** list. Leave that list on Unassigned when nobody is assigned. A one-time task asks for a **Due date**. A recurring task repeats **Daily** or **Weekly** and does not ask for a due date. A weekly task asks for **Days**, and you can choose more than one, such as Tuesday and Friday. **Edit** and **Delete** are on each added task. A description shows under the task title. **Tasks due today** still lists the crop’s tasks. Empty rooms say “No tasks are due today.”

**Notes** has **Add note**. The form asks for a **Category**, a **Date**, a **Time**, and a **Note**. Categories are General, Environment, Irrigation, Canopy, Pests, Nutrients, Equipment, and Harvest. The date and time start at the current moment and can be changed. **Add note** saves it on the current crop, with the signed-in person’s name, so it can be read later. Each line shows the date and time, the author, the category, and the note. If none are stored, it says “No notes are recorded for this crop.” A room with no crop says “This room has no active crop cycle.”

**Trolmaster settings** is on a flower room. The form asks for **TrolMaster controller id** and **API credential**. It saves them for the room that is open. **Save** stores the controller id and credential. The page then says “Credential saved.” and lists the room name, the controller id, and “Credential saved.” The credential is not shown again. The Dashboard tab checks that credential with Trolmaster when Trolmaster is on and Test is off. The chart names the controller when it is on the credential, and draws lines when history points come back. The same **Trolmaster** and **Test** switches are on this tab. A room that is not a flower room does not show this tab.

## Settings

**Settings** sits after SOP when you hold `settings.manage`. Two tabs sit under the title: **General** and **API's**. The page opens on **General**.

**General** asks for **Company name**, **Title**, and **Description**. **Save changes** writes them. The company name is the organization name in the drawer. Without `settings.manage`, Settings stays out of the navigation and the API refuses the page.

**API's** holds **Metrc API's**. The form asks for **Integrator API key**, **User API key**, and **Facility license number**. Metrc uses the integrator key as the username and the user API key as the password. The user API key belongs to the Metrc user, not the facility. **Save** stores the keys. The page says “Metrc API keys saved.” The keys are not shown again. A saved key can be left blank on the next save so the stored key stays. Serenity does not call Metrc.

## Users

**Users** sits directly under **Dashboard** when you hold `access.manage`. Three tabs sit under the title: **Users**, **Roles**, and **Permissions**. The page opens on **Users**. Without that permission, Users stays out of the navigation and the API refuses the page.

**Activity** sits at the top of the Users tab. It counts people, sign-ins, access changes, and active people from the audit log for the last 14 days, draws a daily activity chart, and lists the most active people.

**Users** lists every person in a table: name, email, role, and facilities. Use **Search users** to filter the list, and click a column header to sort. **Add user** opens a form for name, email, password, role, and facilities. **Edit** changes that person. **Delete** asks “Delete this record?” and removes a person who has not recorded work. You cannot delete your own account. An organization admin’s facilities column says “Every facility.”

**Audit logs** sits under the user table. It lists when, who, the action, and a summary for sign-ins and for every signed-in action across Serenity modules (opens, creates, changes, deletes). High-frequency status polls such as `/auth/me` and time-clock status are skipped so the log stays readable. Use **Search activity** to filter the log, and click a column header to sort. The list opens with newest activity first.

**Roles** lists each role with its description and permissions. Use **Search roles** to filter the list, and click a column header to sort. **Add role** asks for a name, a description, **Opens every facility**, and the permissions to grant. **Edit** and **Delete** change or remove a role that no user still holds.

**Permissions** lists each module key and description (`dashboard.read`, `rooms.write`, `timeclock.punch`, and the rest of the catalog). Use **Search permissions** to filter the list, and click a column header to sort. **Add permission** asks for a key, such as notes.read, and a description. **Edit** and **Delete** change or remove that permission.

A person without `access.manage` does not open **Users**. A custom role can receive individual module keys without organization-admin rights.

Readings and alert rules are on the room **Settings** tab.

**Latest environmental readings** lists Temperature, Relative humidity, CO₂, and Substrate. The line under the title says a reading older than the room’s threshold is stale, and names the timezone. Flower 1 and Veg 1 use 60 minutes. A metric with no reading is stale. A reading marked sample shows **Sample data**. A stale reading shows **Stale**.

**Active alerts** lists alert text, or “No active alerts.” An alert exists only when the room has a saved alert rule. Flower 1 has a stale rule for relative humidity, so humidity that is older than 60 minutes stays listed even after a new temperature arrives. The seeded humidity is 58.2% from device `hh-flower-1-rh`.

**Reading history** is a chart. The Metric menu is Temperature, Relative humidity, CO₂, or Substrate.

**Record a reading** asks for Device, Metric, Value, Unit, Timestamp, and Quality (Good, Suspect, or Bad). Check **Sample data** only when the row is not a live sensor. **Save reading** stores it. A saved sample is labeled Sample data and is not used as the live value for a range alert.

**Import a CSV** expects columns `device_id`, `metric`, `value`, `unit`, `recorded_at`, `quality`, and `sample`. **Import readings** stores those rows. A time without an offset uses the facility timezone.

**Alert rule** can be “Stale metric” or “Outside a range,” with Minimum and Maximum for a range. **Save alert rule** keeps it. The page then says “Alert rule saved.”

**Environment gateway** is on the room **Settings** tab. It names the site gateway, such as “Harbor House environment,” and says it posts a live reading and is not sample data. The form asks for Device, Metric, Value, Unit, Timestamp, and Quality. **Post gateway reading** updates the latest reading for that metric. A site with no gateway says “No environment gateway is registered for this site.”

**Controller sample** lists stored controller rows and says they are sample data and do not clear or create range alerts. Flower 1 shows `hh-flower-1-controller`, setpoint 72 °F, labeled Sample data. There is no control on this card that turns a controller row into a room reading or an alert.

The crop cycle page still lists Observations inside operating history.

## Crop cycles

Active crops live on **Rooms** and on each room dashboard. The Rooms list shows the crop name, cultivar, plant count, and day. **Open cycle** opens the cycle page. The room dashboard has a **Current crop** card with the same link. There is no separate Crop cycles page in the navigation. `/crop-cycles` redirects to Rooms.

The cycle page has **Back to** the room, the plant count assigned to the cycle, a status chip, a day chip, and a workflow chip such as “Canopy week v1” when a template is assigned. **Crop details** lets you edit or delete an active crop. **Harvest this crop** appears on that page only while the crop still has plants.

**Generated tasks** lists each task with its assignee and due date. If none exist, the page says “This cycle has no workflow assignments yet.”

**Operating history** repeats Timeline, Movements, Observations, Labor, and Harvest result.

Organization admins also see **Reschedule**. Employees do not.

## Workflow templates

**Workflow templates** are not in the left navigation. Open them from **Settings** (General) or go to `/workflows`. They are blueprints only: a template is copied into crop-cycle tasks when a cycle starts. Daily work is under **Tasks**.

The page says a template is applied when a cycle starts, and that editing it creates a new version and leaves existing cycles on the version they already have.

Each template card shows “Version N of M,” the duration in days, the starting event, and tasks as “Day … · title · assignee.” The seeded template is **Canopy week**, version 1 of 1, 28 days, starting at `cycle_start`. Its tasks are:

- Day 1, Count plants onto the bench
- Day 14, Scout the canopy, after the count task, linked to the Canopy scout note
- Day 22, Lower-leaf pass, after the scout task, marked approval

Employees see “Managers create templates. You can still work the assignments they generate.”

Avery can save three things on this page:

- **SOP record**, with Title, Summary, and **Save SOP**. Browse and edit existing procedures under Operations → SOP library. The seeded note is Canopy scout: “Walk the canopy slowly. Note pests, stretch, and irrigation dry-back. Do not spray during this pass.”
- **Team**, with Team name, Member, and **Save team**. The seeded team is Canopy crew.
- **New template**, then **Save template**. Fields are Template name, Cultivar, Medium, Duration in days, Starting event, Task key, Task title, Days after the starting event, Instructions, Assign to (Role, Team, or Employee), and Linked SOP. The starting-event hint says “Use cycle_start, or the title of a timeline event.” Saving a name that already exists reports “A workflow template with that name already exists.” This form creates a new template. It does not edit Canopy week in place, and the page has no Start cycle button. A crop is started with **Reset room** in the top right of the room page.

**Cultivar** and **Medium** are optional. Leave them blank when the template is not for one cultivar or one medium. A filled card adds “Cultivar …” and “Medium …”. The seeded templates are **Cedar Nights coco week** (Cultivar Cedar Nights, Medium coco, task Check runoff, linked to Irrigation pass) and **Glass Orchard soil week** (Cultivar Glass Orchard, Medium soil, task Scout the benches, linked to IPM scout). Canopy week has neither, so it stays a general template.

## Tasks

**Tasks** sits in the left navigation after Rooms. The address stays `/workspace`. The title is “All tasks due today.” The line under the title names the date and says crop-cycle work, room chores, and Operations recurring duties are listed, with training under **Operations → Training**.

This is the single place for work due today:

- **Crop cycle tasks** — workflow assignments with evidence (open `/tasks/` plus the id).
- **Room tasks** — room chores, AI-generated tasks, and alert follow-ups (open the room).
- **Recurring duties** — Operations recurring duties whose next due date is today or earlier (open **Operations → Recurring tasks**).

The room × milestone **Facility board** sits at the top of **Tasks**. It is a rooms × milestones grid for the selected facility (dry rooms are left off): crop start (**1st**), each stored defoliation day (**D10**, **D21**, and so on), harvest (**H**), transplant dates (**T** from room Settings), and chores. Built-in schedules fill cells when no matching task exists: **Sul.** on crop day 14; **Side Net** and **Filters AC** on crop day 35; **LS** 11 days before expected harvest; **Garden Clean** every 30 days from crop start; **Water Filters** every Tuesday and Friday; **Fans / AC** every Friday. Title-matched crop tasks, room chores, or Operations recurring duties still override those defaults for chore columns. Status chips and cell tints mark done (green), due (gold), overdue (copper), and scheduled (sky) work. Scroll sideways for every column. **Full screen** expands the board over the whole window; **Exit full screen** or Escape returns to Tasks. Tasks from another facility stay off the assignment lists. If nothing is due across those three lists, the page says nothing is due for you today.

## Time clock

**Time clock** sits in the left navigation after Tasks. The address is `/timeclock`. The same punches also sit in the top bar next to the Facility switcher.

Every signed-in employee can:

- **Clock in**, **Start lunch** / **Lunch**, **End lunch**, and **Clock out** from the top bar or the Time clock page (only the next legal punch is enabled).
- See today’s punches and worked/lunch minutes for the selected facility.
- See **Who’s in** — people currently on the clock or on lunch.

Organization admins also get **AI payroll & accounting**:

- Choose a pay period (from/to).
- Read the AI statement: regular hours, overtime (California-style over 8/day then over 40 regular hours/week at 1.5×), unpaid lunch, and gross pay from stored **labor rates**.
- **Ask AI** about overtime, lunch, missing rates, or top earners.
- **Save** hourly pay rates by employee name (matched to the signed-in user’s name).

Serenity calculates hours and gross pay from punches and rates. It does **not** file taxes, withholdings, or send bank payroll.

An assignment card shows the facility and room, the task title, the due date, the assignee, and the crop. Chips appear only when the template requires them: Supervisor approval, Photo, Notes, Measurement, or Sign-off. The instructions are on the card. A dependency reads “Depends on …”. A linked SOP shows its title and summary.

Work the card with the checklist boxes, **Notes** and **Save notes**, **Add photo** (jpeg, png, webp, or gif), and **Comment** then **Add comment**. Saved photos can be opened by file name. The card does not have a separate sign-off or measurement box, even when those chips are shown.

On October 3, 2026, the seeded dates put Lower-leaf pass on Flower 1 and Scout the canopy on Veg 1. Blake sees the Harbor House assignment. Casey sees the Hill Works assignment. Avery sees the assignments for both facilities.

## Compliance

**Compliance** says “Imports stay on the license. A move or stage change is sent only after a manager approves it, and only to the sandbox.”

Each license card shows the license number, the facility names, the plant count, and **Open inventory**. The seeded licenses are:

- `OR-CULT-44821` at Harbor House, 144 tagged plants. The compared file matches. The card says “No discrepancies.”
- `OR-CULT-55218` at Hill Works, 86 tagged plants. The compared file has one extra tag, `1A4HW000000000000099999`, labeled “In the file, not in Serenity.”

A clean comparison shows a chip with the matched count and “0 discrepancies.” A difference is either “In the file, not in Serenity” or “In Serenity, not in the file.” If nothing has been compared, the card says “No inventory file has been compared for this license.” Compliance does not show a file-upload button. It shows the comparison that is already stored.

**Open inventory** lists tags for that license. The page says plant totals come from tagged plants on the license, and “Showing N of M tags.” Each tag links to the plant. The plant page shows the tag, strain, stage, room or “No room,” cycle or “No cycle,” and the event history. A move reads as who moved the plant from one room to another. A stage change reads as who changed the stage. An observation reads as who noted the text. There is no form on the plant page to move a plant or change its stage.

**Submissions** on the license card are the reviewed sandbox queue. Nothing is sent until a manager approves it. Status words are Pending review, Queued, Succeeded, Failed, Uncertain, Rejected, and Reconciled. Pending review says “Waiting for a manager. Nothing has been sent.”

Avery, and only an organization admin, can set the sandbox result to Success, Definite failure, or Uncertain, then **Approve** or **Reject**. Reject says “Rejected. Nothing was sent.” Approve says “Approved. The outbox will deliver it.” The worker then delivers that row to the local sandbox. Serenity does not call production Metrc.

- Success ends as Succeeded.
- Definite failure ends as Failed and says “Definite failure. Retry only by queueing a new reviewed submission.” **Queue again** creates a new submission that is waiting for review and has not been sent.
- Uncertain says “This change will not be sent again until the sandbox says whether it landed.” **Sandbox says landed** records that it landed and will not be sent again. **Sandbox says it did not land** allows a new reviewed submission.

The seeded queue, still pending review until someone approves it, is a Harbor House move set to Success, a Hill Works stage change set to Definite failure, and a Harbor House stage change set to Uncertain. Their notes are “Submit the Harbor House move,” “Submit the Hill Works stage change,” and “Submit the Harbor House stage change.”

## Harvests

**Harvests** says a harvest keeps the plant tags, weights, waste, and packages for one license, and that veg crops stay in the room until they are cut. Each card shows the harvest name, license, facility, and plant count.

**Harvest this crop** is on the crop cycle page while that crop still has plants. It starts a harvest and opens it. The harvest page shows the license, the name, the plant count, and “plant tags stay on this harvest.” Flower 1’s current crop has no plants, so that button is not on its cycle page. Veg 1 still has plants, so the button is on that cycle page.

The weight ledger is Wet weight, Dry weight, Packaged, Waste, and Unaccounted. Unaccounted is dry weight minus packaged minus waste. Figures that are not recorded yet say “Not recorded.”

**Sample scale weight** sits beside the ledger. It says the sample does not change wet, dry, packaged, waste, or unaccounted weight. The seeded Cedar Nights flower harvest (`OR-CULT-44821`) shows:

- Wet weight 18240 g
- Dry weight 4120 g
- Packaged 3600 g
- Waste 240 g
- Unaccounted 280 g
- Sample scale `hh-sample-scale`, 510 g, labeled Sample data

That 510 g is not part of the ledger. There is no scale control that posts into the ledger. Weights that count are the ones you type.

Steps are listed with the actor and time: Harvested, Wet weight, Drying, Dry weight, Trimming, and Waste. Source tags are listed under Source tags. Packages link to the package page.

The next action follows what is already stored:

1. **Wet weight (g)** and **Record wet weight**
2. **Start drying**
3. **Dry weight (g)** and **Record dry weight**
4. **Record trimming**
5. **Waste note**, **Waste (g)**, and **Record waste**
6. Package: **Package weight (g)**, the package tag field, **Scan a source tag** (type or wedge-scan a tag and press Enter), **Include harvested tags**, and **Create package**

**Create package** stays off until a label, a weight, and at least one source tag are present. The line under the buttons counts source tags selected. A package cannot weigh more than the dry weight still unaccounted. A plant that is not on the harvest cannot be packaged. This scan field is a keyboard-style tag entry. It is not a live RFID reader. On a narrow screen the capture card, with the weight fields and **Save sample tag**, is the first block on the page. Buttons and fields use the full width.

**Sample tag** sits with that capture card. It says the sample does not change plant tags, packages, or the weight ledger. The seeded Cedar Nights harvest shows `hh-sample-rfid` and tag `1A4HH000000000000000001`, labeled Sample data. Saving a sample tag stores the device, tag, timestamp, and quality. The ledger numbers stay the same.

The package page shows the label, grams, actor, time, the ledger line, **Open harvest**, and the source tags. **Queue for review** sends it to the same sandbox queue as a plant move. Choose Success, Definite failure, or Uncertain first. After queueing, the page says “Queued for review. Nothing has been sent.” once. The seeded package label is `1A4PKGCEDARNIGHTS00001`.

Hill Works prior lot is an older harvest with no veg cut and no yield ledger. It is not the Glass Orchard crop.

## Reports

**Reports** is titled Cultivar and room comparison. The introduction says each figure is computed from stored harvest, labor, and cost rows, and the formula under a number is the calculation.

Avery’s comparison includes both facilities. Blake’s includes Harbor House cycles only. Casey’s includes Hill Works cycles only. A direct facility report address for the other site says “You do not have access to this report.” There is no link to that address on the comparison page. The address is `/reports/sites/` plus the facility id, and the page title is Facility report.

Each crop card has Yield, Cycle duration, Labor, Input costs, and Total cost.

- Yield uses dry weight divided by harvest plant count. Cedar Nights shows grams per plant from dry weight 4120 g and 144 plants, and the ledger line “Packaged 3600 g + waste 240 g + unaccounted 280 g = dry weight 4120 g.” Glass Orchard says “This cycle has not been harvested, so yield is absent.”
- Completed duration counts calendar days from the start date through the harvest timestamp in `America/Los_Angeles`, with the start date as day 1. Cedar Nights, started 2026-09-12 and harvested 2026-10-03, is 22 days. An open cycle shows days since start and says completed duration is absent.
- Labor cost is each person’s hours times that person’s stored hourly rate. The seeded lines are Blake Ortiz, 5.5 hours at 2800 cents, and Casey Nguyen, 4 hours at 2600 cents.
- Input cost is quantity times the stored unit cost. The seeded lines are Flower nutrients, 2 at 1500 cents, and Veg media, 1 at 4200 cents.
- Total cost is labor cost plus input cost: 18400 cents for Cedar Nights and 14600 cents for Glass Orchard.

The card also says “Sample environmental readings are excluded. This report does not use their values.” Controller samples and scale samples are not part of these totals. When a crop has no labor entries, the card says “Labor is absent. No labor entries are stored.” When it has no input costs, it says “Input cost is absent. No input costs are stored.”

## Serenity

**Serenity** sits in the left navigation after Reports. She is Serenity’s cultivation AI and always introduces herself as Serenity. The address stays `/coach`.

**Serenity** opens with a chat box. **Generate tasks** creates open room tasks from stored procedures and assigns them to the people who can open the facility. **Train workers** assigns training records from a stored procedure; open **Operations → Training** to mark them complete. Typing a question about a procedure quotes the matching stored procedure title and summary. Say **Remember that…** to teach Serenity a note she can reuse later. With an OpenAI API key under **Settings → API's → Serenity · OpenAI**, she can answer in fuller language using those notes and procedures. Without a key she still runs on Serenity’s stored actions.

Yield, labor, and cost figures stay on **Reports**. Serenity does not repeat those charts. On **Time clock**, admins can **Ask Serenity** about payroll; she still introduces herself as Serenity.

**Room notices** lists each active room alert. Opening Serenity creates one open room task for that alert and assigns it to the people who can open the facility. When a stored procedure title matches the metric, the task quotes that procedure. Serenity does not invent a task that no procedure describes. The same notice appears on **Tasks**, and the room task itself is listed under Room tasks.

**Readiness** is headed “Readiness for” plus the license jurisdiction, for example “Readiness for US-OR.” It lists plants without tags, inventory discrepancies, submissions waiting for review, packages that have not been queued, and harvests that have a dry weight and no waste row. The page says “This is a readiness check of stored rows. It is not a state certification.” The same checklist is used for every jurisdiction. Serenity does not call live Metrc, and it does not send email or SMS.

A person who cannot open the facility does not see that facility’s Serenity chat.

## Messages

**Messages** sits in the left navigation after Serenity. The address is `/messages`. It opens for every signed-in user and lists people in the same organization.

**Message a person** opens a direct conversation with someone else in the organization. Both people see the same thread. Messages stay inside Serenity; Serenity does not send email or SMS.

**Chat with Serenity** opens a saved Serenity thread for your account. She uses the facility in the top bar the same way the Serenity page does: quote stored procedures, generate room tasks, assign worker training, and learn notes. Reopening **Chat with Serenity** returns the same saved conversation.

## Operations

**Operations** is in the left navigation after Harvests. The page opens on the facility in the switcher. Blake sees Harbor House rows. Casey sees Hill Works rows. Avery can switch facilities and open both. A facility you cannot open says you do not have access.

The buttons under the title are Irrigation and feed, IPM, Maintenance, Purchasing, Sanitation, Training, Room calendar, Recurring tasks, and SOP library. SOP library is the list of stored procedures to browse and edit. Workflows can still add a new SOP record when a template needs one. The operating procedures document is at `/sop` and is linked from the User manual.

**Irrigation and feed** lists the date, room, Irrigation or Feed, method, volume in liters, nutrient, EC, pH, and the person who saved it. Harbor House Flower 1 has a Feed row: Drip, 12 L, Flower nutrients, EC 1.8, pH 5.9, Blake Ortiz, on 2026-10-02. **Save record** stores a new row.

**IPM** lists the date, room, target, Clear or Present, the response, and the person. Flower 1 has Thrips, Clear, Monitor. Veg 1 has Fungus gnats, Present, Release beneficials.

**Maintenance** lists the date, asset, Preventive or Repair, the summary, the room, and a next due date when one is stored. Flower 1 dehumidifier is preventive and next due 2026-10-30.

**Purchasing** lists the order date, vendor, description, quantity, unit cost in cents, and Requested or Received. Harbor supply received Flower nutrients. Ridge supply requested Veg media.

**Sanitation** lists the date, room, area, method, and Done or Needs follow-up. Flower 1 floor and drains used Quaternary and is Done. Veg 1 benches used Peroxide and Needs follow-up.

**Training** lists the trainee, the title, the procedure name, and Assigned or Completed. Blake Ortiz completed Canopy scout on 2026-09-25. Casey Nguyen is assigned IPM scout.

**Room calendar** shows the month in `America/Los_Angeles` and one line per day. A day inside a stay names the room, cultivar, and medium. Flower 1 is Cedar Nights coco from 2026-09-12 through 2026-10-24. Veg 1 is Glass Orchard soil from 2026-09-20 through 2026-11-15. A day with no stay says open. **Save stay** adds another occupancy. The end date has to be on or after the start date.

**Recurring tasks** lists the next due date, title, Daily or Weekly, assignee, room, and procedure. **Mark done** moves a weekly task forward seven days and a daily task forward one day. Flower 1 has Check drip lines, weekly, Blake Ortiz, Irrigation pass, next due 2026-10-04. Veg 1 has Wipe tables, daily, Casey Nguyen, Room sanitation.

**SOP library** lists each procedure and the template or cycle task that cites it. A template line can include the cultivar and medium. Cycle tasks from another facility stay off the list. Canopy scout is linked to Scout the canopy. Irrigation pass is linked to Check runoff on Cedar Nights coco week. IPM scout is linked to Scout the benches on Glass Orchard soil week.

## Gateway

The gateway is not a navigation item. On a room you can open, open the room **Settings** tab and use **Environment gateway** and **Post gateway reading**. The reading stores the device, unit, timestamp, and quality, and it is live. Flower 1’s latest temperature changes to the value you post. Humidity stays stale when its own newest reading is older than 60 minutes.

A direct gateway address is `/gateways/` plus the gateway id. The page is titled with the gateway name, or “Gateway write” if you cannot load it. The form asks for Room, Device, Value, Unit, Timestamp, and Quality, then **Post gateway reading**. The introduction says a gateway can post a live reading only for a room on its own site.

Blake opening the Hill Works gateway sees “You do not have access to this gateway.” once. The write is refused. He can still use Harbor House environment from a Harbor House room.
