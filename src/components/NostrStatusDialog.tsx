import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, Lock, TrendingUp } from "lucide-react";
import { SystemParameters, RelayStatus } from "@/utils/nostrClient";

interface NostrStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  systemParams: SystemParameters | null;
  relayStatuses: RelayStatus[];
}

const NostrStatusDialog = ({
  open,
  onOpenChange,
  systemParams,
  relayStatuses,
}: NostrStatusDialogProps) => {
  const connectedRelays = relayStatuses.filter((r) => r.connected).length;
  const totalRelays = relayStatuses.length;

  if (!systemParams) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Wifi className="h-6 w-6 text-success" />
            Connected to Nostr Network
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Relay Status */}
          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              relays: {connectedRelays}/{totalRelays} connected
            </h3>
            <div className="space-y-3">
              {relayStatuses.map((relay) => (
                <div
                  key={relay.url}
                  className="flex items-center justify-between rounded-lg bg-secondary/20 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-3 w-3 rounded-full ${
                        relay.connected ? "bg-success" : "bg-destructive"
                      }`}
                    />
                    <span className="font-mono text-sm text-foreground">
                      {relay.url}
                    </span>
                  </div>
                  {relay.latency && (
                    <Badge variant="outline" className="bg-success/10 text-success">
                      {relay.latency}ms
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Exchange Rates */}
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Exchange Rates:</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-secondary/20 p-4">
                <p className="text-sm text-muted-foreground">EUR</p>
                <p className="text-xl font-bold text-foreground">
                  {systemParams.fx.EUR.toFixed(4)} per LANA
                </p>
              </div>
              <div className="rounded-lg bg-secondary/20 p-4">
                <p className="text-sm text-muted-foreground">USD</p>
                <p className="text-xl font-bold text-foreground">
                  {systemParams.fx.USD.toFixed(4)} per LANA
                </p>
              </div>
              <div className="rounded-lg bg-secondary/20 p-4">
                <p className="text-sm text-muted-foreground">GBP</p>
                <p className="text-xl font-bold text-foreground">
                  {systemParams.fx.GBP.toFixed(4)} per LANA
                </p>
              </div>
            </div>
          </Card>

          {/* System Info */}
          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">System Info:</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-secondary/20 p-4">
                <p className="text-sm text-muted-foreground">Split</p>
                <p className="text-xl font-bold text-foreground">{systemParams.split}</p>
              </div>
              <div className="rounded-lg bg-secondary/20 p-4">
                <p className="text-sm text-muted-foreground">Version</p>
                <p className="text-xl font-bold text-foreground">{systemParams.version}</p>
              </div>
              <div className="rounded-lg bg-secondary/20 p-4">
                <p className="text-sm text-muted-foreground">Valid from</p>
                <p className="text-sm font-bold text-foreground">
                  {new Date(parseInt(systemParams.valid_from) * 1000).toLocaleDateString()}
                </p>
              </div>
            </div>
          </Card>

          {/* Trusted Signers */}
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Trusted Signers</h3>
            </div>
            <div className="space-y-4">
              {Object.entries(systemParams.trusted_signers).map(([key, signers]) => (
                <div key={key} className="rounded-lg bg-secondary/20 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium text-foreground">{key}:</p>
                    <Badge variant="secondary">{signers.length} key(s)</Badge>
                  </div>
                  {signers.length > 0 ? (
                    <div className="space-y-1">
                      {signers.map((signer, idx) => (
                        <p
                          key={idx}
                          className="break-all font-mono text-xs text-muted-foreground"
                        >
                          {signer}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">
                      No signers configured
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* All Relays from System Parameters */}
          {systemParams.relays.length > 0 && (
            <Card className="p-6">
              <h3 className="mb-4 text-lg font-semibold text-foreground">
                All System Relays ({systemParams.relays.length}):
              </h3>
              <div className="space-y-2">
                {systemParams.relays.map((relay, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg bg-secondary/20 p-3 font-mono text-sm text-foreground"
                  >
                    {relay}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Electrum Servers */}
          {systemParams.electrum.length > 0 && (
            <Card className="p-6">
              <h3 className="mb-4 text-lg font-semibold text-foreground">
                Electrum Servers:
              </h3>
              <div className="space-y-2">
                {systemParams.electrum.map((server, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg bg-secondary/20 p-3"
                  >
                    <span className="font-mono text-sm text-foreground">
                      {server.host}
                    </span>
                    <Badge variant="outline">Port: {server.port}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NostrStatusDialog;
