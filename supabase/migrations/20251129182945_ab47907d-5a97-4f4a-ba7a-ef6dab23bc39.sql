-- =============================================
-- 1. TABELA: block_tx
-- Namen: Shranjuje metadata o procesiranih blokih
-- =============================================
CREATE TABLE public.block_tx (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id INTEGER NOT NULL,
  time_staked TIMESTAMP WITH TIME ZONE NOT NULL,
  time_audit TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  all_block_transactions INTEGER NOT NULL DEFAULT 0,
  transaction_including_registered_wallets INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint za block_id - vsak blok se lahko procesa samo enkrat
  CONSTRAINT block_tx_block_id_key UNIQUE (block_id)
);

-- Indeksi za hitrejše iskanje
CREATE INDEX idx_block_tx_block_id ON public.block_tx USING btree (block_id);

-- RLS politike - vsi lahko vidijo, samo edge funkcije lahko pišejo
ALTER TABLE public.block_tx ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view block_tx" ON public.block_tx
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert block_tx" ON public.block_tx
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update block_tx" ON public.block_tx
  FOR UPDATE USING (auth.role() = 'authenticated');

-- =============================================
-- 2. TABELA: transactions
-- Namen: Shranjuje transakcije z registriranimi denarnicami
-- =============================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_wallet_id UUID NULL REFERENCES public.wallets(id) ON DELETE SET NULL,
  to_wallet_id UUID NULL REFERENCES public.wallets(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT NULL,
  block_id INTEGER NULL
);

-- Indeksi za hitrejše iskanje
CREATE INDEX idx_transactions_block_id ON public.transactions USING btree (block_id);
CREATE INDEX idx_transactions_created_at ON public.transactions USING btree (created_at);
CREATE INDEX idx_transactions_from_wallet ON public.transactions USING btree (from_wallet_id);
CREATE INDEX idx_transactions_to_wallet ON public.transactions USING btree (to_wallet_id);

-- RLS politike - vsi lahko vidijo, samo edge funkcije lahko pišejo
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view transactions" ON public.transactions
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update transactions" ON public.transactions
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete transactions" ON public.transactions
  FOR DELETE USING (auth.role() = 'authenticated');

-- =============================================
-- 3. TABELA: unregistered_lana_events
-- Namen: Shranjuje dogodke ko registrirana denarnica prejme Lana od neregistriranega pošiljatelja
-- =============================================
CREATE TABLE public.unregistered_lana_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  unregistered_amount NUMERIC NOT NULL,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT NULL,
  
  -- Nostr integracija
  nostr_event_id TEXT NULL,
  
  -- Return tracking (za vračilo Lana neregistriranemu pošiljatelju)
  return_transaction_date TIMESTAMP WITH TIME ZONE NULL,
  return_transaction_id TEXT NULL,
  return_amount_unregistered_lana NUMERIC NULL,
  return_wallet_id TEXT NULL
);

-- Indeksi za hitrejše iskanje
CREATE INDEX idx_unregistered_events_wallet ON public.unregistered_lana_events USING btree (wallet_id);
CREATE INDEX idx_unregistered_events_detected_at ON public.unregistered_lana_events USING btree (detected_at);

-- RLS politike - vsi lahko vidijo, samo edge funkcije lahko pišejo
ALTER TABLE public.unregistered_lana_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view unregistered events" ON public.unregistered_lana_events
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert unregistered events" ON public.unregistered_lana_events
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update unregistered events" ON public.unregistered_lana_events
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete unregistered events" ON public.unregistered_lana_events
  FOR DELETE USING (auth.role() = 'authenticated');

-- =============================================
-- FUNKCIJA: detect_unregistered_lana()
-- Namen: Ko je transakcija vstavljena v tabelo transactions,
--        preveri če prejemnik je registriran in pošiljatelj ni.
--        Če da, ustvari zapis v unregistered_lana_events.
-- =============================================
CREATE OR REPLACE FUNCTION public.detect_unregistered_lana()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sender_address TEXT;
    sender_exists BOOLEAN := FALSE;
    receiver_exists BOOLEAN := FALSE;
BEGIN
    -- Samo procesiraj transakcije kjer je prejemnik določen (to_wallet_id is not null)
    IF NEW.to_wallet_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Preveri če je prejemnik registrirana denarnica
    SELECT EXISTS(
        SELECT 1 FROM public.wallets 
        WHERE id = NEW.to_wallet_id
    ) INTO receiver_exists;
    
    -- Nadaljuj samo če je prejemnik registrirana denarnica
    IF NOT receiver_exists THEN
        RETURN NEW;
    END IF;
    
    -- Če je from_wallet_id določen, preveri če je registriran
    IF NEW.from_wallet_id IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM public.wallets 
            WHERE id = NEW.from_wallet_id
        ) INTO sender_exists;
        
        -- Če je pošiljatelj tudi registriran, ne naredi nič
        IF sender_exists THEN
            RETURN NEW;
        END IF;
    END IF;
    
    -- Izvleci naslov pošiljatelja iz notes polja če je na voljo
    -- Pričakovan format v notes: "From: [address]" ali podobni vzorci
    IF NEW.notes IS NOT NULL THEN
        -- Poišči vzorce kot "From: LAddress..." ali "Sender: LAddress..."
        sender_address := substring(NEW.notes FROM 'From:\s*([A-Za-z0-9]+)');
        IF sender_address IS NULL THEN
            sender_address := substring(NEW.notes FROM 'Sender:\s*([A-Za-z0-9]+)');
        END IF;
        IF sender_address IS NULL THEN
            -- Poskusi izvleči katerikoli naslov-podoben vzorec (začne z L in alfanumeričen)
            sender_address := substring(NEW.notes FROM '(L[A-Za-z0-9]{25,})');
        END IF;
    END IF;
    
    -- Vstavi unregistered Lana event
    INSERT INTO public.unregistered_lana_events (
        wallet_id,
        unregistered_amount,
        notes
    ) VALUES (
        NEW.to_wallet_id,
        NEW.amount,
        CASE 
            WHEN sender_address IS NOT NULL THEN 
                format('Unregistered sender: %s (Transaction ID: %s)', sender_address, NEW.id)
            ELSE 
                format('Unknown sender (Transaction ID: %s)', NEW.id)
        END
    );
    
    RETURN NEW;
END;
$$;

-- =============================================
-- TRIGGER: trigger_detect_unregistered_lana
-- Sproži se AFTER INSERT na tabeli transactions
-- =============================================
CREATE TRIGGER trigger_detect_unregistered_lana
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION detect_unregistered_lana();