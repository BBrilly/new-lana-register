import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const DUST_THRESHOLD = 10000; // Less than 10,000 lanoshis is considered dust

async function connectElectrum(servers: any[], maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (const server of servers) {
      try {
        console.log(`🔌 Connecting to ${server.host}:${server.port} (attempt ${attempt + 1})`);
        const conn = await Deno.connect({ hostname: server.host, port: server.port });
        console.log(`✅ Connected to ${server.host}:${server.port}`);
        return conn;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
        console.error(`❌ Failed to connect to ${server.host}:${server.port}:`, errorMessage);
      }
    }
    if (attempt < maxRetries - 1) {
      console.log(`⏳ Waiting 1 second before retry...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Failed to connect to any Electrum server');
}

async function electrumCall(method: string, params: any[], servers: any[], timeout = 30000) {
  let conn = null;
  try {
    conn = await connectElectrum(servers);
    const request = { id: Date.now(), method, params };
    const requestData = JSON.stringify(request) + '\n';
    console.log(`📤 Electrum ${method}:`, params);
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Electrum call timeout after ${timeout}ms`)), timeout);
    });
    
    const callPromise = (async () => {
      await conn.write(new TextEncoder().encode(requestData));
      let responseText = '';
      const buffer = new Uint8Array(8192);
      
      while (true) {
        const bytesRead = await conn.read(buffer);
        if (!bytesRead) break;
        const chunk = new TextDecoder().decode(buffer.slice(0, bytesRead));
        responseText += chunk;
        if (responseText.includes('\n')) break;
      }
      
      if (!responseText) throw new Error('No response from Electrum server');
      responseText = responseText.trim();
      
      const response = JSON.parse(responseText);
      if (response.error) throw new Error(`Electrum error: ${JSON.stringify(response.error)}`);
      return response.result;
    })();
    
    return await Promise.race([callPromise, timeoutPromise]);
  } catch (error) {
    console.error(`❌ Electrum call error for ${method}:`, error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.close();
      } catch (e) {
        console.warn('Warning: Failed to close connection:', e);
      }
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    console.log('🔍 Starting UTXO analysis...');
    const { wallet_address, electrum_servers } = await req.json();
    
    if (!wallet_address) {
      throw new Error('Missing wallet_address parameter');
    }
    
    const servers = electrum_servers && electrum_servers.length > 0
      ? electrum_servers
      : [
          { host: "electrum1.lanacoin.com", port: 5097 },
          { host: "electrum2.lanacoin.com", port: 5097 }
        ];
    
    console.log(`📊 Analyzing UTXOs for address: ${wallet_address}`);
    
    // Fetch all UTXOs
    const utxos = await electrumCall('blockchain.address.listunspent', [wallet_address], servers);
    
    if (!utxos || utxos.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          total_utxos: 0,
          total_value: 0,
          largest_utxos: [],
          dust_utxos: [],
          dust_count: 0,
          dust_value: 0,
          message: 'No UTXOs found for this wallet'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log(`📦 Found ${utxos.length} UTXOs`);
    
    // Sort by value (largest first)
    const sortedUTXOs = [...utxos].sort((a: any, b: any) => b.value - a.value);
    
    // Calculate total value
    const totalValue = utxos.reduce((sum: number, utxo: any) => sum + utxo.value, 0);
    
    // Get top 20 largest UTXOs
    const largestUtxos = sortedUTXOs.slice(0, 20).map((utxo: any) => ({
      tx_hash: utxo.tx_hash,
      tx_pos: utxo.tx_pos,
      height: utxo.height,
      value: utxo.value,
      value_lana: (utxo.value / 100000000).toFixed(8)
    }));
    
    // Filter dust UTXOs (< 10,000 lanoshis)
    const dustUtxos = sortedUTXOs.filter((utxo: any) => utxo.value < DUST_THRESHOLD);
    const dustValue = dustUtxos.reduce((sum: number, utxo: any) => sum + utxo.value, 0);
    
    console.log(`✅ Analysis complete:`);
    console.log(`   Total UTXOs: ${utxos.length}`);
    console.log(`   Total Value: ${(totalValue / 100000000).toFixed(8)} LANA`);
    console.log(`   Dust UTXOs: ${dustUtxos.length} (${(dustValue / 100000000).toFixed(8)} LANA)`);
    
    return new Response(
      JSON.stringify({
        success: true,
        total_utxos: utxos.length,
        total_value: totalValue,
        total_value_lana: (totalValue / 100000000).toFixed(8),
        all_utxos: sortedUTXOs.map((utxo: any) => ({
          tx_hash: utxo.tx_hash,
          tx_pos: utxo.tx_pos,
          height: utxo.height,
          value: utxo.value,
          value_lana: (utxo.value / 100000000).toFixed(8)
        })),
        largest_utxos: largestUtxos,
        dust_count: dustUtxos.length,
        dust_value: dustValue,
        dust_value_lana: (dustValue / 100000000).toFixed(8),
        dust_threshold: DUST_THRESHOLD,
        dust_threshold_lana: (DUST_THRESHOLD / 100000000).toFixed(8),
        non_dust_count: utxos.length - dustUtxos.length,
        non_dust_value: totalValue - dustValue,
        non_dust_value_lana: ((totalValue - dustValue) / 100000000).toFixed(8)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('❌ UTXO analysis error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
