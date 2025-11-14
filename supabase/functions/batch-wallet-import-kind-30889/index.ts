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
    console.log('Starting batch wallet import...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find next pending or failed batch (oldest first)
    const { data: batch, error: batchError } = await supabase
      .from('batch_wallet_import_status')
      .select('*')
      .in('status', ['pending', 'failed'])
      .order('start_date', { ascending: true })
      .limit(1)
      .single();

    if (batchError || !batch) {
      console.log('No pending or failed batches found');
      return new Response(
        JSON.stringify({ message: 'No batches to process', allComplete: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing batch: ${batch.start_date} to ${batch.end_date}`);

    // Mark batch as processing
    await supabase
      .from('batch_wallet_import_status')
      .update({ status: 'processing', error_message: null })
      .eq('id', batch.id);

    // Fetch system parameters for relays and trusted signers
    const { data: sysParams, error: sysError } = await supabase
      .from('system_parameters')
      .select('relays, trusted_signers')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (sysError || !sysParams) {
      const errorMsg = 'Failed to fetch system parameters';
      console.error(errorMsg, sysError);
      await supabase
        .from('batch_wallet_import_status')
        .update({ status: 'failed', error_message: errorMsg })
        .eq('id', batch.id);
      
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const relays = sysParams.relays as string[];
    const registrarPubkeys = (sysParams.trusted_signers as any)?.LanaRegistrar || [];

    if (!relays || relays.length === 0 || !registrarPubkeys || registrarPubkeys.length === 0) {
      const errorMsg = 'No relays or registrar pubkeys configured';
      console.error(errorMsg);
      await supabase
        .from('batch_wallet_import_status')
        .update({ status: 'failed', error_message: errorMsg })
        .eq('id', batch.id);
      
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Connecting to ${relays.length} relays...`);
    console.log(`Monitoring ${registrarPubkeys.length} registrar pubkeys`);

    // Create Nostr pool
    const pool = new SimplePool();

    // Convert dates to Unix timestamps
    const sinceTimestamp = Math.floor(new Date(batch.start_date).getTime() / 1000);
    const untilTimestamp = Math.floor(new Date(batch.end_date).getTime() / 1000);
    
    const filter: Filter = {
      kinds: [30889],
      authors: registrarPubkeys,
      since: sinceTimestamp,
      until: untilTimestamp
    };

    console.log(`Fetching KIND 30889 events from ${batch.start_date} to ${batch.end_date}...`);
    
    const events = await pool.querySync(relays, filter);
    console.log(`Found ${events.length} events in this batch`);

    if (events.length === 0) {
      pool.close(relays);
      
      // Mark as completed with 0 records
      await supabase
        .from('batch_wallet_import_status')
        .update({ 
          status: 'completed',
          main_wallets_synced: 0,
          total_wallets_synced: 0
        })
        .eq('id', batch.id);

      return new Response(
        JSON.stringify({ message: 'No events in this batch', batchId: batch.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse events
    const parsedEvents = parseKind30889Events(events);
    console.log(`Parsed ${parsedEvents.length} valid events`);

    let totalMainWallets = 0;
    let totalWallets = 0;
    let errorCount = 0;

    // Process each event
    for (const parsed of parsedEvents) {
      try {
        const counts = await syncWallets(supabase, parsed);
        totalMainWallets += counts.mainWalletCount;
        totalWallets += counts.totalWalletCount;
      } catch (error) {
        console.error(`Error syncing wallets for ${parsed.customer_pubkey}:`, error);
        errorCount++;
      }
    }

    pool.close(relays);

    console.log(`Batch completed: ${totalMainWallets} main wallets, ${totalWallets} total wallets, ${errorCount} errors`);

    // Update batch status
    await supabase
      .from('batch_wallet_import_status')
      .update({ 
        status: 'completed',
        main_wallets_synced: totalMainWallets,
        total_wallets_synced: totalWallets,
        error_message: errorCount > 0 ? `${errorCount} errors during sync` : null
      })
      .eq('id', batch.id);

    return new Response(
      JSON.stringify({ 
        message: 'Batch completed',
        batchId: batch.id,
        mainWallets: totalMainWallets,
        totalWallets: totalWallets,
        errors: errorCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fatal error in batch import:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseKind30889Events(events: Event[]): ParsedEvent[] {
  const parsed: ParsedEvent[] = [];

  for (const event of events) {
    try {
      // Extract customer_pubkey from 'd' tag
      const dTag = event.tags.find(t => t[0] === 'd');
      if (!dTag || !dTag[1]) {
        console.warn(`Event ${event.id} missing 'd' tag`);
        continue;
      }

      const customer_pubkey = dTag[1];

      // Extract status from 'status' tag
      const statusTag = event.tags.find(t => t[0] === 'status');
      const status = statusTag?.[1] || 'active';

      // Extract wallets from 'w' tags
      const walletTags = event.tags.filter(t => t[0] === 'w');
      const wallets: WalletTag[] = [];

      for (const wTag of walletTags) {
        if (wTag.length < 4) {
          console.warn(`Invalid 'w' tag in event ${event.id}`);
          continue;
        }

        wallets.push({
          wallet_id: wTag[1] || '',
          wallet_type: wTag[2] || '',
          currency: wTag[3] || '',
          note: wTag[4] || '',
          amount_unregistered_lanoshi: parseInt(wTag[5] || '0', 10)
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

async function syncWallets(
  supabase: any,
  parsed: ParsedEvent
): Promise<{ mainWalletCount: number; totalWalletCount: number }> {
  const { customer_pubkey, status, wallets } = parsed;

  console.log(`Syncing ${wallets.length} wallets for customer ${customer_pubkey.substring(0, 8)}...`);

  // Find Main wallet (checking for both "Main" and "Main Wallet")
  const mainWallet = wallets.find(w => w.wallet_type === 'Main' || w.wallet_type === 'Main Wallet');
  
  if (!mainWallet) {
    console.warn(`No Main wallet found for customer ${customer_pubkey}`);
    return { mainWalletCount: 0, totalWalletCount: 0 };
  }

  // Upsert main wallet in main_wallets table
  const { data: mainWalletData, error: mainWalletError } = await supabase
    .from('main_wallets')
    .upsert({
      nostr_hex_id: customer_pubkey,
      name: mainWallet.wallet_type,
      wallet_id: mainWallet.wallet_id,
      status: status,
      profile_pic_link: null,
      user_id: null
    }, {
      onConflict: 'nostr_hex_id',
      ignoreDuplicates: false
    })
    .select()
    .single();

  if (mainWalletError) {
    console.error('Error upserting main wallet:', mainWalletError);
    throw mainWalletError;
  }

  const mainWalletId = mainWalletData.id;
  console.log(`Main wallet synced: ${mainWalletId}`);

  // Fetch existing wallets for this main_wallet
  const { data: existingWallets } = await supabase
    .from('wallets')
    .select('wallet_id')
    .eq('main_wallet_id', mainWalletId);

  const existingWalletIds: Set<string> = new Set((existingWallets || []).map((w: any) => w.wallet_id as string));
  const newWalletIds: Set<string> = new Set(wallets.map(w => w.wallet_id).filter(id => id));

  // Delete wallets no longer present
  const walletsToDelete = Array.from(existingWalletIds).filter(id => !newWalletIds.has(id));
  if (walletsToDelete.length > 0) {
    await supabase
      .from('wallets')
      .delete()
      .eq('main_wallet_id', mainWalletId)
      .in('wallet_id', walletsToDelete);
    
    console.log(`Deleted ${walletsToDelete.length} removed wallets`);
  }

  // Upsert all wallets
  const walletRecords = wallets.map(w => ({
    main_wallet_id: mainWalletId,
    wallet_id: w.wallet_id || null,
    wallet_type: w.wallet_type,
    notes: w.note || null,
    amount_unregistered_lanoshi: w.amount_unregistered_lanoshi || 0
  }));

  const { error: walletsError } = await supabase
    .from('wallets')
    .upsert(walletRecords, {
      onConflict: 'wallet_id',
      ignoreDuplicates: false
    });

  if (walletsError) {
    console.error('Error upserting wallets:', walletsError);
    throw walletsError;
  }

  console.log(`Synced ${wallets.length} wallets for customer ${customer_pubkey.substring(0, 8)}`);
  
  return { 
    mainWalletCount: 1, 
    totalWalletCount: wallets.length 
  };
}