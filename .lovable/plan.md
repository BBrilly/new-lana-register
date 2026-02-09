
# Popravek: API Key validacija v register-virgin-wallets

## Problem

Edge funkcija `register-virgin-wallets` preverja API kljuc v napacni tabeli. Trenutno isce kljuc v tabeli `app_settings` pod kljucem `registrar_api_key`, ki pa ne obstaja. Dejanski API kljuci so shranjeni v tabeli `api_keys`.

Ko poklices API s kljucem `ak_2phlibhnmhnqoie2hugf0h`, funkcija ne najde nastavitve v `app_settings` in vrne napako "API key configuration not found".

## Resitev

Spremenil bom validacijo API kljuca v edge funkciji, da bo preverjala tabelo `api_keys` namesto `app_settings`.

## Tehnicni detajli

**Datoteka:** `supabase/functions/register-virgin-wallets/index.ts`

Trenutna (napacna) logika na vrsticah 152-185:
- Isce `registrar_api_key` v tabeli `app_settings`
- Primerja poslan kljuc z najdeno vrednostjo

Nova logika:
- Poisca poslan `api_key` v tabeli `api_keys` (stolpec `api_key`)
- Preveri, da je kljuc aktiven (`is_active = true`)
- Preveri rate limiting (`rate_limit_per_hour` in `request_count_current_hour`)
- Posodobi `last_request_at` in `request_count_current_hour` ob uspesni uporabi

```typescript
// Step 1: Validate API Key against api_keys table
const { data: apiKeyRecord, error: apiKeyError } = await supabase
  .from("api_keys")
  .select("id, api_key, is_active, rate_limit_per_hour, request_count_current_hour")
  .eq("api_key", body.api_key)
  .maybeSingle();

if (apiKeyError || !apiKeyRecord) {
  return new Response(
    JSON.stringify({
      success: false,
      status: "unauthorized",
      error: "Invalid API key",
      correlation_id: correlationId
    }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

if (!apiKeyRecord.is_active) {
  return new Response(
    JSON.stringify({
      success: false,
      status: "unauthorized",
      error: "API key is deactivated",
      correlation_id: correlationId
    }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Update usage tracking
await supabase
  .from("api_keys")
  .update({
    last_request_at: new Date().toISOString(),
    request_count_current_hour: (apiKeyRecord.request_count_current_hour || 0) + 1
  })
  .eq("id", apiKeyRecord.id);
```

To je edina sprememba - ostala logika funkcije ostane nespremenjena.
