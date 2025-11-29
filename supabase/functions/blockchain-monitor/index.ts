import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Transaction {
  txid: string;
  vin: Array<{ txid?: string; vout?: number; addresses?: string[] }>;
  vout: Array<{ value: number; scriptPubKey: { addresses?: string[] } }>;
}

interface BlockInfo {
  hash: string;
  height: number;
  tx: string[];
  time: number;
}

interface RpcNode {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
}

const MAX_BLOCKS_PER_RUN = 10;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('=== BLOCKCHAIN MONITOR START ===');

    // 1. Pridobi RPC node iz tabele (vzame prvega)
    const { data: rpcNodes, error: rpcError } = await supabase
      .from('rpc_nodes')
      .select('*')
      .limit(1)
      .single();

    if (rpcError || !rpcNodes) {
      throw new Error(`No RPC node configured: ${rpcError?.message}`);
    }

    const rpcNode: RpcNode = rpcNodes;
    console.log(`Using RPC node: ${rpcNode.name} (${rpcNode.host}:${rpcNode.port})`);

    // RPC call helper funkcija
    const rpcCall = async (method: string, params: any[] = [], retries = 3): Promise<any> => {
      const auth = rpcNode.username && rpcNode.password 
        ? btoa(`${rpcNode.username}:${rpcNode.password}`)
        : null;
      
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const payload = {
            jsonrpc: '2.0',
            id: method,
            method,
            params,
          };
          
          console.log(`RPC Request (${method}):`, JSON.stringify(payload));
          
          const response = await fetch(`http://${rpcNode.host}:${rpcNode.port}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(auth && { 'Authorization': `Basic ${auth}` }),
            },
            body: JSON.stringify(payload),
          });

          const responseText = await response.text();
          console.log(`RPC Response (${method}, status ${response.status}):`, responseText);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${responseText}`);
          }

          const data = JSON.parse(responseText);
          if (data.error) {
            throw new Error(`RPC Error: ${JSON.stringify(data.error)}`);
          }
          return data.result;
        } catch (error) {
          console.error(`RPC call attempt ${attempt}/${retries} failed:`, error);
          if (attempt === retries) throw error;
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    };

    // 2. Pridobi trenutno višino blockchaina
    const currentHeight = await rpcCall('getblockcount');
    console.log(`Current blockchain height: ${currentHeight}`);

    // 3. Pridobi zadnji procesiran blok iz baze
    const { data: lastBlock } = await supabase
      .from('block_tx')
      .select('block_id')
      .order('block_id', { ascending: false })
      .limit(1)
      .single();

    const lastProcessedBlock = lastBlock?.block_id || 0;
    console.log(`Last processed block: ${lastProcessedBlock}`);

    // 4. Preveri za gaps (manjkajoče bloke)
    if (lastProcessedBlock > 0) {
      const { data: gaps } = await supabase
        .from('block_tx')
        .select('block_id')
        .order('block_id', { ascending: true });

      if (gaps && gaps.length > 0) {
        const blockIds = gaps.map(g => g.block_id);
        for (let i = 1; i < blockIds.length; i++) {
          if (blockIds[i] - blockIds[i-1] > 1) {
            console.warn(`GAP DETECTED: blocks ${blockIds[i-1]+1} to ${blockIds[i]-1}`);
          }
        }
      }
    }

    // 5. Pridobi registrirane denarnice za hitro iskanje
    const { data: registeredWallets } = await supabase
      .from('wallets')
      .select('id, wallet_id');

    const walletMap = new Map<string, string>();
    registeredWallets?.forEach(w => {
      if (w.wallet_id) {
        walletMap.set(w.wallet_id.toLowerCase(), w.id);
      }
    });
    console.log(`Loaded ${walletMap.size} registered wallets`);

    // 6. Procesiraj nove bloke
    const startBlock = lastProcessedBlock + 1;
    const endBlock = Math.min(currentHeight, startBlock + MAX_BLOCKS_PER_RUN - 1);
    
    let blocksProcessed = 0;
    let transactionsFound = 0;

    for (let height = startBlock; height <= endBlock; height++) {
      console.log(`Processing block ${height}...`);

      const blockHash = await rpcCall('getblockhash', [height]);
      const block: BlockInfo = await rpcCall('getblock', [blockHash, true]);

      let blockTxCount = 0;
      let registeredTxCount = 0;

      // Procesiraj vsako transakcijo v bloku
      for (const txid of block.tx) {
        blockTxCount++;

        try {
          const tx: Transaction = await rpcCall('getrawtransaction', [txid, true]);
          
          let fromWalletId: string | null = null;
          let toWalletId: string | null = null;
          let amount = 0;

          // Preveri vhode (pošiljatelji)
          for (const vin of tx.vin) {
            if (vin.addresses) {
              for (const addr of vin.addresses) {
                const walletUuid = walletMap.get(addr.toLowerCase());
                if (walletUuid) {
                  fromWalletId = walletUuid;
                  break;
                }
              }
            }
          }

          // Preveri izhode (prejemniki)
          for (const vout of tx.vout) {
            if (vout.scriptPubKey.addresses) {
              for (const addr of vout.scriptPubKey.addresses) {
                const walletUuid = walletMap.get(addr.toLowerCase());
                if (walletUuid) {
                  toWalletId = walletUuid;
                  amount = vout.value;
                  break;
                }
              }
            }
          }

          // Če je vključena registrirana denarnica, shrani transakcijo
          if (fromWalletId || toWalletId) {
            registeredTxCount++;
            transactionsFound++;

            await supabase.from('transactions').insert({
              from_wallet_id: fromWalletId,
              to_wallet_id: toWalletId,
              amount: amount,
              block_id: height,
              notes: `TX: ${txid}`,
            });

            console.log(`  Found registered TX: ${txid}`);
          }
        } catch (txError) {
          console.error(`  Error processing TX ${txid}:`, txError);
        }
      }

      // Zapiši block_tx zapis
      await supabase.from('block_tx').insert({
        block_id: height,
        all_block_transactions: blockTxCount,
        transaction_including_registered_wallets: registeredTxCount,
        time_staked: new Date(block.time * 1000).toISOString(),
      });

      blocksProcessed++;
      console.log(`Block ${height}: ${blockTxCount} total TX, ${registeredTxCount} registered`);
    }

    const result = {
      success: true,
      rpcNode: rpcNode.name,
      currentHeight,
      lastProcessedBlock,
      blocksProcessed,
      transactionsFound,
      range: blocksProcessed > 0 ? `${startBlock}-${endBlock}` : 'none',
    };

    console.log('=== BLOCKCHAIN MONITOR END ===', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('BLOCKCHAIN MONITOR ERROR:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
