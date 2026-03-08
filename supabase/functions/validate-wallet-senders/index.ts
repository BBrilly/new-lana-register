import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ElectrumServer {
  host: string;
  port: number;
}

interface SenderValidationResult {
  totalSenders: number;
  registeredSenders: number;
  unregisteredSenders: string[];
  allRegistered: boolean;
}

// Connect to Electrum and send/receive JSON-RPC
async function electrumCall(server: ElectrumServer, requests: { id: number; method: string; params: any[] }[]): Promise<Map<number, any>> {
  const conn = await Deno.connect({ hostname: server.host, port: server.port });
  const responses = new Map<number, any>();
  
  try {
    // Send all requests
    for (const request of requests) {
      const data = JSON.stringify(request) + '\n';
      await conn.write(new TextEncoder().encode(data));
    }

    // Read responses
    const decoder = new TextDecoder();
    let buffer = '';
    const timeout = setTimeout(() => conn.close(), 30000);

    while (responses.size < requests.length) {
      const chunk = new Uint8Array(8192);
      const bytesRead = await conn.read(chunk);
      if (bytesRead === null) break;

      buffer += decoder.decode(chunk.subarray(0, bytesRead));
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            responses.set(response.id, response);
          } catch (e) {
            console.warn('Failed to parse response:', line.substring(0, 100));
          }
        }
      }
    }

    clearTimeout(timeout);
    conn.close();
  } catch (error) {
    try { conn.close(); } catch (_) {}
    throw error;
  }

  return responses;
}

// Extract sender addresses from a raw transaction hex
function extractInputAddresses(txHex: string, targetAddress: string): string[] {
  // We can't reliably parse raw tx hex for addresses without full script decoding
  // Instead, we'll use blockchain.transaction.get with verbose=true
  return [];
}

// Get all unique sender addresses for a wallet
async function getWalletSenders(
  server: ElectrumServer,
  walletAddress: string,
  correlationId: string
): Promise<string[]> {
  console.log(`[${correlationId}] Getting transaction history for ${walletAddress}`);

  // Step 1: Get transaction history
  const historyResponses = await electrumCall(server, [{
    id: 1,
    method: 'blockchain.address.get_history',
    params: [walletAddress]
  }]);

  const historyResponse = historyResponses.get(1);
  if (!historyResponse?.result || !Array.isArray(historyResponse.result)) {
    console.log(`[${correlationId}] No transaction history found`);
    return [];
  }

  const txHashes: string[] = historyResponse.result.map((tx: any) => tx.tx_hash);
  console.log(`[${correlationId}] Found ${txHashes.length} transactions`);

  if (txHashes.length === 0) return [];

  // Step 2: Get verbose transaction details (in batches)
  const BATCH_SIZE = 20;
  const allSenders = new Set<string>();

  for (let i = 0; i < txHashes.length; i += BATCH_SIZE) {
    const batch = txHashes.slice(i, i + BATCH_SIZE);
    const requests = batch.map((txHash, idx) => ({
      id: idx + 1,
      method: 'blockchain.transaction.get',
      params: [txHash, true] // verbose=true to get decoded tx
    }));

    const txResponses = await electrumCall(server, requests);

    for (let j = 0; j < batch.length; j++) {
      const txResponse = txResponses.get(j + 1);
      if (!txResponse?.result) continue;

      const tx = txResponse.result;

      // Check if this transaction sends TO our wallet
      let sendsToOurWallet = false;
      if (tx.vout) {
        for (const vout of tx.vout) {
          const addresses = vout.scriptPubKey?.addresses || [];
          if (addresses.includes(walletAddress)) {
            sendsToOurWallet = true;
            break;
          }
        }
      }

      if (!sendsToOurWallet) continue;

      // Extract input addresses (senders)
      if (tx.vin) {
        for (const vin of tx.vin) {
          // Coinbase transactions have no sender
          if (vin.coinbase) continue;

          // For inputs, we need to look at the previous transaction's output
          // In verbose mode, some Electrum servers include the address in vin
          if (vin.address) {
            if (vin.address !== walletAddress) {
              allSenders.add(vin.address);
            }
          } else if (vin.prevout?.scriptPubKey?.addresses) {
            for (const addr of vin.prevout.scriptPubKey.addresses) {
              if (addr !== walletAddress) {
                allSenders.add(addr);
              }
            }
          }
        }
      }
    }

    // Small delay between batches
    if (i + BATCH_SIZE < txHashes.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // If verbose mode didn't give us addresses in vin, we need to fetch prev transactions
  // This is a fallback for Electrum servers that don't include prevout data
  if (allSenders.size === 0 && txHashes.length > 0) {
    console.log(`[${correlationId}] Verbose mode didn't return sender addresses, trying prev tx lookup`);
    
    for (let i = 0; i < txHashes.length; i += BATCH_SIZE) {
      const batch = txHashes.slice(i, i + BATCH_SIZE);
      
      // First get the transactions (non-verbose to get raw structure)
      const txRequests = batch.map((txHash, idx) => ({
        id: idx + 1,
        method: 'blockchain.transaction.get',
        params: [txHash, true]
      }));
      
      const txResponses = await electrumCall(server, txRequests);
      
      // Collect all prev tx hashes we need to look up
      const prevTxLookups: { txHash: string; voutIndex: number; originalTxIdx: number }[] = [];
      
      for (let j = 0; j < batch.length; j++) {
        const txResponse = txResponses.get(j + 1);
        if (!txResponse?.result?.vin) continue;
        
        const tx = txResponse.result;
        
        // Check if sends to our wallet
        let sendsToOurWallet = false;
        if (tx.vout) {
          for (const vout of tx.vout) {
            const addresses = vout.scriptPubKey?.addresses || [];
            if (addresses.includes(walletAddress)) {
              sendsToOurWallet = true;
              break;
            }
          }
        }
        
        if (!sendsToOurWallet) continue;
        
        for (const vin of tx.vin) {
          if (vin.coinbase) continue;
          if (vin.txid) {
            prevTxLookups.push({
              txHash: vin.txid,
              voutIndex: vin.vout,
              originalTxIdx: j
            });
          }
        }
      }
      
      // Fetch previous transactions to get sender addresses
      if (prevTxLookups.length > 0) {
        const uniquePrevTxHashes = [...new Set(prevTxLookups.map(l => l.txHash))];
        
        for (let k = 0; k < uniquePrevTxHashes.length; k += BATCH_SIZE) {
          const prevBatch = uniquePrevTxHashes.slice(k, k + BATCH_SIZE);
          const prevRequests = prevBatch.map((txHash, idx) => ({
            id: idx + 1,
            method: 'blockchain.transaction.get',
            params: [txHash, true]
          }));
          
          const prevResponses = await electrumCall(server, prevRequests);
          
          for (let m = 0; m < prevBatch.length; m++) {
            const prevResponse = prevResponses.get(m + 1);
            if (!prevResponse?.result?.vout) continue;
            
            const prevTx = prevResponse.result;
            const relevantLookups = prevTxLookups.filter(l => l.txHash === prevBatch[m]);
            
            for (const lookup of relevantLookups) {
              const output = prevTx.vout[lookup.voutIndex];
              if (output?.scriptPubKey?.addresses) {
                for (const addr of output.scriptPubKey.addresses) {
                  if (addr !== walletAddress) {
                    allSenders.add(addr);
                  }
                }
              }
            }
          }
          
          if (k + BATCH_SIZE < uniquePrevTxHashes.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }
      
      if (i + BATCH_SIZE < txHashes.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  console.log(`[${correlationId}] Found ${allSenders.size} unique senders`);
  return Array.from(allSenders);
}

// Check which senders are registered in the wallets table
async function checkSendersRegistration(
  supabase: any,
  senders: string[],
  correlationId: string
): Promise<SenderValidationResult> {
  if (senders.length === 0) {
    return {
      totalSenders: 0,
      registeredSenders: 0,
      unregisteredSenders: [],
      allRegistered: true
    };
  }

  const BATCH_SIZE = 50;
  const MAX_UNREGISTERED = 5;
  const registeredSet = new Set<string>();
  const unregisteredSenders: string[] = [];

  // Smart sampling for large sender lists
  if (senders.length > 100) {
    console.log(`[${correlationId}] Large sender list (${senders.length}), doing smart sampling first`);
    const sampleSize = 30;
    const shuffled = [...senders].sort(() => Math.random() - 0.5);
    const sample = shuffled.slice(0, sampleSize);

    const { data: sampleRegistered } = await supabase
      .from('wallets')
      .select('wallet_id')
      .in('wallet_id', sample);

    const sampleRegisteredSet = new Set((sampleRegistered || []).map((w: any) => w.wallet_id));
    const sampleUnregistered = sample.filter(s => !sampleRegisteredSet.has(s));

    if (sampleUnregistered.length >= MAX_UNREGISTERED) {
      console.log(`[${correlationId}] Sample found ${sampleUnregistered.length} unregistered, rejecting early`);
      return {
        totalSenders: senders.length,
        registeredSenders: 0,
        unregisteredSenders: sampleUnregistered.slice(0, 10),
        allRegistered: false
      };
    }
  }

  // Full validation in batches
  for (let i = 0; i < senders.length; i += BATCH_SIZE) {
    const batch = senders.slice(i, i + BATCH_SIZE);

    const { data: registered } = await supabase
      .from('wallets')
      .select('wallet_id')
      .in('wallet_id', batch);

    const batchRegisteredSet = new Set((registered || []).map((w: any) => w.wallet_id));

    for (const sender of batch) {
      if (batchRegisteredSet.has(sender)) {
        registeredSet.add(sender);
      } else {
        unregisteredSenders.push(sender);
      }
    }

    // Early exit if too many unregistered
    if (unregisteredSenders.length >= MAX_UNREGISTERED) {
      console.log(`[${correlationId}] Found ${unregisteredSenders.length} unregistered senders, stopping early`);
      break;
    }
  }

  return {
    totalSenders: senders.length,
    registeredSenders: registeredSet.size,
    unregisteredSenders,
    allRegistered: unregisteredSenders.length === 0
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID().substring(0, 8);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { wallet_address, electrum_servers } = body;

    if (!wallet_address || typeof wallet_address !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'wallet_address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!electrum_servers || !Array.isArray(electrum_servers) || electrum_servers.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'electrum_servers array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${correlationId}] Validating senders for wallet: ${wallet_address}`);

    // Try each electrum server
    let senders: string[] = [];
    let serverUsed = '';

    for (const server of electrum_servers) {
      try {
        const electrumServer: ElectrumServer = {
          host: server.host,
          port: parseInt(server.port, 10)
        };
        senders = await getWalletSenders(electrumServer, wallet_address, correlationId);
        serverUsed = server.host;
        break;
      } catch (error) {
        console.warn(`[${correlationId}] Server ${server.host} failed:`, error);
        continue;
      }
    }

    if (!serverUsed) {
      return new Response(
        JSON.stringify({ success: false, error: 'All Electrum servers failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check sender registration
    const result = await checkSendersRegistration(supabase, senders, correlationId);

    console.log(`[${correlationId}] Validation complete: ${result.registeredSenders}/${result.totalSenders} registered, ${result.unregisteredSenders.length} unregistered`);

    return new Response(
      JSON.stringify({
        success: true,
        wallet_address,
        ...result,
        server_used: serverUsed,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[${correlationId}] Error:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
