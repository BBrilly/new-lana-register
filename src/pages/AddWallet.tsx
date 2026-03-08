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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, ArrowLeft, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { validateLanaAddress } from "@/utils/walletValidation";
import { getAuthSession } from "@/utils/wifAuth";

const AddWallet = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("virgin");

  // Shared state
  const [walletNumber, setWalletNumber] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [walletTypes, setWalletTypes] = useState<{ id: string; name: string }[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);

  // Virgin wallet validation
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Registered Lanas validation
  const [isValidatingSenders, setIsValidatingSenders] = useState(false);
  const [senderValidationError, setSenderValidationError] = useState<string | null>(null);
  const [sendersValid, setSendersValid] = useState(false);
  const [senderStats, setSenderStats] = useState<{
    totalSenders: number;
    registeredSenders: number;
    unregisteredSenders: string[];
  } | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isAddressValid, setIsAddressValid] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [isCheckingAddress, setIsCheckingAddress] = useState(false);
  const senderValidationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      }
    };
    fetchWalletTypes();
  }, []);

  // Set default type based on active tab
  useEffect(() => {
    if (activeTab === "virgin") {
      setType(walletTypes.length > 0 ? walletTypes[0].name : "");
    } else {
      // Always force "Wallet" for registered lanas
      setType("Wallet");
    }
  }, [activeTab, walletTypes]);

  // Reset state on tab change
  useEffect(() => {
    setWalletNumber("");
    setDescription("");
    setValidationError(null);
    setIsValid(false);
    setSenderValidationError(null);
    setSendersValid(false);
    setSenderStats(null);
    setWalletBalance(null);
    setIsAddressValid(false);
    setAddressError(null);
  }, [activeTab]);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  // ====== VIRGIN WALLET VALIDATION ======
  const validateVirginWallet = async (walletId: string) => {
    if (!walletId || walletId.length < 10) {
      setValidationError(null);
      setIsValid(false);
      return;
    }

    setIsValidating(true);
    setValidationError(null);
    setIsValid(false);

    try {
      const structureValidation = await validateLanaAddress(walletId);
      if (!structureValidation.valid) {
        setValidationError(structureValidation.error || "Invalid wallet address format");
        setIsValid(false);
        setIsValidating(false);
        return;
      }

      const { data: existingWallet } = await supabase
        .from("wallets")
        .select("id, wallet_id")
        .eq("wallet_id", walletId)
        .maybeSingle();

      if (existingWallet) {
        setValidationError("This wallet is already registered in the system.");
        setIsValid(false);
        setIsValidating(false);
        return;
      }

      const { data: systemParams } = await supabase
        .from("system_parameters")
        .select("electrum")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!systemParams?.electrum) throw new Error("No Electrum servers configured");

      const electrumServers = (systemParams.electrum as any[]).map(server => ({
        host: server.host,
        port: parseInt(server.port, 10)
      }));

      const { data, error } = await supabase.functions.invoke("fetch-wallet-balance", {
        body: { wallet_addresses: [walletId], electrum_servers: electrumServers },
      });

      if (error || !data?.success) throw new Error(data?.error || "Failed to fetch wallet balance");

      const balance = data.wallets[0]?.balance || 0;
      if (balance > 0) {
        setValidationError(`This wallet has a balance of ${balance} LANA. Only wallets with 0 balance can be registered as virgin.`);
        setIsValid(false);
      } else {
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

  // Debounced virgin validation
  useEffect(() => {
    if (activeTab !== "virgin") return;
    if (validationTimeoutRef.current) clearTimeout(validationTimeoutRef.current);
    if (walletNumber && walletNumber.length >= 10) {
      validationTimeoutRef.current = setTimeout(() => validateVirginWallet(walletNumber), 800);
    } else {
      setValidationError(null);
      setIsValid(false);
    }
    return () => { if (validationTimeoutRef.current) clearTimeout(validationTimeoutRef.current); };
  }, [walletNumber, activeTab]);

  // ====== REGISTERED LANAS VALIDATION ======
  const validateRegisteredLanas = async (walletId: string) => {
    if (!walletId || walletId.length < 10) {
      setAddressError(null);
      setIsAddressValid(false);
      setSendersValid(false);
      setSenderStats(null);
      setSenderValidationError(null);
      setWalletBalance(null);
      return;
    }

    setIsCheckingAddress(true);
    setAddressError(null);
    setIsAddressValid(false);
    setSendersValid(false);
    setSenderStats(null);
    setSenderValidationError(null);
    setWalletBalance(null);

    try {
      // Step 1: Validate address format
      const structureValidation = await validateLanaAddress(walletId);
      if (!structureValidation.valid) {
        setAddressError(structureValidation.error || "Invalid wallet address format");
        setIsCheckingAddress(false);
        return;
      }

      // Step 2: Check if already registered
      const { data: existingWallet } = await supabase
        .from("wallets")
        .select("id, wallet_id")
        .eq("wallet_id", walletId)
        .maybeSingle();

      if (existingWallet) {
        setAddressError("This wallet is already registered in the system.");
        setIsCheckingAddress(false);
        return;
      }

      setIsAddressValid(true);
      setIsCheckingAddress(false);

      // Step 3: Fetch balance
      const { data: systemParams } = await supabase
        .from("system_parameters")
        .select("electrum")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!systemParams?.electrum) throw new Error("No Electrum servers configured");

      const electrumServers = (systemParams.electrum as any[]).map(server => ({
        host: server.host,
        port: parseInt(server.port, 10)
      }));

      const { data: balanceData } = await supabase.functions.invoke("fetch-wallet-balance", {
        body: { wallet_addresses: [walletId], electrum_servers: electrumServers },
      });

      if (balanceData?.success) {
        setWalletBalance(balanceData.wallets[0]?.balance || 0);
      }

      // Step 4: Validate senders
      setIsValidatingSenders(true);
      const { data: senderData, error: senderError } = await supabase.functions.invoke("validate-wallet-senders", {
        body: { wallet_address: walletId, electrum_servers: electrumServers },
      });

      if (senderError || !senderData?.success) {
        throw new Error(senderData?.error || "Failed to validate senders");
      }

      setSenderStats({
        totalSenders: senderData.totalSenders,
        registeredSenders: senderData.registeredSenders,
        unregisteredSenders: senderData.unregisteredSenders,
      });

      if (senderData.allRegistered) {
        setSendersValid(true);
      } else {
        setSenderValidationError(
          `Found ${senderData.unregisteredSenders.length} unregistered sender(s). All senders must be registered.`
        );
      }
    } catch (err) {
      console.error("Error validating registered lanas:", err);
      setSenderValidationError("Failed to validate wallet senders. Please try again.");
    } finally {
      setIsCheckingAddress(false);
      setIsValidatingSenders(false);
    }
  };

  // Debounced registered lanas validation
  useEffect(() => {
    if (activeTab !== "registered") return;
    if (senderValidationTimeoutRef.current) clearTimeout(senderValidationTimeoutRef.current);
    if (walletNumber && walletNumber.length >= 10) {
      senderValidationTimeoutRef.current = setTimeout(() => validateRegisteredLanas(walletNumber), 800);
    } else {
      setAddressError(null);
      setIsAddressValid(false);
      setSendersValid(false);
      setSenderStats(null);
      setSenderValidationError(null);
      setWalletBalance(null);
    }
    return () => { if (senderValidationTimeoutRef.current) clearTimeout(senderValidationTimeoutRef.current); };
  }, [walletNumber, activeTab]);

  // ====== SUBMIT ======
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const session = getAuthSession();
    if (!session) {
      toast.error("You must be logged in to add a wallet");
      return;
    }

    if (!walletNumber || !description) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeTab === "virgin") {
        if (!isValid) {
          toast.error("Please ensure the wallet passes all validations");
          return;
        }

        const { data, error } = await supabase.functions.invoke("register-virgin-wallets", {
          body: {
            method: "register_virgin_wallets_for_existing_user",
            api_key: "lk_w1fHNwvEKpCtgGjXqIEFz1yKEynnwuoe",
            data: {
              nostr_id_hex: session.nostrHexId,
              wallets: [{ wallet_id: walletNumber, wallet_type: type, notes: description }]
            }
          }
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Registration failed");
      } else {
        if (!sendersValid) {
          toast.error("Please ensure all senders are registered");
          return;
        }

        const { data, error } = await supabase.functions.invoke("register-virgin-wallets", {
          body: {
            method: "register_wallet_with_registered_lanas",
            api_key: "lk_w1fHNwvEKpCtgGjXqIEFz1yKEynnwuoe",
            data: {
              nostr_id_hex: session.nostrHexId,
              wallet_id: walletNumber,
              wallet_type: type,
              notes: description
            }
          }
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Registration failed");
      }

      toast.success("Wallet successfully registered!");
      navigate("/wallets");
    } catch (err: any) {
      toast.error(err.message || "Failed to register wallet");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ====== QR SCANNING ======
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
            camera.label.toLowerCase().includes('back') || camera.label.toLowerCase().includes('rear')
          );
          if (backCamera) selectedCamera = backCamera;
        }
        const scanner = new Html5Qrcode("qr-reader-wallet");
        scannerRef.current = scanner;
        await scanner.start(
          selectedCamera.id,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            setWalletNumber(decodedText);
            stopScanning();
            toast.success("Wallet ID scanned successfully");
          },
          () => {}
        );
      } catch (error: any) {
        console.error("Error starting QR scanner:", error);
        setIsScanning(false);
        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
          toast.error("Camera permission denied.");
        } else if (error.name === "NotFoundError") {
          toast.error("No camera found on this device");
        } else {
          toast.error(`Error starting camera: ${error.message || "Unknown error"}`);
        }
      }
    }, 100);
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current = null; } catch (e) {}
    }
    setIsScanning(false);
  };

  const isVirginSubmitEnabled = isValid && !isValidating && !isScanning && !isSubmitting;
  const isRegisteredSubmitEnabled = sendersValid && !isValidatingSenders && !isScanning && !isSubmitting && isAddressValid;

  // ====== SHARED FORM FIELDS ======
  const renderWalletInput = () => (
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
        <Button type="button" variant="outline" onClick={startScanning} className="w-full gap-2">
          <QrCode className="h-4 w-4" />
          Scan Wallet QR Code
        </Button>
      ) : (
        <div className="space-y-4">
          <div id="qr-reader-wallet" ref={scannerDivRef} className="rounded-lg overflow-hidden border-2 border-primary" />
          <Button type="button" variant="destructive" onClick={stopScanning} className="w-full">Stop Scanning</Button>
        </div>
      )}
    </div>
  );

  const renderTypeAndDescription = (lockToWallet = false) => (
    <>
      <div className="space-y-2">
        <Label htmlFor="type">Wallet Type</Label>
        {lockToWallet ? (
          <Input id="type" value="Wallet" disabled className="bg-muted" />
        ) : (
          <Select value={type} onValueChange={(value: any) => setType(value)}>
            <SelectTrigger id="type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {walletTypes.map((walletType) => (
                <SelectItem key={walletType.id} value={walletType.name}>{walletType.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
    </>
  );

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/wallets")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Add New Wallet</h1>
            <p className="mt-1 text-muted-foreground">Register a new LAN wallet</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="virgin" className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              Virgin Wallet
            </TabsTrigger>
            <TabsTrigger value="registered" className="gap-2">
              <Wallet className="h-4 w-4" />
              Registered Lanas
            </TabsTrigger>
          </TabsList>

          {/* ====== VIRGIN WALLET TAB ====== */}
          <TabsContent value="virgin">
            <form onSubmit={handleSubmit} className="space-y-6 bg-card p-6 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                Register a wallet with zero balance (virgin wallet). The wallet must have never received any LANA.
              </p>

              {renderWalletInput()}

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

              {renderTypeAndDescription()}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => navigate("/wallets")} disabled={isScanning}>Cancel</Button>
                <Button
                  type="submit"
                  disabled={!isVirginSubmitEnabled}
                  className={isVirginSubmitEnabled ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Registering..." : "Add Wallet"}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* ====== REGISTERED LANAS TAB ====== */}
          <TabsContent value="registered">
            <form onSubmit={handleSubmit} className="space-y-6 bg-card p-6 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                Register a wallet that contains LANA from registered wallets. All sender addresses must already be registered in the system.
              </p>

              {renderWalletInput()}

              {/* Address validation */}
              {isCheckingAddress && walletNumber && (
                <Alert>
                  <AlertDescription className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking wallet address...
                  </AlertDescription>
                </Alert>
              )}
              {addressError && (
                <Alert variant="destructive">
                  <AlertDescription>{addressError}</AlertDescription>
                </Alert>
              )}
              {isAddressValid && !isCheckingAddress && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                  <AlertDescription className="text-green-700 dark:text-green-400">
                    ✓ Wallet address is available
                  </AlertDescription>
                </Alert>
              )}

              {/* Balance info */}
              {walletBalance !== null && (
                <Alert>
                  <AlertDescription className="flex items-center gap-2">
                    💰 Balance: <Badge variant="secondary">{walletBalance} LANA</Badge>
                  </AlertDescription>
                </Alert>
              )}

              {/* Sender validation */}
              {isValidatingSenders && (
                <Alert>
                  <AlertDescription className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Validating sender addresses...
                  </AlertDescription>
                </Alert>
              )}

              {sendersValid && senderStats && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                  <AlertDescription className="text-green-700 dark:text-green-400">
                    ✓ All {senderStats.totalSenders} sender(s) are registered
                  </AlertDescription>
                </Alert>
              )}

              {senderValidationError && (
                <Alert variant="destructive">
                  <AlertDescription>{senderValidationError}</AlertDescription>
                </Alert>
              )}

              {senderStats && senderStats.unregisteredSenders.length > 0 && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 space-y-3">
                  <h4 className="font-semibold text-destructive text-sm">
                    Cannot Register Wallet — {senderStats.unregisteredSenders.length} unregistered sender(s)
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {senderStats.unregisteredSenders.slice(0, 10).map((sender, idx) => (
                      <div key={idx} className="text-xs font-mono text-muted-foreground bg-muted/50 rounded px-2 py-1">
                        {sender}
                      </div>
                    ))}
                    {senderStats.unregisteredSenders.length > 10 && (
                      <p className="text-xs text-muted-foreground">
                        ...and {senderStats.unregisteredSenders.length - 10} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              {renderTypeAndDescription(true)}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => navigate("/wallets")} disabled={isScanning}>Cancel</Button>
                <Button
                  type="submit"
                  disabled={!isRegisteredSubmitEnabled}
                  className={isRegisteredSubmitEnabled ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Registering..." : "Add Wallet"}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AddWallet;
