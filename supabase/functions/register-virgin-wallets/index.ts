import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SimplePool, finalizeEvent, getPublicKey } from "https://esm.sh/nostr-tools@2.7.0";
import { decode as nip19decode } from "https://esm.sh/nostr-tools@2.7.0/nip19";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WalletRequest {
  wallet_id: string;
  wallet_type?: string;
  notes?: string;
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

// Decode nsec to hex private key using nostr-tools nip19
function decodeNsec(nsec: string): string {
  const { type, data } = nip19decode(nsec);
  if (type !== "nsec") throw new Error("Expected nsec key");
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

// Broadcast event to relays with detailed logging
async function broadcastToRelays(
  pool: SimplePool,
  relays: string[],
  event: any,
  correlationId: string
): Promise<{ success: boolean; eventId: string; acceptedRelays: number; failedRelays: number }> {
  try {
    const promises = pool.publish(relays, event);
    const results = await Promise.allSettled(promises);
    
    let accepted = 0;
    let failed = 0;
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        accepted++;
      } else {
        failed++;
        console.warn(`[${correlationId}] Relay ${relays[i]} rejected KIND ${event.kind}: ${result.reason}`);
      }
    }
    
    console.log(`[${correlationId}] KIND ${event.kind} (${event.id.substring(0, 12)}): ${accepted}/${relays.length} relays accepted`);
    
    return { success: accepted > 0, eventId: event.id, acceptedRelays: accepted, failedRelays: failed };
  } catch (error) {
    console.error(`[${correlationId}] Failed to broadcast KIND ${event.kind}:`, error);
    return { success: false, eventId: event.id, acceptedRelays: 0, failedRelays: relays.length };
  }
}

// Helper: get system parameters (electrum + relays)
async function getSystemParams(supabase: any, correlationId: string) {
  const { data: systemParams, error: paramsError } = await supabase
    .from("system_parameters")
    .select("electrum, relays")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paramsError || !systemParams) {
    console.error(`[${correlationId}] Error fetching system parameters:`, paramsError);
    return null;
  }

  const electrumServers = (systemParams.electrum as any[]).map((server: any) => ({
    host: server.host,
    port: parseInt(server.port, 10)
  }));

  const relays = (systemParams.relays as any[]).map((r: any) => r.url || r);
  return { electrumServers, relays };
}

// Helper: validate API key and update usage
async function validateApiKey(supabase: any, apiKey: string, correlationId: string) {
  const { data: apiKeyRecord, error: apiKeyError } = await supabase
    .from("api_keys")
    .select("id, api_key, is_active, service_name, rate_limit_per_hour, request_count_current_hour")
    .eq("api_key", apiKey)
    .maybeSingle();

  if (apiKeyError || !apiKeyRecord) {
    return { valid: false, status: 401, error: "Invalid API key" };
  }

  if (!apiKeyRecord.is_active) {
    return { valid: false, status: 401, error: "API key is deactivated" };
  }

  // Check rate limit
  if (apiKeyRecord.request_count_current_hour >= apiKeyRecord.rate_limit_per_hour) {
    return { valid: false, status: 429, error: "Rate limit exceeded" };
  }

  // Update usage tracking
  await supabase
    .from("api_keys")
    .update({
      last_request_at: new Date().toISOString(),
      request_count_current_hour: (apiKeyRecord.request_count_current_hour || 0) + 1
    })
    .eq("id", apiKeyRecord.id);

  return { valid: true, record: apiKeyRecord };
}

// Helper: get Nostr signing key
async function getNostrSigningKey(supabase: any, correlationId: string) {
  const { data: nsecSetting, error: nsecError } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "nostr_registrar_nsec")
    .maybeSingle();

  if (nsecError || !nsecSetting?.value) {
    console.error(`[${correlationId}] NSEC not found`);
    return null;
  }

  const privateKeyHex = decodeNsec(nsecSetting.value);
  const registrarPubkey = getPublicKey(
    new Uint8Array(privateKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
  );

  return { privateKeyHex, registrarPubkey };
}

// Helper: check wallet balance via Electrum
async function checkWalletBalance(
  supabaseUrl: string,
  supabaseServiceKey: string,
  walletAddresses: string[],
  electrumServers: any[],
  correlationId: string
) {
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
    return null;
  }

  return await balanceResponse.json();
}

// ========================
// HANDLER: check_wallet
// ========================
async function handleCheckWallet(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  body: any,
  correlationId: string,
  apiKeyRecord: any
) {
  const { wallet_id, nostr_id_hex } = body.data || {};

  // Validate wallet_id
  if (!wallet_id || !isValidLanaAddress(wallet_id)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "invalid_wallet",
        message: "Invalid wallet address format. Must start with 'L', minimum 26 chars, alphanumeric.",
        correlation_id: correlationId
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate nostr_id_hex if provided
  if (nostr_id_hex && !isValidNostrHex(nostr_id_hex)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "invalid_nostr_id",
        message: "Invalid nostr_id_hex format. Must be 64-character hex string.",
        correlation_id: correlationId
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[${correlationId}] check_wallet: ${wallet_id}, nostr_id_hex: ${nostr_id_hex || "not provided"}`);

  // Step 1: Check if wallet already exists as a main_wallet (by wallet_id field)
  const { data: existingMainWallet } = await supabase
    .from("main_wallets")
    .select("id, nostr_hex_id, wallet_id")
    .eq("wallet_id", wallet_id)
    .maybeSingle();

  if (existingMainWallet) {
    console.log(`[${correlationId}] Wallet ${wallet_id} already exists as main_wallet`);
    return new Response(
      JSON.stringify({
        success: true,
        wallet_id,
        status: "ok",
        message: "Wallet is registered and valid",
        correlation_id: correlationId
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Step 2: Check if wallet exists in wallets table
  const { data: existingWallet } = await supabase
    .from("wallets")
    .select("id, wallet_id, main_wallet_id")
    .eq("wallet_id", wallet_id)
    .maybeSingle();

  if (existingWallet) {
    console.log(`[${correlationId}] Wallet ${wallet_id} already exists in wallets table`);
    return new Response(
      JSON.stringify({
        success: true,
        wallet_id,
        status: "ok",
        message: "Wallet is registered and valid",
        correlation_id: correlationId
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Step 3: Wallet not registered — validate it
  console.log(`[${correlationId}] Wallet ${wallet_id} not found, proceeding with registration`);

  // Get system parameters
  const sysParams = await getSystemParams(supabase, correlationId);
  if (!sysParams) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "system_error",
        message: "System parameters not available",
        correlation_id: correlationId
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check wallet balance (virgin check)
  const balanceData = await checkWalletBalance(
    supabaseUrl, supabaseServiceKey,
    [wallet_id], sysParams.electrumServers, correlationId
  );

  if (!balanceData) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "validation_error",
        message: "Failed to validate wallet balance",
        correlation_id: correlationId
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const walletBalance = balanceData.wallets?.[0];
  if (!walletBalance || walletBalance.balance !== 0) {
    const balance = walletBalance?.balance ?? "unknown";
    console.log(`[${correlationId}] Wallet ${wallet_id} is not virgin, balance: ${balance}`);
    return new Response(
      JSON.stringify({
        success: false,
        wallet_id,
        status: "rejected",
        message: `Wallet is not virgin (balance: ${balance}). Only zero-balance wallets can be registered via this method.`,
        correlation_id: correlationId
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[${correlationId}] Wallet ${wallet_id} verified as virgin`);

  // Step 4: Determine wallet_type using fallback mechanism
  // Priority: valid wallet_type from request > api key service_name > "Main Wallet"
  const { data: walletTypes } = await supabase
    .from("wallet_types")
    .select("name");
  const validTypes = new Set(walletTypes?.map((t: any) => t.name) || ["Main Wallet"]);

  let resolvedWalletType = "Main Wallet";
  if (body.data?.wallet_type && validTypes.has(body.data.wallet_type)) {
    resolvedWalletType = body.data.wallet_type;
  } else if (apiKeyRecord.service_name && validTypes.has(apiKeyRecord.service_name)) {
    resolvedWalletType = apiKeyRecord.service_name;
  }

  // Step 5: Create main_wallet entry
  const nostrHexForProfile = nostr_id_hex || wallet_id; // use wallet_id as placeholder if no nostr_id
  const profileName = nostr_id_hex ? `Profile ${nostr_id_hex.substring(0, 8)}` : wallet_id;

  const { data: newMainWallet, error: mainWalletError } = await supabase
    .from("main_wallets")
    .insert({
      nostr_hex_id: nostrHexForProfile,
      name: profileName,
      wallet_id: wallet_id,
      is_owned: true,
      status: "active"
    })
    .select()
    .single();

  if (mainWalletError) {
    console.error(`[${correlationId}] Error creating main_wallet:`, mainWalletError);
    return new Response(
      JSON.stringify({
        success: false,
        error: "database_error",
        message: "Failed to create wallet profile",
        correlation_id: correlationId
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[${correlationId}] Created main_wallet: ${newMainWallet.id}`);

  // Step 6: Create wallet entry linked to the main wallet
  const { data: newWallet, error: walletInsertError } = await supabase
    .from("wallets")
    .insert({
      main_wallet_id: newMainWallet.id,
      wallet_id: wallet_id,
      wallet_type: resolvedWalletType,
      notes: body.data?.notes || null,
      registration_source: "api_check_wallet"
    })
    .select()
    .single();

  if (walletInsertError) {
    console.error(`[${correlationId}] Error creating wallet:`, walletInsertError);
    // Rollback main_wallet
    await supabase.from("main_wallets").delete().eq("id", newMainWallet.id);
    return new Response(
      JSON.stringify({
        success: false,
        error: "database_error",
        message: "Failed to register wallet",
        correlation_id: correlationId
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[${correlationId}] Created wallet entry: ${newWallet.id}`);

  // Step 7: Nostr broadcasting
  const nostrKey = await getNostrSigningKey(supabase, correlationId);
  if (nostrKey) {
    const pool = new SimplePool();
    const { privateKeyHex, registrarPubkey } = nostrKey;
    const timestamp = new Date().toISOString();

    console.log(`[${correlationId}] Broadcasting Nostr events, registrar: ${registrarPubkey.substring(0, 12)}...`);

    try {
      // KIND 87006 - Virgin Wallet Confirmation
      const event87006 = createSignedEvent(
        87006,
        [
          ["L", "lana-registry"],
          ["l", "virgin-wallet-confirmation", "lana-registry"],
          ["wallet", wallet_id],
          ["balance", "0"],
          ["verified_at", timestamp],
          ["validation_method", "electrum"]
        ],
        `Wallet ${wallet_id} verified as virgin (balance: 0)`,
        privateKeyHex
      );
      await broadcastToRelays(pool, sysParams.relays, event87006, correlationId);

      // KIND 87002 - Registration Confirmation
      const event87002 = createSignedEvent(
        87002,
        [
          ["L", "lana-registry"],
          ["l", "registration-confirmation", "lana-registry"],
          ["wallet", wallet_id],
          ["p", nostrHexForProfile],
          ["status", "confirmed"],
          ["wallet_type", resolvedWalletType],
          ["registration_source", "api_check_wallet"],
          ["is_virgin", "true"],
          ["registered_at", timestamp]
        ],
        `Wallet ${wallet_id} registered via check_wallet API`,
        privateKeyHex
      );
      await broadcastToRelays(pool, sysParams.relays, event87002, correlationId);

      // KIND 30889 - Wallet List
      const event30889 = createSignedEvent(
        30889,
        [
          ["d", nostrHexForProfile],
          ["status", "active"],
          ["w", wallet_id, resolvedWalletType, "LANA", body.data?.notes || "", "0"]
        ],
        "",
        privateKeyHex
      );
      await broadcastToRelays(pool, sysParams.relays, event30889, correlationId);

      await new Promise(resolve => setTimeout(resolve, 1000));
      pool.close(sysParams.relays);
    } catch (error) {
      console.error(`[${correlationId}] Error in Nostr broadcasting:`, error);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      wallet_id,
      status: "ok",
      message: "Wallet registered successfully",
      data: {
        profileId: newMainWallet.id
      },
      correlation_id: correlationId
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ============================================
// HANDLER: register_virgin_wallets_for_existing_user
// ============================================
async function handleRegisterVirginWallets(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  body: any,
  correlationId: string
) {
  const { nostr_id_hex, wallets } = body.data;

  if (!isValidNostrHex(nostr_id_hex)) {
    return new Response(
      JSON.stringify({ success: false, status: "error", error: "Invalid nostr_id_hex format. Must be 64 character hex string.", correlation_id: correlationId }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!Array.isArray(wallets) || wallets.length === 0 || wallets.length > 8) {
    return new Response(
      JSON.stringify({ success: false, status: "error", error: "Wallets array must contain 1-8 wallets", correlation_id: correlationId }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  for (const wallet of wallets) {
    if (!isValidLanaAddress(wallet.wallet_id)) {
      return new Response(
        JSON.stringify({ success: false, status: "error", error: `Invalid wallet address format: ${wallet.wallet_id}`, correlation_id: correlationId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Check if profile exists
  const { data: mainWallet, error: mainWalletError } = await supabase
    .from("main_wallets")
    .select("id, nostr_hex_id, name, wallet_id")
    .eq("nostr_hex_id", nostr_id_hex)
    .maybeSingle();

  if (mainWalletError) {
    console.error(`[${correlationId}] Error fetching main wallet:`, mainWalletError);
    return new Response(
      JSON.stringify({ success: false, status: "error", error: "Database error while checking profile", correlation_id: correlationId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!mainWallet) {
    return new Response(
      JSON.stringify({ success: false, status: "not_found", error: `Profile not found for nostr_id_hex: ${nostr_id_hex}`, correlation_id: correlationId }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[${correlationId}] Found main wallet:`, mainWallet.id);

  // Get system parameters
  const sysParams = await getSystemParams(supabase, correlationId);
  if (!sysParams) {
    return new Response(
      JSON.stringify({ success: false, status: "error", error: "System parameters not found", correlation_id: correlationId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[${correlationId}] Using ${sysParams.electrumServers.length} Electrum servers and ${sysParams.relays.length} relays`);

  // Virgin wallet validation
  const walletAddresses = wallets.map((w: WalletRequest) => w.wallet_id);
  const balanceData = await checkWalletBalance(supabaseUrl, supabaseServiceKey, walletAddresses, sysParams.electrumServers, correlationId);

  if (!balanceData) {
    return new Response(
      JSON.stringify({ success: false, status: "error", error: "Failed to validate wallet balances", correlation_id: correlationId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const nonVirginWallets: string[] = [];
  for (const walletBalance of balanceData.wallets || []) {
    if (walletBalance.balance !== 0) {
      nonVirginWallets.push(`${walletBalance.wallet_id} (balance: ${walletBalance.balance})`);
    }
  }

  if (nonVirginWallets.length > 0) {
    return new Response(
      JSON.stringify({ success: false, status: "validation_failed", error: "One or more wallets are not virgin (balance > 0)", non_virgin_wallets: nonVirginWallets, correlation_id: correlationId }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[${correlationId}] All ${wallets.length} wallets verified as virgin`);

  // Check for duplicates
  const { data: existingWallets, error: existingError } = await supabase
    .from("wallets")
    .select("wallet_id")
    .in("wallet_id", walletAddresses);

  if (existingError) {
    return new Response(
      JSON.stringify({ success: false, status: "error", error: "Database error while checking duplicates", correlation_id: correlationId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (existingWallets && existingWallets.length > 0) {
    return new Response(
      JSON.stringify({ success: false, status: "duplicate", error: "One or more wallets are already registered", duplicate_wallets: existingWallets.map((w: any) => w.wallet_id), correlation_id: correlationId }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate wallet types
  const { data: walletTypes } = await supabase.from("wallet_types").select("name");
  const validTypes = new Set(walletTypes?.map((t: any) => t.name) || ["Main Wallet"]);

  const walletsToInsert = wallets.map((wallet: WalletRequest) => ({
    main_wallet_id: mainWallet.id,
    wallet_id: wallet.wallet_id,
    wallet_type: validTypes.has(wallet.wallet_type || "") ? wallet.wallet_type : "Main Wallet",
    notes: wallet.notes || null,
    registration_source: "api_virgin_bulk"
  }));

  const { data: insertedWallets, error: insertError } = await supabase
    .from("wallets")
    .insert(walletsToInsert)
    .select();

  if (insertError) {
    console.error(`[${correlationId}] Error inserting wallets:`, insertError);
    return new Response(
      JSON.stringify({ success: false, status: "error", error: "Failed to register wallets in database", details: insertError.message, correlation_id: correlationId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[${correlationId}] Inserted ${insertedWallets?.length} wallets into database`);

  // Nostr broadcasting
  const nostrKey = await getNostrSigningKey(supabase, correlationId);
  const results: WalletResult[] = [];
  let successfulBroadcasts = 0;
  let failedBroadcasts = 0;

  if (nostrKey) {
    const pool = new SimplePool();
    const { privateKeyHex, registrarPubkey } = nostrKey;

    console.log(`[${correlationId}] NSEC decoded OK, registrar pubkey: ${registrarPubkey.substring(0, 12)}...`);
    console.log(`[${correlationId}] Broadcasting to relays: ${JSON.stringify(sysParams.relays)}`);

    const timestamp = new Date().toISOString();

    try {
      for (const wallet of insertedWallets || []) {
        const walletResult: WalletResult = {
          wallet_id: wallet.wallet_id,
          wallet_type: wallet.wallet_type,
          nostr_broadcast: "success",
          nostr_event_ids: {}
        };

        try {
          const event87006 = createSignedEvent(87006, [
            ["L", "lana-registry"],
            ["l", "virgin-wallet-confirmation", "lana-registry"],
            ["wallet", wallet.wallet_id],
            ["balance", "0"],
            ["verified_at", timestamp],
            ["validation_method", "electrum"]
          ], `Wallet ${wallet.wallet_id} verified as virgin (balance: 0)`, privateKeyHex);

          const result87006 = await broadcastToRelays(pool, sysParams.relays, event87006, correlationId);
          if (result87006.success) walletResult.nostr_event_ids!.kind_87006 = result87006.eventId;

          const event87002 = createSignedEvent(87002, [
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
          ], `Wallet ${wallet.wallet_id} registered via bulk virgin registration`, privateKeyHex);

          const result87002 = await broadcastToRelays(pool, sysParams.relays, event87002, correlationId);
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

      // KIND 30889 - Updated Wallet List
      const { data: allWallets } = await supabase
        .from("wallets")
        .select("wallet_id, wallet_type, notes")
        .eq("main_wallet_id", mainWallet.id);

      const walletTags = (allWallets || []).map((w: any) =>
        ["w", w.wallet_id, w.wallet_type, "LANA", w.notes || "", "0"]
      );

      const event30889 = createSignedEvent(30889, [
        ["d", nostr_id_hex],
        ["status", "active"],
        ...walletTags
      ], "", privateKeyHex);

      const result30889 = await broadcastToRelays(pool, sysParams.relays, event30889, correlationId);
      console.log(`[${correlationId}] KIND 30889 broadcast result: ${result30889.acceptedRelays}/${sysParams.relays.length} relays accepted`);

      await new Promise(resolve => setTimeout(resolve, 1000));
      pool.close(sysParams.relays);
    } catch (error) {
      console.error(`[${correlationId}] Error in Nostr broadcasting:`, error);
    }
  } else {
    for (const wallet of insertedWallets || []) {
      results.push({ wallet_id: wallet.wallet_id, wallet_type: wallet.wallet_type, nostr_broadcast: "failed", error: "NSEC not configured" });
    }
  }

  return { insertedWallets, results, successfulBroadcasts, failedBroadcasts, nostr_id_hex };
}

// ========================
// MAIN HANDLER
// ========================
Deno.serve(async (req) => {
  const correlationId = crypto.randomUUID();
  const startTime = Date.now();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log(`[${correlationId}] Received request: method=${body.method}`);

    const method = body.method;

    // Validate API key for all methods
    const apiKeyResult = await validateApiKey(supabase, body.api_key, correlationId);
    if (!apiKeyResult.valid) {
      return new Response(
        JSON.stringify({ success: false, status: "unauthorized", error: apiKeyResult.error, correlation_id: correlationId }),
        { status: apiKeyResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route by method
    if (method === "check_wallet") {
      return await handleCheckWallet(supabase, supabaseUrl, supabaseServiceKey, body, correlationId, apiKeyResult.record);
    } else if (method === "register_virgin_wallets_for_existing_user") {
      const result = await handleRegisterVirginWallets(supabase, supabaseUrl, supabaseServiceKey, body, correlationId);

      // If result is a Response (error), return it directly
      if (result instanceof Response) return result;

      const processingTime = Date.now() - startTime;
      return new Response(
        JSON.stringify({
          success: true,
          status: "ok",
          message: `Successfully registered ${result.insertedWallets?.length} virgin wallets`,
          data: {
            nostr_id_hex: result.nostr_id_hex,
            wallets_registered: result.insertedWallets?.length || 0,
            wallets: result.results,
            nostr_broadcasts: { successful: result.successfulBroadcasts, failed: result.failedBroadcasts }
          },
          processing_time_ms: processingTime,
          correlation_id: correlationId
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          status: "error",
          error: `Invalid method: ${method}. Supported: check_wallet, register_virgin_wallets_for_existing_user`,
          correlation_id: correlationId
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error(`[${correlationId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ success: false, status: "error", error: error instanceof Error ? error.message : "Unexpected error occurred", correlation_id: correlationId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
