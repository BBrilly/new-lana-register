import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Database, Activity, TrendingUp, Package, ArrowRight } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { supabase } from "@/integrations/supabase/client";

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

interface BlockTransaction {
  id: string;
  amount: number;
  from_wallet_id: string | null;
  to_wallet_id: string | null;
  notes: string | null;
  created_at: string | null;
  to_wallet: {
    wallet_id: string | null;
    wallet_type: string;
  } | null;
}

interface TransactionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BlockTransaction | null;
}

const TransactionDetailDialog = ({ open, onOpenChange, transaction }: TransactionDetailDialogProps) => {
  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Transaction Outputs
          </DialogTitle>
          <DialogDescription>
            Details of transaction outputs
          </DialogDescription>
        </DialogHeader>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">From Wallet</p>
                <p className="font-mono text-sm">{transaction.from_wallet_id || "N/A"}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">To Wallet</p>
                <p className="font-mono text-sm">{transaction.to_wallet_id || "N/A"}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-2xl font-bold">{transaction.amount} LAN</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Wallet Type</p>
                <Badge variant="outline">{transaction.to_wallet?.wallet_type || "Unknown"}</Badge>
              </div>
            </div>

            {transaction.notes && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-sm">{transaction.notes}</p>
              </div>
            )}
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

const BlockDetailDialog = ({ open, onOpenChange, blockId, blockData }: BlockDetailDialogProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState<BlockTransaction | null>(null);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const TRANSACTIONS_PER_PAGE = 50;

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["block-transactions", blockId],
    queryFn: async () => {
      const blockIdNum = parseInt(blockId);
      if (isNaN(blockIdNum)) {
        console.error("Invalid block ID:", blockId);
        return [];
      }

      const { data, error } = await supabase
        .from("transactions")
        .select(`
          id,
          amount,
          block_id,
          notes,
          to_wallet_id,
          from_wallet_id,
          created_at,
          to_wallet:wallets!transactions_to_wallet_id_fkey(wallet_id, wallet_type)
        `)
        .eq("block_id", blockIdNum)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching transactions:", error);
        throw error;
      }

      return data as BlockTransaction[];
    },
    enabled: open && !!blockId,
  });

  const totalValue = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const registeredCount = transactions.filter(tx => tx.to_wallet?.wallet_id).length;

  const handleTransactionClick = (transaction: BlockTransaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionDialog(true);
  };

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
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">{totalValue.toFixed(2)} LAN</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Registered</p>
                <p className="text-2xl font-bold">{registeredCount}</p>
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
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentTransactions.map((tx, index) => (
                      <TableRow 
                        key={tx.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleTransactionClick(tx)}
                      >
                        <TableCell className="font-medium">{startIndex + index + 1}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {tx.from_wallet_id 
                            ? `${tx.from_wallet_id.substring(0, 8)}...` 
                            : "N/A"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {tx.to_wallet_id 
                            ? `${tx.to_wallet_id.substring(0, 8)}...` 
                            : "N/A"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {tx.amount} LAN
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {tx.to_wallet?.wallet_type || "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {tx.to_wallet?.wallet_id ? (
                            <Badge variant="default" className="bg-primary">
                              Registered
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Unregistered</Badge>
                          )}
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

      <TransactionDetailDialog
        open={showTransactionDialog}
        onOpenChange={setShowTransactionDialog}
        transaction={selectedTransaction}
      />
    </Dialog>
  );
};

export default BlockDetailDialog;
