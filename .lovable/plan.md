

## Plan: Add `frozen_unreg_Lanas` freeze status

### What
Add a new freeze status code `frozen_unreg_Lanas` (frozen due to receiving unregistered LANA from frozen wallets) across the codebase and API documentation.

### Changes

#### 1. Admin Freeze Manager (`src/components/FreezeManager.tsx`)
- Add `{ value: "frozen_unreg_Lanas", label: "Unregistered Lanas from Frozen", description: "Frozen due to receiving unregistered LANA from frozen wallet(s)" }` to `FREEZE_CODES` array

#### 2. Frozen Accounts Tab (`src/components/FrozenAccountsTab.tsx`)
- Add to `FREEZE_CODES`: `{ value: "frozen_unreg_Lanas", label: "Unreg. Lanas from Frozen" }`
- Add to `FREEZE_LABELS`: `frozen_unreg_Lanas: "Unreg. Lanas from Frozen"`

#### 3. Landing Page (`src/pages/LandingPage.tsx`)
- Add to `FREEZE_LABELS`: `frozen_unreg_Lanas: "Unreg. Lanas from Frozen"`

#### 4. API Docs (`src/pages/ApiDocs.tsx`)
- Add new table row for `frozen_unreg_Lanas` with description "Frozen due to receiving unregistered LANA from frozen wallet(s)"
- Add to `KNOWN_CODES` array in the code example
- Add an example w tag line showing this status

#### 5. Blockchain Monitor (`supabase/functions/blockchain-monitor/index.ts`)
- When auto-freezing wallets that received LANA exceeding the threshold from unregistered senders, use `frozen_unreg_Lanas` as the `freeze_reason` (this ties into the previously approved auto-freeze plan)

No database migration needed — `freeze_reason` is already a free-text column.

