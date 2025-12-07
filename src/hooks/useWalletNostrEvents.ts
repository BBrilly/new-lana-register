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

// Cache for all Kind 87003 events to avoid fetching multiple times
let cachedEvents: Kind87003Event[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION_MS = 60000; // 1 minute cache

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
        const now = Date.now();
        
        // Check if we have valid cached events
        if (cachedEvents && (now - cacheTimestamp) < CACHE_DURATION_MS) {
          console.log(`📦 Using cached Kind 87003 events for wallet: ${walletAddress}`);
          const walletEvents = cachedEvents.filter(e => e.walletId === walletAddress);
          console.log(`📥 Found ${walletEvents.length} cached events for wallet ${walletAddress}`);
          setEvents(walletEvents);
          setIsLoading(false);
          return;
        }

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

        console.log(`🔍 Fetching ALL Kind 87003 events from relays`);
        console.log(`📡 Using ${relaysToUse.length} relays:`, relaysToUse);

        const pool = new SimplePool();

        // Fetch ALL Kind 87003 events (without WalletID filter since some relays don't support it)
        const filter: Filter = {
          kinds: [87003],
          limit: 500
        };

        const fetchedEvents = await pool.querySync(relaysToUse, filter);
        
        console.log(`📥 Fetched ${fetchedEvents.length} total Kind 87003 events from relays`);

        // Parse all events
        const allParsedEvents: Kind87003Event[] = fetchedEvents.map((event: Event) => {
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
        allParsedEvents.sort((a, b) => b.createdAt - a.createdAt);

        // Cache all events
        cachedEvents = allParsedEvents;
        cacheTimestamp = now;

        // Filter for this specific wallet
        const walletEvents = allParsedEvents.filter(e => e.walletId === walletAddress);
        console.log(`📥 Found ${walletEvents.length} Kind 87003 events for wallet ${walletAddress}`);

        setEvents(walletEvents);
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

// Function to clear cache (useful for manual refresh)
export const clearNostrEventsCache = () => {
  cachedEvents = null;
  cacheTimestamp = 0;
};
