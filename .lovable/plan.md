

## Plan: Add `split_created` to simple_check_wallet_registration

### Changes

#### 1. Edge function `supabase/functions/check/index.ts`
- Line 97: Add `split_created` to the `.select()` query: `"wallet_id, wallet_type, main_wallet_id, created_at, frozen, split_created"`
- Line 132: Add `split_created: wallet.split_created ?? null` to the response wallet object

No other logic changes — fully backward compatible (new field, no removed fields).

#### 2. API docs `src/pages/ApiDocs.tsx`
- Update `simpleCheckFound` example response (line ~162) to include `"split_created": 4`
- Add `split_created` description bullet in the description list (~line 631): "Returns the split number in which the wallet was created"
- Add `split_created` row to the response description if needed

#### 3. Deploy the updated edge function

No database changes needed.

