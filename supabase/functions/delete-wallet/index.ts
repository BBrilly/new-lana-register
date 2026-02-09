import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SimplePool, finalizeEvent } from "https://esm.sh/nostr-tools@2.7.0";
import { decode as nip19decode } from "https://esm.sh/nostr-tools@2.7.0/nip19";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROTECTED_TYPES = ["main", "main wallet", "lana8wonder", "knights", "lanaknights"];

function decodeNsec(nsec: string): string {
  const { type, data } = nip19decode(nsec);
  if (type !== "nsec") throw new Error("Expected nsec key");
  return Array.from(data as Uint8Array).map(b => b.toString(16).padStart(2, "0")).join("");
}

function createSignedEvent(kind: number, tags: string[][], content: string, privateKeyHex: string): any {
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

async function broadcastToRelays(pool: SimplePool, relays: string[], event: any, correlationId: string) {
  try {
    const promises = pool.publish(relays, event);
    const results = await Promise.allSettled(promises);
    let accepted = 0;
    for (const result of results) {
      if (result.status === "fulfilled") accepted++;
    }
    console.log(`[${correlationId}] KIND ${event.kind} (${event.id.substring(0, 12)}): ${accepted}/${relays.length} relays accepted`);
    return { success: accepted > 0, acceptedRelays: accepted };
  } catch (error) {
    console.error(`[${correlationId}] Failed to broadcast KIND ${event.kind}:`, error);
    return { success: false, acceptedRelays: 0 };
  }
}

Deno.serve(async (req) => {
  const correlationId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { api_key, wallet_uuid, nostr_id_hex } = body;

    console.log(`[${correlationId}] Delete wallet request: wallet_uuid=${wallet_uuid}, nostr_id_hex=${nostr_id_hex?.substring(0, 12)}`);

    // Validate API key
    const { data: apiKeyRecord, error: apiKeyError } = await supabase
      .from("api_keys")
      .select("id, is_active")
      .eq("api_key", api_key)
      .maybeSingle();

    if (apiKeyError || !apiKeyRecord || !apiKeyRecord.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or inactive API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch wallet to delete
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("*, main_wallet_id")
      .eq("id", wallet_uuid)
      .maybeSingle();

    if (walletError || !wallet) {
      return new Response(
        JSON.stringify({ success: false, error: "Wallet not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify wallet belongs to the user
    const { data: mainWallet } = await supabase
      .from("main_wallets")
      .select("id, nostr_hex_id")
      .eq("id", wallet.main_wallet_id)
      .maybeSingle();

    if (!mainWallet || mainWallet.nostr_hex_id !== nostr_id_hex) {
      return new Response(
        JSON.stringify({ success: false, error: "Wallet does not belong to this user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check protected types
    const walletTypeLower = wallet.wallet_type.toLowerCase();
    if (PROTECTED_TYPES.some(t => walletTypeLower.includes(t))) {
      return new Response(
        JSON.stringify({ success: false, error: "Cannot delete protected wallet type: " + wallet.wallet_type }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch balance before deletion
    let balanceAtDeletion = 0;
    try {
      const balanceResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-wallet-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: [wallet.wallet_id] }),
      });
      const balanceData = await balanceResponse.json();
      if (balanceData?.balances?.[wallet.wallet_id] !== undefined) {
        balanceAtDeletion = balanceData.balances[wallet.wallet_id];
      }
    } catch (err) {
      console.warn(`[${correlationId}] Could not fetch balance, proceeding with 0:`, err);
    }

    // Archive to deleted_wallets
    const { error: archiveError } = await supabase
      .from("deleted_wallets")
      .insert({
        original_wallet_uuid: wallet.id,
        wallet_id: wallet.wallet_id,
        wallet_type: wallet.wallet_type,
        nostr_hex_id: nostr_id_hex,
        main_wallet_id: wallet.main_wallet_id,
        reason: `user_requested | balance: ${balanceAtDeletion}`,
      });

    if (archiveError) {
      console.error(`[${correlationId}] Archive error:`, archiveError);
    }

    // Delete wallet
    const { error: deleteError } = await supabase
      .from("wallets")
      .delete()
      .eq("id", wallet_uuid);

    if (deleteError) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to delete wallet: " + deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${correlationId}] Wallet ${wallet.wallet_id} deleted. Broadcasting KIND 30889...`);

    // Broadcast updated KIND 30889
    try {
      const { data: nsecSetting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "nostr_registrar_nsec")
        .maybeSingle();

      if (nsecSetting?.value) {
        const privateKeyHex = decodeNsec(nsecSetting.value);

        const { data: systemParams } = await supabase
          .from("system_parameters")
          .select("relays")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const relays = (systemParams?.relays as any[])?.map((r: any) => r.url || r) || [
          "wss://relay.lanavault.space",
          "wss://relay.lanacoin-eternity.com",
          "wss://relay.lanaheartvoice.com",
          "wss://relay.lovelana.org",
          "wss://relay.damus.io",
        ];

        // Get remaining wallets
        const { data: allWallets } = await supabase
          .from("wallets")
          .select("wallet_id, wallet_type, notes")
          .eq("main_wallet_id", wallet.main_wallet_id);

        const walletTags = (allWallets || []).map(w =>
          ["w", w.wallet_id, w.wallet_type, "LANA", w.notes || "", "0"]
        );

        console.log(`[${correlationId}] Creating KIND 30889 with ${walletTags.length} wallet tags (after deletion)`);

        const pool = new SimplePool();
        const event30889 = createSignedEvent(
          30889,
          [
            ["d", nostr_id_hex],
            ["status", "active"],
            ...walletTags,
          ],
          "",
          privateKeyHex
        );

        const result = await broadcastToRelays(pool, relays, event30889, correlationId);
        console.log(`[${correlationId}] KIND 30889 broadcast: ${result.acceptedRelays} relays accepted`);

        await new Promise(resolve => setTimeout(resolve, 1000));
        pool.close(relays);
      } else {
        console.warn(`[${correlationId}] No NSEC configured, skipping KIND 30889`);
      }
    } catch (nostrError) {
      console.error(`[${correlationId}] Nostr broadcast error (wallet still deleted):`, nostrError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Wallet ${wallet.wallet_id} deleted and KIND 30889 updated`,
        correlation_id: correlationId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[${correlationId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unexpected error",
        correlation_id: correlationId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
