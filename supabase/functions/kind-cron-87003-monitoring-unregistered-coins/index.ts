import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SimplePool, finalizeEvent } from 'https://esm.sh/nostr-tools@2.7.0';
import { decode } from 'https://esm.sh/nostr-tools@2.7.0/nip19';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PublishResult {
  relay: string;
  success: boolean;
  error?: string;
}

interface UnregisteredLanaEvent {
  id: string;
  wallet_id: string;
  unregistered_amount: number;
  notes: string | null;
  detected_at: string;
  nostr_event_id: string | null;
}

interface WalletInfo {
  id: string;
  wallet_id: string;
  main_wallet_id: string;
  main_wallets: {
    nostr_hex_id: string;
    is_owned: boolean;
  } | null;
}

interface WalletRow {
  id: string;
  wallet_id: string;
  main_wallet_id: string;
  main_wallets: {
    nostr_hex_id: string;
    is_owned: boolean;
  } | { nostr_hex_id: string; is_owned: boolean; }[] | null;
}

// Convert nsec to hex private key
function nsecToHex(nsec: string): string {
  try {
    const decoded = decode(nsec);
    if (decoded.type !== 'nsec') {
      throw new Error('Invalid nsec format');
    }
    return Array.from(decoded.data as Uint8Array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    console.error('Error decoding nsec:', error);
    throw new Error('Failed to decode nsec private key');
  }
}

// Convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  }
  return bytes;
}

// Convert LANA amount to Latoshis (1 LANA = 100,000,000 Latoshis)
function lanaToLatoshis(amount: number): string {
  return Math.floor(amount * 100000000).toString();
}

// Publish event to Nostr relays
async function publishEventToNostr(
  signedEvent: any,
  relays: string[]
): Promise<{ eventId: string; results: PublishResult[] }> {
  const pool = new SimplePool();
  const results: PublishResult[] = [];

  try {
    const publishPromises = relays.map(async (relay: string) => {
      console.log(`🔄 Connecting to ${relay}...`);

      return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          results.push({
            relay,
            success: false,
            error: 'Connection timeout (10s)',
          });
          console.error(`❌ ${relay}: Timeout`);
          resolve();
        }, 10000);

        try {
          const pubs = pool.publish([relay], signedEvent);

          Promise.race([
            Promise.all(pubs),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Publish timeout')), 8000)
            ),
          ])
            .then(() => {
              clearTimeout(timeout);
              results.push({ relay, success: true });
              console.log(`✅ ${relay}: Successfully published`);
              resolve();
            })
            .catch((error) => {
              clearTimeout(timeout);
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              results.push({ relay, success: false, error: errorMsg });
              console.error(`❌ ${relay}: ${errorMsg}`);
              resolve();
            });
        } catch (error) {
          clearTimeout(timeout);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          results.push({ relay, success: false, error: errorMsg });
          console.error(`❌ ${relay}: ${errorMsg}`);
          resolve();
        }
      });
    });

    await Promise.all(publishPromises);

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    console.log('📊 Publishing summary:', {
      eventId: signedEvent.id,
      total: results.length,
      successful: successCount,
      failed: failedCount,
    });

    return { eventId: signedEvent.id, results };
  } finally {
    pool.close(relays);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 Kind 87003 - Monitoring for Unregistered Coins Publisher started');

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch NOSTR private key from app_settings
    console.log('🔑 Fetching NOSTR registrar private key...');
    const { data: settingData, error: settingError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'nostr_registrar_nsec')
      .single();

    if (settingError || !settingData?.value) {
      console.error('❌ Failed to fetch NOSTR private key:', settingError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'NOSTR registrar private key not configured in app_settings',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nsecKey = settingData.value.trim();
    if (!nsecKey || !nsecKey.startsWith('nsec1')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid NOSTR private key format. Must be nsec1...',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert nsec to hex
    const privateKeyHex = nsecToHex(nsecKey);
    const privateKeyBytes = hexToBytes(privateKeyHex);
    console.log('✅ Private key loaded successfully');

    // 2. Fetch relay configuration from system_parameters
    console.log('📡 Fetching relay configuration...');
    const { data: sysParams, error: sysError } = await supabase
      .from('system_parameters')
      .select('relays, pubkey')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (sysError || !sysParams?.relays) {
      console.error('❌ Failed to fetch system parameters:', sysError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch relay configuration',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const relays = (sysParams.relays as string[]).filter((r: string) => r.startsWith('wss://'));
    console.log(`📡 Using ${relays.length} relays:`, relays);

    // 3. Fetch unpublished unregistered_lana_events
    console.log('📋 Fetching unpublished unregistered_lana_events...');
    const { data: unpublishedEvents, error: eventsError } = await supabase
      .from('unregistered_lana_events')
      .select('id, wallet_id, unregistered_amount, notes, detected_at, nostr_event_id')
      .eq('nostr_87003_published', false)
      .order('detected_at', { ascending: true })
      .limit(50); // Process max 50 at a time

    if (eventsError) {
      console.error('❌ Failed to fetch unpublished events:', eventsError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch unpublished events',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!unpublishedEvents || unpublishedEvents.length === 0) {
      console.log('✅ No unpublished unregistered events to process');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No unpublished unregistered events to process',
          processed: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${unpublishedEvents.length} unpublished unregistered events`);

    // 4. Fetch wallet info for all events (including main_wallets.is_owned)
    const walletIds = [...new Set(unpublishedEvents.map((e) => e.wallet_id))];
    const { data: wallets, error: walletsError } = await supabase
      .from('wallets')
      .select('id, wallet_id, main_wallet_id, main_wallets(nostr_hex_id, is_owned)')
      .in('id', walletIds);

    if (walletsError) {
      console.error('❌ Failed to fetch wallet info:', walletsError);
    }

    const walletMap = new Map<string, WalletInfo>();
    wallets?.forEach((w) => {
      const row = w as WalletRow;
      // Normalize main_wallets - handle both single object and array from Supabase
      const mainWallet = Array.isArray(row.main_wallets) 
        ? row.main_wallets[0] || null 
        : row.main_wallets;
      walletMap.set(w.id, {
        id: row.id,
        wallet_id: row.wallet_id,
        main_wallet_id: row.main_wallet_id,
        main_wallets: mainWallet,
      });
    });

    // Filter events to only those where is_owned = true
    const ownedEvents = (unpublishedEvents as UnregisteredLanaEvent[]).filter((event) => {
      const wallet = walletMap.get(event.wallet_id);
      const isOwned = wallet?.main_wallets?.is_owned ?? false;
      if (!isOwned) {
        console.log(`⏭️ Skipping event ${event.id} - wallet owner has is_owned = false`);
      }
      return isOwned;
    });

    console.log(`📋 ${ownedEvents.length} events belong to owned wallets (is_owned = true)`);

    // 5. Process each owned event
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = unpublishedEvents.length - ownedEvents.length;
    const processedEvents: Array<{ id: string; eventId: string; success: boolean }> = [];

    for (const event of ownedEvents) {
      try {
        const wallet = walletMap.get(event.wallet_id);
        const walletAddress = wallet?.wallet_id || event.wallet_id;
        const userPubkey = wallet?.main_wallets?.nostr_hex_id || '';
        
        if (!userPubkey) {
          console.warn(`⚠️ No nostr_hex_id found for event ${event.id}, skipping...`);
          skippedCount++;
          continue;
        }
        
        // Convert amount to Latoshis
        const amountLatoshis = lanaToLatoshis(event.unregistered_amount);

        // Create Kind 87003 event with required ["p", pubkey] tag
        const eventTemplate = {
          kind: 87003,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['p', userPubkey],
            ['WalletID', walletAddress],
            ['Linked_event', event.nostr_event_id || ''],
            ['UnregistratedAmountLatoshis', amountLatoshis],
          ],
          content: 'Unregistered coins detected requiring regularization',
        };

        // Sign event
        const signedEvent = finalizeEvent(eventTemplate, privateKeyBytes);
        console.log(`✍️ Event signed for wallet ${walletAddress}: ${signedEvent.id}`);

        // Publish to relays
        const { eventId, results } = await publishEventToNostr(signedEvent, relays);
        const publishSuccess = results.some((r) => r.success);

        if (publishSuccess) {
          // Update database
          const { error: updateError } = await supabase
            .from('unregistered_lana_events')
            .update({
              nostr_87003_published: true,
              nostr_87003_event_id: eventId,
              nostr_87003_published_at: new Date().toISOString(),
            })
            .eq('id', event.id);

          if (updateError) {
            console.error(`❌ Failed to update event ${event.id}:`, updateError);
            errorCount++;
          } else {
            console.log(`✅ Event ${event.id} published and updated`);
            successCount++;
          }

          processedEvents.push({ id: event.id, eventId, success: true });
        } else {
          console.error(`❌ Failed to publish event ${event.id} to any relay`);
          errorCount++;
          processedEvents.push({ id: event.id, eventId, success: false });
        }
      } catch (eventError) {
        console.error(`❌ Error processing event ${event.id}:`, eventError);
        errorCount++;
        processedEvents.push({ id: event.id, eventId: '', success: false });
      }
    }

    console.log('📊 Final summary:', {
      total: unpublishedEvents.length,
      ownedEvents: ownedEvents.length,
      skipped: skippedCount,
      success: successCount,
      errors: errorCount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${ownedEvents.length} unregistered events (${skippedCount} skipped - not owned)`,
        total: unpublishedEvents.length,
        processed: ownedEvents.length,
        skipped: skippedCount,
        successful: successCount,
        failed: errorCount,
        events: processedEvents,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
