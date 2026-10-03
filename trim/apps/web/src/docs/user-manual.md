# Trim user manual

Trim is the cultivation workspace for Harbor & Hill Cultivation. The room dashboard is the daily center. A license is not the same thing as a facility: plants and packages belong to a license, and rooms belong to a facility.

Open Trim at https://available-kelly-labor-faculty.trycloudflare.com

The sign-in page says “Your cultivation workspace” and “Use the account issued by your organization.” Enter **Email** and **Password**, then **Sign in**. The left side of the page says “Know which rooms are yours before the day starts” and “Access follows the site.”

After sign-in, the left navigation is Company, Facility, Rooms, Crop cycles, Workflows, Workspace, Compliance, Harvests, Reports, User manual, and SOP. Rooms is marked Center. User manual and SOP open for every signed-in user and do not follow the Facility switcher. The drawer ends with “Room dashboards are the daily center of Trim.” On a narrow screen, use **Open navigation**.

The top bar has a **Facility** switcher, your name, and **Sign out**.

## Who can open what

| Person | Email | Password | What opens |
| --- | --- | --- | --- |
| Avery Chen | `avery.chen@harborhill.example` | `HarborHill-admin` | Organization admin. Both facilities, both licenses, template editing, reschedule, and submission review. |
| Blake Ortiz | `blake.ortiz@harborhill.example` | `HarborHouse-only` | Harbor House only. Hill Works stays hidden, and a Hill Works address says he does not have access. |
| Casey Nguyen | `casey.nguyen@harborhill.example` | `HillWorks-only` | Hill Works only. Harbor House stays hidden. |

These are the seeded accounts for this workspace.

## Site access

A facility stays hidden until you have a membership, unless you are an organization admin. Company says that in the page introduction.

Avery sees Harbor House (Astoria, OR, code HARBOR) and Hill Works (Hood River, OR, code HILL). Blake’s Company page lists Harbor House. Casey’s lists Hill Works. Choosing a card in Company sets the Facility switcher.

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

Workspace says “Tasks from another facility stay off this list.” Times on a room use that facility’s timezone, `America/Los_Angeles`. A timestamp you type without a timezone is read as local time at the facility.

## Company

**Company** opens on “Harbor & Hill Cultivation.” Each card shows the facility name, code, city, and how many rooms it has. Select a card to work in that facility.

If an account has no membership, the page says “No facilities are assigned to this account.”

## Facility

**Facility** is the facility selected in the top bar. The title is the facility name. Harbor House is 180 Cannery Road, Astoria, OR 97103. Hill Works is 42 Ridge Lane, Hood River, OR 97031.

Each room card shows the room type, the current crop or “No active crop,” the cultivar and plant count, the expected harvest date, the zones, and **Open room dashboard**.

Seeded rooms:

- Harbor House: Flower 1 (Flower, East canopy and West canopy) and Dry Room (Dry, Hang bay).
- Hill Works: Veg 1 (Vegetative, North tables and South tables) and Mother Room (Mother, Stock bench).

Flower 1’s current crop is Cedar Nights flower. The plants from that crop have been harvested, so the card shows 0 plants. Veg 1’s current crop is Glass Orchard veg, with 86 plants still in the room. Dry Room and Mother Room say “No active crop.”

## Rooms

**Rooms** is titled Rooms, with the kicker Center. The introduction says “Open a room to see its current crop, cycle day, and operating history.” Each row shows the room name, cultivar and plant count or “No active crop,” and the room type. Choose the row to open the dashboard.

The room dashboard introduction says “The room dashboard is the daily workspace. Crop figures, readings, and alerts below are stored records.”

When a crop is active, the **Current crop** card shows the crop name and four figures: Cultivar, Plants, Stage, and Cycle day. Cycle day counts the start date as day 1 in the facility timezone. It also shows “Expected harvest” and **Open crop cycle**. **Harvest this crop** appears only while the crop still has plants. Flower 1 does not show that button. Veg 1 does.

If the room has no active crop, the page says “This room has no active crop cycle.”

Two cards sit under the crop:

- **Tasks due today.** Empty rooms say “No tasks are due today.”
- **Last successful Metrc sync.** With nothing recorded, it says “No successful Metrc sync is recorded.” Trim does not call live Metrc.

**Latest environmental readings** lists Temperature, Relative humidity, CO₂, and Substrate. The line under the title says a reading older than the room’s threshold is stale, and names the timezone. Flower 1 and Veg 1 use 60 minutes. A metric with no reading is stale. A reading marked sample shows **Sample data**. A stale reading shows **Stale**.

**Active alerts** lists alert text, or “No active alerts.” An alert exists only when the room has a saved alert rule. Flower 1 has a stale rule for relative humidity, so humidity that is older than 60 minutes stays listed even after a new temperature arrives. The seeded humidity is 58.2% from device `hh-flower-1-rh`.

**Reading history** is a chart. The Metric menu is Temperature, Relative humidity, CO₂, or Substrate.

**Record a reading** asks for Device, Metric, Value, Unit, Timestamp, and Quality (Good, Suspect, or Bad). Check **Sample data** only when the row is not a live sensor. **Save reading** stores it. A saved sample is labeled Sample data and is not used as the live value for a range alert.

**Import a CSV** expects columns `device_id`, `metric`, `value`, `unit`, `recorded_at`, `quality`, and `sample`. **Import readings** stores those rows. A time without an offset uses the facility timezone.

**Alert rule** can be “Stale metric” or “Outside a range,” with Minimum and Maximum for a range. **Save alert rule** keeps it. The page then says “Alert rule saved.”

**Environment gateway** is on the same room page. It names the site gateway, such as “Harbor House environment,” and says it posts a live reading and is not sample data. The form asks for Device, Metric, Value, Unit, Timestamp, and Quality. **Post gateway reading** updates the latest reading for that metric. A site with no gateway says “No environment gateway is registered for this site.”

**Controller sample** lists stored controller rows and says they are sample data and do not clear or create range alerts. Flower 1 shows `hh-flower-1-controller`, setpoint 72 °F, labeled Sample data. There is no control on this card that turns a controller row into a room reading or an alert.

**Operating history** on the room, when present, has Timeline, Movements, Observations, Labor, and Harvest result.

## Crop cycles

**Crop cycles** lists active cycles for the facility in the switcher. Each card shows the crop, room, cultivar, plant count, expected harvest, stage, and cycle day. Open one for the timeline, movements, observations, and labor.

The cycle page has **Back to** the room, the plant count assigned to the cycle, a status chip, a day chip, and a workflow chip such as “Canopy week v1” when a template is assigned.

**Generated tasks** lists each task with its assignee and due date. If none exist, the page says “This cycle has no workflow assignments yet.”

**Operating history** repeats Timeline, Movements, Observations, Labor, and Harvest result.

Organization admins also see **Reschedule**. Employees do not.

## Workflows

**Workflows** says “A template is applied when a cycle starts. Editing it creates a new version and leaves existing cycles on the version they already have.”

Each template card shows “Version N of M,” the duration in days, the starting event, and tasks as “Day … · title · assignee.” The seeded template is **Canopy week**, version 1 of 1, 28 days, starting at `cycle_start`. Its tasks are:

- Day 1, Count plants onto the bench
- Day 14, Scout the canopy, after the count task, linked to the Canopy scout note
- Day 22, Lower-leaf pass, after the scout task, marked approval

Employees see “Managers create templates. You can still work the assignments they generate.”

Avery can save three things on this page:

- **SOP record**, with Title, Summary, and **Save SOP**. The seeded note is Canopy scout: “Walk the canopy slowly. Note pests, stretch, and irrigation dry-back. Do not spray during this pass.”
- **Team**, with Team name, Member, and **Save team**. The seeded team is Canopy crew.
- **New template**, then **Save template**. Fields are Template name, Duration in days, Starting event, Task key, Task title, Days after the starting event, Instructions, Assign to (Role, Team, or Employee), and Linked SOP. The starting-event hint says “Use cycle_start, or the title of a timeline event.” Saving a name that already exists reports “A workflow template with that name already exists.” This form creates a new template. It does not edit Canopy week in place, and the page has no separate Start cycle button.

## Workspace

**Workspace** is titled Employee workspace. The introduction names the date and says tasks from another facility stay off the list. If nothing is due, it says “Nothing is assigned to you today.”

An assignment card shows the facility and room, the task title, the due date, the assignee, and the crop. Chips appear only when the template requires them: Supervisor approval, Photo, Notes, Measurement, or Sign-off. The instructions are on the card. A dependency reads “Depends on …”. A linked SOP shows its title and summary.

Work the card with the checklist boxes, **Notes** and **Save notes**, **Add photo** (jpeg, png, webp, or gif), and **Comment** then **Add comment**. Saved photos can be opened by file name. The card does not have a separate sign-off or measurement box, even when those chips are shown.

On October 3, 2026, the seeded dates put Lower-leaf pass on Flower 1 and Scout the canopy on Veg 1. Blake sees the Harbor House assignment. Casey sees the Hill Works assignment. Avery sees the assignments for both facilities.

## Compliance

**Compliance** says “Imports stay on the license. A move or stage change is sent only after a manager approves it, and only to the sandbox.”

Each license card shows the license number, the facility names, the plant count, and **Open inventory**. The seeded licenses are:

- `OR-CULT-44821` at Harbor House, 144 tagged plants. The compared file matches. The card says “No discrepancies.”
- `OR-CULT-55218` at Hill Works, 86 tagged plants. The compared file has one extra tag, `1A4HW000000000000099999`, labeled “In the file, not in Trim.”

A clean comparison shows a chip with the matched count and “0 discrepancies.” A difference is either “In the file, not in Trim” or “In Trim, not in the file.” If nothing has been compared, the card says “No inventory file has been compared for this license.” Compliance does not show a file-upload button. It shows the comparison that is already stored.

**Open inventory** lists tags for that license. The page says plant totals come from tagged plants on the license, and “Showing N of M tags.” Each tag links to the plant. The plant page shows the tag, strain, stage, room or “No room,” cycle or “No cycle,” and the event history. A move reads as who moved the plant from one room to another. A stage change reads as who changed the stage. An observation reads as who noted the text. There is no form on the plant page to move a plant or change its stage.

**Submissions** on the license card are the reviewed sandbox queue. Nothing is sent until a manager approves it. Status words are Pending review, Queued, Succeeded, Failed, Uncertain, Rejected, and Reconciled. Pending review says “Waiting for a manager. Nothing has been sent.”

Avery, and only an organization admin, can set the sandbox result to Success, Definite failure, or Uncertain, then **Approve** or **Reject**. Reject says “Rejected. Nothing was sent.” Approve says “Approved. The outbox will deliver it.” The worker then delivers that row to the local sandbox. Trim does not call production Metrc.

- Success ends as Succeeded.
- Definite failure ends as Failed and says “Definite failure. Retry only by queueing a new reviewed submission.” **Queue again** creates a new submission that is waiting for review and has not been sent.
- Uncertain says “This change will not be sent again until the sandbox says whether it landed.” **Sandbox says landed** records that it landed and will not be sent again. **Sandbox says it did not land** allows a new reviewed submission.

The seeded queue, still pending review until someone approves it, is a Harbor House move set to Success, a Hill Works stage change set to Definite failure, and a Harbor House stage change set to Uncertain. Their notes are “Submit the Harbor House move,” “Submit the Hill Works stage change,” and “Submit the Harbor House stage change.”

## Harvests

**Harvests** says a harvest keeps the plant tags, weights, waste, and packages for one license, and that veg crops stay in the room until they are cut. Each card shows the harvest name, license, facility, and plant count.

**Harvest this crop** on a room with plants starts a harvest and opens it. The harvest page shows the license, the name, the plant count, and “plant tags stay on this harvest.”

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

**Create package** stays off until a label, a weight, and at least one source tag are present. The line under the buttons counts source tags selected. A package cannot weigh more than the dry weight still unaccounted. A plant that is not on the harvest cannot be packaged. This scan field is a keyboard-style tag entry. It is not an RFID reader.

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

The card also says “Sample environmental readings are excluded. This report does not use their values.” Controller samples and scale samples are not part of these totals.

## Gateway

The gateway is not a navigation item. On a room you can open, use **Environment gateway** and **Post gateway reading**. The reading stores the device, unit, timestamp, and quality, and it is live. Flower 1’s latest temperature changes to the value you post. Humidity stays stale when its own newest reading is older than 60 minutes.

A direct gateway address is `/gateways/` plus the gateway id. The page is titled with the gateway name, or “Gateway write” if you cannot load it. The form asks for Room, Device, Value, Unit, Timestamp, and Quality, then **Post gateway reading**. The introduction says a gateway can post a live reading only for a room on its own site.

Blake opening the Hill Works gateway sees “You do not have access to this gateway.” once. The write is refused. He can still use Harbor House environment from a Harbor House room.
