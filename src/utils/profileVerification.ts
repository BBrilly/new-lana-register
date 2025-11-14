import { SimplePool, Event } from "nostr-tools";
import { UserProfile } from "./wifAuth";

const RELAYS = [
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
  "wss://nos.lol"
];

export async function fetchUserProfile(publicKeyHex: string): Promise<UserProfile | null> {
  const pool = new SimplePool();
  
  try {
    // Fetch KIND 0 events for the user
    const events = await pool.querySync(RELAYS, {
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
    pool.close(RELAYS);
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
