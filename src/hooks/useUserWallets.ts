import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet } from "@/types/wallet";
import { getAuthSession } from "@/utils/wifAuth"
import { useWalletBalances } from "./useWalletBalances";

export const useUserWallets = () => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletIds, setWalletIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { balances, fxRates, userCurrency, isLoading: isLoadingBalances } = useWalletBalances(walletIds);

  const refetch = () => setRefreshKey(k => k + 1);

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

        // Extract wallet IDs for balance fetching
        const ids = (walletsData || [])
          .map((w) => w.wallet_id)
          .filter((id): id is string => id !== null);
        setWalletIds(ids);

        // Map database data to Wallet interface
        const mappedWallets: Wallet[] = (walletsData || []).map((w) => ({
          id: w.id,
          walletNumber: w.wallet_id || "N/A",
          type: w.wallet_type,
          description: w.notes || "No description",
          lanAmount: 0, // Will be updated when balances are loaded
          eurAmount: 0, // Will be updated when balances are loaded
          events: [], // MOCK - will be implemented later
          notification: undefined, // MOCK - will be implemented later
        }));

        // Sort wallets by type priority: Main → LanaPays.Us → Knights → others → Lana8Wonder
        const getTypePriority = (type: string, notes: string): number => {
          const typeLower = type.toLowerCase();
          if (typeLower.includes("main")) return 0;
          if (typeLower.includes("lanapays")) return 1;
          if (typeLower.includes("knight")) return 2;
          if (typeLower.includes("lana8wonder")) return 999; // Always last
          return 3; // Other types
        };

        // Extract number from notes for Lana8Wonder sorting
        const getNotesNumber = (notes: string): number => {
          const match = notes.match(/(\d+)/);
          return match ? parseInt(match[1], 10) : 999999;
        };

        const sortedWallets = mappedWallets.sort((a, b) => {
          const priorityA = getTypePriority(a.type, a.description);
          const priorityB = getTypePriority(b.type, b.description);
          
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }
          
          // If both are Lana8Wonder, sort by number in notes
          if (a.type.toLowerCase().includes("lana8wonder") && b.type.toLowerCase().includes("lana8wonder")) {
            return getNotesNumber(a.description) - getNotesNumber(b.description);
          }
          
          return 0;
        });

        setWallets(sortedWallets);
      } catch (err) {
        console.error("Error fetching wallets:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch wallets");
        setWallets([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWallets();
  }, [refreshKey]);

  // Update wallet balances when balances are loaded
  useEffect(() => {
    if (balances.size > 0 && wallets.length > 0 && fxRates) {
      // Get the exchange rate for user's currency
      const exchangeRate = fxRates[userCurrency as keyof typeof fxRates] || fxRates.EUR;
      
      const updatedWallets = wallets.map((wallet) => {
        const balance = balances.get(wallet.walletNumber) || 0;
        return {
          ...wallet,
          lanAmount: balance,
          eurAmount: balance * exchangeRate,
        };
      });
      setWallets(updatedWallets);
    }
  }, [balances, fxRates, userCurrency]);

  return { wallets, isLoading: isLoading || isLoadingBalances, error, fxRates, userCurrency, refetch };
};
