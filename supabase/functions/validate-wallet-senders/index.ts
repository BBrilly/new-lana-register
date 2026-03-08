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
async function electrumCall(server: ElectrumServer, requests: { id: number; method: string; params: any[] }[], timeoutMs = 30000): Promise<Map<number, any>> {
  const conn = await Deno.connect({ hostname: server.host, port: server.port });
  const responses = new Map<number, any>();
  
  try {
    for (const request of requests) {
      const data = JSON.stringify(request) + '\n';
      await conn.write(new TextEncoder().encode(data));
    }

    const decoder = new TextDecoder();
    let buffer = '';
    const timeout = setTimeout(() => { try { conn.close(); } catch(_){} }, timeoutMs);

    while (responses.size < requests.length) {
      const chunk = new Uint8Array(65536);
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
            // skip
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

// Decode a Bitcoin-like varint from a hex string at a given byte offset
function readVarInt(hex: string, offset: number): { value: number; bytesRead: number } {
  const firstByte = parseInt(hex.substring(offset * 2, offset * 2 + 2), 16);
  if (firstByte < 0xfd) {
    return { value: firstByte, bytesRead: 1 };
  } else if (firstByte === 0xfd) {
    const val = parseInt(hex.substring((offset + 1) * 2, (offset + 1) * 2 + 2) + hex.substring((offset + 2) * 2 - 2, (offset + 2) * 2), 16);
    // Little endian
    const b1 = parseInt(hex.substring((offset + 1) * 2, (offset + 1) * 2 + 2), 16);
    const b2 = parseInt(hex.substring((offset + 2) * 2, (offset + 2) * 2 + 2), 16);
    return { value: b1 + (b2 << 8), bytesRead: 3 };
  } else if (firstByte === 0xfe) {
    const b1 = parseInt(hex.substring((offset + 1) * 2, (offset + 1) * 2 + 2), 16);
    const b2 = parseInt(hex.substring((offset + 2) * 2, (offset + 2) * 2 + 2), 16);
    const b3 = parseInt(hex.substring((offset + 3) * 2, (offset + 3) * 2 + 2), 16);
    const b4 = parseInt(hex.substring((offset + 4) * 2, (offset + 4) * 2 + 2), 16);
    return { value: b1 + (b2 << 8) + (b3 << 16) + (b4 << 24), bytesRead: 5 };
  }
  return { value: 0, bytesRead: 9 }; // 0xff case, unlikely for our use
}

// Reverse byte order of a hex string (for txid)
function reverseHex(hex: string): string {
  const bytes = hex.match(/.{2}/g) || [];
  return bytes.reverse().join('');
}

// Parse a raw transaction hex to extract input txids and vout indices
function parseRawTxInputs(rawHex: string): { txid: string; vout: number }[] {
  const inputs: { txid: string; vout: number }[] = [];
  
  try {
    let offset = 0;
    
    // Version (4 bytes)
    offset += 4;
    
    // Check for segwit marker
    const marker = parseInt(rawHex.substring(offset * 2, offset * 2 + 2), 16);
    if (marker === 0x00) {
      // Skip marker and flag
      offset += 2;
    }
    
    // Input count
    const vinCount = readVarInt(rawHex, offset);
    offset += vinCount.bytesRead;
    
    for (let i = 0; i < vinCount.value; i++) {
      // Previous tx hash (32 bytes, reversed)
      const prevTxHash = reverseHex(rawHex.substring(offset * 2, (offset + 32) * 2));
      offset += 32;
      
      // Previous output index (4 bytes, little endian)
      const voutHex = rawHex.substring(offset * 2, (offset + 4) * 2);
      const b1 = parseInt(voutHex.substring(0, 2), 16);
      const b2 = parseInt(voutHex.substring(2, 4), 16);
      const b3 = parseInt(voutHex.substring(4, 6), 16);
      const b4 = parseInt(voutHex.substring(6, 8), 16);
      const voutIndex = b1 + (b2 << 8) + (b3 << 16) + (b4 << 24);
      offset += 4;
      
      // Script length
      const scriptLen = readVarInt(rawHex, offset);
      offset += scriptLen.bytesRead;
      
      // Skip script
      offset += scriptLen.value;
      
      // Sequence (4 bytes)
      offset += 4;
      
      // Skip coinbase transactions (txid all zeros)
      if (prevTxHash !== '0000000000000000000000000000000000000000000000000000000000000000') {
        inputs.push({ txid: prevTxHash, vout: voutIndex });
      }
    }
  } catch (e) {
    // parsing error
  }
  
  return inputs;
}

// Parse raw tx hex to extract output addresses from scriptPubKey
// For P2PKH (most common for LANA): OP_DUP OP_HASH160 <20 bytes> OP_EQUALVERIFY OP_CHECKSIG
function parseRawTxOutputs(rawHex: string): { scriptHex: string; index: number }[] {
  const outputs: { scriptHex: string; index: number }[] = [];
  
  try {
    let offset = 0;
    
    // Version (4 bytes)
    offset += 4;
    
    // Check for segwit marker
    const marker = parseInt(rawHex.substring(offset * 2, offset * 2 + 2), 16);
    if (marker === 0x00) {
      offset += 2;
    }
    
    // Skip inputs
    const vinCount = readVarInt(rawHex, offset);
    offset += vinCount.bytesRead;
    
    for (let i = 0; i < vinCount.value; i++) {
      offset += 32; // prev tx hash
      offset += 4;  // prev output index
      const scriptLen = readVarInt(rawHex, offset);
      offset += scriptLen.bytesRead;
      offset += scriptLen.value; // script
      offset += 4; // sequence
    }
    
    // Output count
    const voutCount = readVarInt(rawHex, offset);
    offset += voutCount.bytesRead;
    
    for (let i = 0; i < voutCount.value; i++) {
      offset += 8; // value (8 bytes)
      
      const scriptLen = readVarInt(rawHex, offset);
      offset += scriptLen.bytesRead;
      
      const scriptHex = rawHex.substring(offset * 2, (offset + scriptLen.value) * 2);
      offset += scriptLen.value;
      
      outputs.push({ scriptHex, index: i });
    }
  } catch (e) {
    // parsing error
  }
  
  return outputs;
}

// Convert a P2PKH scriptPubKey hash160 to a base58check address
// LANA version byte is 0x30 (48)
function hash160ToAddress(hash160Hex: string, versionByte: number = 0x30): string {
  const payload = new Uint8Array(21);
  payload[0] = versionByte;
  for (let i = 0; i < 20; i++) {
    payload[i + 1] = parseInt(hash160Hex.substring(i * 2, i * 2 + 2), 16);
  }
  
  return base58CheckEncode(payload);
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

async function doubleSha256(data: Uint8Array): Promise<Uint8Array> {
  const first = await sha256(data);
  return await sha256(first);
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes: Uint8Array): string {
  const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  
  let result = '';
  // Leading zeros
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    result += BASE58_ALPHABET[0];
  }
  // Convert digits to base58
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

async function base58CheckEncode(payload: Uint8Array): Promise<string> {
  const checksum = await doubleSha256(payload);
  const fullPayload = new Uint8Array(payload.length + 4);
  fullPayload.set(payload);
  fullPayload.set(checksum.slice(0, 4), payload.length);
  return base58Encode(fullPayload);
}

// Extract address from a scriptPubKey hex
// Handles P2PKH: 76a914{20 bytes}88ac
// Handles P2SH: a914{20 bytes}87
async function scriptPubKeyToAddress(scriptHex: string): Promise<string | null> {
  // P2PKH: OP_DUP OP_HASH160 OP_PUSH20 <20bytes> OP_EQUALVERIFY OP_CHECKSIG
  if (scriptHex.length === 50 && scriptHex.startsWith('76a914') && scriptHex.endsWith('88ac')) {
    const hash160 = scriptHex.substring(6, 46);
    return await hash160ToAddress(hash160, 0x30); // LANA P2PKH version byte
  }
  
  // P2SH: OP_HASH160 OP_PUSH20 <20bytes> OP_EQUAL
  if (scriptHex.length === 46 && scriptHex.startsWith('a914') && scriptHex.endsWith('87')) {
    const hash160 = scriptHex.substring(4, 44);
    return await hash160ToAddress(hash160, 0x05); // Standard P2SH version byte
  }
  
  return null;
}

// Get all unique sender addresses for a wallet using raw tx parsing
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

  // Step 2: Get raw transactions (non-verbose since LANA Electrum doesn't support verbose)
  const BATCH_SIZE = 10;
  const allSenders = new Set<string>();
  const prevTxNeeded = new Map<string, Set<number>>(); // txid -> set of vout indices

  for (let i = 0; i < txHashes.length; i += BATCH_SIZE) {
    const batch = txHashes.slice(i, i + BATCH_SIZE);
    const requests = batch.map((txHash, idx) => ({
      id: idx + 1,
      method: 'blockchain.transaction.get',
      params: [txHash] // No verbose flag
    }));

    const txResponses = await electrumCall(server, requests);

    for (let j = 0; j < batch.length; j++) {
      const txResponse = txResponses.get(j + 1);
      if (!txResponse?.result) continue;

      const rawHex = txResponse.result;
      
      if (typeof rawHex !== 'string') {
        // It's verbose JSON - try to use it
        console.log(`[${correlationId}] Got verbose response for tx ${j}, type: ${typeof rawHex}`);
        continue;
      }

      // Debug: log first tx outputs
      if (i === 0 && j === 0) {
        console.log(`[${correlationId}] First raw tx hex length: ${rawHex.length}`);
        console.log(`[${correlationId}] First tx outputs count: ${outputs.length}`);
        for (const output of outputs) {
          const addr = await scriptPubKeyToAddress(output.scriptHex);
          console.log(`[${correlationId}] Output ${output.index}: script=${output.scriptHex.substring(0, 20)}..., addr=${addr}`);
        }
        console.log(`[${correlationId}] Looking for wallet: ${walletAddress}`);
      }

      // Parse outputs to check if this tx sends to our wallet
      let sendsToOurWallet = false;
      
      for (const output of outputs) {
        const addr = await scriptPubKeyToAddress(output.scriptHex);
        if (addr === walletAddress) {
          sendsToOurWallet = true;
          break;
        }
      }

      if (!sendsToOurWallet) continue;

      // Parse inputs to get prev tx references
      const inputs = parseRawTxInputs(rawHex);
      for (const input of inputs) {
        if (!prevTxNeeded.has(input.txid)) {
          prevTxNeeded.set(input.txid, new Set());
        }
        prevTxNeeded.get(input.txid)!.add(input.vout);
      }
    }

    if (i + BATCH_SIZE < txHashes.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  console.log(`[${correlationId}] Need to look up ${prevTxNeeded.size} previous transactions`);

  // Step 3: Fetch previous transactions to get sender addresses
  const prevTxHashes = Array.from(prevTxNeeded.keys());

  for (let k = 0; k < prevTxHashes.length; k += BATCH_SIZE) {
    const prevBatch = prevTxHashes.slice(k, k + BATCH_SIZE);
    const prevRequests = prevBatch.map((txHash, idx) => ({
      id: idx + 1,
      method: 'blockchain.transaction.get',
      params: [txHash]
    }));

    const prevResponses = await electrumCall(server, prevRequests);

    for (let m = 0; m < prevBatch.length; m++) {
      const prevResponse = prevResponses.get(m + 1);
      if (!prevResponse?.result || typeof prevResponse.result !== 'string') continue;

      const prevRawHex = prevResponse.result;
      const prevOutputs = parseRawTxOutputs(prevRawHex);
      const neededVouts = prevTxNeeded.get(prevBatch[m])!;

      for (const output of prevOutputs) {
        if (neededVouts.has(output.index)) {
          const addr = await scriptPubKeyToAddress(output.scriptHex);
          if (addr && addr !== walletAddress) {
            allSenders.add(addr);
          }
        }
      }
    }

    if (k + BATCH_SIZE < prevTxHashes.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  console.log(`[${correlationId}] Final: Found ${allSenders.size} unique senders`);
  return Array.from(allSenders);
}

// Check which senders are registered in the wallets table
async function checkSendersRegistration(
  supabase: any,
  senders: string[],
  correlationId: string
): Promise<SenderValidationResult> {
  if (senders.length === 0) {
    return { totalSenders: 0, registeredSenders: 0, unregisteredSenders: [], allRegistered: true };
  }

  const BATCH_SIZE = 50;
  const MAX_UNREGISTERED = 5;
  const registeredSet = new Set<string>();
  const unregisteredSenders: string[] = [];

  // Smart sampling for large sender lists
  if (senders.length > 100) {
    console.log(`[${correlationId}] Large sender list (${senders.length}), sampling first`);
    const shuffled = [...senders].sort(() => Math.random() - 0.5);
    const sample = shuffled.slice(0, 30);

    const { data: sampleRegistered } = await supabase
      .from('wallets')
      .select('wallet_id')
      .in('wallet_id', sample);

    const sampleRegisteredSet = new Set((sampleRegistered || []).map((w: any) => w.wallet_id));
    const sampleUnregistered = sample.filter(s => !sampleRegisteredSet.has(s));

    if (sampleUnregistered.length >= MAX_UNREGISTERED) {
      return {
        totalSenders: senders.length,
        registeredSenders: 0,
        unregisteredSenders: sampleUnregistered.slice(0, 10),
        allRegistered: false
      };
    }
  }

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

    if (unregisteredSenders.length >= MAX_UNREGISTERED) {
      console.log(`[${correlationId}] Found ${unregisteredSenders.length} unregistered, stopping early`);
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
