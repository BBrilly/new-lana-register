import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send, AlertTriangle, Wallet, ArrowRight, Loader2, QrCode, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import { getAuthSession } from '@/utils/wifAuth';
import { getStoredParameters, getStoredRelayStatuses } from '@/utils/nostrClient';
const SendToRegister = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const amount = searchParams.get('amount') || '0';
  const fromWallet = searchParams.get('from') || '';
  const walletUuid = searchParams.get('walletUuid') || '';
  const eventId = searchParams.get('eventId') || '';
  
  const [registerWallet, setRegisterWallet] = useState<string>('');
  const [privateKey, setPrivateKey] = useState('');
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  
  // Fetch balance using the wallet ADDRESS (not UUID)
  const { balances, isLoading: isLoadingBalance } = useWalletBalances(fromWallet ? [fromWallet] : []);
  // Balance from edge function is already in LAN, not lanoshis
  const balanceLana = fromWallet ? (balances.get(fromWallet) ?? 0) : 0;
  
  const amountLanoshis = parseInt(amount, 10);
  const amountLana = amountLanoshis / 100000000;
  const fee = 0.0001; // Estimated fee in LAN
  const totalNeeded = amountLana + fee;
  const hasSufficientBalance = balanceLana >= totalNeeded;

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const fetchRegisterWallet = async () => {
      setIsLoadingSettings(true);
      setSettingsError(null);
      
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'unregistered_lana_wallet')
          .single();
        
        if (error) {
          throw error;
        }
        
        if (data) {
          setRegisterWallet(data.value);
        } else {
          setSettingsError('Register wallet not configured in app settings');
        }
      } catch (err) {
        console.error('Error fetching register wallet:', err);
        setSettingsError('Failed to load register wallet address');
      } finally {
        setIsLoadingSettings(false);
      }
    };
    
    fetchRegisterWallet();
  }, []);

  const startScanning = async () => {
    setIsScanning(true);
    
    setTimeout(async () => {
      try {
        const cameras = await Html5Qrcode.getCameras();
        
        if (!cameras || cameras.length === 0) {
          toast.error('No camera found on this device');
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

        const scanner = new Html5Qrcode("qr-reader-send");
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
            toast.success('QR code scanned - WIF key detected');
          },
          () => {}
        );
      } catch (error: any) {
        console.error("Error starting QR scanner:", error);
        setIsScanning(false);
        
        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
          toast.error('Camera permission denied. Please allow camera access.');
        } else if (error.name === "NotFoundError") {
          toast.error('No camera found on this device');
        } else if (error.name === "NotReadableError") {
          toast.error('Camera is already in use by another application');
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

  const handleSend = async () => {
    if (!privateKey.trim()) {
      toast.error('Please enter your private key (WIF)');
      return;
    }
    
    if (!hasSufficientBalance) {
      toast.error('Insufficient balance for this transaction');
      return;
    }

    if (!registerWallet) {
      toast.error('Register wallet not configured');
      return;
    }
    
    setIsSending(true);
    
    try {
      // Get user session for pubkey
      const authSession = getAuthSession();
      if (!authSession) {
        toast.error('User session not found. Please log in again.');
        setIsSending(false);
        return;
      }
      
      // Get system parameters for electrum servers and relays
      const sysParams = getStoredParameters();
      const relayStatuses = getStoredRelayStatuses();
      
      // Get electrum servers
      let electrumServers: { host: string; port: number }[] = [
        { host: "electrum1.lanacoin.com", port: 5097 },
        { host: "electrum2.lanacoin.com", port: 5097 }
      ];
      if (sysParams?.electrum && Array.isArray(sysParams.electrum)) {
        electrumServers = (sysParams.electrum as any[]).map(e => ({ host: e.host, port: Number(e.port) }));
      }
      
      // Get connected relays
      let relays = relayStatuses
        .filter(r => r.connected)
        .map(r => r.url);
      if (relays.length === 0 && sysParams?.relays) {
        relays = sysParams.relays;
      }
      if (relays.length === 0) {
        relays = ['wss://relay.lanavault.space', 'wss://relay.lanacoin-eternity.com'];
      }
      
      toast.info('Building and broadcasting transaction...');
      
      const response = await supabase.functions.invoke('send-and-register-lana', {
        body: {
          sender_address: fromWallet,
          recipients: [
            { address: registerWallet, amount: amountLana }
          ],
          private_key: privateKey,
          electrum_servers: electrumServers,
          relays: relays,
          user_pubkey_hex: authSession.nostrHexId,
          original_event_id: eventId,
          from_wallet: fromWallet,
          to_wallet: registerWallet,
          amount_lanoshis: amount,
          memo: 'User regularized unregistered balance per 87003 notice.'
        }
      });
      
      if (response.error) {
        throw new Error(response.error.message || 'Failed to send transaction');
      }
      
      const result = response.data;
      
      if (!result.success) {
        throw new Error(result.error || 'Transaction failed');
      }
      
      // Success!
      toast.success(
        <div className="space-y-1">
          <p className="font-semibold">Transaction successful!</p>
          <p className="text-sm">TX: {result.txid?.slice(0, 16)}...</p>
          {result.nostr_event_published && (
            <p className="text-sm text-green-600">Kind 87009 event published</p>
          )}
        </div>,
        { duration: 10000 }
      );
      
      // Navigate back after success
      setTimeout(() => {
        navigate(-1);
      }, 2000);
      
    } catch (err) {
      console.error('Error sending transaction:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to send transaction');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 px-4 max-w-2xl">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Send Lanas to Register
            </CardTitle>
            <CardDescription>
              Send unregistered coins to the registration wallet
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Amount */}
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
              <Label className="text-sm text-muted-foreground">Amount to Send</Label>
              <div className="mt-1">
                <p className="text-2xl font-bold text-warning">
                  {amountLana.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 8
                  })} LAN
                </p>
                <p className="text-sm text-muted-foreground">
                  ({amountLanoshis.toLocaleString()} lanoshis)
                </p>
              </div>
            </div>
            
            {/* From/To Wallets */}
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm text-muted-foreground">From Wallet</Label>
                </div>
                <code className="text-sm font-mono break-all">{fromWallet}</code>
                
                <div className="mt-3 flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Balance:</Label>
                  {isLoadingBalance ? (
                    <Skeleton className="h-5 w-24" />
                  ) : (
                    <Badge variant={hasSufficientBalance ? "default" : "destructive"}>
                      {balanceLana.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 8
                      })} LAN
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex justify-center">
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
              </div>
              
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <Label className="text-sm text-muted-foreground">Register Wallet</Label>
                </div>
                {isLoadingSettings ? (
                  <Skeleton className="h-5 w-full" />
                ) : settingsError ? (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    {settingsError}
                  </div>
                ) : (
                  <code className="text-sm font-mono break-all">{registerWallet}</code>
                )}
              </div>
            </div>
            
            {/* Fee info */}
            <div className="rounded-lg border bg-muted/10 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network Fee (estimated):</span>
                <span>{fee} LAN</span>
              </div>
              <div className="flex justify-between font-medium mt-1">
                <span>Total Required:</span>
                <span>{totalNeeded.toLocaleString('en-US', { minimumFractionDigits: 4 })} LAN</span>
              </div>
            </div>
            
            {/* Balance warning */}
            {!isLoadingBalance && !hasSufficientBalance && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Insufficient balance. You need {totalNeeded.toFixed(8)} LAN but only have {balanceLana.toFixed(8)} LAN.</span>
                </div>
              </div>
            )}
            
            {/* Private Key Input */}
            <div className="space-y-2">
              <Label htmlFor="privateKey">Private Key (WIF)</Label>
              <Input
                id="privateKey"
                type="password"
                placeholder="Enter your private key to sign the transaction"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                disabled={isScanning}
                className="font-mono"
              />
              
              {!isScanning ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={startScanning}
                  disabled={isSending}
                  className="w-full"
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Scan QR Code
                </Button>
              ) : (
                <div className="space-y-2">
                  <div
                    id="qr-reader-send"
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
              
              <p className="text-xs text-muted-foreground">
                Your private key is used only to sign the transaction locally and is never sent to any server.
              </p>
            </div>
            
            {/* Event ID reference */}
            {eventId && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Event ID:</span>{' '}
                <code className="bg-muted px-1 rounded">{eventId.slice(0, 16)}...</code>
              </div>
            )}
            
            {/* Send Button */}
            <Button
              onClick={handleSend}
              disabled={isSending || isLoadingSettings || !hasSufficientBalance || !privateKey.trim() || !!settingsError || isScanning}
              className="w-full"
              size="lg"
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send {amountLana.toFixed(8)} LAN to Register
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default SendToRegister;