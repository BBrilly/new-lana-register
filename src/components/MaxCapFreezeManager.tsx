import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Search, Snowflake, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WalletCandidate {
  id: string;
  wallet_id: string;
  wallet_type: string;
  balance: number;
  owner_name: string;
  nostr_hex_id: string;
  main_wallet_id: string;
}

const MaxCapFreezeManager = () => {
  const [threshold, setThreshold] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [candidates, setCandidates] = useState<WalletCandidate[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [freezingId, setFreezingId] = useState<string | null>(null);

  const handleAnalyze = async () => {
    const num = parseFloat(threshold);
    if (isNaN(num) || num <= 0) {
      toast.error("Vnesi veljavno pozitivno število LANA");
      return;
    }

    setIsAnalyzing(true);
    setCandidates([]);
    setAnalyzed(false);

    try {
      // Fetch all unfrozen wallets of type 'main wallet' or 'wallet' with pagination
      const PAGE_SIZE = 1000;
      let allWallets: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error } = await supabase
          .from("wallets")
          .select("id, wallet_id, wallet_type, main_wallet_id")
          .in("wallet_type", ["main wallet", "wallet"])
          .eq("frozen", false)
          .not("wallet_id", "is", null)
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        if (batch && batch.length > 0) {
          allWallets = [...allWallets, ...batch];
          offset += PAGE_SIZE;
          hasMore = batch.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      if (allWallets.length === 0) {
        toast.info("Ni najdenih nezamrznjenih denarnic tipa 'main wallet' ali 'wallet'");
        setAnalyzed(true);
        setIsAnalyzing(false);
        return;
      }

      // Fetch main_wallets for owner names
      const mainWalletIds = [...new Set(allWallets.map(w => w.main_wallet_id))];
      const mainWalletMap = new Map<string, { name: string; nostr_hex_id: string }>();

      for (let i = 0; i < mainWalletIds.length; i += PAGE_SIZE) {
        const batch = mainWalletIds.slice(i, i + PAGE_SIZE);
        const { data: mwBatch, error } = await supabase
          .from("main_wallets")
          .select("id, name, display_name, nostr_hex_id")
          .in("id", batch);
        if (error) throw error;
        mwBatch?.forEach((mw: any) => {
          mainWalletMap.set(mw.id, {
            name: mw.display_name || mw.name,
            nostr_hex_id: mw.nostr_hex_id,
          });
        });
      }

      // Fetch electrum servers
      const { data: sysParams, error: paramsError } = await supabase
        .from("system_parameters")
        .select("electrum")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (paramsError) throw paramsError;

      // Fetch balances in batches of 50
      const BATCH_SIZE = 50;
      const balanceMap = new Map<string, number>();
      const addresses = allWallets.map(w => w.wallet_id as string);

      for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
        const batch = addresses.slice(i, i + BATCH_SIZE);
        const { data: balancesData, error: balanceError } = await supabase.functions.invoke(
          "fetch-wallet-balance",
          { body: { wallet_addresses: batch, electrum_servers: sysParams.electrum } }
        );
        if (balanceError) {
          console.error("Balance fetch error:", balanceError);
          continue;
        }
        if (balancesData?.wallets) {
          balancesData.wallets.forEach((wb: any) => balanceMap.set(wb.wallet_id, wb.balance || 0));
        }
      }

      // Filter by threshold and build candidates
      const results: WalletCandidate[] = allWallets
        .map(w => {
          const balance = balanceMap.get(w.wallet_id) || 0;
          const owner = mainWalletMap.get(w.main_wallet_id);
          return {
            id: w.id,
            wallet_id: w.wallet_id,
            wallet_type: w.wallet_type,
            balance,
            owner_name: owner?.name || "Unknown",
            nostr_hex_id: owner?.nostr_hex_id || "",
            main_wallet_id: w.main_wallet_id,
          };
        })
        .filter(w => w.balance > num)
        .sort((a, b) => b.balance - a.balance);

      setCandidates(results);
      setAnalyzed(true);

      if (results.length === 0) {
        toast.info(`Nobena denarnica nima stanja višjega od ${num} LANA`);
      } else {
        toast.success(`Najdenih ${results.length} denarnic s stanjem nad ${num} LANA`);
      }
    } catch (err: any) {
      console.error("Analyze error:", err);
      toast.error(err.message || "Napaka pri analizi");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFreeze = async (wallet: WalletCandidate) => {
    setFreezingId(wallet.id);
    try {
      const { error } = await supabase.functions.invoke("freeze-wallets", {
        body: {
          wallet_ids: [wallet.id],
          freeze: true,
          freeze_reason: "frozen_max_cap",
          nostr_hex_id: wallet.nostr_hex_id,
        },
      });

      if (error) throw error;

      // Remove from list
      setCandidates(prev => prev.filter(c => c.id !== wallet.id));
      toast.success(`Denarnica ${wallet.wallet_id.slice(0, 12)}... zamrznjena (frozen_max_cap)`);
    } catch (err: any) {
      console.error("Freeze error:", err);
      toast.error(err.message || "Napaka pri zamrznitvi");
    } finally {
      setFreezingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Max Cap – Zamrzni po znesku
          </CardTitle>
          <CardDescription>
            Vnesi znesek LANA. Sistem bo poiskal vse nezamrznjene denarnice tipa "main wallet" in "wallet" s stanjem višjim od tega zneska. Zamrzneš jih lahko enega po enega.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Znesek LANA (npr. 1000)"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            />
            <Button onClick={handleAnalyze} disabled={isAnalyzing} className="gap-2 shrink-0">
              {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Analiziraj
            </Button>
          </div>
        </CardContent>
      </Card>

      {isAnalyzing && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {analyzed && !isAnalyzing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Rezultati ({candidates.length} denarnic)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {candidates.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Ni denarnic nad podanim zneskom
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lastnik</TableHead>
                      <TableHead>Naslov denarnice</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead className="text-right">Stanje (LANA)</TableHead>
                      <TableHead className="text-center">Akcija</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.owner_name}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {w.wallet_id}
                        </TableCell>
                        <TableCell>{w.wallet_type}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {w.balance.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="gap-1"
                            disabled={freezingId === w.id}
                            onClick={() => handleFreeze(w)}
                          >
                            {freezingId === w.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Snowflake className="h-3 w-3" />
                            )}
                            Zamrzni
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MaxCapFreezeManager;
