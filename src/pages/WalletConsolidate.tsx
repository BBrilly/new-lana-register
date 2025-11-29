import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Package, Sparkles, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UTXOAnalysis {
  success: boolean;
  total_utxos: number;
  total_value: number;
  total_value_lana: string;
  largest_utxos: Array<{
    tx_hash: string;
    tx_pos: number;
    height: number;
    value: number;
    value_lana: string;
  }>;
  dust_count: number;
  dust_value: number;
  dust_value_lana: string;
  dust_threshold: number;
  dust_threshold_lana: string;
  non_dust_count: number;
  non_dust_value: number;
  non_dust_value_lana: string;
  message?: string;
}

const WalletConsolidate = () => {
  const { walletId } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [analysis, setAnalysis] = useState<UTXOAnalysis | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");

  useEffect(() => {
    const fetchAnalysis = async () => {
      if (!walletId) {
        toast.error("Wallet ID not provided");
        navigate("/wallets");
        return;
      }

      try {
        setIsLoading(true);

        // Fetch wallet details
        const { data: wallet, error: walletError } = await supabase
          .from("wallets")
          .select("wallet_id")
          .eq("id", walletId)
          .single();

        if (walletError || !wallet?.wallet_id) {
          throw new Error("Wallet not found");
        }

        setWalletAddress(wallet.wallet_id);

        // Fetch electrum servers from system parameters
        const { data: systemParams, error: paramsError } = await supabase
          .from("system_parameters")
          .select("electrum")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (paramsError) {
          throw new Error("Failed to fetch system parameters");
        }

        const electrumServers = systemParams.electrum;

        // Call edge function to analyze UTXOs
        const { data, error } = await supabase.functions.invoke(
          "analyze-wallet-utxos",
          {
            body: {
              wallet_address: wallet.wallet_id,
              electrum_servers: electrumServers,
            },
          }
        );

        if (error) throw error;

        setAnalysis(data);
      } catch (error) {
        console.error("Error fetching UTXO analysis:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to analyze wallet UTXOs"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalysis();
  }, [walletId, navigate]);

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  if (!analysis) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">
            Failed to load UTXO analysis
          </p>
          <Button onClick={() => navigate("/wallets")} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Wallets
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate("/wallets")}
              className="mb-2"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Wallets
            </Button>
            <h1 className="text-3xl font-bold text-foreground">
              UTXO Consolidation Analysis
            </h1>
            <p className="mt-1 text-sm text-muted-foreground font-mono">
              {walletAddress}
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total UTXOs</p>
                <p className="text-2xl font-bold">{analysis.total_utxos}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">{analysis.total_value_lana} LAN</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-destructive/10 p-3">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dust UTXOs</p>
                <p className="text-2xl font-bold">{analysis.dust_count}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Dust Analysis */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Dust Analysis</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dust Threshold:</span>
              <span className="font-mono">
                &lt; {analysis.dust_threshold_lana} LAN ({analysis.dust_threshold} satoshis)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dust UTXOs Count:</span>
              <span className="font-semibold text-destructive">
                {analysis.dust_count} / {analysis.total_utxos}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Dust Value:</span>
              <span className="font-mono text-destructive">
                {analysis.dust_value_lana} LAN
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Non-Dust UTXOs:</span>
              <span className="font-semibold text-primary">
                {analysis.non_dust_count}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Non-Dust Value:</span>
              <span className="font-mono text-primary">
                {analysis.non_dust_value_lana} LAN
              </span>
            </div>
          </div>
        </Card>

        {/* Top 20 Largest UTXOs */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            Top 20 Largest UTXOs
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">#</th>
                  <th className="text-left py-2 px-2">Transaction</th>
                  <th className="text-right py-2 px-2">Value (LAN)</th>
                  <th className="text-right py-2 px-2">Value (satoshis)</th>
                  <th className="text-right py-2 px-2">Height</th>
                </tr>
              </thead>
              <tbody>
                {analysis.largest_utxos.map((utxo, index) => (
                  <tr key={`${utxo.tx_hash}-${utxo.tx_pos}`} className="border-b">
                    <td className="py-2 px-2 text-muted-foreground">{index + 1}</td>
                    <td className="py-2 px-2 font-mono text-xs">
                      {utxo.tx_hash.substring(0, 12)}...:{utxo.tx_pos}
                    </td>
                    <td className="py-2 px-2 text-right font-semibold">
                      {utxo.value_lana}
                    </td>
                    <td className="py-2 px-2 text-right text-muted-foreground">
                      {utxo.value.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-right text-muted-foreground">
                      {utxo.height}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recommendations */}
        {analysis.dust_count > 0 && (
          <Card className="p-6 border-destructive/50">
            <h2 className="text-xl font-semibold mb-4 text-destructive">
              Recommendations
            </h2>
            <div className="space-y-2 text-sm">
              <p>
                Your wallet contains <strong>{analysis.dust_count}</strong> dust UTXOs 
                totaling <strong>{analysis.dust_value_lana} LAN</strong>.
              </p>
              <p className="text-muted-foreground">
                Consider consolidating these small UTXOs to reduce transaction fees in the future.
                Each UTXO adds approximately 180 bytes to a transaction, increasing the fee by ~18,000 satoshis.
              </p>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default WalletConsolidate;
