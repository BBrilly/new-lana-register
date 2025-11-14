import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Play, RefreshCw, Database, Wallet, TrendingUp } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BatchStatus {
  id: string;
  start_date: string;
  end_date: string;
  main_wallets_synced: number;
  total_wallets_synced: number;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

const AdminPanel = () => {
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const queryClient = useQueryClient();

  // Fetch batch statuses
  const { data: batches, isLoading } = useQuery({
    queryKey: ["batch-statuses", selectedStatus],
    queryFn: async () => {
      let query = supabase
        .from("batch_wallet_import_status")
        .select("*")
        .order("start_date", { ascending: false });

      if (selectedStatus !== "all") {
        query = query.eq("status", selectedStatus);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as BatchStatus[];
    },
  });

  // Run batch mutation
  const runBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const response = await supabase.functions.invoke("batch-wallet-import-kind-30889", {
        body: {},
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Batch uspešno zagnan`, {
        description: `Main wallets: ${data.mainWallets || 0}, Total wallets: ${data.totalWallets || 0}`,
      });
      queryClient.invalidateQueries({ queryKey: ["batch-statuses"] });
    },
    onError: (error: any) => {
      toast.error("Napaka pri zagonu batch-a", {
        description: error.message,
      });
    },
  });

  // Calculate statistics
  const stats = {
    total: batches?.length || 0,
    pending: batches?.filter(b => b.status === "pending").length || 0,
    processing: batches?.filter(b => b.status === "processing").length || 0,
    completed: batches?.filter(b => b.status === "completed").length || 0,
    failed: batches?.filter(b => b.status === "failed").length || 0,
    totalMainWallets: batches?.reduce((sum, b) => sum + (b.main_wallets_synced || 0), 0) || 0,
    totalWallets: batches?.reduce((sum, b) => sum + (b.total_wallets_synced || 0), 0) || 0,
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      pending: { variant: "outline", label: "Čaka" },
      processing: { variant: "default", label: "V teku" },
      completed: { variant: "secondary", label: "Končano" },
      failed: { variant: "destructive", label: "Napaka" },
    };

    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Initial Wallets Takeover Management</p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Skupaj Batch-i</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.pending} čaka, {stats.completed} končanih
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Main Wallets</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMainWallets}</div>
              <p className="text-xs text-muted-foreground">
                Sinhroniziranih main denarnic
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vse Wallets</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalWallets}</div>
              <p className="text-xs text-muted-foreground">
                Vseh sinhroniziranih denarnic
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Napake</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.failed}</div>
              <p className="text-xs text-muted-foreground">
                Batch-i z napakami
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Batch Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Batch Import Status</CardTitle>
                <CardDescription>
                  Pregled vseh batch-ev za historični import denarnic
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={selectedStatus === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStatus("all")}
                >
                  Vsi
                </Button>
                <Button
                  variant={selectedStatus === "pending" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStatus("pending")}
                >
                  Čakajo
                </Button>
                <Button
                  variant={selectedStatus === "failed" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStatus("failed")}
                >
                  Napake
                </Button>
                <Button
                  variant={selectedStatus === "completed" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStatus("completed")}
                >
                  Končani
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Nalagam...</div>
            ) : batches && batches.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Časovno obdobje</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Main Wallets</TableHead>
                    <TableHead className="text-right">Vse Wallets</TableHead>
                    <TableHead>Napaka</TableHead>
                    <TableHead>Akcija</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">
                        <div className="text-sm">
                          <div>{format(new Date(batch.start_date), "dd.MM.yyyy HH:mm")}</div>
                          <div className="text-muted-foreground">
                            do {format(new Date(batch.end_date), "dd.MM.yyyy HH:mm")}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(batch.status)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {batch.main_wallets_synced || 0}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {batch.total_wallets_synced || 0}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {batch.error_message || "-"}
                      </TableCell>
                      <TableCell>
                        {(batch.status === "pending" || batch.status === "failed") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => runBatchMutation.mutate(batch.id)}
                            disabled={runBatchMutation.isPending}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Zaženi
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Ni batch-ev za prikaz
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminPanel;
