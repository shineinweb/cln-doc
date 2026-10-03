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

A **site** is a physical facility (address, rooms, zones). A **license** is a regulated authorization number held by the organization. `license_sites` records that a license may cover work at a facility. Inventory, when it exists, should be scoped by license. Phase 1 stores license rows and does not expose them through the API.

## Access

`site_memberships` is the explicit grant to open one site. A role with `is_org_wide` bypasses that grant inside the same organization only.

## Timestamps

Every table has `created_at` and `updated_at`.

## Room types

`rooms.room_type` is a short string so new kinds do not need a schema change. Seed data uses `flower`, `veg`, `dry`, and `mother`.

## Crop cycles

`crop_cycles.status = active` is the current crop for a room. Cycle day is not stored. It is the number of calendar days from `start_date` through today in the site timezone, counting the start date as day 1.

Timeline events, movements, observations, labor entries, and an optional harvest-result summary are records for the cycle page. They are not a harvest workflow.

`room_tasks`, `room_alerts`, `environmental_readings`, and `metrc_syncs` exist so the room dashboard can read them. Phase 2 does not generate tasks or call Metrc. Empty tables render as empty states. A reading or sync row with `is_sample` must be labeled sample data.
