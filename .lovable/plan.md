

# Implementacija dodajanja denarnic preko registrar API kljuca

## Kaj se spremeni

Gumb "Add Wallet" na strani `/wallets/add` bo dejansko poklical edge funkcijo `register-virgin-wallets` z registrarjevim API kljucem `lk_w1fHNwvEKpCtgGjXqIEFz1yKEynnwuoe`, tako da bo registracija identična zunanjemu API klicu.

## Kako bo delovalo

1. Uporabnik vnese wallet naslov, izbere tip in opis
2. Validacija preveri strukturo naslova, da ni duplikat, in da je balance 0 (to ze deluje)
3. Ob kliku "Add Wallet":
   - Prebere `nostrHexId` prijavljenega uporabnika iz seje
   - Poklice `register-virgin-wallets` edge funkcijo z registrarjevim kljucem
   - Prikaze rezultat (uspeh ali napaka)
   - Ob uspehu preusmeri nazaj na `/wallets`

## Tehnicni detajli

**Datoteka:** `src/pages/AddWallet.tsx`

Spremembe:
- Uvoz `getAuthSession` iz `@/utils/wifAuth`
- Dodano stanje `isSubmitting` za loading indikator
- `handleSubmit` zamenja TODO komentar z dejanskim klicem:

```typescript
const session = getAuthSession();
if (!session) {
  toast.error("You must be logged in to add a wallet");
  return;
}

setIsSubmitting(true);
try {
  const { data, error } = await supabase.functions.invoke("register-virgin-wallets", {
    body: {
      method: "register_virgin_wallets_for_existing_user",
      api_key: "lk_w1fHNwvEKpCtgGjXqIEFz1yKEynnwuoe",
      data: {
        nostr_id_hex: session.nostrHexId,
        wallets: [{
          wallet_id: walletNumber,
          wallet_type: type,
          notes: description
        }]
      }
    }
  });

  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Registration failed");

  toast.success("Wallet successfully registered!");
  navigate("/wallets");
} catch (err) {
  toast.error(err.message || "Failed to register wallet");
} finally {
  setIsSubmitting(false);
}
```

- Gumb "Add Wallet" prikaze spinner med posiljanjem in je onemogocen med klicem
- `isSubmitting` dodan v disable pogoje gumba

