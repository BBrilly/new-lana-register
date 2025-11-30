import { useEffect, useState } from "react";
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
import { Database, Activity, TrendingUp, Package, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

interface TxOutput {
  index: number;
  address: string;
  value: number;
}

interface TxInput {
  index: number;
  address: string;
  value: number;
}

interface BlockTransaction {
  txid: string;
  inputs: number;
  outputs: number;
  totalValue: number;
  isRegistered: boolean;
  inputDetails: TxInput[];
  outputDetails: TxOutput[];
}

interface RegisteredTransaction {
  id: string;
  from_wallet_address: string | null;
  to_wallet_address: string | null;
  amount: number;
  notes: string | null;
  created_at: string;
}

const BlockDetailDialog = ({ open, onOpenChange, blockId, blockData }: BlockDetailDialogProps) => {
  const [transactions, setTransactions] = useState<BlockTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [registeredTransactions, setRegisteredTransactions] = useState<RegisteredTransaction[]>([]);
  const [isLoadingRegistered, setIsLoadingRegistered] = useState(false);
  const TRANSACTIONS_PER_PAGE = 50;

  useEffect(() => {
    if (open) {
      // Mock data - in production this would fetch from RPC node or database
      setIsLoading(true);
      setCurrentPage(1); // Reset to first page when opening
      setTimeout(() => {
        // Generate mock transaction data for demonstration
        const mockTransactions: BlockTransaction[] = Array.from(
          { length: blockData.totalTx },
          (_, i) => {
            const inputs = Math.floor(Math.random() * 5) + 1;
            const outputs = Math.floor(Math.random() * 10) + 1;
            return {
              txid: `${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`.substring(0, 64),
              inputs,
              outputs,
              totalValue: Math.random() * 1000,
              isRegistered: i < blockData.registeredTx,
              inputDetails: Array.from({ length: inputs }, (_, j) => ({
                index: j,
                address: `Lan${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`,
                value: Math.random() * 100
              })),
              outputDetails: Array.from({ length: outputs }, (_, j) => ({
                index: j,
                address: `Lan${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`,
                value: Math.random() * 100
              }))
            };
          }
        );
        setTransactions(mockTransactions);
        setIsLoading(false);
      }, 500);
    }
  }, [open, blockId, blockData]);

  // Fetch registered transactions from Supabase
  useEffect(() => {
    if (open && blockId) {
      const fetchRegisteredTransactions = async () => {
        setIsLoadingRegistered(true);
        
        const { data, error } = await supabase
          .from('transactions')
          .select(`
            id,
            amount,
            notes,
            created_at,
            from_wallet:wallets!transactions_from_wallet_id_fkey(wallet_id),
            to_wallet:wallets!transactions_to_wallet_id_fkey(wallet_id)
          `)
          .eq('block_id', parseInt(blockId))
          .order('created_at', { ascending: false });
        
        if (!error && data) {
          const mapped: RegisteredTransaction[] = data.map(tx => ({
            id: tx.id,
            from_wallet_address: (tx.from_wallet as any)?.wallet_id || null,
            to_wallet_address: (tx.to_wallet as any)?.wallet_id || null,
            amount: Number(tx.amount),
            notes: tx.notes,
            created_at: tx.created_at || ''
          }));
          setRegisteredTransactions(mapped);
        }
        setIsLoadingRegistered(false);
      };
      
      fetchRegisteredTransactions();
    }
  }, [open, blockId]);

  const totalInputs = transactions.reduce((sum, tx) => sum + tx.inputs, 0);
  const totalOutputs = transactions.reduce((sum, tx) => sum + tx.outputs, 0);
  const totalValue = transactions.reduce((sum, tx) => sum + tx.totalValue, 0);
  const avgOutputsPerTx = transactions.length > 0 ? (totalOutputs / transactions.length).toFixed(1) : 0;

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
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <p className="text-2xl font-bold">{blockData.totalTx}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Inputs</p>
                <p className="text-2xl font-bold">{totalInputs}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Outputs</p>
                <p className="text-2xl font-bold">{totalOutputs}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Outputs/TX</p>
                <p className="text-2xl font-bold">{avgOutputsPerTx}</p>
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

          {/* Registered Transactions Preview */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Registered Transactions
            </h3>
            
            {isLoadingRegistered ? (
              <div className="space-y-2">
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registeredTransactions.map((tx, index) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {tx.from_wallet_address 
                            ? `${tx.from_wallet_address.substring(0, 8)}...${tx.from_wallet_address.slice(-6)}`
                            : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {tx.to_wallet_address 
                            ? `${tx.to_wallet_address.substring(0, 8)}...${tx.to_wallet_address.slice(-6)}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {tx.amount.toFixed(4)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {registeredTransactions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No registered transactions in this block
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          {/* All Block Transactions */}
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
                      <TableHead>Transaction ID</TableHead>
                      <TableHead className="text-right">Inputs</TableHead>
                      <TableHead className="text-right">Outputs</TableHead>
                      <TableHead className="text-right">Total Value</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentTransactions.map((tx, index) => (
                      <>
                        <TableRow 
                          key={tx.txid}
                          onClick={() => setExpandedTxId(expandedTxId === tx.txid ? null : tx.txid)}
                          className="cursor-pointer hover:bg-muted/50"
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {expandedTxId === tx.txid ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              {startIndex + index + 1}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {tx.txid.substring(0, 16)}...{tx.txid.substring(tx.txid.length - 8)}
                          </TableCell>
                          <TableCell className="text-right">{tx.inputs}</TableCell>
                          <TableCell className="text-right font-semibold">{tx.outputs}</TableCell>
                          <TableCell className="text-right">
                            {tx.totalValue.toFixed(4)} LAN
                          </TableCell>
                          <TableCell>
                            {tx.isRegistered ? (
                              <Badge variant="default" className="bg-primary">
                                Registered
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Unregistered</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                        {expandedTxId === tx.txid && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/30 p-6">
                              <div className="grid md:grid-cols-2 gap-6">
                                {/* Input Addresses */}
                                <div>
                                  <div className="text-sm font-semibold mb-3 text-destructive">From (Inputs):</div>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-16">#</TableHead>
                                        <TableHead>Address</TableHead>
                                        <TableHead className="text-right">Value (LANA)</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {tx.inputDetails.map((input) => (
                                        <TableRow key={input.index}>
                                          <TableCell>{input.index}</TableCell>
                                          <TableCell className="font-mono text-xs">{input.address}</TableCell>
                                          <TableCell className="text-right">{input.value.toFixed(4)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>

                                {/* Output Addresses */}
                                <div>
                                  <div className="text-sm font-semibold mb-3 text-primary">To (Outputs):</div>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-16">#</TableHead>
                                        <TableHead>Address</TableHead>
                                        <TableHead className="text-right">Value (LANA)</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {tx.outputDetails.map((output) => (
                                        <TableRow key={output.index}>
                                          <TableCell>{output.index}</TableCell>
                                          <TableCell className="font-mono text-xs">{output.address}</TableCell>
                                          <TableCell className="text-right">{output.value.toFixed(4)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
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
