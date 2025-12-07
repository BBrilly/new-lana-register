import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send, AlertTriangle, Wallet, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { toast } from 'sonner';

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
  
  // Fetch balance for the source wallet
  const { balances, isLoading: isLoadingBalance } = useWalletBalances(walletUuid ? [walletUuid] : []);
  const walletBalance = walletUuid ? balances.get(walletUuid) : undefined;
  
  const amountLatoshis = parseInt(amount, 10);
  const amountLana = amountLatoshis / 100000000;
  const balanceLana = walletBalance ? walletBalance / 100000000 : 0;
  const fee = 0.0001; // Estimated fee in LAN
  const totalNeeded = amountLana + fee;
  const hasSufficientBalance = balanceLana >= totalNeeded;

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

  const handleSend = async () => {
    if (!privateKey.trim()) {
      toast.error('Please enter your private key (WIF)');
      return;
    }
    
    if (!hasSufficientBalance) {
      toast.error('Insufficient balance for this transaction');
      return;
    }
    
    setIsSending(true);
    
    try {
      // TODO: Implement actual transaction sending
      // This would call the consolidate-wallet edge function or similar
      toast.success('Transaction functionality coming soon');
    } catch (err) {
      console.error('Error sending transaction:', err);
      toast.error('Failed to send transaction');
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
                  ({amountLatoshis.toLocaleString()} latoshis)
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
                className="font-mono"
              />
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
              disabled={isSending || isLoadingSettings || !hasSufficientBalance || !privateKey.trim() || !!settingsError}
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
