import { SimplePool, Event } from "nostr-tools";
import { UserProfile } from "./wifAuth";

const DEFAULT_LANA_RELAYS = [
  "wss://nostr1.lanacoin.com",
  "wss://relay.lanaheartvoice.com",
  "wss://relay.lovelana.org",
  "wss://relay.lanavault.space",
  "wss://relay.lanacoin-eternity.com"
];

export async function fetchUserProfile(publicKeyHex: string): Promise<UserProfile | null> {
  const pool = new SimplePool();
  
  // Get relays from sessionStorage (system_parameters) or use defaults
  let relays = DEFAULT_LANA_RELAYS;
  const storedParams = sessionStorage.getItem('lana_system_parameters');
  if (storedParams) {
    try {
      const params = JSON.parse(storedParams);
      if (params.relays && params.relays.length > 0) {
        relays = params.relays;
        console.log(`Using ${relays.length} relays from system parameters`);
      }
    } catch (e) {
      console.warn("Failed to parse system parameters, using default LanaCoin relays");
    }
  }
  
  try {
    // Fetch KIND 0 events for the user
    const events = await pool.querySync(relays, {
      kinds: [0],
      authors: [publicKeyHex],
      limit: 1
    });

    if (!events || events.length === 0) {
      return null;
    }

    // Get the most recent event
    const profileEvent = events.reduce((latest: Event, current: Event) => 
      current.created_at > latest.created_at ? current : latest
    );

    // Parse profile content
    const profile = JSON.parse(profileEvent.content) as UserProfile;

    // Validate required fields
    if (!profile.name) {
      throw new Error("Profile missing required field: name");
    }

    return profile;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  } finally {
    pool.close(relays);
  }
}

export function validateProfile(profile: UserProfile): { isValid: boolean; missing: string[] } {
  const requiredFields = [
    "name",
    "display_name",
    "about",
    "location",
    "country",
    "currency",
    "lanoshi2lash",
    "whoAreYou",
    "orgasmic_profile"
  ];

  const missing = requiredFields.filter(field => !profile[field]);

  return {
    isValid: missing.length === 0,
    missing
  };
}
