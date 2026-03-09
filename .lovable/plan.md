

## Plan: Add Auto-Freeze Threshold Setting in Admin Panel

### What's already done
- `blockchain-monitor` already reads `auto_freeze_threshold_lana` from `app_settings` and auto-freezes wallets with `frozen_unreg_Lanas` status
- The `frozen_unreg_Lanas` status is already added across all UI components and API docs

### What's missing
An Admin UI to **set/update** the `auto_freeze_threshold_lana` value in `app_settings`.

### Changes

#### 1. Update `src/components/FreezeManager.tsx`
Add a new section at the top of the component (before the Nostr Hex search):
- On mount, fetch current value from `app_settings` where `key = 'auto_freeze_threshold_lana'`
- Show an input field (number, in LANA) with the current threshold value
- Save button that upserts to `app_settings` (insert if not exists, update if exists)
- Display description: "Wallets receiving more than this amount of unregistered LANA will be automatically frozen with status `frozen_unreg_Lanas`"

#### Technical Details
- Use `useEffect` to load the current setting on mount
- On save, use `supabase.from('app_settings').upsert({ key: 'auto_freeze_threshold_lana', value: inputValue, description: '...' }, { onConflict: 'key' })`
- The `app_settings` table already has admin-only insert/update RLS policies, so this is secure
- No database migration needed

