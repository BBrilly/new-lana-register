import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet } from "@/types/wallet";
import { getAuthSession } from "@/utils/wifAuth";

export const useUserWallets = () => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWallets = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get nostrHexId from session
        const authSession = getAuthSession();
        if (!authSession) {
          // Not logged in - return empty list without error
          setWallets([]);
          setIsLoading(false);
          return;
        }

        const nostrHexId = authSession.nostrHexId;

        if (!nostrHexId) {
          throw new Error("No nostr hex ID found in session");
        }

        // Fetch main wallet
        const { data: mainWalletData, error: mainWalletError } = await supabase
          .from("main_wallets")
          .select("*")
          .eq("nostr_hex_id", nostrHexId)
          .maybeSingle();

        if (mainWalletError) {
          throw mainWalletError;
        }

        if (!mainWalletData) {
          // No main wallet found - return empty array
          setWallets([]);
          setIsLoading(false);
          return;
        }

        // Fetch all wallets for this main wallet
        const { data: walletsData, error: walletsError } = await supabase
          .from("wallets")
          .select("*")
          .eq("main_wallet_id", mainWalletData.id);

        if (walletsError) {
          throw walletsError;
        }

        // Map database data to Wallet interface
        const mappedWallets: Wallet[] = (walletsData || []).map((w) => ({
          id: w.id,
          walletNumber: w.wallet_id || "N/A",
          type: w.wallet_type,
          description: w.notes || "No description",
          lanAmount: 0, // MOCK - will be implemented later
          eurAmount: 0, // MOCK - will be implemented later
          events: [], // MOCK - will be implemented later
          notification: undefined, // MOCK - will be implemented later
        }));

        setWallets(mappedWallets);
      } catch (err) {
        console.error("Error fetching wallets:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch wallets");
        setWallets([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWallets();
  }, []);

  return { wallets, isLoading, error };
};
