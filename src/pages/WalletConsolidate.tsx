import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Package, Sparkles, AlertTriangle, Key, Layers, QrCode } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { convertWifToIds } from "@/utils/wifAuth";

interface UTXO {
  tx_hash: string;
  tx_pos: number;
  height: number;
  value: number;
  value_lana: string;
}

interface UTXOAnalysis {
  success: boolean;
  total_utxos: number;
  total_value: number;
  total_value_lana: string;
  all_utxos: UTXO[];
  largest_utxos: UTXO[];
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

interface Batch {
  id: number;
  utxos: UTXO[];
  totalValue: number;
  totalValueLana: string;
  dustCount: number;
  isProcessing?: boolean;
  isCompleted?: boolean;
  txid?: string;
}

const WalletConsolidate = () => {
  const { walletId } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [analysis, setAnalysis] = useState<UTXOAnalysis | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [privateKey, setPrivateKey] = useState<string>("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [isKeyValid, setIsKeyValid] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);

  // Validate private key
  useEffect(() => {
    const validatePrivateKey = async () => {
      if (!privateKey.trim()) {
        setIsKeyValid(null);
        return;
      }

      setIsValidatingKey(true);
      try {
        const derived = await convertWifToIds(privateKey);
        const isValid = derived.walletId === walletAddress;
        setIsKeyValid(isValid);
        
        if (!isValid) {
          toast.error("Private key does not match this wallet address");
        }
      } catch (error) {
        setIsKeyValid(false);
        toast.error("Invalid private key format");
      } finally {
        setIsValidatingKey(false);
      }
    };

    const timeoutId = setTimeout(validatePrivateKey, 500);
    return () => clearTimeout(timeoutId);
  }, [privateKey, walletAddress]);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

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

        // Create batches from all UTXOs (mixed dust and non-dust)
        if (data.all_utxos && data.all_utxos.length > 0) {
          const allUtxos = [...data.all_utxos];
          
          // Shuffle UTXOs to mix dust and non-dust
          for (let i = allUtxos.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allUtxos[i], allUtxos[j]] = [allUtxos[j], allUtxos[i]];
          }

          // Split into batches of 30
          const batchSize = 30;
          const createdBatches: Batch[] = [];
          
          for (let i = 0; i < allUtxos.length; i += batchSize) {
            const batchUtxos = allUtxos.slice(i, i + batchSize);
            const totalValue = batchUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
            const dustCount = batchUtxos.filter(utxo => utxo.value < 10000).length;
            
            createdBatches.push({
              id: Math.floor(i / batchSize) + 1,
              utxos: batchUtxos,
              totalValue,
              totalValueLana: (totalValue / 100000000).toFixed(8),
              dustCount
            });
          }

          setBatches(createdBatches);
        }
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

  const startScanning = async () => {
    setIsScanning(true);
    
    setTimeout(async () => {
      try {
        const cameras = await Html5Qrcode.getCameras();
        
        if (!cameras || cameras.length === 0) {
          toast.error("No camera found on this device");
          setIsScanning(false);
          return;
        }

        let selectedCamera = cameras[0];
        if (cameras.length > 1) {
          const backCamera = cameras.find(camera => 
            camera.label.toLowerCase().includes('back') || 
            camera.label.toLowerCase().includes('rear')
          );
          if (backCamera) {
            selectedCamera = backCamera;
          }
        }

        const scanner = new Html5Qrcode("qr-reader-consolidate");
        scannerRef.current = scanner;

        await scanner.start(
          selectedCamera.id,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            setPrivateKey(decodedText);
            stopScanning();
            toast.success("QR code scanned successfully");
          },
          (errorMessage) => {
            // Ignore during operation
          }
        );
      } catch (error: any) {
        console.error("Error starting QR scanner:", error);
        setIsScanning(false);
        
        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
          toast.error("Camera permission denied. Please allow camera access.");
        } else if (error.name === "NotFoundError") {
          toast.error("No camera found on this device");
        } else if (error.name === "NotReadableError") {
          toast.error("Camera is already in use by another application");
        } else {
          toast.error(`Error starting camera: ${error.message || "Unknown error"}`);
        }
      }
    }, 100);
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
    }
    setIsScanning(false);
  };

  const handleConsolidateBatch = async (batchId: number) => {
    if (!privateKey.trim()) {
      toast.error("Please enter your private key first");
      return;
    }

    const batch = batches.find(b => b.id === batchId);
    if (!batch) {
      toast.error("Batch not found");
      return;
    }

    // Mark batch as processing
    setBatches(prev => prev.map(b => 
      b.id === batchId ? { ...b, isProcessing: true } : b
    ));

    try {
      toast.info(`Starting consolidation of Batch #${batchId} (${batch.utxos.length} UTXOs)...`);

      // Fetch electrum servers
      const { data: systemParams, error: paramsError } = await supabase
        .from("system_parameters")
        .select("electrum")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (paramsError) {
        throw new Error("Failed to fetch system parameters");
      }

      // Call consolidate-wallet edge function
      const { data, error } = await supabase.functions.invoke(
        "consolidate-wallet",
        {
          body: {
            sender_address: walletAddress,
            selected_utxos: batch.utxos,
            private_key: privateKey,
            electrum_servers: systemParams.electrum,
          },
        }
      );

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Consolidation failed");
      }

      // Mark batch as completed
      setBatches(prev => prev.map(b => 
        b.id === batchId 
          ? { ...b, isProcessing: false, isCompleted: true, txid: data.txid } 
          : b
      ));

      toast.success(
        `Batch #${batchId} consolidated successfully! TX: ${data.txid.substring(0, 16)}...`,
        { duration: 5000 }
      );

      console.log(`✅ Batch ${batchId} consolidated:`, data);
    } catch (error) {
      console.error(`❌ Batch ${batchId} consolidation error:`, error);
      
      // Reset processing state
      setBatches(prev => prev.map(b => 
        b.id === batchId ? { ...b, isProcessing: false } : b
      ));

      toast.error(
        error instanceof Error 
          ? `Consolidation failed: ${error.message}` 
          : "Consolidation failed"
      );
    }
  };

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

        {/* Private Key Input */}
        <Card className="p-6 border-primary/50">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-3">
              <Key className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 space-y-3">
              <Label htmlFor="privateKey" className="text-base font-semibold">
                Wallet Private Key
              </Label>
              <p className="text-sm text-muted-foreground">
                Enter your private key to authorize consolidation transactions. Your key is never sent to our servers.
              </p>
              <div className="relative">
                <Input
                  id="privateKey"
                  type="password"
                  placeholder="Enter your private key (WIF format)"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  disabled={isScanning || isValidatingKey}
                  className={`font-mono pr-10 ${
                    isKeyValid === true 
                      ? 'border-green-500 focus-visible:ring-green-500' 
                      : isKeyValid === false 
                      ? 'border-destructive focus-visible:ring-destructive' 
                      : ''
                  }`}
                />
                {isValidatingKey && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                )}
                {!isValidatingKey && isKeyValid === true && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                    ✓
                  </div>
                )}
                {!isValidatingKey && isKeyValid === false && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive">
                    ✗
                  </div>
                )}
              </div>
              
              {!isScanning ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={startScanning}
                  className="w-full"
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Scan QR Code
                </Button>
              ) : (
                <div className="space-y-3">
                  <div
                    id="qr-reader-consolidate"
                    ref={scannerDivRef}
                    className="rounded-lg overflow-hidden border-2 border-primary"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={stopScanning}
                    className="w-full"
                  >
                    Stop Scanning
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>

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
                &lt; {analysis.dust_threshold_lana} LAN ({analysis.dust_threshold} lanoshis)
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
                  <th className="text-right py-2 px-2">Value (lanoshis)</th>
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

        {/* Consolidation Batches */}
        {batches.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-lg bg-accent/10 p-3">
                <Layers className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Consolidation Batches</h2>
                <p className="text-sm text-muted-foreground">
                  {batches.length} batches of mixed UTXOs (30 UTXOs each)
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {batches.map((batch) => (
                <Card key={batch.id} className="p-4 border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">Batch #{batch.id}</h3>
                        <span className="text-sm px-2 py-1 rounded-full bg-muted text-muted-foreground">
                          {batch.utxos.length} UTXOs
                        </span>
                        {batch.dustCount > 0 && (
                          <span className="text-sm px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                            {batch.dustCount} dust
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          Total Value:
                        </span>
                        <span className="font-mono font-semibold text-primary">
                          {batch.totalValueLana} LAN
                        </span>
                        <span className="text-muted-foreground">
                          ({batch.totalValue.toLocaleString()} lanoshis)
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleConsolidateBatch(batch.id)}
                      disabled={!privateKey.trim() || isKeyValid !== true || batch.isProcessing || batch.isCompleted}
                      className="ml-4"
                    >
                      {batch.isProcessing ? (
                        <>
                          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-foreground" />
                          Processing...
                        </>
                      ) : batch.isCompleted ? (
                        "✓ Completed"
                      ) : (
                        "Consolidate"
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        )}

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
                Each UTXO adds approximately 180 bytes to a transaction, increasing the fee by ~18,000 lanoshis.
              </p>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default WalletConsolidate;
