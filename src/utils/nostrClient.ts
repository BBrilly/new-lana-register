import { SimplePool, Event, Filter } from 'nostr-tools';

const RELAYS = [
  'wss://relay.lanavault.space',
  'wss://relay.lanacoin-eternity.com'
];

const AUTHORIZED_PUBKEY = '9eb71bf1e9c3189c78800e4c3831c1c1a93ab43b61118818c32e4490891a35b3';

export interface SystemParameters {
  relays: string[];
  electrum: Array<{ host: string; port: string }>;
  fx: {
    EUR: number;
    USD: number;
    GBP: number;
  };
  split: string;
  version: string;
  valid_from: string;
  trusted_signers: {
    Lana8Wonder: string[];
    LanaRegistrar: string[];
    LanaRooms: string[];
    LanaAlignment: string[];
    LanaPaysUs: string[];
    '100MillionFun': string[];
    LanaKnights: string[];
    LanaHelpsUs: string[];
  };
}

export interface RelayStatus {
  url: string;
  connected: boolean;
  latency?: number;
}

export class NostrClient {
  private pool: SimplePool;
  private relayStatuses: Map<string, RelayStatus>;

  constructor() {
    this.pool = new SimplePool();
    this.relayStatuses = new Map();
  }

  async fetchSystemParameters(): Promise<{
    parameters: SystemParameters | null;
    relayStatuses: RelayStatus[];
  }> {
    const filter: Filter = {
      kinds: [38888],
      authors: [AUTHORIZED_PUBKEY],
      '#d': ['main'],
      limit: 1
    };

    // Test initial relay connectivity and measure latency
    const relayStatusPromises = RELAYS.map(async (url) => {
      const startTime = Date.now();
      try {
        await this.pool.ensureRelay(url);
        const latency = Date.now() - startTime;
        const status: RelayStatus = { url, connected: true, latency };
        this.relayStatuses.set(url, status);
        return status;
      } catch (error) {
        console.error(`Failed to connect to ${url}:`, error);
        const status: RelayStatus = { url, connected: false };
        this.relayStatuses.set(url, status);
        return status;
      }
    });

    const initialRelayStatuses = await Promise.all(relayStatusPromises);

    // Fetch events from all connected relays
    const connectedRelays = RELAYS.filter(url => 
      this.relayStatuses.get(url)?.connected
    );

    if (connectedRelays.length === 0) {
      console.error('No relays connected');
      return { parameters: null, relayStatuses: initialRelayStatuses };
    }

    try {
      const events = await this.pool.querySync(connectedRelays, filter);
      
      if (events.length === 0) {
        console.warn('No kind 38888 events found');
        return { parameters: null, relayStatuses: initialRelayStatuses };
      }

      // Get the latest event
      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];

      // Verify the event
      if (!this.verifyEvent(latestEvent)) {
        console.error('Invalid event signature or pubkey');
        return { parameters: null, relayStatuses: initialRelayStatuses };
      }

      // Parse content
      const parameters = this.parseEventContent(latestEvent);
      
      if (!parameters) {
        return { parameters: null, relayStatuses: initialRelayStatuses };
      }

      // Now connect to ALL relays from the system parameters
      const allRelayStatuses = await this.connectToAllRelays(parameters.relays);
      
      // Store in session storage
      sessionStorage.setItem('lana_system_parameters', JSON.stringify(parameters));
      sessionStorage.setItem('lana_relay_statuses', JSON.stringify(allRelayStatuses));

      return { parameters, relayStatuses: allRelayStatuses };
    } catch (error) {
      console.error('Error fetching system parameters:', error);
      return { parameters: null, relayStatuses: initialRelayStatuses };
    }
  }

  private async connectToAllRelays(relays: string[]): Promise<RelayStatus[]> {
    console.log(`Connecting to ${relays.length} relays...`);
    
    const allRelayPromises = relays.map(async (url) => {
      // Check if already tested
      if (this.relayStatuses.has(url)) {
        return this.relayStatuses.get(url)!;
      }

      const startTime = Date.now();
      try {
        await this.pool.ensureRelay(url);
        const latency = Date.now() - startTime;
        const status: RelayStatus = { url, connected: true, latency };
        this.relayStatuses.set(url, status);
        console.log(`✓ Connected to ${url} (${latency}ms)`);
        return status;
      } catch (error) {
        console.error(`✗ Failed to connect to ${url}:`, error);
        const status: RelayStatus = { url, connected: false };
        this.relayStatuses.set(url, status);
        return status;
      }
    });

    return await Promise.all(allRelayPromises);
  }

  private verifyEvent(event: Event): boolean {
    // Verify pubkey matches authorized pubkey
    if (event.pubkey !== AUTHORIZED_PUBKEY) {
      return false;
    }

    // Verify d-tag is "main"
    const dTag = event.tags.find(t => t[0] === 'd');
    if (!dTag || dTag[1] !== 'main') {
      return false;
    }

    return true;
  }

  private parseEventContent(event: Event): SystemParameters | null {
    try {
      const content = JSON.parse(event.content);
      
      // Extract relays from tags
      const relays = event.tags
        .filter(t => t[0] === 'relay')
        .map(t => t[1]);

      // Extract electrum servers
      const electrum = event.tags
        .filter(t => t[0] === 'electrum')
        .map(t => ({ host: t[1], port: t[2] }));

      // Extract exchange rates
      const fxTags = event.tags.filter(t => t[0] === 'fx');
      const fx = {
        EUR: parseFloat(fxTags.find(t => t[1] === 'EUR')?.[2] || '0'),
        USD: parseFloat(fxTags.find(t => t[1] === 'USD')?.[2] || '0'),
        GBP: parseFloat(fxTags.find(t => t[1] === 'GBP')?.[2] || '0')
      };

      // Extract split, version, valid_from
      const split = event.tags.find(t => t[0] === 'split')?.[1] || '0';
      const version = event.tags.find(t => t[0] === 'version')?.[1] || '0';
      const valid_from = event.tags.find(t => t[0] === 'valid_from')?.[1] || '0';

      return {
        relays: relays.length > 0 ? relays : content.relays || [],
        electrum: electrum.length > 0 ? electrum : content.electrum || [],
        fx,
        split,
        version,
        valid_from,
        trusted_signers: content.trusted_signers || {
          Lana8Wonder: [],
          LanaRegistrar: [],
          LanaRooms: [],
          LanaAlignment: [],
          LanaPaysUs: [],
          '100MillionFun': [],
          LanaKnights: [],
          LanaHelpsUs: []
        }
      };
    } catch (error) {
      console.error('Error parsing event content:', error);
      return null;
    }
  }

  disconnect() {
    this.pool.close(RELAYS);
  }
}

export const getStoredParameters = (): SystemParameters | null => {
  const stored = sessionStorage.getItem('lana_system_parameters');
  return stored ? JSON.parse(stored) : null;
};

export const getStoredRelayStatuses = (): RelayStatus[] => {
  const stored = sessionStorage.getItem('lana_relay_statuses');
  return stored ? JSON.parse(stored) : [];
};
