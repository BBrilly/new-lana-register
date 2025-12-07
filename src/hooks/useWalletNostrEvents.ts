import { useState, useEffect } from 'react';
import { SimplePool, Event, Filter } from 'nostr-tools';
import { getStoredParameters, getStoredRelayStatuses } from '@/utils/nostrClient';

export interface Kind87003Event {
  id: string;
  walletId: string;
  userPubkey: string;
  txId?: string;
  linkedEvent?: string;
  unregisteredAmountLatoshis: string;
  content: string;
  createdAt: number;
}

export const useWalletNostrEvents = (walletAddress: string | undefined) => {
  const [events, setEvents] = useState<Kind87003Event[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setEvents([]);
      return;
    }

    const fetchEvents = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Get relays from stored parameters
        const params = getStoredParameters();
        const relayStatuses = getStoredRelayStatuses();
        
        // Use stored relays or fallback to default
        const defaultRelays = [
          'wss://relay.lanavault.space',
          'wss://relay.lanacoin-eternity.com'
        ];
        
        const connectedRelays = relayStatuses
          .filter(r => r.connected)
          .map(r => r.url);
        
        const relaysToUse = connectedRelays.length > 0 
          ? connectedRelays 
          : (params?.relays || defaultRelays);

        console.log(`🔍 Fetching Kind 87003 events for wallet: ${walletAddress}`);
        console.log(`📡 Using ${relaysToUse.length} relays`);

        const pool = new SimplePool();

        // Query for Kind 87003 events with WalletID tag matching this wallet
        const filter: Filter = {
          kinds: [87003],
          '#WalletID': [walletAddress],
          limit: 50
        };

        const fetchedEvents = await pool.querySync(relaysToUse, filter);
        
        console.log(`📥 Found ${fetchedEvents.length} Kind 87003 events for wallet ${walletAddress}`);

        // Parse events
        const parsedEvents: Kind87003Event[] = fetchedEvents.map((event: Event) => {
          const pTag = event.tags.find(t => t[0] === 'p');
          const walletIdTag = event.tags.find(t => t[0] === 'WalletID');
          const txTag = event.tags.find(t => t[0] === 'TX');
          const linkedEventTag = event.tags.find(t => t[0] === 'Linked_event');
          const amountTag = event.tags.find(t => t[0] === 'UnregistratedAmountLatoshis');

          return {
            id: event.id,
            walletId: walletIdTag?.[1] || '',
            userPubkey: pTag?.[1] || '',
            txId: txTag?.[1],
            linkedEvent: linkedEventTag?.[1],
            unregisteredAmountLatoshis: amountTag?.[1] || '0',
            content: event.content,
            createdAt: event.created_at
          };
        });

        // Sort by created_at descending
        parsedEvents.sort((a, b) => b.createdAt - a.createdAt);

        setEvents(parsedEvents);
        pool.close(relaysToUse);
      } catch (err) {
        console.error('Error fetching Nostr events:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch events');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [walletAddress]);

  return { events, isLoading, error };
};

// Helper function to convert latoshis to LANA
export const latoshisToLana = (latoshis: string): number => {
  return parseFloat(latoshis) / 100000000;
};
