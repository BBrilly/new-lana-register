import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, Key } from "lucide-react";
import CodeBlock from "./CodeBlock";

const KeyDerivationDocs = () => {
  const utilityFunctions = `// Convert hexadecimal string to byte array
function hexToBytes(hex) {
    return new Uint8Array(hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
}

// Convert byte array to hexadecimal string
function bytesToHex(bytes) {
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// SHA-256 hash function using Web Crypto API
async function sha256(hex) {
    const buffer = hexToBytes(hex);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    return bytesToHex(new Uint8Array(hashBuffer));
}

// Double SHA-256 (SHA-256 of SHA-256)
async function sha256d(data) {
    const firstHash = await crypto.subtle.digest("SHA-256", data);
    const secondHash = await crypto.subtle.digest("SHA-256", firstHash);
    return new Uint8Array(secondHash);
}

// RIPEMD160 hash (requires CryptoJS library)
function ripemd160(data) {
    return CryptoJS.RIPEMD160(CryptoJS.enc.Hex.parse(data)).toString();
}

// Base58 encoding (Bitcoin/LanaCoin standard)
function base58Encode(bytes) {
    const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let num = BigInt('0x' + bytesToHex(bytes));
    let encoded = "";

    while (num > 0n) {
        let remainder = num % 58n;
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
function base58Decode(encoded) {
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
}`;

  const wifDecoding = `// Convert WIF to raw private key hex — supports BOTH formats
// Returns { privateKeyHex, isCompressed }
async function wifToPrivateKey(wif) {
    try {
        // Decode Base58
        const decoded = base58Decode(wif);

        // Extract components
        const payload = decoded.slice(0, -4);   // All except last 4 bytes
        const checksum = decoded.slice(-4);      // Last 4 bytes

        // Verify checksum (double SHA-256)
        const hash = await sha256d(payload);
        const expectedChecksum = hash.slice(0, 4);

        for (let i = 0; i < 4; i++) {
            if (checksum[i] !== expectedChecksum[i]) {
                throw new Error('Invalid WIF checksum');
            }
        }

        // Verify LanaCoin prefix — accept BOTH formats
        //   0xB0 = Dominate / uncompressed (altcoin convention: 0x30 + 0x80)
        //   0x41 = Staking / compressed (from chainparams.cpp SECRET_KEY=65) *preferred*
        if (payload[0] !== 0xB0 && payload[0] !== 0x41) {
            throw new Error('Invalid LANA WIF prefix');
        }

        // Detect compression:
        //   33 bytes = version(1) + key(32) -> uncompressed
        //   34 bytes = version(1) + key(32) + flag(1) -> compressed
        const isCompressed = payload.length === 34 && payload[33] === 0x01;

        // Extract 32-byte private key (bytes 1-33) — same slice for both
        const privateKey = payload.slice(1, 33);
        return { privateKeyHex: bytesToHex(privateKey), isCompressed };

    } catch (error) {
        throw new Error(\`Invalid WIF format: \${error.message}\`);
    }
}`;

  const publicKeyGeneration = `// Generate UNCOMPRESSED public key (65 bytes: 04 + x + y)
function generatePublicKey(privateKeyHex) {
    const ec = new elliptic.ec('secp256k1');
    const keyPair = ec.keyFromPrivate(privateKeyHex);
    const pubKeyPoint = keyPair.getPublic();

    return "04" +
           pubKeyPoint.getX().toString(16).padStart(64, '0') +
           pubKeyPoint.getY().toString(16).padStart(64, '0');
}

// Generate COMPRESSED public key (33 bytes: 02/03 + x)
// Prefix: 02 if y is even, 03 if y is odd
function generateCompressedPublicKey(privateKeyHex) {
    const ec = new elliptic.ec('secp256k1');
    const keyPair = ec.keyFromPrivate(privateKeyHex);
    const pubKeyPoint = keyPair.getPublic();

    const yBN = pubKeyPoint.getY();
    const prefix = yBN.isEven() ? "02" : "03";

    return prefix + pubKeyPoint.getX().toString(16).padStart(64, '0');
}

// Generate Nostr x-only public key (32 bytes: just x)
function deriveNostrPublicKey(privateKeyHex) {
    const ec = new elliptic.ec('secp256k1');
    const keyPair = ec.keyFromPrivate(privateKeyHex);
    const pubKeyPoint = keyPair.getPublic();

    return pubKeyPoint.getX().toString(16).padStart(64, '0');
}`;

  const addressGeneration = `// Generate LanaCoin wallet address from ANY public key type
async function generateLanaAddress(publicKeyHex) {
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
}`;

  const nostrKeyFormatting = `// Convert hex public key to npub format (requires bech32 library)
function hexToNpub(hexPubKey) {
    const data = hexToBytes(hexPubKey);
    const words = bech32.toWords(data);
    return bech32.encode('npub', words);
}

// Convert hex private key to nsec format
function hexToNsec(privateKeyHex) {
    const data = hexToBytes(privateKeyHex);
    const words = bech32.toWords(data);
    return bech32.encode('nsec', words);
}`;

  const completeConversion = `// Main function — derives BOTH wallet addresses from a single WIF
async function convertWifToIds(wif) {
    try {
        // Step 1: Extract private key and detect format
        const { privateKeyHex, isCompressed } = await wifToPrivateKey(wif);

        // Step 2: Generate BOTH public key types
        const uncompressedPubKey = generatePublicKey(privateKeyHex);
        const compressedPubKey = generateCompressedPublicKey(privateKeyHex);

        // Step 3: Generate BOTH LanaCoin Wallet IDs
        const uncompressedWalletId = await generateLanaAddress(uncompressedPubKey);
        const compressedWalletId = await generateLanaAddress(compressedPubKey);

        // Primary address matches the WIF compression flag
        const walletId = isCompressed ? compressedWalletId : uncompressedWalletId;

        // Step 4: Derive Nostr identifiers
        const nostrHexId = deriveNostrPublicKey(privateKeyHex);
        const nostrNpubId = hexToNpub(nostrHexId);
        const nostrNsecId = hexToNsec(privateKeyHex);

        return {
            walletId,               // Primary address (matches WIF type)
            compressedWalletId,     // Address from compressed pubkey
            uncompressedWalletId,   // Address from uncompressed pubkey
            isCompressed,           // WIF format detection result
            nostrHexId,             // Nostr public key (hex)
            nostrNpubId,            // Nostr public key (npub)
            nostrNsecId,            // Nostr private key (nsec)
            privateKeyHex           // Raw private key (hex)
        };

    } catch (error) {
        throw new Error(\`Conversion failed: \${error.message}\`);
    }
}`;

  const usageExamples = `// Dominate Format WIF (Uncompressed)
async function exampleDominateFormat() {
    // Dominate WIF starts with '6', prefix 0xB0, 51 characters
    const wif = "6v7y8KLxbYtvcp1PRQXLQBX5778cHVtvhfyjZorLsxp8P9MS97";

    const result = await convertWifToIds(wif);

    console.log("Format: Dominate (uncompressed)");
    console.log("isCompressed:", result.isCompressed);  // false
    console.log("Primary Address:", result.walletId);    // uncompressed
    console.log("Compressed Address:", result.compressedWalletId);
    console.log("Uncompressed Address:", result.uncompressedWalletId);
}

// Staking Format WIF (Compressed) — Preferred
async function exampleStakingFormat() {
    // Staking WIF starts with 'T', prefix 0x41, 52 characters
    // This is the PREFERRED format for new wallets
    const wif = "TnR2B1cM3TnR..."; // example Staking WIF

    const result = await convertWifToIds(wif);

    console.log("Format: Staking (compressed) — preferred");
    console.log("isCompressed:", result.isCompressed);  // true
    console.log("Primary Address:", result.walletId);    // compressed
    console.log("Compressed Address:", result.compressedWalletId);
    console.log("Uncompressed Address:", result.uncompressedWalletId);
}`;

  const cryptoFlowDiagram = `WIF Private Key (Base58)
         |
    Base58 Decode
         |
   Verify Checksum
         |
  Detect Format:
  0xB0 = Dominate (Uncompressed)    0x41 = Staking (Compressed) *preferred*
  (33-byte payload)                 (34-byte payload, 0x01 flag)
         |
  Extract Private Key (32 bytes)
         |
    +----+----+-----------------+
    |         |                 |
Uncompressed  Compressed     X-only
Public Key    Public Key    Public Key
(65 bytes)    (33 bytes)    (32 bytes)
04+x+y        02/03+x         x
    |         |                 |
 Hash160   Hash160          Bech32
    |         |             Encode
 +0x30     +0x30               |
    |         |            npub1...
 Base58    Base58
 Check     Check
    |         |
 Address   Address
 (Primary    (Primary
  if 0xB0     if 0x41
  Dominate)   Staking)`;

  const addressDerivationDiagram = `Private Key (32 bytes)
    |
    +---> Uncompressed PubKey (65 bytes: 04+x+y)
    |         |
    |     Hash160 -> Version 0x30 -> Base58Check
    |         |
    |     Address A  (e.g. "LXyz...")
    |
    +---> Compressed PubKey (33 bytes: 02/03+x)
              |
          Hash160 -> Version 0x30 -> Base58Check
              |
          Address B  (e.g. "LWab...")`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-primary" />
            <div>
              <CardTitle className="text-2xl">LanaCoin & Nostr Key Derivation</CardTitle>
              <CardDescription className="mt-1">
                Complete technical specifications for deriving LanaCoin wallet addresses and Nostr identifiers from a WIF (Wallet Import Format) private key
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            LanaCoin supports two WIF formats: <strong>Dominate</strong> (uncompressed, prefix 0xB0) and <strong>Staking</strong> (compressed, prefix 0x41). 
            The same private key produces two different wallet addresses depending on key type. 
            <strong className="text-primary"> The Staking format is the preferred format for new wallets.</strong>
          </p>
        </CardContent>
      </Card>

      {/* Dual WIF Format Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Dual WIF Format Overview
          </CardTitle>
          <CardDescription>LanaCoin uses two WIF private key formats</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Dominate Format (Uncompressed)</TableHead>
                  <TableHead>
                    <span className="flex items-center gap-2">
                      Staking Format (Compressed)
                      <Badge className="bg-primary text-primary-foreground text-[10px]">Preferred</Badge>
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Version byte</TableCell>
                  <TableCell><code className="px-1.5 py-0.5 rounded bg-muted text-foreground">0xB0 (176)</code></TableCell>
                  <TableCell><code className="px-1.5 py-0.5 rounded bg-muted text-foreground">0x41 (65)</code></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Starts with</TableCell>
                  <TableCell><code className="px-1.5 py-0.5 rounded bg-muted text-foreground">6</code></TableCell>
                  <TableCell><code className="px-1.5 py-0.5 rounded bg-muted text-foreground">T</code></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Length</TableCell>
                  <TableCell>51 characters</TableCell>
                  <TableCell>52 characters</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Payload size</TableCell>
                  <TableCell>33 bytes (version + 32-byte key)</TableCell>
                  <TableCell>34 bytes (version + 32-byte key + 0x01 flag)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Compression flag</TableCell>
                  <TableCell>None</TableCell>
                  <TableCell>0x01 appended after key</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Public key type</TableCell>
                  <TableCell>Uncompressed (65 bytes: 04 + x + y)</TableCell>
                  <TableCell>Compressed (33 bytes: 02/03 + x)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Address prefix</TableCell>
                  <TableCell><code className="px-1.5 py-0.5 rounded bg-muted text-foreground">L</code> (from version 0x30)</TableCell>
                  <TableCell><code className="px-1.5 py-0.5 rounded bg-muted text-foreground">L</code> (from version 0x30)</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Key insight:</strong> The same 32-byte private key produces two different wallet addresses because the public key format (compressed vs uncompressed) affects the Hash160 result.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
            <p className="text-sm font-medium text-foreground mb-1">Recommended: Staking Format</p>
            <p className="text-sm text-muted-foreground">
              The Staking format (prefix T, version 0x41, compressed) is the preferred WIF format for LanaCoin. 
              It uses compressed public keys which are more efficient and is the standard for staking operations. 
              The Dominate format (prefix 6, version 0xB0, uncompressed) remains fully supported for backward compatibility.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Key Derivation Process */}
      <Card>
        <CardHeader>
          <CardTitle>Key Derivation Process</CardTitle>
          <CardDescription>From a single WIF private key, you can derive all identifiers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">Derived Identifiers</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <strong className="text-foreground">Primary LanaCoin Wallet Address</strong> — Matches the WIF compression type
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <strong className="text-foreground">Secondary LanaCoin Wallet Address</strong> — The other compression type
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <strong className="text-foreground">Nostr Public Key (HEX)</strong> — 64-character x-only public key
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <strong className="text-foreground">Nostr Public Key (npub)</strong> — Bech32 encoded for Nostr protocol
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <strong className="text-foreground">Nostr Private Key (nsec)</strong> — Bech32 encoded private key
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Cryptographic Flow Diagram</h4>
            <CodeBlock code={cryptoFlowDiagram} sectionId="crypto-flow-diagram" />
          </div>
        </CardContent>
      </Card>

      {/* Step-by-Step Implementation */}
      <Card>
        <CardHeader>
          <CardTitle>Step-by-Step Implementation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Step 1 */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              Utility Functions
            </h4>
            <CodeBlock code={utilityFunctions} sectionId="kd-step1-utils" label="JavaScript" />
          </div>

          {/* Step 2 */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              WIF Private Key Decoding (Dual Format)
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              The WIF decoder must accept both version bytes and detect whether the key uses compressed or uncompressed public keys.
            </p>
            <CodeBlock code={wifDecoding} sectionId="kd-step2-wif" label="JavaScript" />

            <div className="mt-4 overflow-x-auto">
              <h5 className="text-sm font-medium text-foreground mb-2">WIF Format Detection Logic</h5>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Check</TableHead>
                    <TableHead>Dominate Format</TableHead>
                    <TableHead>Staking Format</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-sm">payload[0]</TableCell>
                    <TableCell><code className="px-1.5 py-0.5 rounded bg-muted text-foreground">0xB0</code></TableCell>
                    <TableCell><code className="px-1.5 py-0.5 rounded bg-muted text-foreground">0x41</code></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">payload.length</TableCell>
                    <TableCell>33</TableCell>
                    <TableCell>34</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">payload[33]</TableCell>
                    <TableCell className="text-muted-foreground">N/A</TableCell>
                    <TableCell><code className="px-1.5 py-0.5 rounded bg-muted text-foreground">0x01</code></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-sm">isCompressed</TableCell>
                    <TableCell><code className="px-1.5 py-0.5 rounded bg-muted text-foreground">false</code></TableCell>
                    <TableCell><code className="px-1.5 py-0.5 rounded bg-muted text-foreground">true</code></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Step 3 */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
              Public Key Generation (Both Types)
            </h4>
            <CodeBlock code={publicKeyGeneration} sectionId="kd-step3-pubkey" label="JavaScript" />

            <div className="mt-4 overflow-x-auto">
              <h5 className="text-sm font-medium text-foreground mb-2">Public Key Format Comparison</h5>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Used For</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Uncompressed</TableCell>
                    <TableCell>65 bytes</TableCell>
                    <TableCell className="font-mono text-sm">04 + x (32B) + y (32B)</TableCell>
                    <TableCell className="text-muted-foreground">Dominate LANA address (from 0xB0 WIF)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        Compressed
                        <Badge className="bg-primary text-primary-foreground text-[10px]">Preferred</Badge>
                      </span>
                    </TableCell>
                    <TableCell>33 bytes</TableCell>
                    <TableCell className="font-mono text-sm">02/03 + x (32B)</TableCell>
                    <TableCell className="text-muted-foreground">Staking LANA address (from 0x41 WIF)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">X-only</TableCell>
                    <TableCell>32 bytes</TableCell>
                    <TableCell className="font-mono text-sm">x (32B)</TableCell>
                    <TableCell className="text-muted-foreground">Nostr npub / nsec</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Step 4 */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
              LanaCoin Address Generation
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              The address generation process is identical for both public key types. The difference in the resulting address comes from the different Hash160 of the compressed vs uncompressed public key.
            </p>
            <CodeBlock code={addressGeneration} sectionId="kd-step4-address" label="JavaScript" />
          </div>

          {/* Step 5 */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">5</span>
              Nostr Key Formatting
            </h4>
            <CodeBlock code={nostrKeyFormatting} sectionId="kd-step5-nostr" label="JavaScript" />
          </div>

          {/* Step 6 */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">6</span>
              Complete Dual-Format Conversion
            </h4>
            <CodeBlock code={completeConversion} sectionId="kd-step6-complete" label="JavaScript" />
          </div>
        </CardContent>
      </Card>

      {/* Address Derivation Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Address Derivation Summary</CardTitle>
          <CardDescription>Given the same 32-byte private key, two different LanaCoin addresses are derived</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <CodeBlock code={addressDerivationDiagram} sectionId="kd-addr-diagram" />

          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground">
              Both addresses are valid and belong to the same private key. The WIF format determines which is considered "primary":
            </p>
            <ul className="mt-2 text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li><strong>Dominate WIF</strong> (prefix 6, version 0xB0): Primary = uncompressed address</li>
              <li><strong>Staking WIF</strong> (prefix T, version 0x41): Primary = compressed address — <strong className="text-primary">Preferred format</strong></li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Usage Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Examples</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <CodeBlock code={usageExamples} sectionId="kd-usage" label="JavaScript" />

          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Expected Output Format</h4>
            <CodeBlock 
              code={`Primary Wallet Address:     L... (Base58, starts with 'L')
Compressed Wallet Address:  L... (from compressed pubkey)
Uncompressed Wallet Address: L... (from uncompressed pubkey)
isCompressed:               true/false
Nostr Public Key (HEX):     64-character hexadecimal string
Nostr Public Key (npub):    npub1... (Bech32 encoded)
Nostr Private Key (nsec):   nsec1... (Bech32 encoded)
Private Key (HEX):          64-character hexadecimal string`}
              sectionId="kd-output-format"
            />
          </div>
        </CardContent>
      </Card>

      {/* Required Libraries */}
      <Card>
        <CardHeader>
          <CardTitle>Required Libraries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Browser</h4>
            <CodeBlock 
              code={`<script src="https://cdnjs.cloudflare.com/ajax/libs/elliptic/6.5.4/elliptic.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bech32@2.0.0/index.js"></script>`}
              sectionId="kd-libs-browser"
              label="HTML"
            />
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Node.js</h4>
            <CodeBlock 
              code={`npm install elliptic crypto-js bech32`}
              sectionId="kd-libs-node"
              label="Shell"
            />
          </div>
        </CardContent>
      </Card>

      {/* Security & Implementation Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Security & Implementation Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h4 className="font-medium text-foreground mb-2">Security</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-start gap-2"><span className="text-primary mt-1">•</span>Never expose private keys in production or shared environments</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1">•</span>Use cryptographically secure random number generation (crypto.getRandomValues)</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1">•</span>Always validate WIF format and checksum before processing</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1">•</span>Implement proper error handling for all cryptographic operations</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1">•</span>When importing a private key, always check both compressed and uncompressed addresses for existing funds</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-2">Implementation</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-start gap-2"><span className="text-primary mt-1">•</span>All hash functions use standard cryptographic libraries</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1">•</span>Elliptic curve operations use secp256k1 (same as Bitcoin)</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1">•</span>Base58 encoding follows Bitcoin standards (Base58Check)</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1">•</span>Bech32 encoding follows BIP-173 (for Nostr keys)</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1">•</span>LanaCoin uses version byte 0x30 (48) for addresses</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1">•</span>0xB0 (Dominate) = address version (0x30) + 0x80</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1">•</span>0x41 (Staking) from chainparams.cpp SECRET_KEY=65</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-1">•</span>Nostr x-only public keys are identical regardless of WIF format</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KeyDerivationDocs;
