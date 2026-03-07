import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SimplePool, finalizeEvent } from "https://esm.sh/nostr-tools@2.7.0";
import { decode as nip19decode } from "https://esm.sh/nostr-tools@2.7.0/nip19";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { api_key, wallet_uuid, nostr_id_hex, notes } = body;

    console.log(`[${correlationId}] Update wallet notes: wallet_uuid=${wallet_uuid}, nostr_id_hex=${nostr_id_hex?.substring(0, 12)}`);

    if (typeof notes !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Notes must be a string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Fetch wallet
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

    // Verify ownership
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

    // Update notes
    const { error: updateError } = await supabase
      .from("wallets")
      .update({ notes })
      .eq("id", wallet_uuid);

    if (updateError) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update notes: " + updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${correlationId}] Notes updated for wallet ${wallet.wallet_id}. Broadcasting KIND 30889...`);

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

        // Get all wallets for this user (with updated notes, include frozen for 7th field)
        const { data: allWallets } = await supabase
          .from("wallets")
          .select("wallet_id, wallet_type, notes, amount_unregistered_lanoshi, frozen")
          .eq("main_wallet_id", wallet.main_wallet_id);

        const walletTags = (allWallets || []).map(w =>
          ["w", w.wallet_id || "", w.wallet_type, "LANA", w.notes || "", String(w.amount_unregistered_lanoshi || 0), w.frozen ? "frozen_l8w" : ""]
        );

        console.log(`[${correlationId}] Creating KIND 30889 with ${walletTags.length} wallet tags`);

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
      console.error(`[${correlationId}] Nostr broadcast error (notes still updated):`, nostrError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Wallet notes updated and KIND 30889 broadcast`,
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
