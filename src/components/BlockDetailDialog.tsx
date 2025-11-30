import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Database, Activity, TrendingUp, Package, ChevronDown, ChevronRight } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface BlockDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockId: string;
  blockData: {
    stakedTime: string;
    auditTime: string;
    totalTx: number;
    registeredTx: number;
    coverage: number;
  };
}

interface WalletInfo {
  wallet_id: string | null;
  wallet_type: string;
}

interface BlockTransaction {
  id: string;
  amount: number;
  from_wallet: WalletInfo | null;
  to_wallet: WalletInfo | null;
  notes: string | null;
}

const BlockDetailDialog = ({ open, onOpenChange, blockId, blockData }: BlockDetailDialogProps) => {
  const [transactions, setTransactions] = useState<BlockTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const TRANSACTIONS_PER_PAGE = 50;

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setCurrentPage(1);
      
      const fetchTransactions = async () => {
        try {
          const { data, error } = await supabase
            .from('transactions')
            .select(`
              id,
              amount,
              notes,
              from_wallet:wallets!from_wallet_id(wallet_id, wallet_type),
              to_wallet:wallets!to_wallet_id(wallet_id, wallet_type)
            `)
            .eq('block_id', parseInt(blockId));

          if (error) {
            console.error('Error fetching transactions:', error);
            setTransactions([]);
          } else {
            setTransactions(data || []);
          }
        } catch (err) {
          console.error('Failed to fetch transactions:', err);
          setTransactions([]);
        } finally {
          setIsLoading(false);
        }
      };

      fetchTransactions();
    }
  }, [open, blockId]);

  const totalValue = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

  // Pagination logic
  const totalPages = Math.ceil(transactions.length / TRANSACTIONS_PER_PAGE);
  const startIndex = (currentPage - 1) * TRANSACTIONS_PER_PAGE;
  const endIndex = startIndex + TRANSACTIONS_PER_PAGE;
  const currentTransactions = transactions.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 10;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 6) {
        for (let i = 1; i <= 8; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 5) {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 7; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Block {blockId} Details
          </DialogTitle>
          <DialogDescription>
            Transaction statistics and details for this block
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Block Summary */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-3">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Staked Time</p>
                  <p className="font-semibold">{blockData.stakedTime}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-3">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Audit Time</p>
                  <p className="font-semibold">{blockData.auditTime}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Transaction Statistics */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Transaction Statistics
            </h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <p className="text-2xl font-bold">{transactions.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Registered Transactions</p>
                <p className="text-2xl font-bold">{transactions.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">{totalValue.toFixed(4)} LANA</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Registered Transactions</p>
                  <p className="text-xl font-semibold text-primary">{blockData.registeredTx}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Coverage</p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${blockData.coverage}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold">{blockData.coverage}%</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Transactions Table */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Block Transactions
            </h3>
            
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>From Wallet</TableHead>
                      <TableHead>To Wallet</TableHead>
                      <TableHead className="text-right">Amount (LANA)</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentTransactions.map((tx, index) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium">{startIndex + index + 1}</TableCell>
                        <TableCell>
                          {tx.from_wallet ? (
                            <div>
                              <div className="font-mono text-xs">{tx.from_wallet.wallet_id}</div>
                              <div className="text-xs text-muted-foreground">{tx.from_wallet.wallet_type}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Unknown</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {tx.to_wallet ? (
                            <div>
                              <div className="font-mono text-xs">{tx.to_wallet.wallet_id}</div>
                              <div className="text-xs text-muted-foreground">{tx.to_wallet.wallet_type}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Unknown</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {Number(tx.amount).toFixed(4)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {tx.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Showing {startIndex + 1} to {Math.min(endIndex, transactions.length)} of {transactions.length} transactions
                    </div>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        
                        {getPageNumbers().map((page, idx) => (
                          page === 'ellipsis' ? (
                            <PaginationItem key={`ellipsis-${idx}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          ) : (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setCurrentPage(page as number)}
                                isActive={currentPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        ))}
                        
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BlockDetailDialog;
