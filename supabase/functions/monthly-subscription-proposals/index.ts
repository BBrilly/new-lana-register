import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { schnorr } from "https://esm.sh/@noble/curves@1.4.0/secp256k1";
import { bytesToHex, hexToBytes } from "https://esm.sh/@noble/hashes@1.4.0/utils";
import { sha256 } from "https://esm.sh/@noble/hashes@1.4.0/sha256";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hardcoded nsec for signing (same as other edge functions)
const REGISTRAR_NSEC = "nsec1v6dd5ftmjzpmw0khj4xnmwmcql5qqwuv9afp8qy878jg6qn5m58q8vc5xt";

// Recipient pubkey for subscription payments
const RECIPIENT_PUBKEY = "bcb0cf91fb810b54c7cf18a1ababca455b008e2a7ebdf303a7c2a72bbc0f521e";

// Batch size for relay publishing
const RELAY_BATCH_SIZE = 50;

// Batch size for user processing (process 30 users concurrently)
const USER_BATCH_SIZE = 30;

function bech32Decode(str: string): Uint8Array {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const hrpEnd = str.lastIndexOf('1');
  const data = str.slice(hrpEnd + 1, -6);
  const decoded: number[] = [];
  for (const char of data) {
    decoded.push(CHARSET.indexOf(char));
  }
  const converted: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const value of decoded) {
    acc = (acc << 5) | value;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      converted.push((acc >> bits) & 0xff);
    }
  }
  return new Uint8Array(converted);
}

function getPrivateKeyFromNsec(nsec: string): Uint8Array {
  return bech32Decode(nsec);
}

function getPublicKeyFromPrivate(privateKey: Uint8Array): string {
  return bytesToHex(schnorr.getPublicKey(privateKey));
}

interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

function serializeEvent(event: Partial<NostrEvent>): string {
  return JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
}

function getEventHash(event: Partial<NostrEvent>): string {
  const serialized = serializeEvent(event);
  const hash = sha256(new TextEncoder().encode(serialized));
  return bytesToHex(hash);
}

async function signEvent(event: Partial<NostrEvent>, privateKey: Uint8Array): Promise<NostrEvent> {
  const id = getEventHash(event);
  const sig = bytesToHex(await schnorr.sign(hexToBytes(id), privateKey));
  return { ...event, id, sig } as NostrEvent;
}

async function publishToRelay(relay: string, event: NostrEvent, timeout = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(relay);
      const timer = setTimeout(() => {
        ws.close();
        resolve(false);
      }, timeout);

      ws.onopen = () => {
        ws.send(JSON.stringify(["EVENT", event]));
      };

      ws.onmessage = (msg) => {
        try {
          const response = JSON.parse(msg.data);
          if (response[0] === "OK" && response[1] === event.id) {
            clearTimeout(timer);
            ws.close();
            resolve(response[2] === true);
          }
        } catch {
          // Continue waiting
        }
      };

      ws.onerror = () => {
        clearTimeout(timer);
        ws.close();
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}

async function publishEventToRelays(event: NostrEvent, relays: string[]): Promise<{ success: boolean; publishedTo: string[] }> {
  const publishedTo: string[] = [];
  
  // Process relays in batches
  for (let i = 0; i < relays.length; i += RELAY_BATCH_SIZE) {
    const batch = relays.slice(i, i + RELAY_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (relay) => {
        const success = await publishToRelay(relay, event);
        if (success) publishedTo.push(relay);
        return success;
      })
    );
  }
  
  return { success: publishedTo.length > 0, publishedTo };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🚀 Starting monthly subscription proposals`);

    // Get current month in YYYY-MM format
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    console.log(`📅 Processing for month: ${currentMonth}`);

    // Fetch app_settings
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['registered_lana_wallet', 'currency_code', 'subscription_fee']);

    if (settingsError) throw new Error(`Failed to fetch app_settings: ${settingsError.message}`);

    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
    const lanaWallet = settingsMap['registered_lana_wallet'] || 'LTpv5j4NYmzVF4LPKC6irwc4xvAZkfXjEg';
    const currencyCode = settingsMap['currency_code'] || 'EUR';
    const subscriptionFeeEur = parseFloat(settingsMap['subscription_fee'] || '3.00');

    console.log(`💰 Subscription fee: ${subscriptionFeeEur} ${currencyCode}`);

    // Fetch system_parameters for exchange rate and relays
    const { data: sysParams, error: sysParamsError } = await supabase
      .from('system_parameters')
      .select('fx, relays')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sysParamsError) throw new Error(`Failed to fetch system_parameters: ${sysParamsError.message}`);
    if (!sysParams) throw new Error('No system_parameters found');

    // Extract exchange rate (EUR to LANA)
    const fxData = sysParams.fx as { EUR?: number; eur?: number };
    const exchangeRate = fxData?.EUR || fxData?.eur || 0.0004; // Default fallback
    console.log(`📊 Exchange rate EUR/LANA: ${exchangeRate}`);

    // Calculate LANA amount
    const amountLana = subscriptionFeeEur / exchangeRate;
    const amountLanoshi = Math.round(amountLana * 100000000);
    console.log(`💎 Amount: ${amountLana.toFixed(8)} LANA (${amountLanoshi} lanoshi)`);

    // Extract relays
    const relaysData = sysParams.relays as string[] | { urls?: string[] };
    let relays: string[] = [];
    if (Array.isArray(relaysData)) {
      relays = relaysData;
    } else if (relaysData?.urls) {
      relays = relaysData.urls;
    }
    console.log(`📡 Found ${relays.length} relays`);

    // Get all main_wallets with at least one Lana8Wonder wallet
    const { data: eligibleWallets, error: walletsError } = await supabase
      .from('main_wallets')
      .select(`
        id,
        nostr_hex_id,
        name,
        display_name,
        wallets!inner(wallet_type)
      `)
      .eq('wallets.wallet_type', 'Lana8Wonder')
      .limit(10000);

    if (walletsError) throw new Error(`Failed to fetch wallets: ${walletsError.message}`);

    // Get unique main_wallets (deduplicate if multiple Lana8Wonder wallets)
    const uniqueWallets = new Map();
    for (const w of eligibleWallets || []) {
      if (!uniqueWallets.has(w.id)) {
        uniqueWallets.set(w.id, w);
      }
    }

    let targetWallets = Array.from(uniqueWallets.values());
    console.log(`👥 Found ${targetWallets.length} eligible users`);

    // Check which users already have a proposal for this month
    const nostrIds = targetWallets.map(w => w.nostr_hex_id);
    const { data: existingProposals, error: existingError } = await supabase
      .from('subscription_proposals')
      .select('nostr_hex_id')
      .eq('proposal_month', currentMonth)
      .in('nostr_hex_id', nostrIds);

    if (existingError) throw new Error(`Failed to check existing proposals: ${existingError.message}`);

    const alreadySent = new Set((existingProposals || []).map(p => p.nostr_hex_id));
    const walletsToProcess = targetWallets.filter(w => !alreadySent.has(w.nostr_hex_id));
    console.log(`🔄 Skipping ${alreadySent.size} already processed, ${walletsToProcess.length} to process`);

    // Setup signing
    const privateKey = getPrivateKeyFromNsec(REGISTRAR_NSEC);
    const pubkey = getPublicKeyFromPrivate(privateKey);

    const results = {
      processed: 0,
      success: 0,
      failed: 0,
      skipped: alreadySent.size,
      errors: [] as string[],
    };

    // Process wallets in batches of USER_BATCH_SIZE
    for (let i = 0; i < walletsToProcess.length; i += USER_BATCH_SIZE) {
      const batch = walletsToProcess.slice(i, i + USER_BATCH_SIZE);
      console.log(`📦 Processing batch ${Math.floor(i / USER_BATCH_SIZE) + 1}/${Math.ceil(walletsToProcess.length / USER_BATCH_SIZE)} (${batch.length} users)`);
      
      const batchPromises = batch.map(async (wallet) => {
        const userName = wallet.display_name || wallet.name || 'User';
        
        try {
          const proposalId = `registrar:subscription:${wallet.nostr_hex_id.slice(0, 8)}:${currentMonth}`;
          const createdAt = Math.floor(Date.now() / 1000);

          // Create KIND 90900 event
          const eventData: Partial<NostrEvent> = {
            pubkey,
            created_at: createdAt,
            kind: 90900,
            tags: [
              ["d", proposalId],
              ["p", wallet.nostr_hex_id, "payer"],
              ["p", RECIPIENT_PUBKEY, "recipient"],
              ["wallet", lanaWallet],
              ["fiat", currencyCode, subscriptionFeeEur.toFixed(2)],
              ["lana", amountLana.toFixed(8)],
              ["lanoshi", amountLanoshi.toString()],
              ["type", "unconditional_payment"],
              ["service", "Registrar"],
            ],
            content: `Monthly subscription proposal for Lana8Wonder service (${currentMonth}). Fee: ${subscriptionFeeEur.toFixed(2)} ${currencyCode} = ${amountLana.toFixed(2)} LANA.`,
          };

          const signedEvent = await signEvent(eventData, privateKey);
          
          // Publish to relays
          const { success, publishedTo } = await publishEventToRelays(signedEvent, relays);
          
          if (success) {
            // Store in database
            const { error: insertError } = await supabase
              .from('subscription_proposals')
              .insert({
                main_wallet_id: wallet.id,
                nostr_hex_id: wallet.nostr_hex_id,
                proposal_month: currentMonth,
                amount_eur: subscriptionFeeEur,
                amount_lana: amountLana,
                amount_lanoshi: amountLanoshi,
                exchange_rate: exchangeRate,
                nostr_event_id: signedEvent.id,
              });

            if (insertError) {
              throw new Error(`DB insert failed: ${insertError.message}`);
            }

            console.log(`✅ Sent proposal to ${userName} (${wallet.nostr_hex_id.slice(0, 8)}...) - published to ${publishedTo.length} relays`);
            return { success: true };
          } else {
            throw new Error('Failed to publish to any relay');
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`❌ Failed for ${userName}: ${errorMsg}`);
          return { success: false, error: `${wallet.nostr_hex_id.slice(0, 8)}: ${errorMsg}` };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        results.processed++;
        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          if (result.error) results.errors.push(result.error);
        }
      }
    }

    console.log(`🎉 Completed: ${JSON.stringify(results)}`);

    return new Response(JSON.stringify({
      success: true,
      month: currentMonth,
      results,
      settings: {
        lanaWallet,
        currencyCode,
        subscriptionFeeEur,
        exchangeRate,
        amountLana: amountLana.toFixed(8),
        amountLanoshi,
        relayCount: relays.length,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`💥 Error: ${message}`);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
