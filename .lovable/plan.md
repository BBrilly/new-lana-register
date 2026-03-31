

## Plan: Hourly Balance Snapshots with Chart

### Overview
Every hour, the blockchain monitor records the total LANA balance across all registered wallets into a new table. A new "Balance History" tab on the Landing page displays this data as a line chart and table.

### Changes

#### 1. New database table: `balance_snapshots`
- `id` (uuid, PK)
- `total_balance_lana` (numeric) — sum of all wallet balances
- `wallet_count` (integer) — number of wallets included
- `recorded_at` (timestamptz, default now())
- RLS: public SELECT, service-role INSERT (via edge function)

#### 2. Update `blockchain-monitor` edge function
At the end of the existing run, check if the last snapshot is older than 55 minutes. If so:
- Query all wallets, sum their balances (same logic used for the landing page wallet balances — fetch each wallet's transaction sum)
- Insert a row into `balance_snapshots`
- This ensures one snapshot per hour without a separate cron job

#### 3. New tab on Landing page: "Balance History"
- Add a `TabsTrigger` for "Balance History" with a chart icon
- Fetch data from `balance_snapshots` ordered by `recorded_at`
- Display a **line chart** (using existing Recharts/ChartContainer) showing `total_balance_lana` over time (x-axis: hours/dates, y-axis: LANA)
- Below the chart, show a simple table with timestamp, total balance, and wallet count

#### 4. Snapshot logic detail
In `blockchain-monitor/index.ts`, after the main block processing (before the final response):
```text
1. Query balance_snapshots for the most recent recorded_at
2. If no record exists OR last record is > 55 min ago:
   a. Query all wallets (non-frozen) and calculate sum of balances
      via transactions table (credits - debits per wallet)
   b. INSERT into balance_snapshots
3. Log result
```

The balance calculation reuses the same approach the landing page uses: sum of incoming transactions minus outgoing transactions per wallet, then grand total.

### Files to create/modify
1. **Database migration** — Create `balance_snapshots` table with RLS
2. **`supabase/functions/blockchain-monitor/index.ts`** — Add hourly snapshot logic at the end
3. **`src/pages/LandingPage.tsx`** — Add "Balance History" tab with chart and table

