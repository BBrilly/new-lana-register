import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { validateLanaAddress } from "@/utils/walletValidation";

const AdminRegisterWallet = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [nostrHexId, setNostrHexId] = useState("");
  const [walletType, setWalletType] = useState("");
  const [notes, setNotes] = useState("");
  const [walletTypes, setWalletTypes] = useState<{ id: string; name: string }[]>([]);

  // Validation states
  const [isCheckingAddress, setIsCheckingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [isAddressValid, setIsAddressValid] = useState(false);

  const [isValidatingSenders, setIsValidatingSenders] = useState(false);
  const [senderValidationError, setSenderValidationError] = useState<string | null>(null);
  const [sendersValid, setSendersValid] = useState(false);
  const [senderStats, setSenderStats] = useState<{
    totalSenders: number;
    registeredSenders: number;
    unregisteredSenders: string[];
  } | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Profile lookup
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const addressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch all wallet types (not just visible_in_form)
  useEffect(() => {
    const fetchTypes = async () => {
      const { data } = await supabase
        .from("wallet_types")
        .select("id, name")
        .order("name");
      if (data) {
        setWalletTypes(data);
        if (data.length > 0) setWalletType(data[0].name);
      }
    };
    fetchTypes();
  }, []);

  // Debounced profile lookup
  useEffect(() => {
    if (profileTimeoutRef.current) clearTimeout(profileTimeoutRef.current);
    setProfileName(null);
    setProfileError(null);

    if (nostrHexId.length === 64 && /^[a-fA-F0-9]+$/.test(nostrHexId)) {
      setIsCheckingProfile(true);
      profileTimeoutRef.current = setTimeout(async () => {
        const { data, error } = await supabase
          .from("main_wallets")
          .select("name, display_name")
          .eq("nostr_hex_id", nostrHexId)
          .maybeSingle();

        if (error) {
          setProfileError("Error looking up profile");
        } else if (!data) {
          setProfileError("No profile found — a new one will be created upon registration");
          setProfileName(null);
        } else {
          setProfileName(data.display_name || data.name);
          setProfileError(null);
        }
        setIsCheckingProfile(false);
      }, 500);
    } else if (nostrHexId.length > 0) {
      setProfileError("Must be a 64-character hex string");
    }

    return () => { if (profileTimeoutRef.current) clearTimeout(profileTimeoutRef.current); };
  }, [nostrHexId]);

  // Debounced address validation + sender check
  useEffect(() => {
    if (addressTimeoutRef.current) clearTimeout(addressTimeoutRef.current);
    setAddressError(null);
    setIsAddressValid(false);
    setSendersValid(false);
    setSenderStats(null);
    setSenderValidationError(null);
    setWalletBalance(null);

    if (walletAddress.length >= 10) {
      addressTimeoutRef.current = setTimeout(() => validateAddress(walletAddress), 800);
    }

    return () => { if (addressTimeoutRef.current) clearTimeout(addressTimeoutRef.current); };
  }, [walletAddress]);

  const validateAddress = async (addr: string) => {
    setIsCheckingAddress(true);
    try {
      const structureCheck = await validateLanaAddress(addr);
      if (!structureCheck.valid) {
        setAddressError(structureCheck.error || "Invalid address format");
        setIsCheckingAddress(false);
        return;
      }

      const { data: existing } = await supabase
        .from("wallets")
        .select("id")
        .eq("wallet_id", addr)
        .maybeSingle();

      if (existing) {
        setAddressError("This wallet is already registered in the system.");
        setIsCheckingAddress(false);
        return;
      }

      setIsAddressValid(true);
      setIsCheckingAddress(false);

      // Fetch balance
      const { data: sysParams } = await supabase
        .from("system_parameters")
        .select("electrum")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sysParams?.electrum) throw new Error("No Electrum servers configured");

      const electrumServers = (sysParams.electrum as any[]).map(s => ({
        host: s.host,
        port: parseInt(s.port, 10)
      }));

      const { data: balanceData } = await supabase.functions.invoke("fetch-wallet-balance", {
        body: { wallet_addresses: [addr], electrum_servers: electrumServers },
      });

      if (balanceData?.success) {
        setWalletBalance(balanceData.wallets[0]?.balance || 0);
      }

      // Validate senders
      setIsValidatingSenders(true);
      const { data: senderData, error: senderError } = await supabase.functions.invoke("validate-wallet-senders", {
        body: { wallet_address: addr, electrum_servers: electrumServers },
      });

      if (senderError || !senderData?.success) {
        throw new Error(senderData?.error || "Failed to validate senders");
      }

      setSenderStats({
        totalSenders: senderData.totalSenders,
        registeredSenders: senderData.registeredSenders,
        unregisteredSenders: senderData.unregisteredSenders,
      });

      if (senderData.hasFrozenSenders) {
        setSenderValidationError(
          `Registration blocked: funds originate from ${senderData.frozenSenders.length} frozen wallet(s).`
        );
      } else if (senderData.allRegistered) {
        setSendersValid(true);
      } else {
        setSenderValidationError(
          `Found ${senderData.unregisteredSenders.length} unregistered sender(s). All senders must be registered.`
        );
      }
    } catch (err) {
      console.error("Validation error:", err);
      setSenderValidationError("Failed to validate wallet senders. Please try again.");
    } finally {
      setIsCheckingAddress(false);
      setIsValidatingSenders(false);
    }
  };

  const handleSubmit = async () => {
    if (!sendersValid || !nostrHexId || nostrHexId.length !== 64) {
      toast.error("Please ensure all validations pass before submitting");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-virgin-wallets", {
        body: {
          method: "register_wallet_with_registered_lanas",
          api_key: "lk_w1fHNwvEKpCtgGjXqIEFz1yKEynnwuoe",
          data: {
            nostr_id_hex: nostrHexId,
            wallet_id: walletAddress,
            wallet_type: walletType,
            notes: notes || null,
          }
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Registration failed");

      toast.success(`Wallet ${walletAddress} registered successfully for ${profileName || nostrHexId.slice(0, 8)}...`);

      // Reset form
      setWalletAddress("");
      setNostrHexId("");
      setNotes("");
      setIsAddressValid(false);
      setSendersValid(false);
      setSenderStats(null);
      setWalletBalance(null);
      setProfileName(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to register wallet");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = sendersValid && isAddressValid && nostrHexId.length === 64 && !isSubmitting && !isCheckingAddress && !isValidatingSenders && walletType;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Register Wallet with Registered Lanas
        </CardTitle>
        <CardDescription>
          Register a wallet for another user. All fund sources must originate from registered wallets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Nostr Hex ID */}
        <div className="space-y-2">
          <Label>Owner Nostr Hex ID</Label>
          <Input
            placeholder="64-character hex public key..."
            value={nostrHexId}
            onChange={(e) => setNostrHexId(e.target.value.trim())}
            className="font-mono text-xs"
          />
          {isCheckingProfile && <p className="text-xs text-muted-foreground">Looking up profile...</p>}
          {profileName && (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600 font-medium">Profile: {profileName}</span>
            </div>
          )}
          {profileError && (
            <p className="text-xs text-amber-600">{profileError}</p>
          )}
        </div>

        {/* Wallet Address */}
        <div className="space-y-2">
          <Label>Wallet Address</Label>
          <Input
            placeholder="LZgUUQALhZbCoQrUXEDDwJS1Pb99E1bJ27..."
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value.trim())}
            className="font-mono"
          />
          {isCheckingAddress && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-3 w-3 animate-spin" />
              Validating address...
            </div>
          )}
          {addressError && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">{addressError}</AlertDescription>
            </Alert>
          )}
          {isAddressValid && !isCheckingAddress && (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600">Address valid</span>
              {walletBalance !== null && (
                <Badge variant="secondary">{walletBalance} LANA</Badge>
              )}
            </div>
          )}
        </div>

        {/* Sender Validation Status */}
        {isValidatingSenders && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-3 w-3 animate-spin" />
            Validating fund sources...
          </div>
        )}
        {senderStats && (
          <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline">Total senders: {senderStats.totalSenders}</Badge>
              <Badge variant="outline">Registered: {senderStats.registeredSenders}</Badge>
              {senderStats.unregisteredSenders.length > 0 && (
                <Badge variant="destructive">Unregistered: {senderStats.unregisteredSenders.length}</Badge>
              )}
            </div>
            {sendersValid && (
              <Alert className="py-2 border-green-200 bg-green-50 dark:bg-green-950/30">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700 dark:text-green-400 text-xs">
                  All fund sources are from registered wallets. Ready to register.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
        {senderValidationError && (
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">{senderValidationError}</AlertDescription>
          </Alert>
        )}

        {/* Wallet Type */}
        <div className="space-y-2">
          <Label>Wallet Type</Label>
          <Select value={walletType} onValueChange={setWalletType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {walletTypes.map((t) => (
                <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Textarea
            placeholder="Registration notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Registering...
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4 mr-2" />
              Register Wallet
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminRegisterWallet;
