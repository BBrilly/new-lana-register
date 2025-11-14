import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { SimplePool, Filter, Event } from 'https://esm.sh/nostr-tools@2.17.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INITIAL_RELAYS = [
  'wss://relay.lanavault.space',
  'wss://relay.lanacoin-eternity.com',
  'wss://relay.lanaheartvoice.com',
  'wss://relay.lovelana.org'
];

const AUTHORIZED_PUBKEY = '9eb71bf1e9c3189c78800e4c3831c1c1a93ab43b61118818c32e4490891a35b3';

interface SystemParameters {
  relays: string[];
  electrum: Array<{ host: string; port: string }>;
  fx: {
    EUR: number;
    USD: number;
    GBP: number;
  };
  split: string;
  version: string;
  valid_from: string;
  trusted_signers: {
    Lana8Wonder: string[];
    LanaRegistrar: string[];
    LanaRooms: string[];
    LanaAlignment: string[];
    LanaPaysUs: string[];
    '100MillionFun': string[];
    LanaKnights: string[];
    LanaHelpsUs: string[];
  };
}

function parseKind38888Event(event: Event): SystemParameters | null {
  try {
    const content = JSON.parse(event.content);
    
    // Extract relays from tags
    const relays = event.tags
      .filter(t => t[0] === 'relay')
      .map(t => t[1]);

    // Extract electrum servers
    const electrum = event.tags
      .filter(t => t[0] === 'electrum')
      .map(t => ({ host: t[1], port: t[2] }));

    // Extract exchange rates
    const fxTags = event.tags.filter(t => t[0] === 'fx');
    const fx = {
      EUR: parseFloat(fxTags.find(t => t[1] === 'EUR')?.[2] || '0'),
      USD: parseFloat(fxTags.find(t => t[1] === 'USD')?.[2] || '0'),
      GBP: parseFloat(fxTags.find(t => t[1] === 'GBP')?.[2] || '0')
    };

    // Extract split, version, valid_from
    const split = event.tags.find(t => t[0] === 'split')?.[1] || '0';
    const version = event.tags.find(t => t[0] === 'version')?.[1] || '0';
    const valid_from = event.tags.find(t => t[0] === 'valid_from')?.[1] || '0';

    return {
      relays: relays.length > 0 ? relays : content.relays || [],
      electrum: electrum.length > 0 ? electrum : content.electrum || [],
      fx,
      split,
      version,
      valid_from,
      trusted_signers: content.trusted_signers || {
        Lana8Wonder: [],
        LanaRegistrar: [],
        LanaRooms: [],
        LanaAlignment: [],
        LanaPaysUs: [],
        '100MillionFun': [],
        LanaKnights: [],
        LanaHelpsUs: []
      }
    };
  } catch (error) {
    console.error('Error parsing KIND 38888 event:', error);
    return null;
  }
}

async function fetchSystemParameters(): Promise<{ event: Event | null; relays: string[] }> {
  const pool = new SimplePool();
  
  const filter: Filter = {
    kinds: [38888],
    authors: [AUTHORIZED_PUBKEY],
    '#d': ['main'],
    limit: 1
  };

  console.log('Connecting to relays:', INITIAL_RELAYS);
  console.log('Fetching KIND 38888 events from authorized pubkey:', AUTHORIZED_PUBKEY);

  try {
    // Connect to relays
    const relayPromises = INITIAL_RELAYS.map(async (url) => {
      try {
        await pool.ensureRelay(url);
        console.log(`✓ Connected to ${url}`);
        return url;
      } catch (error) {
        console.error(`✗ Failed to connect to ${url}:`, error);
        return null;
      }
    });

    const connectedRelays = (await Promise.all(relayPromises)).filter(r => r !== null) as string[];
    
    if (connectedRelays.length === 0) {
      console.error('No relays connected');
      return { event: null, relays: [] };
    }

    console.log(`Connected to ${connectedRelays.length} relays`);

    // Fetch events
    const events = await pool.querySync(connectedRelays, filter);
    
    console.log(`Found ${events.length} KIND 38888 events`);

    if (events.length === 0) {
      console.warn('No KIND 38888 events found');
      return { event: null, relays: connectedRelays };
    }

    // Get the latest event
    const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];

    // Verify pubkey
    if (latestEvent.pubkey !== AUTHORIZED_PUBKEY) {
      console.error('Event pubkey does not match authorized pubkey');
      return { event: null, relays: connectedRelays };
    }

    // Verify d-tag
    const dTag = latestEvent.tags.find(t => t[0] === 'd');
    if (!dTag || dTag[1] !== 'main') {
      console.error('Event does not have d=main tag');
      return { event: null, relays: connectedRelays };
    }

    console.log('✓ Valid KIND 38888 event found:', {
      id: latestEvent.id,
      created_at: latestEvent.created_at,
      version: latestEvent.tags.find(t => t[0] === 'version')?.[1]
    });

    pool.close(connectedRelays);
    return { event: latestEvent, relays: connectedRelays };

  } catch (error) {
    console.error('Error fetching system parameters:', error);
    pool.close(INITIAL_RELAYS);
    return { event: null, relays: [] };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting system parameters sync...');

    // Fetch from Nostr
    const { event, relays } = await fetchSystemParameters();

    if (!event) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to fetch KIND 38888 event from relays',
          relays_attempted: INITIAL_RELAYS,
          relays_connected: relays
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse event
    const parameters = parseKind38888Event(event);

    if (!parameters) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to parse KIND 38888 event' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Store in database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if this event already exists
    const { data: existing } = await supabase
      .from('system_parameters')
      .select('id')
      .eq('event_id', event.id)
      .single();

    if (existing) {
      console.log('Event already exists in database, updating timestamp');
      const { error: updateError } = await supabase
        .from('system_parameters')
        .update({ updated_at: new Date().toISOString() })
        .eq('event_id', event.id);

      if (updateError) {
        console.error('Error updating timestamp:', updateError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'System parameters already up to date',
          event_id: event.id,
          version: parameters.version,
          already_exists: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Insert new record
    const { data, error } = await supabase
      .from('system_parameters')
      .insert({
        event_id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at,
        relays: parameters.relays,
        electrum: parameters.electrum,
        fx: parameters.fx,
        split: parameters.split,
        version: parameters.version,
        valid_from: parameters.valid_from,
        trusted_signers: parameters.trusted_signers,
        raw_event: event
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to store system parameters in database',
          details: error.message
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✓ System parameters stored successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'System parameters synced successfully',
        data: {
          event_id: event.id,
          version: parameters.version,
          split: parameters.split,
          relays_count: parameters.relays.length,
          electrum_count: parameters.electrum.length,
          fx: parameters.fx
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});