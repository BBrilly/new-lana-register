import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WalletBalance {
  wallet_id: string;
  balance: number;
  status: string;
  error?: string;
}

interface BalanceResponse {
  success: boolean;
  total_balance: number;
  wallets: WalletBalance[];
  success_count: number;
  error_count: number;
  timestamp: string;
  error?: string;
}

export const useWalletBalances = (walletIds: string[]) => {
  const [balances, setBalances] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalances = async () => {
      if (walletIds.length === 0) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Fetch system parameters to get Electrum servers
        const { data: systemParams, error: paramsError } = await supabase
          .from("system_parameters")
          .select("electrum")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (paramsError) {
          throw paramsError;
        }

        if (!systemParams || !systemParams.electrum) {
          throw new Error("No Electrum servers configured in system parameters");
        }

        // Parse electrum servers from system parameters
        const electrumServers = (systemParams.electrum as any[]).map(server => ({
          host: server.host,
          port: parseInt(server.port, 10)
        }));

        if (electrumServers.length === 0) {
          throw new Error("No Electrum servers available");
        }

        console.log(`Fetching balances for ${walletIds.length} wallets using ${electrumServers.length} Electrum servers`);

        // Call the edge function
        const { data, error: functionError } = await supabase.functions.invoke<BalanceResponse>(
          "fetch-wallet-balance",
          {
            body: {
              wallet_addresses: walletIds,
              electrum_servers: electrumServers,
            },
          }
        );

        if (functionError) {
          throw functionError;
        }

        if (!data || !data.success) {
          throw new Error(data?.error || "Failed to fetch wallet balances");
        }

        // Create a map of wallet_id -> balance
        const balanceMap = new Map<string, number>();
        data.wallets.forEach((wallet) => {
          balanceMap.set(wallet.wallet_id, wallet.balance);
        });

        setBalances(balanceMap);
        console.log(`Successfully fetched ${data.success_count} wallet balances`);
      } catch (err) {
        console.error("Error fetching wallet balances:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch wallet balances");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalances();
  }, [walletIds.join(",")]); // Re-fetch when wallet IDs change

  return { balances, isLoading, error };
};
