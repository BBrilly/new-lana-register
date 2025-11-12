import { Wallet } from "@/types/wallet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Info, Trash2, Wallet as WalletIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WalletCardProps {
  wallet: Wallet;
  onDelete: (id: string) => void;
}

const WalletCard = ({ wallet, onDelete }: WalletCardProps) => {
  const getTypeColor = (type: string) => {
    switch (type) {
      case "Hardware":
        return "bg-success/10 text-success";
      case "Software":
        return "bg-primary/10 text-primary";
      case "Exchange":
        return "bg-warning/10 text-warning";
      default:
        return "bg-muted text-muted-foreground";
    }
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

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <WalletIcon className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">{wallet.description}</h3>
                <Badge className={getTypeColor(wallet.type)}>{wallet.type}</Badge>
              </div>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{wallet.walletNumber}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(wallet.id)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-xs font-medium text-muted-foreground">LAN Stanje</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {wallet.lanAmount.toLocaleString("sl-SI", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">LAN</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-xs font-medium text-muted-foreground">EUR Vrednost</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              €{" "}
              {wallet.eurAmount.toLocaleString("sl-SI", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="mt-0.5 text-xs text-success">+2.5%</p>
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
            <h4 className="mb-2 text-sm font-semibold text-foreground">Zadnji Eventi</h4>
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
                        {event.type === "unregistered_lan" ? "Neregistrirana" : event.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString("sl-SI")}
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
