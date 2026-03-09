

## Plan: Move freeze threshold from Admin UI to KIND 38888 system parameters

### Summary
Remove the auto-freeze threshold input from Admin panel. Instead, parse `freeze_lana_account_above` and `max_cap_lanas_on_split` from the KIND 38888 event (already published on Nostr) and store them in the `system_parameters` table. The `blockchain-monitor` edge function will read the threshold from `system_parameters` instead of `app_settings`.

### Changes

#### 1. Database migration — add new columns to `system_parameters`
Add columns for the new KIND 38888 tags:
- `freeze_lana_account_above` (text, nullable)
- `max_cap_lanas_on_split` (text, nullable)
- `split_target_lana` (text, nullable)
- `split_started_at` (text, nullable)
- `split_ends_at` (text, nullable)

#### 2. Update `supabase/functions/sync-system-parameters/index.ts`
- Parse new tags from the KIND 38888 event: `freeze_lana_account_above`, `max_cap_lanas_on_split`, `split_target_lana`, `split_started_at`, `split_ends_at`
- Add these fields to the `SystemParameters` interface and `parseKind38888Event` function
- Include them in the `newData` object that gets upserted to the database
- Redeploy the edge function

#### 3. Update `supabase/functions/blockchain-monitor/index.ts`
- Remove the `app_settings` query for `auto_freeze_threshold_lana`
- Instead, read `freeze_lana_account_above` from the `system_parameters` table (already fetched alongside `split`)
- Use this value as the auto-freeze threshold

#### 4. Update `src/components/FreezeManager.tsx`
- Remove the entire Auto-Freeze Threshold card (lines 279–317)
- Remove related state variables (`thresholdValue`, `thresholdLoading`, `thresholdSaving`)
- Remove `useEffect` for fetching threshold and `handleSaveThreshold` function
- Remove unused imports (`Settings`, `Save`)

#### 5. Update `src/utils/nostrClient.ts`
- Add new fields to the `SystemParameters` interface: `freeze_lana_account_above`, `max_cap_lanas_on_split`, `split_target_lana`, `split_started_at`, `split_ends_at`
- Parse these tags in `parseEventContent`

