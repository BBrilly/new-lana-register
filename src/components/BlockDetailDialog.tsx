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
import { Database, Activity, TrendingUp, Package } from "lucide-react";

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
  txid: string;
  inputs: number;
  outputs: number;
  totalValue: number;
  isRegistered: boolean;
}

const BlockDetailDialog = ({ open, onOpenChange, blockId, blockData }: BlockDetailDialogProps) => {
  const [transactions, setTransactions] = useState<BlockTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      // Mock data - in production this would fetch from RPC node or database
      setIsLoading(true);
      setTimeout(() => {
        // Generate mock transaction data for demonstration
        const mockTransactions: BlockTransaction[] = Array.from(
          { length: blockData.totalTx },
          (_, i) => ({
            txid: `${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`.substring(0, 64),
            inputs: Math.floor(Math.random() * 5) + 1,
            outputs: Math.floor(Math.random() * 10) + 1,
            totalValue: Math.random() * 1000,
            isRegistered: i < blockData.registeredTx,
          })
        );
        setTransactions(mockTransactions);
        setIsLoading(false);
      }, 500);
    }
  }, [open, blockId, blockData]);

  const totalInputs = transactions.reduce((sum, tx) => sum + tx.inputs, 0);
  const totalOutputs = transactions.reduce((sum, tx) => sum + tx.outputs, 0);
  const totalValue = transactions.reduce((sum, tx) => sum + tx.totalValue, 0);
  const avgOutputsPerTx = transactions.length > 0 ? (totalOutputs / transactions.length).toFixed(1) : 0;

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
                      <TableHead>Transaction ID</TableHead>
                      <TableHead className="text-right">Inputs</TableHead>
                      <TableHead className="text-right">Outputs</TableHead>
                      <TableHead className="text-right">Total Value</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx, index) => (
                      <TableRow key={tx.txid}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BlockDetailDialog;
