import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FrozenWalletWithBalance {
  id: string;
  wallet_id: string | null;
  wallet_type: string;
  name: string | null;
  display_name: string | null;
  balance: number;
  nostr_hex_id?: string;
  split_created: number | null;
}

export const useFrozenWallets = () => {
  const [wallets, setWallets] = useState<FrozenWalletWithBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'name' | 'balance' | 'wallet_type'>('balance');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);

        // Fetch all frozen wallets with pagination
        const allWallets: any[] = [];
        const PAGE_SIZE = 1000;
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('wallets')
            .select(`id, wallet_id, wallet_type, main_wallet_id, main_wallet:main_wallets(name, display_name, nostr_hex_id)`)
            .eq('frozen', true)
            .range(offset, offset + PAGE_SIZE - 1);

          if (error) throw error;
          if (!data || data.length === 0) { hasMore = false; }
          else {
            allWallets.push(...data);
            hasMore = data.length === PAGE_SIZE;
            offset += PAGE_SIZE;
          }
        }

        if (allWallets.length === 0) { setWallets([]); return; }

        const walletAddresses = allWallets.filter(w => w.wallet_id).map(w => w.wallet_id as string);

        if (walletAddresses.length === 0) {
          setWallets(allWallets.map(w => ({
            id: w.id,
            wallet_id: w.wallet_id,
            wallet_type: w.wallet_type,
            name: (w.main_wallet as any)?.name || null,
            display_name: (w.main_wallet as any)?.display_name || null,
            balance: 0,
            nostr_hex_id: (w.main_wallet as any)?.nostr_hex_id || undefined,
          })));
          return;
        }

        // Fetch electrum servers
        const { data: sysParams } = await supabase
          .from('system_parameters')
          .select('electrum')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!sysParams?.electrum) {
          console.error('No Electrum servers');
          return;
        }

        const electrumServers = (sysParams.electrum as any[]).map(s => ({
          host: s.host, port: parseInt(s.port, 10)
        }));

        const { data: balanceData, error: balanceError } = await supabase.functions.invoke(
          'fetch-wallet-balance',
          { body: { wallet_addresses: walletAddresses, electrum_servers: electrumServers } }
        );

        if (balanceError) console.error('Balance error:', balanceError);

        const balanceMap = new Map<string, number>();
        if (balanceData?.wallets) {
          balanceData.wallets.forEach((w: any) => balanceMap.set(w.wallet_id, w.balance || 0));
        }

        setWallets(allWallets.map(w => ({
          id: w.id,
          wallet_id: w.wallet_id,
          wallet_type: w.wallet_type,
          name: (w.main_wallet as any)?.name || null,
          display_name: (w.main_wallet as any)?.display_name || null,
          balance: balanceMap.get(w.wallet_id || '') || 0,
          nostr_hex_id: (w.main_wallet as any)?.nostr_hex_id || undefined,
        })));
      } catch (err) {
        console.error('Error loading frozen wallets:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const sortWallets = (list: FrozenWalletWithBalance[]) => {
    return [...list].sort((a, b) => {
      if (sortField === 'balance') {
        return sortDirection === 'desc' ? b.balance - a.balance : a.balance - b.balance;
      } else if (sortField === 'wallet_type') {
        return sortDirection === 'desc'
          ? b.wallet_type.toLowerCase().localeCompare(a.wallet_type.toLowerCase())
          : a.wallet_type.toLowerCase().localeCompare(b.wallet_type.toLowerCase());
      } else {
        const nameA = (a.display_name || a.name || '').toLowerCase();
        const nameB = (b.display_name || b.name || '').toLowerCase();
        return sortDirection === 'desc' ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
      }
    });
  };

  const toggleSort = (field: 'name' | 'balance' | 'wallet_type') => {
    if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('desc'); }
  };

  const copyWalletId = (walletId: string) => {
    navigator.clipboard.writeText(walletId);
    setCopiedId(walletId);
    toast.success('Wallet ID copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalBalance = useMemo(() => wallets.reduce((s, w) => s + w.balance, 0), [wallets]);
  const sorted = useMemo(() => sortWallets(wallets), [wallets, sortField, sortDirection]);

  return { wallets, sorted, totalBalance, isLoading, copiedId, sortField, sortDirection, toggleSort, copyWalletId };
};
