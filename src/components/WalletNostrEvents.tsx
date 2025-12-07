import { useWalletNostrEvents, latoshisToLana } from '@/hooks/useWalletNostrEvents';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Radio, ExternalLink, AlertTriangle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WalletNostrEventsProps {
  walletAddress: string | undefined;
  walletUuid?: string;
}

const WalletNostrEvents = ({ walletAddress, walletUuid }: WalletNostrEventsProps) => {
  const { events, isLoading, error } = useWalletNostrEvents(walletAddress);
  const navigate = useNavigate();

  if (!walletAddress) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 animate-pulse text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Loading Nostr events...</span>
        </div>
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>Error loading Nostr events: {error}</span>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return null;
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('sl-SI', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const shortenId = (id: string) => {
    if (!id) return '';
    return `${id.slice(0, 8)}...${id.slice(-8)}`;
  };

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Radio className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">
          Nostr Events (Kind 87003)
        </h4>
        <Badge variant="secondary" className="text-xs">
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </Badge>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {events.map((event) => {
          const lanaAmount = latoshisToLana(event.unregisteredAmountLatoshis);
          
          return (
            <div
              key={event.id}
              className="rounded-lg border border-warning/30 bg-warning/5 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">
                      Unregistered
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(event.createdAt)}
                    </span>
                  </div>
                  
                  <p className="mt-1 text-sm text-foreground">
                    {event.content || 'Unregistered coins detected'}
                  </p>

                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Event ID:</span>
                      <code className="bg-muted px-1 rounded">{shortenId(event.id)}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4"
                        onClick={() => window.open(`https://njump.me/${event.id}`, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {event.txId && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">TX:</span>
                        <code className="bg-muted px-1 rounded">{shortenId(event.txId)}</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4"
                          onClick={() => window.open(`https://chainz.cryptoid.info/lana/tx.dws?${event.txId}.htm`, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    
                    {event.linkedEvent && event.linkedEvent !== '' && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Linked Event:</span>
                        <code className="bg-muted px-1 rounded">{shortenId(event.linkedEvent)}</code>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-warning">
                      {lanaAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 8
                      })} LAN
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ({event.unregisteredAmountLatoshis} latoshis)
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-primary/50 text-primary hover:bg-primary/10"
                    onClick={() => navigate(`/send-to-register?amount=${event.unregisteredAmountLatoshis}&from=${walletAddress}&walletUuid=${walletUuid || ''}&eventId=${event.id}`)}
                  >
                    <Send className="mr-1 h-3 w-3" />
                    Send to Register
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WalletNostrEvents;
