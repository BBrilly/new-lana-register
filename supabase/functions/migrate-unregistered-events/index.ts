import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Nostr imports
import { SimplePool } from "https://esm.sh/nostr-tools@2.7.0/pool";
import type { Filter } from "https://esm.sh/nostr-tools@2.7.0/filter";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CSV data to migrate
const csvData = [
  {
    id: "0b4371dc-5537-4b20-a1f6-938c81b02371",
    unregistered_amount: 50000.00000000,
    detected_at: "2025-09-16T17:12:00.674717+00:00",
    notes: "Unregistered sender: LaFnKHXxj4KEuVMbtyLnNCJTpUtTPWXjJC (Transaction ID: 43f5f1fe-a341-4f0f-afe2-5b06551d8954)",
    nostr_event_id: "d2a2b992cc552a486f489d74df19f4581076cf2ed1d353be9d8d72b0f09af4c1"
  },
  {
    id: "3f8f9cb6-0994-480a-b9a7-bbe525e525fb",
    unregistered_amount: 100.00000000,
    detected_at: "2025-10-04T13:45:01.728142+00:00",
    notes: "Unregistered sender: LYk3Gp7iQGc6XAq6E5X5VKeGksKTt2sEUN (Transaction ID: 95aa7540-2e85-4366-976e-5dacfa90f49c)",
    nostr_event_id: "5169538e2b83ca20c82465f06dd92e7a4a7251cc65787ba7c0c8be17653f641f"
  },
  {
    id: "6d37b226-698d-4af1-8b74-b89213b9ee12",
    unregistered_amount: 1.00000000,
    detected_at: "2025-10-21T14:39:01.696165+00:00",
    notes: "Unregistered sender: LVWUcTeJvx25HZsmzHPBCqDKyysBSdGzYA (Transaction ID: 218057b1-0e31-4c11-9f33-73bef31f1ebc)",
    nostr_event_id: "66d98e1b547d1f27ac86eaf399452c3a0db3442e2ffbfaad58c7f1c61f0cd25c"
  },
  {
    id: "7d7fc0b6-7b0f-4e10-9d86-c7c795fcb6c8",
    unregistered_amount: 0.00100000,
    detected_at: "2025-08-24T11:17:01.382827+00:00",
    notes: "Unregistered sender: LSjGWvnJRrdfsGDYud499yP8DAY2GfbT6P (Transaction ID: c77fae2b-5cbf-4e63-9723-e2758336e6bd)",
    nostr_event_id: "d19749ed2e8152bd6e6fb52405627d3175f2c5f6335286b459886136fc29353c"
  },
  {
    id: "9644a71c-2d2a-4d9d-9c1e-b960b3a4084f",
    unregistered_amount: 50000.00000000,
    detected_at: "2025-10-22T18:27:02.130009+00:00",
    notes: "Unregistered sender: LaFnKHXxj4KEuVMbtyLnNCJTpUtTPWXjJC (Transaction ID: 87c9dc43-f09e-495a-a4ed-e4c9a01d9924)",
    nostr_event_id: "47ebe27c02aed2cf08e396fe853d191210ce857ec4cd64ba226373a87598e7a7"
  },
  {
    id: "9f20e9e3-28d9-4cd1-95f2-fbbcc88ef5b6",
    unregistered_amount: 100000.00000000,
    detected_at: "2025-09-16T17:09:06.479122+00:00",
    notes: "Unregistered sender: LaFnKHXxj4KEuVMbtyLnNCJTpUtTPWXjJC (Transaction ID: 83303af5-4600-43dd-b176-5705257a14d0)",
    nostr_event_id: "2498ef496ef8a33c92974b3a020df5eb834b7b10ec7ab6be26f70e902e35bca1"
  },
  {
    id: "ba55e4c3-4348-414f-90d3-38469c4ff461",
    unregistered_amount: 1.00000000,
    detected_at: "2025-07-20T20:35:03.292162+00:00",
    notes: "Unregistered sender: LX8xQSevKTywyRvKVh6qGM6jbiZ5F23TgF (Transaction ID: 073c2753-f76e-4b21-a265-f3c0a8c4afee)",
    nostr_event_id: "d834b27c197d43691d52629be91f74282c61568ebe324dc944480c494b17b168"
  },
  {
    id: "c7e62626-f030-4f42-8d89-a3d3f7384b8f",
    unregistered_amount: 0.00100000,
    detected_at: "2025-09-03T10:54:03.16189+00:00",
    notes: "Unregistered sender: LTjKeaKNWhHUqZJHoNyRsyHKdX4XpbzJA2 (Transaction ID: e58e6de5-62ed-4133-aafa-53273c6955b1)",
    nostr_event_id: "1f99fce8f751aa23dc590943b8e863df9c520b3350a0c96f5b3ec7c9ac3f3392"
  },
  {
    id: "c95fd088-281a-4e95-baf2-5e2c9064d9f4",
    unregistered_amount: 3.00000000,
    detected_at: "2025-08-24T11:17:01.287472+00:00",
    notes: "Unregistered sender: LNk98927TPKhUkrebL5Z4GqtW3qowVVqi9 (Transaction ID: 91aa94ce-ae37-4fd6-ba69-35a06c9dacae)",
    nostr_event_id: "70b6607620998efcc7692f729d5e2e2e2af204f39ae09518a6bbce92f78ae401"
  },
  {
    id: "d6e0068a-b959-4d51-8a7a-7b98f5ec2dfc",
    unregistered_amount: 1.00000000,
    detected_at: "2025-10-21T14:39:01.619696+00:00",
    notes: "Unregistered sender: LVWUcTeJvx25HZsmzHPBCqDKyysBSdGzYA (Transaction ID: 0c450bc7-d3f0-40bb-9bd2-d8fe939bd2f5)",
    nostr_event_id: "fe3b6f7bb98b6bd2da4bf50a0c33a645a39a56e15e40088d500ea1dfae9040b9"
  }
];

// Default relays to use if system_parameters not available
const DEFAULT_RELAYS = [
  'wss://relay.lanavault.space',
  'wss://relay.lanacoin-eternity.com',
  'wss://relay.lanaheartvoice.com',
  'wss://relay.lovelana.org',
  'wss://nostr1.lanacoin.com'
];

interface MigrationResult {
  id: string;
  nostr_event_id: string;
  wallet_address: string | null;
  wallet_uuid: string | null;
  status: 'inserted' | 'skipped_exists' | 'skipped_no_event' | 'skipped_no_wallet' | 'error';
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 Starting migration of unregistered_lana_events...');

  try {
    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get relays from system_parameters
    let relays = DEFAULT_RELAYS;
    const { data: sysParams } = await supabase
      .from('system_parameters')
      .select('relays')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sysParams?.relays) {
      const relayList = sysParams.relays as string[];
      if (Array.isArray(relayList) && relayList.length > 0) {
        relays = relayList;
        console.log(`📡 Using ${relays.length} relays from system_parameters`);
      }
    } else {
      console.log(`📡 Using ${DEFAULT_RELAYS.length} default relays`);
    }

    // Initialize Nostr pool
    const pool = new SimplePool();
    const results: MigrationResult[] = [];

    // Collect all nostr event IDs for batch query
    const eventIds = csvData.map(row => row.nostr_event_id);
    console.log(`🔍 Fetching ${eventIds.length} events from Nostr relays...`);

    // Fetch all 87003 events in one batch
    const filter: Filter = {
      ids: eventIds,
      kinds: [87003]
    };

    let nostrEvents: any[] = [];
    try {
      nostrEvents = await pool.querySync(relays, filter);
      console.log(`✅ Fetched ${nostrEvents.length} events from Nostr`);
    } catch (error) {
      console.error('❌ Error fetching events from Nostr:', error);
    }

    // Create a map of event ID -> WalletID for quick lookup
    const eventWalletMap = new Map<string, string>();
    for (const event of nostrEvents) {
      const walletIdTag = event.tags?.find((t: string[]) => t[0] === 'WalletID');
      if (walletIdTag && walletIdTag[1]) {
        eventWalletMap.set(event.id, walletIdTag[1]);
        console.log(`📍 Event ${event.id.substring(0, 8)}... -> Wallet: ${walletIdTag[1]}`);
      }
    }

    // Get all wallets from database for mapping
    const { data: wallets, error: walletsError } = await supabase
      .from('wallets')
      .select('id, wallet_id');

    if (walletsError) {
      throw new Error(`Failed to fetch wallets: ${walletsError.message}`);
    }

    // Create wallet address -> UUID map
    const walletAddressToUuid = new Map<string, string>();
    for (const wallet of wallets || []) {
      if (wallet.wallet_id) {
        walletAddressToUuid.set(wallet.wallet_id, wallet.id);
      }
    }
    console.log(`📦 Loaded ${walletAddressToUuid.size} wallets from database`);

    // Check for existing records
    const { data: existingRecords } = await supabase
      .from('unregistered_lana_events')
      .select('nostr_87003_event_id')
      .in('nostr_87003_event_id', eventIds);

    const existingEventIds = new Set((existingRecords || []).map(r => r.nostr_87003_event_id));
    console.log(`📋 Found ${existingEventIds.size} existing records`);

    // Process each CSV row
    for (const row of csvData) {
      const result: MigrationResult = {
        id: row.id,
        nostr_event_id: row.nostr_event_id,
        wallet_address: null,
        wallet_uuid: null,
        status: 'error'
      };

      try {
        // Check if already exists
        if (existingEventIds.has(row.nostr_event_id)) {
          result.status = 'skipped_exists';
          console.log(`⏭️ Skipping ${row.nostr_event_id.substring(0, 8)}... (already exists)`);
          results.push(result);
          continue;
        }

        // Get wallet address from Nostr event
        const walletAddress = eventWalletMap.get(row.nostr_event_id);
        if (!walletAddress) {
          result.status = 'skipped_no_event';
          result.error = 'Event not found on Nostr relays or missing WalletID tag';
          console.log(`⚠️ Event ${row.nostr_event_id.substring(0, 8)}... not found on Nostr`);
          results.push(result);
          continue;
        }
        result.wallet_address = walletAddress;

        // Get wallet UUID from database
        const walletUuid = walletAddressToUuid.get(walletAddress);
        if (!walletUuid) {
          result.status = 'skipped_no_wallet';
          result.error = `Wallet ${walletAddress} not found in database`;
          console.log(`⚠️ Wallet ${walletAddress} not found in database`);
          results.push(result);
          continue;
        }
        result.wallet_uuid = walletUuid;

        // Insert the record
        const { error: insertError } = await supabase
          .from('unregistered_lana_events')
          .insert({
            id: row.id,
            wallet_id: walletUuid,
            unregistered_amount: row.unregistered_amount,
            detected_at: row.detected_at,
            notes: row.notes,
            nostr_87003_event_id: row.nostr_event_id,
            nostr_87003_published: true,
            nostr_87003_published_at: row.detected_at
          });

        if (insertError) {
          result.status = 'error';
          result.error = insertError.message;
          console.log(`❌ Error inserting ${row.id}: ${insertError.message}`);
        } else {
          result.status = 'inserted';
          console.log(`✅ Inserted ${row.id} (wallet: ${walletAddress})`);
        }
      } catch (error) {
        result.status = 'error';
        result.error = error instanceof Error ? error.message : String(error);
        console.log(`❌ Error processing ${row.id}: ${result.error}`);
      }

      results.push(result);
    }

    // Close pool
    pool.close(relays);

    // Generate summary
    const summary = {
      success: true,
      total: csvData.length,
      inserted: results.filter(r => r.status === 'inserted').length,
      skipped_exists: results.filter(r => r.status === 'skipped_exists').length,
      skipped_no_event: results.filter(r => r.status === 'skipped_no_event').length,
      skipped_no_wallet: results.filter(r => r.status === 'skipped_no_wallet').length,
      errors: results.filter(r => r.status === 'error').length,
      details: results
    };

    console.log('📊 Migration complete:', JSON.stringify({
      total: summary.total,
      inserted: summary.inserted,
      skipped_exists: summary.skipped_exists,
      skipped_no_event: summary.skipped_no_event,
      skipped_no_wallet: summary.skipped_no_wallet,
      errors: summary.errors
    }));

    return new Response(JSON.stringify(summary, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
