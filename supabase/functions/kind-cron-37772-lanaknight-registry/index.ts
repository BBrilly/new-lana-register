import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SimplePool } from "https://esm.sh/nostr-tools@2.7.0/pool";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Official LanaKnight Registry publisher pubkey
const KNIGHT_REGISTRY_PUBKEY = "e1048b738f4960110bb869928df8742d760981a12bb11aa77dfeee6895161626";
const KIND_37772 = 37772;

interface KnightRegistryEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

interface KnightWallet {
  id: string;
  wallet_id: string | null;
  wallet_type: string;
  main_wallet_id: string;
  main_wallet?: {
    id: string;
    nostr_hex_id: string;
    name: string;
  };
}

async function fetchKnightRegistry(relays: string[]): Promise<KnightRegistryEvent | null> {
  console.log(`🔍 Attempting to fetch KIND 37772 from ${relays.length} relays...`);
  
  const pool = new SimplePool();
  
  try {
    // Query for the latest KIND 37772 event from the official publisher
    const filter = {
      kinds: [KIND_37772],
      authors: [KNIGHT_REGISTRY_PUBKEY],
      "#d": ["knight-registry"],
      limit: 1
    };
    
    console.log(`📡 Querying relays: ${JSON.stringify(relays)}`);
    
    // Try to fetch from relays with timeout
    const events = await Promise.race([
      pool.querySync(relays, filter),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("Relay query timeout")), 15000)
      )
    ]) as KnightRegistryEvent[];
    
    if (!events || events.length === 0) {
      console.log("⚠️ No KIND 37772 events found from official publisher");
      return null;
    }
    
    // Get the most recent event
    const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
    console.log(`✅ Found KIND 37772 event: ${latestEvent.id} (created: ${new Date(latestEvent.created_at * 1000).toISOString()})`);
    
    return latestEvent;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error fetching from relays: ${errorMessage}`);
    return null;
  } finally {
    try {
      pool.close(relays);
    } catch (e) {
      // Ignore close errors
    }
  }
}

function extractKnightPubkeys(event: KnightRegistryEvent): Set<string> {
  const pubkeys = new Set<string>();
  
  for (const tag of event.tags) {
    if (tag[0] === "p" && tag[1]) {
      pubkeys.add(tag[1].toLowerCase());
    }
  }
  
  console.log(`📋 Extracted ${pubkeys.size} Knight pubkeys from registry`);
  return pubkeys;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("🚀 Kind CRON 37772 — LanaKnight Registry started");
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 1. Fetch relays from system_parameters
    console.log("📡 Fetching relay configuration...");
    const { data: sysParams, error: sysError } = await supabase
      .from("system_parameters")
      .select("relays")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (sysError || !sysParams) {
      console.error("❌ Failed to fetch system parameters:", sysError?.message);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Failed to fetch system parameters" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      });
    }
    
    const relays = (sysParams.relays as string[]) || [];
    if (relays.length === 0) {
      console.log("⚠️ No relays configured, skipping...");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No relays configured" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    console.log(`📡 Using ${relays.length} relays: ${JSON.stringify(relays)}`);
    
    // 2. Fetch KIND 37772 from relays
    const registryEvent = await fetchKnightRegistry(relays);
    
    if (!registryEvent) {
      console.log("⚠️ Could not fetch Knight registry, relays may be unreachable. Skipping...");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Relays unreachable or no registry event found, skipping" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // 3. Extract valid Knight pubkeys from the event
    const validKnightPubkeys = extractKnightPubkeys(registryEvent);
    
    if (validKnightPubkeys.size === 0) {
      console.log("⚠️ No Knight pubkeys found in registry event");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No Knights in registry" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // 4. Fetch all Knights wallets with their main_wallet info
    console.log("🔍 Fetching all Knights wallets from database...");
    const { data: knightWallets, error: walletsError } = await supabase
      .from("wallets")
      .select(`
        id,
        wallet_id,
        wallet_type,
        main_wallet_id,
        main_wallet:main_wallets!wallets_main_wallet_id_fkey (
          id,
          nostr_hex_id,
          name
        )
      `)
      .eq("wallet_type", "Knights");
    
    if (walletsError) {
      console.error("❌ Failed to fetch Knights wallets:", walletsError.message);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Failed to fetch Knights wallets" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      });
    }
    
    console.log(`📋 Found ${knightWallets?.length || 0} Knights wallets in database`);
    
    if (!knightWallets || knightWallets.length === 0) {
      console.log("✅ No Knights wallets to check");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No Knights wallets in database" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // 5. Check each Knights wallet against the registry
    const walletsToDelete: KnightWallet[] = [];
    
    for (const wallet of knightWallets) {
      const mainWallet = wallet.main_wallet as unknown as { id: string; nostr_hex_id: string; name: string } | null;
      
      if (!mainWallet || !mainWallet.nostr_hex_id) {
        console.log(`⚠️ Wallet ${wallet.id} has no main_wallet or nostr_hex_id, skipping...`);
        continue;
      }
      
      const ownerPubkey = mainWallet.nostr_hex_id.toLowerCase();
      
      if (!validKnightPubkeys.has(ownerPubkey)) {
        console.log(`❌ Owner ${ownerPubkey} (${mainWallet.name}) NOT in Knight registry`);
        walletsToDelete.push({
          ...wallet,
          main_wallet: mainWallet
        });
      }
    }
    
    console.log(`🗑️ Found ${walletsToDelete.length} wallets to delete`);
    
    // 6. Process deletions
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const wallet of walletsToDelete) {
      const mainWallet = wallet.main_wallet!;
      
      try {
        // Insert into deleted_wallets first
        const { error: insertError } = await supabase
          .from("deleted_wallets")
          .insert({
            wallet_id: wallet.wallet_id,
            original_wallet_uuid: wallet.id,
            nostr_hex_id: mainWallet.nostr_hex_id,
            main_wallet_id: wallet.main_wallet_id,
            wallet_type: wallet.wallet_type,
            reason: "Not found in 37772 Event"
          });
        
        if (insertError) {
          console.error(`❌ Failed to insert into deleted_wallets: ${insertError.message}`);
          errorCount++;
          continue;
        }
        
        // Delete from wallets table
        const { error: deleteError } = await supabase
          .from("wallets")
          .delete()
          .eq("id", wallet.id);
        
        if (deleteError) {
          console.error(`❌ Failed to delete wallet ${wallet.id}: ${deleteError.message}`);
          errorCount++;
          continue;
        }
        
        console.log(`✅ Deleted wallet ${wallet.wallet_id || wallet.id} (owner: ${mainWallet.name})`);
        deletedCount++;
        
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error processing wallet ${wallet.id}: ${errorMsg}`);
        errorCount++;
      }
    }
    
    const summary = {
      success: true,
      registryEventId: registryEvent.id,
      registryCreatedAt: new Date(registryEvent.created_at * 1000).toISOString(),
      validKnightsCount: validKnightPubkeys.size,
      knightWalletsChecked: knightWallets.length,
      walletsDeleted: deletedCount,
      errors: errorCount
    };
    
    console.log(`✅ Completed: ${JSON.stringify(summary)}`);
    
    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Fatal error: ${errorMessage}`);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
