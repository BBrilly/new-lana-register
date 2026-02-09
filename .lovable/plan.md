

# Brisanje denarnic z dvojno potrditvijo in Nostr KIND 30889

## Kaj se bo spremenilo

### 1. Nova edge funkcija: `delete-wallet`
Ustvari novo edge funkcijo `supabase/functions/delete-wallet/index.ts`, ki:
- Sprejme `wallet_id` (UUID) in `api_key` (registrarjev kljuc)
- Preveri, da denarnica obstaja in da tip NI "Main Wallet", "Main", "Lana8Wonder" ali "Knights"/"LanaKnights"
- Prebere trenutni balance denarnice preko `fetch-wallet-balance`
- Zbrise denarnico iz tabele `wallets`
- Vstavi zapis v tabelo `deleted_wallets` z vsemi podatki (wallet_id, wallet_type, nostr_hex_id, reason, balance ob brisanju)
- Prebere vse preostale denarnice za tega uporabnika
- Podpise in objavi nov KIND 30889 event z posodobljenim seznamom denarnic (brez izbrisane) -- enaka logika kot v `register-virgin-wallets` (vrstice 522-549)

### 2. Sprememba WalletCard komponente (`src/components/WalletCard.tsx`)
- Skrij gumb za brisanje (Trash2 ikona) za denarnice tipa Main, Lana8Wonder in Knights
- Ob kliku na gumb za brisanje odpri **prvi dialog** z opozorilom: "Ali ste prepricani, da zelite zbrisati to denarnico?"
- Po prvi potrditvi odpri **drugi dialog** z besedilom: "To dejanje je nepovratno. Denarnica bo odstranjena iz registra. Potrdite brisanje." -- uporabnik mora klikniti "Da, zbrisi"
- Po drugi potrditvi poklice edge funkcijo `delete-wallet`
- Prikaze toast ob uspehu ali napaki
- Ob uspehu odstrani kartico iz prikaza (callback na parent)

### 3. Sprememba Wallets strani (`src/pages/Wallets.tsx`)
- Posodobi `handleDeleteWallet` da dejansko poklice edge funkcijo in refresha seznam denarnic

## Tehnicni detajli

### Edge funkcija `delete-wallet`
- Metoda: POST
- Body: `{ api_key, wallet_uuid, nostr_id_hex }`
- Validacija: preveri tip denarnice, preveri da pripada danemu nostr_id_hex
- Brisanje iz `wallets` tabele (service role key)
- Insert v `deleted_wallets` z razlogom "user_requested" in balanceom
- Fetch vseh preostalih walletov za main_wallet
- Podpis in objava KIND 30889 eventa z novim seznamom (brez izbrisane denarnice)
- Uporabi `nostr_registrar_nsec` iz `app_settings` za podpis (enako kot register-virgin-wallets)

### WalletCard spremembe
- Dodaj dva AlertDialog-a za dvojno potrditev
- Logika za skrivanje delete gumba:
  ```
  const canDelete = !["main", "lana8wonder", "knights", "lanaknights"].some(
    t => wallet.type.toLowerCase().includes(t)
  );
  ```
- Ce `canDelete` je false, se Trash2 ikona sploh ne prikaze
- Dodaj `isDeleting` state za loading indikator med brisanjem

### config.toml
- Dodaj zapis za novo edge funkcijo z `verify_jwt = false`

