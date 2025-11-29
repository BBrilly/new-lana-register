import { Wallet } from "@/types/wallet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Info, Trash2, Wallet as WalletIcon, Copy, Check, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useState } from "react";

interface WalletCardProps {
  wallet: Wallet;
  onDelete: (id: string) => void;
  userCurrency: string;
  fxRates: { EUR: number; GBP: number; USD: number } | null;
}

const WalletCard = ({ wallet, onDelete, userCurrency, fxRates }: WalletCardProps) => {
  const [copied, setCopied] = useState(false);

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case "EUR": return "€";
      case "USD": return "$";
      case "GBP": return "£";
      default: return currency;
    }
  };

  const currencySymbol = getCurrencySymbol(userCurrency);
  const exchangeRate = fxRates?.[userCurrency as keyof typeof fxRates] || 0;
  const fiatAmount = wallet.lanAmount * exchangeRate;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(wallet.walletNumber);
      setCopied(true);
      toast.success("Wallet ID copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const getTypeColor = (type: string) => {
    const lowerType = type.toLowerCase();
    
    if (lowerType.includes("main")) {
      return "bg-success/10 text-success";
    } else if (lowerType.includes("savings")) {
      return "bg-primary/10 text-primary";
    } else if (lowerType.includes("business")) {
      return "bg-purple-500/10 text-purple-500";
    } else if (lowerType.includes("lana8wonder")) {
      return "bg-orange-500/10 text-orange-500";
    } else if (lowerType.includes("lanapays")) {
      return "bg-red-500/10 text-red-500";
    } else if (lowerType.includes("hardware")) {
      return "bg-success/10 text-success";
    } else if (lowerType.includes("software")) {
      return "bg-primary/10 text-primary";
    } else if (lowerType.includes("exchange")) {
      return "bg-warning/10 text-warning";
    }
    
    return "bg-muted text-muted-foreground";
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "warning":
        return <AlertCircle className="h-4 w-4" />;
      case "success":
        return <CheckCircle className="h-4 w-4" />;
      case "info":
        return <Info className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const isMainWallet = wallet.type.toLowerCase().includes("main");
  const isLana8Wonder = wallet.type.toLowerCase().includes("lana8wonder");
  
  const cardBorderClass = isMainWallet 
    ? "border-success/50 bg-success/5" 
    : isLana8Wonder 
    ? "border-orange-500/50 bg-orange-500/5" 
    : "";

  return (
    <Card className={`overflow-hidden transition-all hover:shadow-md ${cardBorderClass}`}>
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${isMainWallet ? "bg-success/10" : isLana8Wonder ? "bg-orange-500/10" : "bg-primary/10"}`}>
              <WalletIcon className={`h-6 w-6 ${isMainWallet ? "text-success" : isLana8Wonder ? "text-orange-500" : "text-primary"}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">{wallet.type}</h3>
                {isMainWallet && <Badge className="bg-success/10 text-success">Main</Badge>}
                {isLana8Wonder && <Badge className="bg-orange-500/10 text-orange-500">Lana8Wonder</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{wallet.description}</p>
              <div className="mt-1 flex items-center gap-2">
                <p className="font-mono text-xs text-muted-foreground">ID: {wallet.walletNumber}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`https://chainz.cryptoid.info/lana/address.dws?${wallet.walletNumber}.htm`, '_blank')}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Transactions
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(wallet.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-xs font-medium text-muted-foreground">LAN Balance</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {wallet.lanAmount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">LAN</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-xs font-medium text-muted-foreground">{userCurrency} Value</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {currencySymbol}{" "}
              {fiatAmount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Rate: 1 LAN = {exchangeRate.toFixed(6)} {userCurrency}</p>
          </div>
        </div>

        {wallet.notification && (
          <Alert className="mt-4 border-l-4" variant={wallet.notification.type === "warning" ? "destructive" : "default"}>
            <div className="flex gap-2">
              {getNotificationIcon(wallet.notification.type)}
              <div className="flex-1">
                <AlertDescription className="text-sm">
                  <span className="font-medium">{wallet.notification.message}</span>
                  {wallet.notification.action && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {wallet.notification.action}
                    </span>
                  )}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        {wallet.events.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-semibold text-foreground">Recent Events</h4>
            <div className="space-y-2">
              {wallet.events.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className="flex items-start justify-between rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={event.type === "unregistered_lan" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {event.type === "unregistered_lan" ? "Unregistered" : event.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString("en-US")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{event.description}</p>
                  </div>
                  {event.amount && (
                    <div className="ml-4 text-right">
                      <p
                        className={`text-sm font-semibold ${
                          event.amount > 0 ? "text-success" : "text-destructive"
                        }`}
                      >
                        {event.amount > 0 ? "+" : ""}
                        {event.amount.toFixed(2)} LAN
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default WalletCard;
