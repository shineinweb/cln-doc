# Data model

The company structure is organization → site → room → zone. A crop cycle belongs to a room. Licenses stay separate from sites.

```
Organization
  ├── User ── Credential
  ├── Role ── Permission
  ├── License ──── LicenseSite ──── Site
  └── Site ── SiteMembership ── User
        └── Room
              ├── Zone
              └── CropCycle
                    ├── CycleEvent
                    ├── CycleMovement
                    ├── CycleObservation
                    ├── CycleLaborEntry
                    └── HarvestResultSummary
```

## Sites are not licenses

A **site** is a physical facility (address, rooms, zones). A **license** is a regulated authorization number held by the organization. `license_sites` records which facilities a license covers. Plants, batches, and inventory comparisons belong to the license. A user can read a license only when they can open one of its sites. Harbor House and Hill Works each have their own license.

`crop_cycles.plant_count` is no longer the number shown in the app. Room and cycle plant counts are `COUNT` of `plants` assigned to that cycle.

Strains belong to the organization. A plant has one strain, one batch, one tag unique on its license, a current room, and an optional crop cycle. Movements, stage changes, observations, and the original planting are `plant_events`. Each event stores the actor.

`metrc_connections` holds server-side credentials and is not returned by the API. Inventory import and submission delivery do not read that table and do not call Metrc.

`metrc_submissions` queue a move or stage change for review. Rejection stores the reviewer and does not send. Approval writes one `metrc_outbox` row in the same transaction. The worker delivers pending outbox rows through the sandbox. Each delivery is a `metrc_attempts` row with the actor, time, request id, and outcome. An uncertain attempt is not sent again until reconciliation stores `landed` or `not_landed` on that attempt.

`metrc_inventory_imports` and `metrc_discrepancies` record a comparison of a saved tag list with local plants. `metrc_syncs` stays empty; it is not an import.

## Access

`site_memberships` is the explicit grant to open one site. A role with `is_org_wide` bypasses that grant inside the same organization only.

## Timestamps

Every table has `created_at` and `updated_at`.

## Room types

`rooms.room_type` is a short string so new kinds do not need a schema change. Seed data uses `flower`, `veg`, `dry`, and `mother`.

## Crop cycles

`crop_cycles.status = active` is the current crop for a room. Cycle day is not stored. It is the number of calendar days from `start_date` through today in the site timezone, counting the start date as day 1.

Timeline events, movements, observations, labor entries, and an optional harvest-result summary are records for the cycle page. They are not the harvest workflow.

`labor_rates` stores an hourly cost in cents for a person. `cycle_input_costs` stores a quantity and unit cost on a cycle. Yield, duration, labor, and cost reports read those rows plus harvest weights and labor entries. They do not store a second total. Sample environmental readings are left out of the reports.

A harvest belongs to a license and records the plant tags that were cut. Wet weight, drying, dry weight, and trimming are `harvest_steps`, each with an actor and time. Waste is `harvest_waste` on that harvest. A package is `harvest_packages` plus `harvest_package_plants`, so the package traces back to those tags. Package weight, waste, and the unaccounted remainder are shown against the dry weight. A finished package is queued on the existing `metrc_submissions` row (`package_id`) and uses the same outbox. Hill Works Veg 1 is not a harvest.

A workflow template belongs to the organization. Each edit creates a new `workflow_template_versions` row. A cycle stores `workflow_version_id` and keeps that version until a manager applies another. Starting or applying a version writes `cycle_tasks`. Due dates are the anchor date plus `offset_days`, in the site timezone. `cycle_start` means the cycle start date, which is day 1. Tasks can be assigned to a team, a role, or an employee. Comments and photo attachments hang off the task. Photos are objects in the attachment bucket.

`environmental_readings` store temperature, relative humidity, CO₂, and substrate for a room. Each row has `device_id`, `unit`, `recorded_at`, `quality` (`good`, `suspect`, or `bad`), and `is_sample`. A sample row is labeled sample data and is not used as a live sensor for a range alert. `rooms.stale_after_minutes` defaults to 60. A metric is stale when it has no reading or the newest reading is older than that many minutes. `alert_rules` flag a stale metric or a live reading outside a range. Matching rows stay active on `room_alerts`. A timestamp without an offset is the site timezone. `sensor_gateways` are site-scoped. A gateway posts a live environmental reading (`is_sample` false) only for a room on that same site. `controller_readings` store sample controller payloads and are not environmental readings, so they do not clear or create range alerts. `scale_samples` store a sample weight beside a harvest and are not harvest steps, waste, or packages, so the weight ledger stays unchanged. None of these adapters call a vendor API. `metrc_syncs` stays empty. `room_tasks` is unused; the room dashboard reads generated `cycle_tasks` that are due today. A sync row with `is_sample` must be labeled sample data.
