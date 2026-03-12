

## Plan: Fix register-virgin-wallets timeout during Nostr broadcasting

### Problem
The edge function successfully inserts wallets into the database but then hangs during Nostr relay broadcasting (`pool.publish` + `Promise.allSettled`). The function times out before it can return a response or complete the KIND 30889 publish. Logs confirm: after "Broadcasting to relays" there are no further logs — the function hits the edge runtime timeout.

### Root Cause
`broadcastToRelays` calls `pool.publish(relays, event)` and waits for all relays via `Promise.allSettled`. If any relay connection hangs (doesn't connect or respond), the entire broadcast blocks indefinitely. There's no timeout on individual relay connections or on the overall broadcast operation.

### Solution
Add a timeout wrapper around the entire Nostr broadcasting phase so the function always returns a response, even if some relays are slow/unresponsive.

### Changes — `supabase/functions/register-virgin-wallets/index.ts`

#### 1. Add timeout to `broadcastToRelays`
Wrap `Promise.allSettled(promises)` in a `Promise.race` with a 8-second timeout. If relays don't respond in time, count them as failed but don't block the response.

```typescript
async function broadcastToRelays(...) {
  try {
    const promises = pool.publish(relays, event);
    const timeoutPromise = new Promise(resolve => 
      setTimeout(() => resolve("timeout"), 8000)
    );
    const raceResult = await Promise.race([
      Promise.allSettled(promises),
      timeoutPromise
    ]);
    
    if (raceResult === "timeout") {
      console.warn(`[${correlationId}] KIND ${event.kind} broadcast timed out after 8s`);
      return { success: true, eventId: event.id, acceptedRelays: 0, failedRelays: relays.length };
    }
    // ... count accepted/failed as before
  }
}
```

#### 2. Reduce the post-broadcast delay
Change `await new Promise(resolve => setTimeout(resolve, 1000))` to 300ms (in both `handleRegisterVirginWallets` and `handleCheckWallet`).

#### 3. Add overall timeout for the entire broadcast section
Wrap the Nostr broadcasting block (KIND 87006 + 87002 + 30889) in a `Promise.race` with a 30-second overall timeout, so the function always returns within the edge runtime limit.

#### 4. Deploy the updated function

No database changes needed. No frontend changes needed.

