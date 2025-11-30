import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { SimplePool, Event, Filter } from 'npm:nostr-tools@2.17.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NostrProfile {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  location?: string;
  country?: string;
  [key: string]: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting profile data sync from Nostr relays...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Fetch system parameters for relays
    const { data: sysParams, error: sysError } = await supabase
      .from('system_parameters')
      .select('relays')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sysError) {
      console.error('❌ Error fetching system parameters:', sysError);
      throw sysError;
    }

    if (!sysParams?.relays) {
      console.error('❌ No relays configured in system parameters');
      throw new Error('No relays configured');
    }

    const relays = Array.isArray(sysParams.relays) 
      ? sysParams.relays 
      : Object.values(sysParams.relays);

    console.log(`📡 Using ${relays.length} relays`);

    // Fetch all main wallets
    const { data: mainWallets, error: walletsError } = await supabase
      .from('main_wallets')
      .select('id, nostr_hex_id, name, display_name');

    if (walletsError) {
      console.error('❌ Error fetching main wallets:', walletsError);
      throw walletsError;
    }

    if (!mainWallets || mainWallets.length === 0) {
      console.log('ℹ️ No main wallets found');
      return new Response(
        JSON.stringify({ success: true, message: 'No wallets to sync', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`👥 Found ${mainWallets.length} main wallets to check`);

    // Check if we need to fetch all or just recent
    const hasEmptyProfiles = mainWallets.some(w => !w.name || !w.display_name);
    const timeFilter = hasEmptyProfiles 
      ? undefined 
      : Math.floor(Date.now() / 1000) - (20 * 60); // Last 20 minutes

    console.log(hasEmptyProfiles 
      ? '📥 Fetching all profiles (some wallets missing profile data)'
      : '📥 Fetching profiles from last 20 minutes'
    );

    // Initialize Nostr pool
    const pool = new SimplePool();
    const pubkeys = mainWallets.map(w => w.nostr_hex_id);

    // Build filter for KIND 0 events
    const filter: Filter = {
      kinds: [0],
      authors: pubkeys,
    };

    if (timeFilter) {
      filter.since = timeFilter;
    }

    console.log(`🔍 Querying ${pubkeys.length} pubkeys for KIND 0 events...`);

    // Fetch KIND 0 events from relays
    const events = await pool.querySync(relays, filter);
    
    console.log(`✅ Received ${events.length} KIND 0 events`);

    // Group events by pubkey and keep only the most recent
    const latestEvents = new Map<string, Event>();
    
    for (const event of events) {
      const existing = latestEvents.get(event.pubkey);
      if (!existing || event.created_at > existing.created_at) {
        latestEvents.set(event.pubkey, event);
      }
    }

    console.log(`📊 Processing ${latestEvents.size} unique profiles`);

    // Update profiles in database
    let updatedCount = 0;
    let errorCount = 0;

    for (const [pubkey, event] of latestEvents.entries()) {
      try {
        const profile: NostrProfile = JSON.parse(event.content);
        
        const wallet = mainWallets.find(w => w.nostr_hex_id === pubkey);
        if (!wallet) continue;

        // Only update if there are changes
        const needsUpdate = 
          profile.name !== wallet.name || 
          profile.display_name !== wallet.display_name;

        if (!needsUpdate) {
          console.log(`⏭️ Skipping ${pubkey.substring(0, 8)}... (no changes)`);
          continue;
        }

        const { error: updateError } = await supabase
          .from('main_wallets')
          .update({
            name: profile.name || null,
            display_name: profile.display_name || null,
            updated_at: new Date().toISOString(),
          })
          .eq('nostr_hex_id', pubkey);

        if (updateError) {
          console.error(`❌ Error updating wallet ${pubkey.substring(0, 8)}:`, updateError);
          errorCount++;
        } else {
          console.log(`✅ Updated profile for ${pubkey.substring(0, 8)}... (${profile.name || 'N/A'})`);
          updatedCount++;
        }
      } catch (parseError) {
        console.error(`❌ Error parsing profile for ${pubkey.substring(0, 8)}:`, parseError);
        errorCount++;
      }
    }

    // Close pool connections
    pool.close(relays);

    const result = {
      success: true,
      walletsChecked: mainWallets.length,
      eventsReceived: events.length,
      uniqueProfiles: latestEvents.size,
      updated: updatedCount,
      errors: errorCount,
      mode: hasEmptyProfiles ? 'full_sync' : 'incremental',
    };

    console.log('🎉 Profile sync completed:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Fatal error in sync-profile-data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: errorDetails 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
