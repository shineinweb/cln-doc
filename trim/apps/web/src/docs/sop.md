# Trim operating procedures

These procedures are the ones a manager and an employee follow in Trim. Avery Chen is the manager: organization admin, both facilities. Blake Ortiz works Harbor House. Casey Nguyen works Hill Works. Sign in with the accounts in the user manual, then use the facility you can open.

A page for the other facility says you do not have access. Do not keep going on that page.

## Daily room check

**Who.** The person who can open that facility. Blake checks Flower 1 and Dry Room. Casey checks Veg 1 and Mother Room. Avery can check either facility.

**When.** At the start of the shift, before today’s assignment.

**Steps.**

1. Open **Facility** and select the facility card. Harbor House is Astoria. Hill Works is Hood River.
2. Open **Rooms** and choose the room. The page says “Open a room to see its zones, readings, and operating history.”
3. The room dashboard opens on **Dashboard**. Read the Trolmaster chart, then **Operating history**. The chart shows Temp, Humid, CO2, VPD, and Light when Trolmaster is on and a controller is saved on **Trolmaster settings**. **24 Hour**, **Week**, and **Month** change the window. **Test on** draws a sample of that history and does not call Trolmaster. **Trolmaster off** says “Trolmaster is off.” Open **Zones** for the zone list. Open **Settings** for **Defoliation schedule**, **Last successful Metrc sync**, readings, alerts, the gateway, and the controller sample. **Add defoliation** adds a day number. Day 1 is the current crop’s start date, so day 10 is the tenth day. **Save schedule** stores every day and shows the date. A dry room does not show **Defoliation schedule**. The room does not show a current-crop card. Cycle day is on the crop cycle page, and it counts the start date as day 1 in `America/Los_Angeles`. A flower room also has **Trolmaster settings**. That tab stores a controller id and API credential. The Dashboard tab checks that credential with Trolmaster. It names the controller when the credential lists it, and draws the chart when history points come back.
4. Open **Tasks**. **Add task** can save a one-time task with a due date, a daily task, or a weekly task on chosen days such as Tuesday and Friday. A recurring task does not ask for a due date. The form has an optional description and can assign more than one employee. Then read **Tasks due today**. On October 3, 2026, Flower 1 lists Count plants onto the bench and Lower-leaf pass. Veg 1 lists Scout the canopy.
5. Open **Notes**. **Add note** saves a note on the current crop for later. Choose a category, such as Environment or Pests, a date, a time, and write the note. The line shows the date and time, the author, the category, and the note. If none are stored, it says “No notes are recorded for this crop.”
6. On **Settings**, read **Last successful Metrc sync**. With nothing stored, it says “No successful Metrc sync is recorded.”
7. On **Settings**, read **Latest environmental readings** for Temperature, Relative humidity, CO₂, and Substrate. A metric with no reading, or whose newest reading is older than 60 minutes on Flower 1 or Veg 1, shows **Stale**. A row marked sample shows **Sample data**.
8. On **Settings**, read **Active alerts**. Flower 1 keeps “Relative humidity is stale. No reading is newer than 60 minutes.” when the humidity reading is older than 60 minutes. A room with no matching rule says “No active alerts.”
9. On **Settings**, read **Controller sample** if a row is listed. Flower 1 shows `hh-flower-1-controller`, setpoint 72 °F, labeled Sample data. That row does not clear or create a range alert.
10. A room with no crop, such as Dry Room or Mother Room, says “This room has no active crop cycle” on **Notes**, and “No tasks are due today” on **Tasks**. The room list row says “No active crop.”

**Done.** You can name the task due today and whether a reading or alert needs attention. The crop name and plant count are on the Rooms list and on the room’s **Current crop** card. Flower 1’s listed crop shows 0 plants because that crop is already harvested. Veg 1’s listed crop is Glass Orchard veg, with 86 plants still in the room.

## Completing today’s assignment

**Who.** The person the card names. Blake completes Harbor House assignments. Casey completes Hill Works assignments. Avery sees both lists. A task from the other facility stays off the list.

**When.** On the due date shown on **Tasks**. On October 3, 2026, Count plants onto the bench and Lower-leaf pass are due on Flower 1, and Scout the canopy is due on Veg 1.

**Steps.**

1. Open **Tasks**. The title is All tasks due today. The introduction names the date and the three task lists.
2. Open the assignment card. It shows the facility, room, task title, due date, assignee, and crop.
3. Read the instructions. Scout the canopy also shows the Canopy scout note: “Walk the canopy slowly. Note pests, stretch, and irrigation dry-back. Do not spray during this pass.” Lower-leaf pass shows the chip Supervisor approval and the line “Depends on Scout the canopy.”
4. Check the boxes on the card. Scout the canopy uses “Check the first half of the room” and “Check the second half of the room.” Lower-leaf pass uses “Clear the aisle” and “Bag the leaves.”
5. Type **Notes** and choose **Save notes** when the work needs a written record.
6. Choose **Add photo** when a picture is required. The file must be jpeg, png, webp, or gif. The file name appears on the card. Choose that name to open it again.
7. Type **Comment** and choose **Add comment**. Your name and the comment stay on the card.

Chips for Measurement or Sign-off can appear on a card. The card has no separate measurement field and no sign-off field.

**Done.** The boxes you checked stay checked. Saved notes, the photo file name, and your comment are on the card. If nothing is due across crop cycles, room chores, and recurring duties, Tasks says nothing is due for you today.

## Starting a cycle from a template

**Who.** Avery. Blake and Casey see “Managers create templates. You can still work the assignments they generate.”

**When.** You need to confirm that an active cycle is already running on a template, or you are preparing the template a cycle uses.

**Steps.**

1. Open **Workflow templates** from Settings, or go to `/workflows`. The page says templates are blueprints and that a template is applied when a cycle starts.
2. Read **Canopy week**. The card says “Version 1 of 1 · 28 days · starts at cycle_start.” The tasks are Day 1 Count plants onto the bench, Day 14 Scout the canopy, and Day 22 Lower-leaf pass.
3. Open **Rooms**, open the room, and choose **Open cycle** on **Current crop**.
4. Read the workflow chip and **Generated tasks**. Cedar Nights flower and Glass Orchard veg show **Canopy week v1**, with each task, its assignee, and its due date.

Workflow templates has a **New template** form and **Save template**. That form creates a new template. It does not start a cycle, and it does not change Canopy week. There is no **Start cycle** button on the room, on **Workflow templates**, or on the cycle page. **Crop details** on the cycle page opens the crop form. **Cycle duration in days** uses the start date as day 1. A duration of 22 days from September 12, 2026 ends October 3, 2026. **Save changes** writes the crop. **Cancel** closes the form without saving.

**Reset room** sits in the top right of the room page, and only Avery sees it. The form asks for Strain, Plant count, Stage, Start date, Cycle duration in days, and an optional Harvest date. Saving closes the crop that is in the room, keeps it under **Archived crops**, and opens the next crop. The harvest date is stored on the closed crop. Zones stay on **Zones**. Readings and alert rules stay on **Settings**. The other tabs are **Tasks**, **Notes**, **Zones**, and, on a flower room, **Trolmaster settings**.

**Done.** The cycle page shows the template chip and the generated tasks. A cycle with no template says “This cycle has no workflow assignments yet.”

## Reschedule preview before confirm

**Who.** Avery. The **Reschedule** panel is not on the cycle page for Blake or Casey.

**When.** The cycle start date needs to move, and you want to see the new task dates before they are saved.

**Steps.**

1. Open the crop cycle.
2. In **Reschedule**, read “Current start” and “Preview the task dates before anything is written.”
3. Set **New start date**.
4. Choose **Preview**. The page lists each task as “title: from → to” and says “Preview only. Nothing has been saved.”
5. If the dates are wrong, change **New start date**. Preview clears, and **Confirm reschedule** stays off until you preview again.
6. Choose **Confirm reschedule** only after the preview lines are the dates you want.

**Done.** The page says “Reschedule saved.” The cycle start date and the due dates on **Generated tasks** match the preview. Expected harvest moves with the start date.

## Template versions

**Who.** Avery.

**When.** You are checking which version a cycle uses, or a newer version of that template is already stored and this cycle should move to it.

**Steps.**

1. Open **Workflow templates** from Settings, or go to `/workflows`. Each card says “Version N of M.” Canopy week is version 1 of 1. The introduction says editing a template creates a new version and leaves existing cycles on the version they already have.
2. **New template** and **Save template** create version 1 of a new name. Saving the name Canopy week again says “A workflow template with that name already exists.” That form does not edit the existing template.
3. Open the crop cycle. The chip shows the version that cycle already has, such as **Canopy week v1**.
4. **Apply version N** appears only when a newer version of that template is already stored. It is not on Canopy week while the template is still version 1 of 1.
5. When the button is present, choose **Apply version N**.

**Done.** After apply, the page says “The newer template version is now assigned to this cycle.” The chip and **Generated tasks** match that version. A cycle you do not apply stays on the version it already has.

## License inventory import

**Who.** Anyone who can open the license. Avery sees both. Blake sees `OR-CULT-44821` at Harbor House. Casey sees `OR-CULT-55218` at Hill Works.

**When.** You need to know whether the stored inventory file matches the tagged plants.

**Steps.**

1. Open **Compliance**. The page says “Imports stay on the license.”
2. Read the license card. It shows the license number, the facility, and the plant count.
3. Harbor House, 144 tagged plants, says “No discrepancies.”
4. Hill Works, 86 tagged plants, lists `1A4HW000000000000099999` as “In the file, not in Trim.”
5. Choose **Open inventory**. The page says plant totals come from tagged plants on this license, and “Showing N of M tags.” Open a tag to read the plant: tag, strain, stage, room or “No room,” and cycle or “No cycle.”

Compliance has no file-upload control. The card shows the comparison already stored. A license with no comparison says “No inventory file has been compared for this license.” The plant page has no form to add, move, or remove a tag.

**Done.** You can say the Harbor file matches, and you can name the Hill tag that is in the file and not in Trim. The inventory list matches the count on the license card.

## Reviewed sandbox submissions

**Who.** Avery. Approve, Reject, and the sandbox result are not shown to Blake or Casey. The page says “Only a manager can review submissions” if someone else tries. A move or stage change is sent only after the manager approves it, and only to the sandbox.

**When.** A submission on the license card says Pending review, or an earlier send came back Failed or Uncertain and needs a decision.

**Steps.**

1. Open **Compliance** and find **Submissions** on the license card.
2. Read the tag or package label, the event, the note, and the status. Pending review says “Waiting for a manager. Nothing has been sent.”
3. The seeded rows, still pending until you approve them, are:
   - Harbor House move, note “Submit the Harbor House move.”, sandbox result Success.
   - Hill Works stage change, note “Submit the Hill Works stage change.”, sandbox result Definite failure.
   - Harbor House stage change, note “Submit the Harbor House stage change.”, sandbox result Uncertain.

**Success.**

1. Set the sandbox menu to **Success**.
2. Choose **Approve**. The card says “Approved. The outbox will deliver it.” and the status becomes Queued.
3. Leave the page open. It checks again while the status is Queued.

**Done for success.** The status is Succeeded. The attempt line names the request, Avery, the time, and the outcome. That change will not be sent again.

**Definite failure.**

1. Set the sandbox menu to **Definite failure**.
2. Choose **Approve** and wait through Queued.

**Done for failure.** The status is Failed. The card says “Definite failure. Retry only by queueing a new reviewed submission.” Choose **Queue again**. The new row says “A new submission is waiting for review. It has not been sent.” and is Pending review. Review that new row before anything is sent.

**Uncertain.**

1. Set the sandbox menu to **Uncertain**.
2. Choose **Approve** and wait through Queued.

**Done for uncertain.** The status is Uncertain. The card says “This change will not be sent again until the sandbox says whether it landed.”

**Reconcile.**

1. On an Uncertain row, choose one finding.
2. **Sandbox says landed** says “Sandbox says the write landed. It will not be sent again.”
3. **Sandbox says it did not land** says “Sandbox says the write did not land. A new reviewed submission can be queued.” Choose **Queue again** only after that finding. The new row waits for review.

**Done for reconcile.** The status is Reconciled. The attempt line includes the reconciliation result. A landed result is not sent again. A not-landed result can be queued again as a new Pending review row.

**Reject.** On a Pending review row, **Reject** says “Rejected. Nothing was sent.”

A package uses the same sandbox. On the package page, choose Success, Definite failure, or Uncertain, then **Queue for review**. The page then says “Queued for review. Nothing has been sent.” Finish the review on **Compliance**.

## Harvest through package

**Who.** Anyone who can open the facility. Blake can harvest Harbor House. Casey can harvest Hill Works. Avery can harvest either. **Harvest this crop** is on the crop cycle page while that crop still has plants. Flower 1’s current crop does not show it. Veg 1 does.

**When.** The crop is cut and you are recording wet weight through the package. Veg crops stay in the room until they are cut.

**Steps.**

1. Open **Rooms**, open the room, then **Open cycle**. Choose **Harvest this crop**. The harvest page opens. It shows the license, the name, the plant count, and “plant tags stay on this harvest.”
2. Enter **Wet weight (g)** and choose **Record wet weight**.
3. Choose **Start drying**.
4. Enter **Dry weight (g)** and choose **Record dry weight**.
5. Choose **Record trimming**.
6. Enter **Waste note** and **Waste (g)**, then choose **Record waste**.
7. Under Package, enter **Package weight (g)** and the package tag.
8. In **Scan a source tag**, type or wedge-scan a plant tag and press Enter. Repeat for each tag, or choose **Include harvested tags**. The line under the buttons counts source tags selected.
9. Choose **Create package**. It stays off until the tag, the weight, and at least one source tag are present. The package page opens.
10. Choose the sandbox result and **Queue for review**.

The weight that counts is the number you type. **Sample scale weight** sits beside the ledger and does not change wet, dry, packaged, waste, or unaccounted weight. The scan field is keyboard entry. It is not an RFID reader.

**Done.** The ledger shows Wet weight, Dry weight, Packaged, Waste, and Unaccounted. Unaccounted is dry weight minus packaged minus waste. The package page shows the label, grams, your name, the time, the ledger line, and the source tags. After queueing, it says “Queued for review. Nothing has been sent.” once.

The stored Cedar Nights flower harvest on `OR-CULT-44821` is already through this sequence: wet 18240 g, dry 4120 g, packaged 3600 g, waste 240 g, unaccounted 280 g, package `1A4PKGCEDARNIGHTS00001`. The sample beside it is `hh-sample-scale`, 510 g, labeled Sample data. That 510 g is not part of the ledger. Hill Works prior lot has no veg cut and is not the Glass Orchard crop.

## Recording a reading

**Who.** Anyone who can open the room. Blake records Harbor House rooms. Casey records Hill Works rooms. Avery can record either. A Harbor House gateway cannot write a Hill Works room. The message is “This gateway cannot write that room.” Blake opening the Hill Works gateway sees “You do not have access to this gateway.” once.

**When.** During the room check, or when a sensor posts a live value.

**Steps.**

1. Open the room dashboard and choose the **Settings** tab.
2. Under **Record a reading**, enter Device, Metric, Value, Unit, Timestamp, and Quality. Quality is Good, Suspect, or Bad.
3. Leave **Sample data** unchecked for a live sensor. Check it only when the row is not a live sensor.
4. Choose **Save reading**. A time you type without a timezone is the facility’s local time.
5. To load a file instead, use **Import a CSV**. The columns are `device_id`, `metric`, `value`, `unit`, `recorded_at`, `quality`, and `sample`. Choose **Import readings**.
6. For a live gateway post, use **Environment gateway** on the room **Settings** tab. Harbor House environment says it posts a live reading and is not sample data. Enter Device, Metric, Value, Unit, Timestamp, and Quality, then **Post gateway reading**. There is no sample checkbox on that form.
7. To add an alert, set **Alert rule** to “Stale metric” or “Outside a range,” enter Minimum and Maximum for a range, and choose **Save alert rule**.

A controller sample is not this procedure. It stays on **Controller sample**, labeled Sample data, and it does not clear or create a range alert.

**Done.** **Latest environmental readings** shows the device, value, unit, and time. A manual save says “Reading saved.” or “Sample reading saved.” A gateway post names the device, value, and unit and says “This is a live reading.” A sample row shows **Sample data** and is not the live value for a range alert. A live temperature newer than 60 minutes is not stale. Humidity stays stale when its own newest reading is older than 60 minutes and the stale rule is on. The page says “Alert rule saved.” after you save a rule.

## Reading yield and cost

**Who.** Avery reads both facilities. Blake reads Harbor House cycles. Casey reads Hill Works cycles. A facility report for the other site says “You do not have access to this report.”

**When.** After harvest weights, labor, and input costs are stored, or when you need to see that an open cycle has no yield yet.

**Steps.**

1. Open **Reports**. The title is Cultivar and room comparison. Each figure is computed from stored harvest, labor, and cost rows, and the formula under a number is the calculation.
2. On the crop card, read **Yield**. Cedar Nights shows grams per plant from dry weight 4120 g divided by 144 plants, and the ledger line “Packaged 3600 g + waste 240 g + unaccounted 280 g = dry weight 4120 g.” Glass Orchard says “This cycle has not been harvested, so yield is absent.”
3. Read **Cycle duration**. Cedar Nights, started 2026-09-12 and harvested 2026-10-03, says “Completed duration: 22 days.” An open cycle says “Days since start” and “Completed duration is absent.”
4. Read **Labor**. Blake Ortiz is 5.5 hours at 2800 cents. Casey Nguyen is 4 hours at 2600 cents. The line under each name is hours times that person’s stored rate.
5. Read **Input costs**. Flower nutrients is 2 at 1500 cents. Veg media is 1 at 4200 cents.
6. Read **Total cost**. Cedar Nights is 18400 cents. Glass Orchard is 14600 cents. The formula is labor cost plus input cost.
7. Read the sample line. It says sample environmental readings are excluded and gives the excluded count.

The comparison page has no link to a single-facility report. That page is **Facility report** at `/reports/sites/` plus the facility id, and it uses the same sections for the cycles on that facility.

**Done.** You can read grams per plant, the ledger identity, completed duration or its absence, each labor and input line, and the total. Controller samples, the 510 g scale sample, and the sample tag are not in these totals. Hill Works prior lot is not a Glass Orchard yield. A crop with no labor entries says “Labor is absent. No labor entries are stored.” A crop with no input costs says “Input cost is absent. No input costs are stored.”

## AI helper

**Who.** Anyone who can open the facility. Blake sees Harbor House. Casey sees Hill Works. Avery can switch facilities.

**When.** You want to generate tasks, train workers, quote a procedure, read stored figures, or check readiness for the license jurisdiction.

**Steps.**

1. Open **AI helper**. It follows the facility in the top bar. The address is `/coach`.
2. Use the chat box. Choose **Generate tasks** to create room tasks from stored procedures, or **Train workers** to assign training. Type a procedure question to get a quote.
3. Read **Room notices**. An active alert has one open room task for the people who can open the facility. A matching procedure title is quoted on the task. The same notice is on **Tasks**.
4. Read **Readiness**. The heading is “Readiness for” plus the license jurisdiction. The page says “This is a readiness check of stored rows. It is not a state certification.”
5. Open **Reports** when you need yield, labor, and cost figures.
6. Open **Messages** when you need a saved AI chat or a direct message with someone in the organization. The address is `/messages`.

**Done.** You can name the jurisdiction, whether tasks or training were created, and whether a procedure was quoted. Trim does not call live Metrc and does not send email or SMS.

## Internal messages

**Who.** Anyone signed in. Avery, Blake, and Casey can message people in Harbor & Hill Cultivation.

**When.** You need a direct message inside Trim, or a saved AI chatbot thread that remembers earlier questions.

**Steps.**

1. Open **Messages**. The address is `/messages`.
2. Choose **Message a person**, then pick a name from the organization directory.
3. Write the message and choose **Send**. The other person sees the same conversation.
4. Choose **Chat with AI** for a saved Trim AI thread. Ask about procedures, generate tasks, or assign training. The assistant uses the facility in the top bar.

**Done.** You can name who received the message and whether the AI assistant replied. Trim does not send email or SMS.

## Recording irrigation and feed

**Who.** Anyone who can open the room. Blake records Harbor House. Casey records Hill Works. Avery can record either.

**When.** After a water or nutrient pass.

**Steps.**

1. Open **Operations**, then **Irrigation and feed**.
2. Read the stored rows for the facility in the switcher.
3. Choose the room, date, Irrigation or Feed, method, volume, EC, pH, and nutrient.
4. Choose **Save record**.

**Done.** The new row is on the list with your name. The page says “Irrigation and feed record saved.” Flower 1’s stored feed is Drip, 12 L, Flower nutrients, EC 1.8, pH 5.9.

## Recording an IPM scout

**Who.** Anyone who can open the room.

**When.** After walking the room, including when you find nothing.

**Steps.**

1. Open **Operations**, then **IPM**.
2. Choose the room, date, target, Clear or Present, and the response.
3. Choose **Save record**.

**Done.** The list shows the target, Clear or Present, and the response. Flower 1 shows Thrips, Clear, Monitor. A clear scout stays on the list.

## Completing a recurring task

**Who.** The assignee named on the row, or anyone who can open that facility.

**When.** On or after the next due date.

**Steps.**

1. Open **Operations**, then **Recurring tasks**.
2. Read the next due date, Daily or Weekly, the room, and the procedure name.
3. Choose **Mark done**.

**Done.** The page says “Next due date moved.” A weekly task moves seven days later. A daily task moves one day later. Check drip lines on Flower 1 is weekly and starts at 2026-10-04.

## Reading the room calendar

**Who.** Anyone who can open the facility.

**When.** Before you plan a room, or when you need the cultivar and medium for the dates a crop occupies it.

**Steps.**

1. Open **Operations**, then **Room calendar**.
2. Read the month, then the day lines. A stay names the room, cultivar, and medium. An empty day says open.

**Done.** You can name the cultivar and medium for a date. In October 2026, Flower 1 is Cedar Nights coco and Veg 1 is Glass Orchard soil.

## Using a cultivar or medium template

**Who.** Avery, when saving a template. Blake and Casey can read the template cards.

**When.** The work belongs to one cultivar or one medium.

**Steps.**

1. Open **Workflow templates** from Settings, or go to `/workflows`.
2. Read the card. **Cedar Nights coco week** says Cultivar Cedar Nights and Medium coco. **Glass Orchard soil week** says Cultivar Glass Orchard and Medium soil. Canopy week has no cultivar or medium.
3. To add one, use **New template**. Fill **Cultivar**, **Medium**, or leave either blank, then **Save template**.

**Done.** The new card shows the cultivar and medium you entered. Existing cycles stay on the version they already have.

## Reading the SOP library

**Who.** Any signed-in user. Cycle tasks from another facility stay off the list.

**When.** You need the procedure tied to a task.

**Steps.**

1. Open **Operations**, then **SOP library**.
2. Read the procedure title and summary.
3. Read the template line or the facility, room, cycle, and task line under it.

**Done.** You can see which task cites the procedure. Irrigation pass cites Check runoff on Cedar Nights coco week. The operating document stays at `/sop` and is linked from the User manual.

## Adding a user

**Who.** Avery, the organization admin. An employee sees **Users** and cannot save.

**When.** A new person needs a sign-in.

**Steps.**

1. Open **Users**, directly under **Dashboard**. The page opens on **Users**. **Activity** shows the last 14 days of sign-ins and access changes.
2. Choose **Add user**. Enter the name, email, and a password of at least 8 characters.
3. Choose a role. For a site operator, check the facility they can open. An organization admin opens every facility.
4. Choose **Add user**. The person appears in the table. Use **Search users** or a column header when the list is long. **Audit logs** records the change and can be searched the same way.
5. **Edit** changes the person. **Delete** removes a person who has not recorded work. Do not delete your own account.

**Done.** The new person is in the Users table, and the audit log names who added them.

## Capturing a harvest on a phone

**Who.** Anyone who can open the harvest.

**When.** You are recording weights or a sample tag on a narrow screen.

**Steps.**

1. Open the harvest.
2. Use the capture card at the top. Enter the weight the next step asks for. The fields and buttons use the width of the screen.
3. To store a scanner sample, fill Device, Tag, Timestamp, and Quality under **Sample tag**, then **Save sample tag**.
4. Type source tags in **Scan a source tag** and press Enter only when you are creating a package. That field is the package step. The sample tag is separate.

**Done.** The ledger shows the weights you typed. A sample tag shows Sample data and leaves wet, dry, packaged, waste, unaccounted, and the plant tags unchanged. The seeded sample is `hh-sample-rfid`, tag `1A4HH000000000000000001`, beside the Cedar Nights ledger.
