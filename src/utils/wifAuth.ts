import * as elliptic from 'elliptic';
import * as CryptoJS from 'crypto-js';
import { bech32 } from 'bech32';

const ec = new elliptic.ec('secp256k1');

// Convert hexadecimal string to byte array
function hexToBytes(hex: string): Uint8Array {
  const matches = hex.match(/.{2}/g);
  if (!matches) throw new Error('Invalid hex string');
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

// Convert byte array to hexadecimal string
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// SHA-256 hash function using Web Crypto API
async function sha256(hex: string): Promise<string> {
  const buffer = hexToBytes(hex);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer.buffer as ArrayBuffer);
  return bytesToHex(new Uint8Array(hashBuffer));
}

// Double SHA-256 (SHA-256 of SHA-256)
async function sha256d(data: Uint8Array): Promise<Uint8Array> {
  const firstHash = await crypto.subtle.digest("SHA-256", data.buffer as ArrayBuffer);
  const secondHash = await crypto.subtle.digest("SHA-256", firstHash);
  return new Uint8Array(secondHash);
}

// RIPEMD160 hash
function ripemd160(data: string): string {
  return CryptoJS.RIPEMD160(CryptoJS.enc.Hex.parse(data)).toString();
}

// Base58 encoding (Bitcoin/LanaCoin standard)
function base58Encode(bytes: Uint8Array): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = BigInt('0x' + bytesToHex(bytes));
  let encoded = "";
  
  while (num > 0n) {
    const remainder = num % 58n;
    num = num / 58n;
    encoded = alphabet[Number(remainder)] + encoded;
  }
  
  // Handle leading zeros
  for (const byte of bytes) {
    if (byte !== 0) break;
    encoded = '1' + encoded;
  }
  
  return encoded;
}

// Base58 decoding
function base58Decode(encoded: string): Uint8Array {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = 0n;
  
  for (const char of encoded) {
    const index = alphabet.indexOf(char);
    if (index === -1) throw new Error('Invalid Base58 character');
    num = num * 58n + BigInt(index);
  }
  
  let hex = num.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  
  let bytes = hexToBytes(hex);
  
  // Handle leading '1's (zeros)
  for (const char of encoded) {
    if (char !== '1') break;
    bytes = new Uint8Array([0, ...bytes]);
  }
  
  return bytes;
}

// Convert WIF to raw private key hex
async function wifToPrivateKey(wif: string): Promise<string> {
  try {
    // Decode Base58
    const decoded = base58Decode(wif);
    
    // Extract components
    const payload = decoded.slice(0, -4);
    const checksum = decoded.slice(-4);
    
    // Verify checksum
    const hash = await sha256d(payload);
    const expectedChecksum = hash.slice(0, 4);
    
    for (let i = 0; i < 4; i++) {
      if (checksum[i] !== expectedChecksum[i]) {
        throw new Error('Invalid WIF checksum');
      }
    }
    
    // Verify prefix (0xb0 for LanaCoin)
    if (payload[0] !== 0xb0) {
      throw new Error('Invalid WIF prefix');
    }
    
    // Extract private key (32 bytes after prefix)
    const privateKey = payload.slice(1, 33);
    return bytesToHex(privateKey);
    
  } catch (error) {
    throw new Error(`Invalid WIF format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Generate uncompressed public key from private key
function generatePublicKey(privateKeyHex: string): string {
  const keyPair = ec.keyFromPrivate(privateKeyHex);
  const pubKeyPoint = keyPair.getPublic();
  
  // Return uncompressed format (04 + x + y coordinates)
  return "04" + 
         pubKeyPoint.getX().toString(16).padStart(64, '0') + 
         pubKeyPoint.getY().toString(16).padStart(64, '0');
}

// Generate compressed public key for Nostr (x-only)
function deriveNostrPublicKey(privateKeyHex: string): string {
  const keyPair = ec.keyFromPrivate(privateKeyHex);
  const pubKeyPoint = keyPair.getPublic();
  
  // Return only x-coordinate (32 bytes)
  return pubKeyPoint.getX().toString(16).padStart(64, '0');
}

// Generate LanaCoin wallet address from public key
async function generateLanaAddress(publicKeyHex: string): Promise<string> {
  // Step 1: SHA-256 of public key
  const sha256Hash = await sha256(publicKeyHex);
  
  // Step 2: RIPEMD160 of SHA-256 hash
  const hash160 = ripemd160(sha256Hash);
  
  // Step 3: Add version byte (0x30 = 48 for LanaCoin)
  const versionedPayload = "30" + hash160;
  
  // Step 4: Double SHA-256 for checksum
  const checksum = await sha256(await sha256(versionedPayload));
  
  // Step 5: Take first 4 bytes of checksum
  const finalPayload = versionedPayload + checksum.substring(0, 8);
  
  // Step 6: Base58 encode
  return base58Encode(hexToBytes(finalPayload));
}

// Convert hex public key to npub format
function hexToNpub(hexPubKey: string): string {
  const data = hexToBytes(hexPubKey);
  const words = bech32.toWords(data);
  return bech32.encode('npub', words, 1000);
}

export interface WifAuthResult {
  walletId: string;
  nostrHexId: string;
  nostrNpubId: string;
  nostrPrivateKey: string;
}

export interface UserProfile {
  name: string;
  display_name?: string;
  about?: string;
  picture?: string;
  location?: string;
  country?: string;
  currency?: string;
  lanaWalletID?: string;
  whoAreYou?: string;
  language?: string;
  [key: string]: any;
}

// Main function to convert WIF to all derived identifiers
export async function convertWifToIds(wif: string): Promise<WifAuthResult> {
  try {
    // Step 1: Extract private key from WIF
    const privateKeyHex = await wifToPrivateKey(wif);
    
    // Step 2: Generate public keys
    const publicKeyHex = generatePublicKey(privateKeyHex);
    const nostrHexId = deriveNostrPublicKey(privateKeyHex);
    
    // Step 3: Generate addresses/identifiers
    const walletId = await generateLanaAddress(publicKeyHex);
    const nostrNpubId = hexToNpub(nostrHexId);
    
    return {
      walletId,
      nostrHexId,
      nostrNpubId,
      nostrPrivateKey: privateKeyHex
    };
    
  } catch (error) {
    throw new Error(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Store auth data in session
export function storeAuthSession(authData: WifAuthResult): void {
  sessionStorage.setItem('lana_auth', JSON.stringify(authData));
  sessionStorage.setItem('lana_authenticated', 'true');
}

// Get auth data from session
export function getAuthSession(): WifAuthResult | null {
  const authData = sessionStorage.getItem('lana_auth');
  const isAuthenticated = sessionStorage.getItem('lana_authenticated');
  
  if (!authData || isAuthenticated !== 'true') {
    return null;
  }
  
  return JSON.parse(authData);
}

// Check if user is authenticated (requires both auth and profile)
export function isAuthenticated(): boolean {
  const hasAuth = sessionStorage.getItem('lana_authenticated') === 'true';
  const hasProfile = sessionStorage.getItem('lana_user_profile') !== null;
  return hasAuth && hasProfile;
}

// Store user profile in session
export function storeUserProfile(profile: UserProfile): void {
  sessionStorage.setItem('lana_user_profile', JSON.stringify(profile));
}

// Get user profile from session
export function getUserProfile(): UserProfile | null {
  const profile = sessionStorage.getItem('lana_user_profile');
  return profile ? JSON.parse(profile) : null;
}

// Logout
export function logout(): void {
  sessionStorage.removeItem('lana_auth');
  sessionStorage.removeItem('lana_authenticated');
  sessionStorage.removeItem('lana_user_profile');
}
