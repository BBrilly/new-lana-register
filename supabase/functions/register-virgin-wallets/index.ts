import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SimplePool, finalizeEvent, getPublicKey, nip19 } from "https://esm.sh/nostr-tools@2.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WalletRequest {
  wallet_id: string;
  wallet_type?: string;
  notes?: string;
}

interface RegisterVirginRequest {
  method: "register_virgin_wallets_for_existing_user";
  api_key: string;
  data: {
    nostr_id_hex: string;
    wallets: WalletRequest[];
  };
}

interface WalletResult {
  wallet_id: string;
  wallet_type: string;
  nostr_broadcast: "success" | "failed";
  nostr_event_ids?: {
    kind_87006?: string;
    kind_87002?: string;
  };
  error?: string;
}

// Validate LANA wallet address format
function isValidLanaAddress(address: string): boolean {
  return typeof address === "string" && 
         address.startsWith("L") && 
         address.length >= 26 && 
         address.length <= 35 &&
         /^[A-Za-z0-9]+$/.test(address);
}

// Validate nostr hex ID format
function isValidNostrHex(hexId: string): boolean {
  return typeof hexId === "string" && 
         hexId.length === 64 && 
         /^[a-fA-F0-9]+$/.test(hexId);
}

// Decode nsec to hex private key using nostr-tools
function decodeNsec(nsec: string): string {
  const { type, data } = nip19.decode(nsec);
  if (type !== "nsec") throw new Error("Expected nsec key");
  // data is a Uint8Array of 32 bytes
  return Array.from(data as Uint8Array).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Create and sign a Nostr event
function createSignedEvent(
  kind: number,
  tags: string[][],
  content: string,
  privateKeyHex: string
): any {
  const privateKeyBytes = new Uint8Array(
    privateKeyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
  
  const event = {
    kind,
    tags,
    content,
    created_at: Math.floor(Date.now() / 1000),
  };
  
  return finalizeEvent(event, privateKeyBytes);
}

// Broadcast event to relays
async function broadcastToRelays(
  pool: SimplePool,
  relays: string[],
  event: any
): Promise<{ success: boolean; eventId: string }> {
  try {
    await Promise.any(pool.publish(relays, event));
    return { success: true, eventId: event.id };
  } catch (error) {
    console.error("Failed to broadcast event:", error);
    return { success: false, eventId: event.id };
  }
}

Deno.serve(async (req) => {
  const correlationId = crypto.randomUUID();
  const startTime = Date.now();
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: RegisterVirginRequest = await req.json();
    console.log(`[${correlationId}] Received request:`, JSON.stringify({
      method: body.method,
      nostr_id_hex: body.data?.nostr_id_hex,
      wallet_count: body.data?.wallets?.length
    }));

    // Validate method
    if (body.method !== "register_virgin_wallets_for_existing_user") {
      return new Response(
        JSON.stringify({
          success: false,
          status: "error",
          error: "Invalid method. Expected: register_virgin_wallets_for_existing_user",
          correlation_id: correlationId
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Validate API Key against api_keys table
    const { data: apiKeyRecord, error: apiKeyError } = await supabase
      .from("api_keys")
      .select("id, api_key, is_active, rate_limit_per_hour, request_count_current_hour")
      .eq("api_key", body.api_key)
      .maybeSingle();

    if (apiKeyError || !apiKeyRecord) {
      console.log(`[${correlationId}] Invalid API key provided`);
      return new Response(
        JSON.stringify({
          success: false,
          status: "unauthorized",
          error: "Invalid API key",
          correlation_id: correlationId
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!apiKeyRecord.is_active) {
      console.log(`[${correlationId}] API key is deactivated`);
      return new Response(
        JSON.stringify({
          success: false,
          status: "unauthorized",
          error: "API key is deactivated",
          correlation_id: correlationId
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update usage tracking
    await supabase
      .from("api_keys")
      .update({
        last_request_at: new Date().toISOString(),
        request_count_current_hour: (apiKeyRecord.request_count_current_hour || 0) + 1
      })
      .eq("id", apiKeyRecord.id);

    // Step 2: Validate input data
    const { nostr_id_hex, wallets } = body.data;

    if (!isValidNostrHex(nostr_id_hex)) {
      return new Response(
        JSON.stringify({
          success: false,
          status: "error",
          error: "Invalid nostr_id_hex format. Must be 64 character hex string.",
          correlation_id: correlationId
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(wallets) || wallets.length === 0 || wallets.length > 8) {
      return new Response(
        JSON.stringify({
          success: false,
          status: "error",
          error: "Wallets array must contain 1-8 wallets",
          correlation_id: correlationId
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate each wallet address
    for (const wallet of wallets) {
      if (!isValidLanaAddress(wallet.wallet_id)) {
        return new Response(
          JSON.stringify({
            success: false,
            status: "error",
            error: `Invalid wallet address format: ${wallet.wallet_id}`,
            correlation_id: correlationId
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Step 3: Check if profile exists
    const { data: mainWallet, error: mainWalletError } = await supabase
      .from("main_wallets")
      .select("id, nostr_hex_id, name, wallet_id")
      .eq("nostr_hex_id", nostr_id_hex)
      .maybeSingle();

    if (mainWalletError) {
      console.error(`[${correlationId}] Error fetching main wallet:`, mainWalletError);
      return new Response(
        JSON.stringify({
          success: false,
          status: "error",
          error: "Database error while checking profile",
          correlation_id: correlationId
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!mainWallet) {
      return new Response(
        JSON.stringify({
          success: false,
          status: "not_found",
          error: `Profile not found for nostr_id_hex: ${nostr_id_hex}`,
          correlation_id: correlationId
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${correlationId}] Found main wallet:`, mainWallet.id);

    // Step 4: Get system parameters for Electrum servers and relays
    const { data: systemParams, error: paramsError } = await supabase
      .from("system_parameters")
      .select("electrum, relays")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paramsError || !systemParams) {
      console.error(`[${correlationId}] Error fetching system parameters:`, paramsError);
      return new Response(
        JSON.stringify({
          success: false,
          status: "error",
          error: "System parameters not found",
          correlation_id: correlationId
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const electrumServers = (systemParams.electrum as any[]).map((server: any) => ({
      host: server.host,
      port: parseInt(server.port, 10)
    }));

    const relays = (systemParams.relays as any[]).map((r: any) => r.url || r);
    console.log(`[${correlationId}] Using ${electrumServers.length} Electrum servers and ${relays.length} relays`);

    // Step 5: Virgin wallet validation - check all wallets have zero balance
    const walletAddresses = wallets.map(w => w.wallet_id);
    
    const balanceResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-wallet-balance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        wallet_addresses: walletAddresses,
        electrum_servers: electrumServers
      })
    });

    if (!balanceResponse.ok) {
      console.error(`[${correlationId}] Failed to fetch wallet balances`);
      return new Response(
        JSON.stringify({
          success: false,
          status: "error",
          error: "Failed to validate wallet balances",
          correlation_id: correlationId
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const balanceData = await balanceResponse.json();
    const nonVirginWallets: string[] = [];

    for (const walletBalance of balanceData.wallets || []) {
      if (walletBalance.balance !== 0) {
        nonVirginWallets.push(`${walletBalance.wallet_id} (balance: ${walletBalance.balance})`);
      }
    }

    if (nonVirginWallets.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          status: "validation_failed",
          error: "One or more wallets are not virgin (balance > 0)",
          non_virgin_wallets: nonVirginWallets,
          correlation_id: correlationId
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${correlationId}] All ${wallets.length} wallets verified as virgin`);

    // Step 6: Check for duplicate registrations
    const { data: existingWallets, error: existingError } = await supabase
      .from("wallets")
      .select("wallet_id")
      .in("wallet_id", walletAddresses);

    if (existingError) {
      console.error(`[${correlationId}] Error checking existing wallets:`, existingError);
      return new Response(
        JSON.stringify({
          success: false,
          status: "error",
          error: "Database error while checking duplicates",
          correlation_id: correlationId
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingWallets && existingWallets.length > 0) {
      const duplicates = existingWallets.map(w => w.wallet_id);
      return new Response(
        JSON.stringify({
          success: false,
          status: "duplicate",
          error: "One or more wallets are already registered",
          duplicate_wallets: duplicates,
          correlation_id: correlationId
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 7: Validate wallet types
    const { data: walletTypes, error: typesError } = await supabase
      .from("wallet_types")
      .select("name");

    if (typesError) {
      console.error(`[${correlationId}] Error fetching wallet types:`, typesError);
    }

    const validTypes = new Set(walletTypes?.map(t => t.name) || ["Main Wallet"]);
    
    // Prepare wallets for insertion
    const walletsToInsert = wallets.map(wallet => ({
      main_wallet_id: mainWallet.id,
      wallet_id: wallet.wallet_id,
      wallet_type: validTypes.has(wallet.wallet_type || "") ? wallet.wallet_type : "Main Wallet",
      notes: wallet.notes || null,
      registration_source: "api_virgin_bulk"
    }));

    // Step 8: Insert wallets
    const { data: insertedWallets, error: insertError } = await supabase
      .from("wallets")
      .insert(walletsToInsert)
      .select();

    if (insertError) {
      console.error(`[${correlationId}] Error inserting wallets:`, insertError);
      return new Response(
        JSON.stringify({
          success: false,
          status: "error",
          error: "Failed to register wallets in database",
          details: insertError.message,
          correlation_id: correlationId
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${correlationId}] Inserted ${insertedWallets?.length} wallets into database`);

    // Step 9: Prepare Nostr events
    const { data: nsecSetting, error: nsecError } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "nostr_registrar_nsec")
      .maybeSingle();

    if (nsecError || !nsecSetting) {
      console.error(`[${correlationId}] NSEC not found, skipping Nostr broadcasts`);
    }

    const results: WalletResult[] = [];
    let successfulBroadcasts = 0;
    let failedBroadcasts = 0;

    if (nsecSetting?.value) {
      const pool = new SimplePool();
      const privateKeyHex = decodeNsec(nsecSetting.value);
      const registrarPubkey = getPublicKey(
        new Uint8Array(privateKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
      );

      const timestamp = new Date().toISOString();

      try {
        // Publish KIND 87006 and KIND 87002 for each wallet
        for (const wallet of insertedWallets || []) {
          const walletResult: WalletResult = {
            wallet_id: wallet.wallet_id,
            wallet_type: wallet.wallet_type,
            nostr_broadcast: "success",
            nostr_event_ids: {}
          };

          try {
            // KIND 87006 - Virgin Wallet Confirmation
            const event87006 = createSignedEvent(
              87006,
              [
                ["L", "lana-registry"],
                ["l", "virgin-wallet-confirmation", "lana-registry"],
                ["wallet", wallet.wallet_id],
                ["balance", "0"],
                ["verified_at", timestamp],
                ["validation_method", "electrum"]
              ],
              `Wallet ${wallet.wallet_id} verified as virgin (balance: 0)`,
              privateKeyHex
            );

            const result87006 = await broadcastToRelays(pool, relays, event87006);
            if (result87006.success) {
              walletResult.nostr_event_ids!.kind_87006 = result87006.eventId;
            }

            // KIND 87002 - Registration Confirmation
            const event87002 = createSignedEvent(
              87002,
              [
                ["L", "lana-registry"],
                ["l", "registration-confirmation", "lana-registry"],
                ["wallet", wallet.wallet_id],
                ["p", nostr_id_hex],
                ["status", "confirmed"],
                ["wallet_type", wallet.wallet_type],
                ["registration_source", "api_virgin_bulk"],
                ["is_virgin", "true"],
                ["registered_at", timestamp],
                ["batch_id", correlationId]
              ],
              `Wallet ${wallet.wallet_id} registered via bulk virgin registration`,
              privateKeyHex
            );

            const result87002 = await broadcastToRelays(pool, relays, event87002);
            if (result87002.success) {
              walletResult.nostr_event_ids!.kind_87002 = result87002.eventId;
              successfulBroadcasts++;
            } else {
              failedBroadcasts++;
              walletResult.nostr_broadcast = "failed";
            }
          } catch (error) {
            console.error(`[${correlationId}] Error broadcasting for wallet ${wallet.wallet_id}:`, error);
            walletResult.nostr_broadcast = "failed";
            failedBroadcasts++;
          }

          results.push(walletResult);
        }

        // Publish KIND 30889 - Updated Wallet List
        const { data: allWallets } = await supabase
          .from("wallets")
          .select("wallet_id, wallet_type, notes")
          .eq("main_wallet_id", mainWallet.id);

        const walletTags = (allWallets || []).map(w => 
          ["w", w.wallet_id, w.wallet_type, "LANA", w.notes || "", "0"]
        );

        const event30889 = createSignedEvent(
          30889,
          [
            ["d", nostr_id_hex],
            ["status", "active"],
            ...walletTags
          ],
          "",
          privateKeyHex
        );

        await broadcastToRelays(pool, relays, event30889);
        console.log(`[${correlationId}] Published KIND 30889 with ${walletTags.length} wallets`);

        pool.close(relays);
      } catch (error) {
        console.error(`[${correlationId}] Error in Nostr broadcasting:`, error);
      }
    } else {
      // No NSEC configured, mark all as success without broadcast
      for (const wallet of insertedWallets || []) {
        results.push({
          wallet_id: wallet.wallet_id,
          wallet_type: wallet.wallet_type,
          nostr_broadcast: "failed",
          error: "NSEC not configured"
        });
      }
    }

    const processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        status: "ok",
        message: `Successfully registered ${insertedWallets?.length} virgin wallets`,
        data: {
          nostr_id_hex,
          wallets_registered: insertedWallets?.length || 0,
          wallets: results,
          nostr_broadcasts: {
            successful: successfulBroadcasts,
            failed: failedBroadcasts
          }
        },
        processing_time_ms: processingTime,
        correlation_id: correlationId
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[${correlationId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        status: "error",
        error: error instanceof Error ? error.message : "Unexpected error occurred",
        correlation_id: correlationId
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
