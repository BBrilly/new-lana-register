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
import { validateLanaAddress } from "@/utils/walletValidation";
import { getAuthSession } from "@/utils/wifAuth";

const AddWallet = () => {
  const navigate = useNavigate();
  const [walletNumber, setWalletNumber] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [walletTypes, setWalletTypes] = useState<{ id: string; name: string }[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const validateWallet = async (walletId: string) => {
    if (!walletId || walletId.length < 10) {
      setValidationError(null);
      setIsValid(false);
      return;
    }

    setIsValidating(true);
    setValidationError(null);
    setIsValid(false);

    try {
      // Step 1: Validate address structure first
      console.log('🔍 Validating wallet address structure...');
      const structureValidation = await validateLanaAddress(walletId);
      
      if (!structureValidation.valid) {
        setValidationError(structureValidation.error || "Invalid wallet address format");
        setIsValid(false);
        setIsValidating(false);
        return;
      }
      
      console.log('✅ Wallet address structure is valid');

      // Step 2: Check if wallet already exists in database
      const { data: existingWallet, error: walletCheckError } = await supabase
        .from("wallets")
        .select("id, wallet_id")
        .eq("wallet_id", walletId)
        .maybeSingle();

      if (walletCheckError && walletCheckError.code !== "PGRST116") {
        throw walletCheckError;
      }

      if (existingWallet) {
        setValidationError("This wallet is already registered in the system.");
        setIsValid(false);
        setIsValidating(false);
        return;
      }

      // Step 3: Fetch system parameters for electrum servers
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

      // Step 4: Call edge function to check balance
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

      // Step 5: Check if balance is 0
      const walletBalance = data.wallets[0]?.balance || 0;
      
      if (walletBalance > 0) {
        setValidationError(
          `This wallet has a balance of ${walletBalance} LANA. Only wallets with 0 balance can be registered.`
        );
        setIsValid(false);
      } else {
        setValidationError(null);
        setIsValid(true);
      }
    } catch (err) {
      console.error("Error validating wallet:", err);
      setValidationError("Failed to validate wallet. Please try again.");
      setIsValid(false);
    } finally {
      setIsValidating(false);
    }
  };

  // Debounced validation when wallet number changes
  useEffect(() => {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    if (walletNumber && walletNumber.length >= 10) {
      validationTimeoutRef.current = setTimeout(() => {
        validateWallet(walletNumber);
      }, 800);
    } else {
      setValidationError(null);
      setIsValid(false);
    }

    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, [walletNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid) {
      toast.error("Please ensure the wallet passes all validations");
      return;
    }

    if (!walletNumber || !description) {
      toast.error("Please fill in all fields");
      return;
    }

    const session = getAuthSession();
    if (!session) {
      toast.error("You must be logged in to add a wallet");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-virgin-wallets", {
        body: {
          method: "register_virgin_wallets_for_existing_user",
          api_key: "lk_w1fHNwvEKpCtgGjXqIEFz1yKEynnwuoe",
          data: {
            nostr_id_hex: session.nostrHexId,
            wallets: [{
              wallet_id: walletNumber,
              wallet_type: type,
              notes: description
            }]
          }
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Registration failed");

      toast.success("Wallet successfully registered!");
      navigate("/wallets");
    } catch (err: any) {
      toast.error(err.message || "Failed to register wallet");
    } finally {
      setIsSubmitting(false);
    }
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
              onChange={(e) => setWalletNumber(e.target.value)}
              className="font-mono"
              disabled={isScanning}
            />
            {!isScanning ? (
              <Button
                type="button"
                variant="outline"
                onClick={startScanning}
                className="w-full gap-2"
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

          {isValidating && walletNumber && (
            <Alert>
              <AlertDescription className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Validating wallet...
              </AlertDescription>
            </Alert>
          )}

          {validationError && (
            <Alert variant="destructive">
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          {isValid && !isValidating && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <AlertDescription className="text-green-700 dark:text-green-400">
                ✓ Wallet is valid and can be registered
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="type">Wallet Type</Label>
            <Select value={type} onValueChange={(value: any) => setType(value)}>
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
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate("/wallets")} 
              disabled={isScanning}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isScanning || !isValid || isValidating || isSubmitting}
              className={isValid && !isValidating ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Registering..." : "Add Wallet"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default AddWallet;
