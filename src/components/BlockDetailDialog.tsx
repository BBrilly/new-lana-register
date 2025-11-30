import { useEffect, useState, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, Activity, TrendingUp, Package, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
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

interface TransactionOutput {
  id: string;
  amount: number;
  block_id: number | null;
  notes: string | null;
  to_wallet_id: string | null;
  from_wallet_id: string | null;
  created_at: string | null;
  to_wallet?: {
    wallet_id: string | null;
    wallet_type: string;
  } | null;
}

const BlockDetailDialog = ({ open, onOpenChange, blockId, blockData }: BlockDetailDialogProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"all" | "registered">("all");
  const { toast } = useToast();
  const OUTPUTS_PER_PAGE = 50;

  // Fetch transaction outputs from database
  const { data: outputs, isLoading } = useQuery({
    queryKey: ["block-outputs", blockId],
    queryFn: async () => {
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
        .eq("block_id", parseInt(blockId))
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as TransactionOutput[];
    },
    enabled: open,
  });

  // Reset to first page when dialog opens or tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [open, activeTab]);

  // Filter outputs based on active tab
  const filteredOutputs = useMemo(() => {
    if (!outputs) return [];
    if (activeTab === "registered") {
      return outputs.filter((output) => output.to_wallet_id !== null);
    }
    return outputs;
  }, [outputs, activeTab]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!outputs) return { totalOutputs: 0, uniqueTxids: 0, registeredOutputs: 0, totalValue: 0 };

    const uniqueTxids = new Set(
      outputs.map((o) => o.notes).filter((note): note is string => note !== null)
    ).size;

    const registeredOutputs = outputs.filter((o) => o.to_wallet_id !== null).length;
    const totalValue = outputs.reduce((sum, o) => sum + Number(o.amount), 0);

    return {
      totalOutputs: outputs.length,
      uniqueTxids,
      registeredOutputs,
      totalValue,
    };
  }, [outputs]);

  // Extract TXID from notes field
  const extractTxid = (notes: string | null): string | null => {
    if (!notes) return null;
    // Try to extract transaction ID from notes
    const txidMatch = notes.match(/[a-f0-9]{64}/i);
    return txidMatch ? txidMatch[0] : null;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "TXID copied to clipboard",
    });
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredOutputs.length / OUTPUTS_PER_PAGE);
  const startIndex = (currentPage - 1) * OUTPUTS_PER_PAGE;
  const endIndex = startIndex + OUTPUTS_PER_PAGE;
  const currentOutputs = filteredOutputs.slice(startIndex, endIndex);

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

          {/* Output Statistics */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Output Statistics
            </h3>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Outputs</p>
                <p className="text-2xl font-bold">{stats.totalOutputs}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unique TXIDs</p>
                <p className="text-2xl font-bold">{stats.uniqueTxids}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Registered Outputs</p>
                <p className="text-2xl font-bold text-primary">{stats.registeredOutputs}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">{stats.totalValue.toFixed(4)} LANA</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Coverage</p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${stats.totalOutputs > 0 ? (stats.registeredOutputs / stats.totalOutputs) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold">
                      {stats.totalOutputs > 0
                        ? ((stats.registeredOutputs / stats.totalOutputs) * 100).toFixed(1)
                        : 0}
                      %
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Transaction Outputs Table */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Transaction Outputs
            </h3>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "registered")}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All Outputs ({outputs?.length || 0})</TabsTrigger>
                <TabsTrigger value="registered">
                  Registered Only ({stats.registeredOutputs})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-0">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : filteredOutputs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No outputs found for this block
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>TXID</TableHead>
                          <TableHead className="text-right">Amount (LANA)</TableHead>
                          <TableHead>Receiving Wallet</TableHead>
                          <TableHead>Wallet Type</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentOutputs.map((output, index) => {
                          const txid = extractTxid(output.notes);
                          const walletAddress = output.to_wallet?.wallet_id;
                          const isRegistered = output.to_wallet_id !== null;

                          return (
                            <TableRow key={output.id}>
                              <TableCell className="font-medium">{startIndex + index + 1}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {txid ? (
                                  <div className="flex items-center gap-1">
                                    <a
                                      href={`https://explorer.lanacoin.com/tx/${txid}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:text-primary transition-colors flex items-center gap-1"
                                    >
                                      {txid.substring(0, 8)}...{txid.substring(txid.length - 6)}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => copyToClipboard(txid)}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {Number(output.amount).toFixed(8)}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {walletAddress ? (
                                  <span>
                                    {walletAddress.substring(0, 8)}...
                                    {walletAddress.substring(walletAddress.length - 6)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {output.to_wallet?.wallet_type || (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {isRegistered ? (
                                  <Badge variant="default" className="bg-primary">
                                    ✅ Registered
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">⚪ Unregistered</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Showing {startIndex + 1} to {Math.min(endIndex, filteredOutputs.length)} of{" "}
                          {filteredOutputs.length} outputs
                        </div>
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                className={
                                  currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
                                }
                              />
                            </PaginationItem>

                            {getPageNumbers().map((page, idx) =>
                              page === "ellipsis" ? (
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
                            )}

                            <PaginationItem>
                              <PaginationNext
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                className={
                                  currentPage === totalPages
                                    ? "pointer-events-none opacity-50"
                                    : "cursor-pointer"
                                }
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BlockDetailDialog;
