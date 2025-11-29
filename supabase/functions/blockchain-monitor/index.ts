import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Configuration constants
const MAX_BLOCKS_PER_RUN = 10;
const MAX_RPC_RETRIES = 3;
const RPC_RETRY_DELAY = 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting enhanced blockchain monitoring with gap detection...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get RPC node configuration from database
    const { data: rpcNodes, error: rpcError } = await supabase
      .from('rpc_nodes')
      .select('*')
      .limit(1)
      .single();

    if (rpcError || !rpcNodes) {
      throw new Error(`No RPC node configured: ${rpcError?.message}`);
    }

    const rpcUser = rpcNodes.username;
    const rpcPassword = rpcNodes.password;
    const RPC_HOST = rpcNodes.host;
    const RPC_PORT = rpcNodes.port;

    if (!rpcUser || !rpcPassword) {
      throw new Error('RPC credentials not configured');
    }

    const rpcUrl = `http://${RPC_HOST}:${RPC_PORT}/`;
    console.log(`Using RPC node: ${rpcNodes.name} (${RPC_HOST}:${RPC_PORT})`);

    // Enhanced RPC call function with retry logic
    async function rpcCall(method: string, params: any[] = [], retryCount = 0): Promise<any> {
      const payload = {
        jsonrpc: '1.0',
        id: 'supabase',
        method: method,
        params: params
      };

      try {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${rpcUser}:${rpcPassword}`)}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`RPC call failed: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.error) {
          throw new Error(`RPC error: ${JSON.stringify(result.error)}`);
        }

        return result.result;
      } catch (error) {
        if (retryCount < MAX_RPC_RETRIES) {
          console.log(`RPC call failed, retrying in ${RPC_RETRY_DELAY}ms... (attempt ${retryCount + 1}/${MAX_RPC_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, RPC_RETRY_DELAY));
          return rpcCall(method, params, retryCount + 1);
        }
        throw error;
      }
    }

    // Get current blockchain height
    const currentHeight = await rpcCall('getblockcount');
    console.log(`Current blockchain height: ${currentHeight}`);

    // Get last processed block from our database
    const { data: lastBlock } = await supabase
      .from('block_tx')
      .select('block_id')
      .order('block_id', { ascending: false })
      .limit(1)
      .single();

    // If no records exist, start from last 1000 blocks (approximately last week)
    const lastProcessedHeight = lastBlock?.block_id || Math.max(0, currentHeight - 1000);
    console.log(`Last processed height: ${lastProcessedHeight}`);

    // Calculate missing blocks
    const blocksToProcess = [];
    for (let height = lastProcessedHeight + 1; height <= currentHeight; height++) {
      blocksToProcess.push(height);
    }

    if (blocksToProcess.length === 0) {
      console.log('No new blocks to process');
      return new Response(JSON.stringify({
        message: 'No new blocks to process',
        currentHeight,
        lastProcessedHeight
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Log gap detection results
    if (blocksToProcess.length > 1) {
      console.log(`Gap detected! Found ${blocksToProcess.length} missing blocks: ${blocksToProcess[0]} to ${blocksToProcess[blocksToProcess.length - 1]}`);
    }

    // Process up to MAX_BLOCKS_PER_RUN blocks to prevent timeouts
    const blocksThisRun = blocksToProcess.slice(0, MAX_BLOCKS_PER_RUN);
    console.log(`Processing ${blocksThisRun.length} blocks this run: [${blocksThisRun.join(', ')}]`);

    // Get all registered wallet addresses once for efficiency
    const { data: registeredWallets } = await supabase
      .from('wallets')
      .select('wallet_id, id');

    const walletAddresses = new Set(registeredWallets?.map(w => w.wallet_id) || []);
    const walletMap = new Map(registeredWallets?.map(w => [w.wallet_id, w]) || []);

    let totalTransactionsProcessed = 0;
    let totalRegisteredTransactions = 0;
    let successfulBlocks = 0;
    let failedBlocks: number[] = [];

    // Process each block in the batch
    for (const blockHeight of blocksThisRun) {
      try {
        console.log(`Processing block ${blockHeight}...`);

        // Get block hash and block info (without verbosity parameter)
        const blockHash = await rpcCall('getblockhash', [blockHeight]);
        const blockInfo = await rpcCall('getblock', [blockHash]);

        console.log(`Block ${blockHeight} contains ${blockInfo.tx.length} transactions`);
        totalTransactionsProcessed += blockInfo.tx.length;

        let transactionsWithRegisteredWallets = 0;

        // Process each transaction in the block
        for (const txid of blockInfo.tx) {
          try {
            const tx = await rpcCall('getrawtransaction', [txid, 1]);

            // Collect sender addresses
            const senders = new Set<string>();
            if (tx.vin) {
              for (const vin of tx.vin) {
                if (vin.coinbase) {
                  senders.add('[COINBASE/STAKE]');
                } else if (vin.txid && vin.vout !== undefined) {
                  try {
                    const prevTx = await rpcCall('getrawtransaction', [vin.txid, 1]);
                    if (prevTx.vout && prevTx.vout[vin.vout]) {
                      const addr = prevTx.vout[vin.vout].scriptPubKey?.addresses?.[0];
                      if (addr) senders.add(addr);
                    }
                  } catch (e) {
                    console.log(`Error getting previous transaction ${vin.txid}: ${e}`);
                  }
                }
              }
            }

            // Collect receiver addresses and amounts
            const receivers: Array<{ address: string; amount: number }> = [];
            if (tx.vout) {
              for (const vout of tx.vout) {
                const addr = vout.scriptPubKey?.addresses?.[0];
                const amount = vout.value || 0;
                if (addr) {
                  receivers.push({ address: addr, amount });
                }
              }
            }

            // Check if any sender or receiver is a registered wallet
            const involvedWallets = new Set([
              ...senders,
              ...receivers.map(r => r.address)
            ]);
            const registeredInvolved = Array.from(involvedWallets).filter(addr => 
              walletAddresses.has(addr)
            );

            if (registeredInvolved.length > 0) {
              transactionsWithRegisteredWallets++;

              // Insert transaction records for each registered wallet involved
              for (const senderAddr of senders) {
                if (walletAddresses.has(senderAddr)) {
                  for (const receiver of receivers) {
                    if (walletAddresses.has(receiver.address)) {
                      // Both sender and receiver are registered
                      const senderWallet = walletMap.get(senderAddr);
                      const receiverWallet = walletMap.get(receiver.address);
                      
                      await supabase.from('transactions').insert({
                        from_wallet_id: senderWallet?.id,
                        to_wallet_id: receiverWallet?.id,
                        amount: receiver.amount,
                        block_id: blockHeight,
                        notes: `Blockchain transaction ${txid}`
                      });
                    } else {
                      // Only sender is registered
                      const senderWallet = walletMap.get(senderAddr);
                      
                      await supabase.from('transactions').insert({
                        from_wallet_id: senderWallet?.id,
                        to_wallet_id: null,
                        amount: receiver.amount,
                        block_id: blockHeight,
                        notes: `Outgoing blockchain transaction ${txid} to ${receiver.address}`
                      });
                    }
                  }
                } else {
                  // Check if any receiver is registered
                  for (const receiver of receivers) {
                    if (walletAddresses.has(receiver.address)) {
                      const receiverWallet = walletMap.get(receiver.address);
                      
                      await supabase.from('transactions').insert({
                        from_wallet_id: null,
                        to_wallet_id: receiverWallet?.id,
                        amount: receiver.amount,
                        block_id: blockHeight,
                        notes: `Incoming blockchain transaction ${txid} from ${Array.from(senders).join(', ')}`
                      });
                    }
                  }
                }
              }
            }
          } catch (txError) {
            console.log(`Error processing transaction ${txid} in block ${blockHeight}: ${txError}`);
          }
        }

        // Record block processing in database
        const timeStaked = new Date(blockInfo.time * 1000);
        const { error: blockInsertError } = await supabase.from('block_tx').insert({
          block_id: blockHeight,
          time_staked: timeStaked.toISOString(),
          all_block_transactions: blockInfo.tx.length,
          transaction_including_registered_wallets: transactionsWithRegisteredWallets
        });

        if (blockInsertError) {
          throw new Error(`Failed to insert block record: ${blockInsertError.message}`);
        }

        totalRegisteredTransactions += transactionsWithRegisteredWallets;
        successfulBlocks++;
        console.log(`✅ Successfully processed block ${blockHeight}: ${blockInfo.tx.length} total transactions, ${transactionsWithRegisteredWallets} involving registered wallets`);

      } catch (blockError) {
        console.error(`❌ Failed to process block ${blockHeight}:`, blockError);
        failedBlocks.push(blockHeight);
        // Continue processing other blocks instead of failing completely
      }
    }

    // Prepare response with detailed statistics
    const remainingBlocks = blocksToProcess.length - blocksThisRun.length;
    const response = {
      success: true,
      processedBlocks: blocksThisRun.length,
      successfulBlocks,
      failedBlocks,
      totalTransactionsProcessed,
      totalRegisteredTransactions,
      currentHeight,
      lastProcessedHeight,
      remainingBlocks,
      nextBlocksToProcess: remainingBlocks > 0 ? blocksToProcess.slice(MAX_BLOCKS_PER_RUN, MAX_BLOCKS_PER_RUN + 5) : [],
      gapDetected: blocksToProcess.length > 1,
      blocksProcessedThisRun: blocksThisRun
    };

    console.log(`🎯 Batch completed: ${successfulBlocks}/${blocksThisRun.length} blocks processed successfully`);
    
    if (remainingBlocks > 0) {
      console.log(`⏳ ${remainingBlocks} blocks remaining for next run`);
    }
    
    if (failedBlocks.length > 0) {
      console.log(`⚠️ Failed blocks: [${failedBlocks.join(', ')}]`);
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Critical blockchain monitoring error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
