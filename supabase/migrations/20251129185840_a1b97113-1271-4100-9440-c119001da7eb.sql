-- ============================================
-- TABELA: rpc_nodes
-- Namen: Shramba podatkov o RPC vozliščih
-- ============================================

CREATE TABLE public.rpc_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    username TEXT,
    password TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.rpc_nodes IS 'Tabela za shranjevanje RPC node konfiguracij';

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.rpc_nodes ENABLE ROW LEVEL SECURITY;

-- Vsi lahko vidijo RPC node-e
CREATE POLICY "Everyone can view RPC nodes"
ON public.rpc_nodes
FOR SELECT
USING (true);

-- Samo autenticirani uporabniki (edge funkcije) lahko upravljajo
CREATE POLICY "Authenticated can insert RPC nodes"
ON public.rpc_nodes
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update RPC nodes"
ON public.rpc_nodes
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete RPC nodes"
ON public.rpc_nodes
FOR DELETE
USING (auth.role() = 'authenticated');

-- ============================================
-- POSODOBI TRIGGER detect_unregistered_lana
-- Da uporablja 'wallets' namesto 'user_wallets'
-- ============================================

CREATE OR REPLACE FUNCTION public.detect_unregistered_lana()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
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
$function$;