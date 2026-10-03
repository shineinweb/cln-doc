# Data model

Phase 1 models the company structure later modules will hang from. It does not model plants, harvests, sensors, or Metrc submissions.

```
Organization
  ├── User ── Credential
  ├── Role ── Permission
  ├── License ──── LicenseSite ──── Site
  └── Site ── SiteMembership ── User
        └── Room
              └── Zone
```

## Sites are not licenses

A **site** is a physical facility (address, rooms, zones). A **license** is a regulated authorization number held by the organization. `license_sites` records that a license may cover work at a facility. Inventory, when it exists, should be scoped by license. Phase 1 stores license rows and does not expose them through the API.

## Access

`site_memberships` is the explicit grant to open one site. A role with `is_org_wide` bypasses that grant inside the same organization only.

## Timestamps

Every table has `created_at` and `updated_at`.

## Room types

`rooms.room_type` is a short string so new kinds do not need a schema change. Seed data uses `flower`, `veg`, `dry`, and `mother`.
