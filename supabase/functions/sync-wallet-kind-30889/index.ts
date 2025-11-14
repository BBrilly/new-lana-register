import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { SimplePool, Filter, Event } from 'https://esm.sh/nostr-tools@2.17.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WalletTag {
  wallet_id: string;
  wallet_type: string;
  currency: string;
  note: string;
  amount_unregistered_lanoshi: number;
}

interface ParsedEvent {
  customer_pubkey: string;
  status: string;
  wallets: WalletTag[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting KIND 30889 wallet sync...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch system parameters for relays and trusted signers
    const { data: sysParams, error: sysError } = await supabase
      .from('system_parameters')
      .select('relays, trusted_signers')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (sysError || !sysParams) {
      console.error('Failed to fetch system parameters:', sysError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch system parameters' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const relays = sysParams.relays as string[];
    const registrarPubkeys = (sysParams.trusted_signers as any)?.LanaRegistrar || [];

    if (!relays || relays.length === 0) {
      console.error('No relays found in system parameters');
      return new Response(
        JSON.stringify({ error: 'No relays configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!registrarPubkeys || registrarPubkeys.length === 0) {
      console.error('No LanaRegistrar pubkeys found');
      return new Response(
        JSON.stringify({ error: 'No registrar pubkeys configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Connecting to ${relays.length} relays...`);
    console.log(`Monitoring ${registrarPubkeys.length} registrar pubkeys`);

    // Create Nostr pool
    const pool = new SimplePool();

    // Query events from last 20 minutes
    const twentyMinutesAgo = Math.floor(Date.now() / 1000) - (20 * 60);
    
    const filter: Filter = {
      kinds: [30889],
      authors: registrarPubkeys,
      since: twentyMinutesAgo
    };

    console.log('Fetching KIND 30889 events from last 20 minutes...');
    
    const events = await pool.querySync(relays, filter);
    console.log(`Found ${events.length} events`);

    if (events.length === 0) {
      pool.close(relays);
      return new Response(
        JSON.stringify({ message: 'No events found', synced: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse events
    const parsedEvents = parseKind30889Events(events);
    console.log(`Parsed ${parsedEvents.length} valid events`);

    let syncedCount = 0;
    let errorCount = 0;

    // Process each event
    for (const parsed of parsedEvents) {
      try {
        await syncWallets(supabase, parsed);
        syncedCount++;
      } catch (error) {
        console.error(`Error syncing wallets for ${parsed.customer_pubkey}:`, error);
        errorCount++;
      }
    }

    pool.close(relays);

    console.log(`Sync completed: ${syncedCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        message: 'Sync completed',
        synced: syncedCount,
        errors: errorCount,
        total_events: events.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fatal error during sync:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseKind30889Events(events: Event[]): ParsedEvent[] {
  const parsed: ParsedEvent[] = [];

  for (const event of events) {
    try {
      // Find required tags
      const dTag = event.tags.find(t => t[0] === 'd');
      const statusTag = event.tags.find(t => t[0] === 'status');
      const wTags = event.tags.filter(t => t[0] === 'w');

      if (!dTag || !dTag[1]) {
        console.warn(`Event ${event.id} missing d tag`);
        continue;
      }

      if (!statusTag || !statusTag[1]) {
        console.warn(`Event ${event.id} missing status tag`);
        continue;
      }

      const customer_pubkey = dTag[1];
      const status = statusTag[1];

      // Parse wallet tags
      const wallets: WalletTag[] = [];
      for (const wTag of wTags) {
        if (wTag.length !== 6) {
          console.warn(`Invalid w tag format in event ${event.id}`);
          continue;
        }

        wallets.push({
          wallet_id: wTag[1],
          wallet_type: wTag[2],
          currency: wTag[3],
          note: wTag[4] || '',
          amount_unregistered_lanoshi: parseInt(wTag[5]) || 0
        });
      }

      if (wallets.length === 0) {
        console.warn(`Event ${event.id} has no valid wallet tags`);
        continue;
      }

      parsed.push({
        customer_pubkey,
        status,
        wallets
      });

    } catch (error) {
      console.error(`Error parsing event ${event.id}:`, error);
    }
  }

  return parsed;
}

async function syncWallets(supabase: any, parsed: ParsedEvent) {
  const { customer_pubkey, status, wallets } = parsed;

  console.log(`Syncing ${wallets.length} wallets for customer ${customer_pubkey.substring(0, 8)}...`);

  // Find Main wallet
  const mainWallet = wallets.find(w => w.wallet_type === 'Main');
  
  if (!mainWallet) {
    console.warn(`No Main wallet found for customer ${customer_pubkey}`);
    return;
  }

  // UPSERT main wallet
  const { data: mainWalletData, error: mainError } = await supabase
    .from('main_wallets')
    .upsert({
      nostr_hex_id: customer_pubkey,
      wallet_id: mainWallet.wallet_id,
      name: mainWallet.note || 'Main Wallet',
      status: status,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'nostr_hex_id',
      ignoreDuplicates: false
    })
    .select()
    .single();

  if (mainError) {
    console.error('Error upserting main wallet:', mainError);
    throw mainError;
  }

  console.log(`Main wallet synced: ${mainWalletData.id}`);

  const mainWalletId = mainWalletData.id;

  // Get current wallet IDs in database for this main wallet
  const { data: existingWallets } = await supabase
    .from('wallets')
    .select('wallet_id')
    .eq('main_wallet_id', mainWalletId);

  const existingWalletIds = new Set<string>((existingWallets || []).map((w: any) => w.wallet_id).filter((id: string) => id !== null));
  const newWalletIds = new Set<string>(wallets.map(w => w.wallet_id));

  // Delete wallets that are no longer in the event
  const walletsToDelete = Array.from(existingWalletIds).filter((id: string) => !newWalletIds.has(id));
  
  if (walletsToDelete.length > 0) {
    console.log(`Deleting ${walletsToDelete.length} removed wallets...`);
    const { error: deleteError } = await supabase
      .from('wallets')
      .delete()
      .in('wallet_id', walletsToDelete);

    if (deleteError) {
      console.error('Error deleting wallets:', deleteError);
    }
  }

  // UPSERT all wallets (including Main)
  for (const wallet of wallets) {
    const { error: walletError } = await supabase
      .from('wallets')
      .upsert({
        main_wallet_id: mainWalletId,
        wallet_id: wallet.wallet_id,
        wallet_type: wallet.wallet_type,
        notes: wallet.note,
        amount_unregistered_lanoshi: wallet.amount_unregistered_lanoshi,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'wallet_id',
        ignoreDuplicates: false
      });

    if (walletError) {
      console.error(`Error upserting wallet ${wallet.wallet_id}:`, walletError);
    }
  }

  console.log(`Synced ${wallets.length} wallets for customer ${customer_pubkey.substring(0, 8)}`);
}
