import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, ArrowUpDown, Check, Copy, AlertTriangle } from "lucide-react";
import { WalletWithBalance, FxLimits } from "@/hooks/usePublicWalletBalances";
import { cn } from "@/lib/utils";

interface Props {
  wallets: WalletWithBalance[];
  isLoading: boolean;
  totalBalance: number;
  title: string;
  subtitle: string;
  emptyMessage: string;
  showWalletType?: boolean;
  sortField: 'name' | 'balance' | 'wallet_type';
  sortDirection: 'asc' | 'desc';
  toggleSort: (field: 'name' | 'balance' | 'wallet_type') => void;
  copiedId: string | null;
  copyWalletId: (id: string) => void;
  fxRates?: FxLimits | null;
  lanaLimits?: { EUR: number; GBP: number; USD: number } | null;
}

const PublicWalletTable = ({
  wallets, isLoading, totalBalance, title, subtitle, emptyMessage,
  showWalletType = false, sortField, sortDirection, toggleSort, copiedId, copyWalletId,
  fxRates, lanaLimits
}: Props) => {
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  // Use EUR limit as the threshold (most common)
  const lanaLimit = lanaLimits?.EUR ?? null;
  const isOverLimit = (balance: number) => lanaLimit !== null && balance > lanaLimit;

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle} ({wallets.length} wallets)</p>
        </div>
        <div className="text-right">
          <span className="text-sm text-muted-foreground">Total: </span>
          <span className="font-bold text-lg text-primary">
            {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 })} LANA
          </span>
        </div>
      </div>

      {/* FX Limit Info */}
      {lanaLimits && fxRates && (
        <div className="mb-4 p-3 rounded-lg border bg-muted/30 flex flex-wrap gap-4 items-center text-sm">
          <span className="font-medium text-muted-foreground">50 unit limit in LANA:</span>
          <Badge variant="outline" className="gap-1">
            EUR: {lanaLimits.EUR.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LANA
          </Badge>
          <Badge variant="outline" className="gap-1">
            GBP: {lanaLimits.GBP.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LANA
          </Badge>
          <Badge variant="outline" className="gap-1">
            USD: {lanaLimits.USD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LANA
          </Badge>
          <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-destructive" />
            Red = over 50 EUR limit
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" className="gap-1 -ml-3 font-medium" onClick={() => toggleSort('name')}>
                    Name <SortIcon field="name" />
                  </Button>
                </TableHead>
                {showWalletType && (
                  <TableHead>
                    <Button variant="ghost" size="sm" className="gap-1 -ml-3 font-medium" onClick={() => toggleSort('wallet_type')}>
                      Wallet Type <SortIcon field="wallet_type" />
                    </Button>
                  </TableHead>
                )}
                <TableHead>Wallet ID</TableHead>
                <TableHead className="text-center">Split</TableHead>
                <TableHead className="text-right">
                  <Button variant="ghost" size="sm" className="gap-1 -mr-3 font-medium" onClick={() => toggleSort('balance')}>
                    Balance <SortIcon field="balance" />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wallets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showWalletType ? 6 : 5} className="text-center text-muted-foreground py-8">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                wallets.map((wallet, index) => {
                  const overLimit = isOverLimit(wallet.balance);
                  return (
                    <TableRow key={wallet.id} className={cn(overLimit && "bg-destructive/10 hover:bg-destructive/15")}>
                      <TableCell className={cn("font-medium text-muted-foreground", overLimit && "text-destructive")}>{index + 1}</TableCell>
                      <TableCell>
                        <span className={cn("font-medium", overLimit && "text-destructive font-semibold")}>
                          {wallet.display_name || wallet.name || '-'}
                        </span>
                      </TableCell>
                      {showWalletType && (
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{wallet.wallet_type}</Badge>
                        </TableCell>
                      )}
                      <TableCell>
                        {wallet.wallet_id ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              {`${wallet.wallet_id.substring(0, 8)}...${wallet.wallet_id.slice(-6)}`}
                            </span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyWalletId(wallet.wallet_id!)}>
                              {copiedId === wallet.wallet_id ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {wallet.split_created != null ? (
                          <Badge variant="outline" className="text-xs font-mono">#{wallet.split_created}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className={cn("text-right font-semibold", overLimit && "text-destructive")}>
                        {overLimit && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                        {wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 })} LANA
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default PublicWalletTable;
