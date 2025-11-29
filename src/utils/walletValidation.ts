// Wallet address validation utilities for LANA cryptocurrency

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Decode(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);
  
  const bytes = [0];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    const p = BASE58_ALPHABET.indexOf(c);
    if (p < 0) throw new Error('Invalid base58 character');
    
    let carry = p;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  
  // Count leading zeros
  let leadingOnes = 0;
  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    leadingOnes++;
  }
  
  const result = new Uint8Array(leadingOnes + bytes.length);
  bytes.reverse();
  result.set(bytes, leadingOnes);
  return result;
}

async function sha256d(data: Uint8Array): Promise<Uint8Array> {
  // First hash - TypeScript workaround for BufferSource type
  const hash1Buffer = await crypto.subtle.digest('SHA-256', data as unknown as BufferSource);
  const hash1 = new Uint8Array(hash1Buffer);
  
  // Second hash
  const hash2Buffer = await crypto.subtle.digest('SHA-256', hash1 as unknown as BufferSource);
  return new Uint8Array(hash2Buffer);
}

export async function validateLanaAddress(address: string): Promise<{ 
  valid: boolean; 
  error?: string 
}> {
  try {
    // Check if address starts with 'L' (LANA prefix)
    if (!address.startsWith('L')) {
      return { 
        valid: false, 
        error: 'LANA wallet addresses must start with "L"' 
      };
    }
    
    // Check minimum length (typical Bitcoin-style addresses are 26-35 characters)
    if (address.length < 26 || address.length > 35) {
      return { 
        valid: false, 
        error: 'Invalid wallet address length. Expected 26-35 characters.' 
      };
    }
    
    // Check if all characters are valid Base58
    for (let i = 0; i < address.length; i++) {
      if (BASE58_ALPHABET.indexOf(address[i]) === -1) {
        return { 
          valid: false, 
          error: `Invalid character "${address[i]}" at position ${i + 1}. Wallet addresses use Base58 encoding (no 0, O, I, or l).` 
        };
      }
    }
    
    // Decode and verify checksum
    let decoded: Uint8Array;
    try {
      decoded = base58Decode(address);
    } catch (error) {
      return { 
        valid: false, 
        error: 'Failed to decode wallet address. Invalid Base58 format.' 
      };
    }
    
    if (decoded.length < 5) {
      return { 
        valid: false, 
        error: 'Wallet address is too short after decoding.' 
      };
    }
    
    // Split payload and checksum
    const payload = decoded.slice(0, -4);
    const checksum = decoded.slice(-4);
    
    // Verify version byte (0x30 for LANA)
    if (payload[0] !== 0x30) {
      return { 
        valid: false, 
        error: `Invalid version byte. Expected LANA address format (0x30).` 
      };
    }
    
    // Verify checksum
    const hash = await sha256d(payload);
    const expectedChecksum = hash.slice(0, 4);
    
    for (let i = 0; i < 4; i++) {
      if (checksum[i] !== expectedChecksum[i]) {
        return { 
          valid: false, 
          error: 'Invalid checksum. The wallet address may be mistyped or corrupted.' 
        };
      }
    }
    
    // All checks passed
    return { valid: true };
    
  } catch (error) {
    console.error('Wallet validation error:', error);
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown validation error' 
    };
  }
}

export function isValidBase58(str: string): boolean {
  if (!str || str.length === 0) return false;
  
  for (let i = 0; i < str.length; i++) {
    if (BASE58_ALPHABET.indexOf(str[i]) === -1) {
      return false;
    }
  }
  
  return true;
}
