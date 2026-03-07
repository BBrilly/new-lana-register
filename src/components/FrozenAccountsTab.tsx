import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FrozenWallet {
  id: string;
  wallet_id: string | null;
  wallet_type: string;
  frozen: boolean;
  owner_name: string | null;
  owner_display_name: string | null;
  nostr_hex_id: string | null;
}

const FrozenAccountsTab = () => {
  const { data: frozenWallets, isLoading } = useQuery({
    queryKey: ["frozen-wallets-admin"],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const allWallets: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("wallets")
          .select(`id, wallet_id, wallet_type, frozen, main_wallet:main_wallets(name, display_name, nostr_hex_id)`)
          .eq("frozen", true)
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) { hasMore = false; }
        else {
          allWallets.push(...data);
          hasMore = data.length === PAGE_SIZE;
          offset += PAGE_SIZE;
        }
      }

      return allWallets.map((w): FrozenWallet => ({
        id: w.id,
        wallet_id: w.wallet_id,
        wallet_type: w.wallet_type,
        frozen: w.frozen,
        owner_name: (w.main_wallet as any)?.name || null,
        owner_display_name: (w.main_wallet as any)?.display_name || null,
        nostr_hex_id: (w.main_wallet as any)?.nostr_hex_id || null,
      }));
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-destructive" />
          <CardTitle>Frozen Accounts</CardTitle>
        </div>
        <CardDescription>
          All wallets currently marked as frozen ({frozenWallets?.length ?? 0} total)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !frozenWallets || frozenWallets.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No frozen wallets found
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Wallet Type</TableHead>
                  <TableHead>Wallet Address</TableHead>
                  <TableHead>Nostr Hex ID</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {frozenWallets.map((wallet, index) => (
                  <TableRow key={wallet.id}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      {wallet.owner_display_name || wallet.owner_name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{wallet.wallet_type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {wallet.wallet_id
                        ? `${wallet.wallet_id.slice(0, 8)}...${wallet.wallet_id.slice(-6)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {wallet.nostr_hex_id
                        ? `${wallet.nostr_hex_id.slice(0, 8)}...`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="gap-1">
                        <Lock className="h-3 w-3" />
                        Frozen
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FrozenAccountsTab;
