import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Html5Qrcode } from "html5-qrcode";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { QrCode, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AddWallet = () => {
  const navigate = useNavigate();
  const [walletNumber, setWalletNumber] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [walletTypes, setWalletTypes] = useState<{ id: string; name: string }[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchWalletTypes = async () => {
      const { data, error } = await supabase
        .from("wallet_types")
        .select("id, name")
        .eq("visible_in_form", true)
        .order("name");

      if (error) {
        console.error("Error fetching wallet types:", error);
        toast.error("Failed to load wallet types");
      } else if (data) {
        setWalletTypes(data);
        if (data.length > 0 && !type) {
          setType(data[0].name);
        }
      }
    };

    fetchWalletTypes();
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  const validateWalletBalance = async (walletId: string) => {
    setIsValidating(true);
    setBalanceError(null);

    try {
      // Fetch system parameters for electrum servers
      const { data: systemParams, error: paramsError } = await supabase
        .from("system_parameters")
        .select("electrum")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paramsError) {
        throw paramsError;
      }

      if (!systemParams || !systemParams.electrum) {
        throw new Error("No Electrum servers configured");
      }

      const electrumServers = (systemParams.electrum as any[]).map(server => ({
        host: server.host,
        port: parseInt(server.port, 10)
      }));

      // Call edge function to check balance
      const { data, error } = await supabase.functions.invoke("fetch-wallet-balance", {
        body: {
          wallet_addresses: [walletId],
          electrum_servers: electrumServers,
        },
      });

      if (error) {
        throw error;
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "Failed to fetch wallet balance");
      }

      // Check if balance is 0
      const walletBalance = data.wallets[0]?.balance || 0;
      
      if (walletBalance > 0) {
        setBalanceError(
          `This wallet has a balance of ${walletBalance} LANA. Only wallets with 0 balance can be registered.`
        );
        return false;
      }

      return true;
    } catch (err) {
      console.error("Error validating wallet balance:", err);
      toast.error("Failed to validate wallet balance");
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!walletNumber || !description) {
      toast.error("Please fill in all fields");
      return;
    }

    // Validate wallet balance before proceeding
    const isValid = await validateWalletBalance(walletNumber);
    if (!isValid) {
      return;
    }

    // TODO: Implement add wallet via Supabase
    console.log("Nova denarnica:", { walletNumber, type, description });
    toast.success("Wallet will be added (functionality coming soon)");
    navigate("/wallets");
  };

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

        const scanner = new Html5Qrcode("qr-reader-wallet");
        scannerRef.current = scanner;

        await scanner.start(
          selectedCamera.id,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            setWalletNumber(decodedText);
            stopScanning();
            toast.success("Wallet ID scanned successfully");
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

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/wallets")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Add New Wallet</h1>
            <p className="mt-1 text-muted-foreground">
              Enter details for the new LAN wallet to track
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-card p-6 rounded-lg border">
          <div className="space-y-2">
            <Label htmlFor="walletNumber">Wallet Number</Label>
            <Input
              id="walletNumber"
              placeholder="LZgUUQALhZbCoQrUXEDDwJS1Pb99E1bJ27..."
              value={walletNumber}
              onChange={(e) => {
                setWalletNumber(e.target.value);
                setBalanceError(null);
              }}
              className="font-mono"
              disabled={isScanning || isValidating}
            />
            {!isScanning ? (
              <Button
                type="button"
                variant="outline"
                onClick={startScanning}
                className="w-full gap-2"
                disabled={isValidating}
              >
                <QrCode className="h-4 w-4" />
                Scan Wallet QR Code
              </Button>
            ) : (
              <div className="space-y-4">
                <div
                  id="qr-reader-wallet"
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

          {balanceError && (
            <Alert variant="destructive">
              <AlertDescription>{balanceError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="type">Wallet Type</Label>
            <Select value={type} onValueChange={(value: any) => setType(value)} disabled={isValidating}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {walletTypes.map((walletType) => (
                  <SelectItem key={walletType.id} value={walletType.name}>
                    {walletType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Wallet description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={isValidating}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate("/wallets")} 
              disabled={isScanning || isValidating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isScanning || isValidating}>
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                "Add Wallet"
              )}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default AddWallet;
