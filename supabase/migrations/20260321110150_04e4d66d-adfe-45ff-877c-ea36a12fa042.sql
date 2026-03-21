
-- 1. Update detect_unregistered_lana trigger to aggregate by blockchain TX hash
CREATE OR REPLACE FUNCTION public.detect_unregistered_lana()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    sender_address TEXT;
    sender_exists BOOLEAN := FALSE;
    receiver_exists BOOLEAN := FALSE;
    receiver_wallet_type TEXT;
    blockchain_tx_hash TEXT;
    existing_event_id UUID;
BEGIN
    -- Samo procesiraj transakcije kjer je prejemnik določen
    IF NEW.to_wallet_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Preveri če je prejemnik registrirana denarnica
    SELECT EXISTS(SELECT 1 FROM public.wallets WHERE id = NEW.to_wallet_id)
    INTO receiver_exists;
    
    IF NOT receiver_exists THEN
        RETURN NEW;
    END IF;
    
    -- Pridobi wallet_type prejemnika
    SELECT wallet_type INTO receiver_wallet_type 
    FROM public.wallets 
    WHERE id = NEW.to_wallet_id;
    
    -- Če je prejemnik Knights denarnica, preskoči
    IF receiver_wallet_type = 'Knights' THEN
        RETURN NEW;
    END IF;
    
    -- Če je from_wallet_id določen, preveri če je registriran
    IF NEW.from_wallet_id IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM public.wallets 
            WHERE id = NEW.from_wallet_id
        ) INTO sender_exists;
        
        IF sender_exists THEN
            RETURN NEW;
        END IF;
    END IF;
    
    -- Izvleci naslov pošiljatelja iz notes polja
    IF NEW.notes IS NOT NULL THEN
        sender_address := substring(NEW.notes FROM 'From:\s*([A-Za-z0-9]+)');
        IF sender_address IS NULL THEN
            sender_address := substring(NEW.notes FROM 'Sender:\s*([A-Za-z0-9]+)');
        END IF;
        IF sender_address IS NULL THEN
            sender_address := substring(NEW.notes FROM '(L[A-Za-z0-9]{25,})');
        END IF;
    END IF;
    
    -- Extract blockchain TX hash from notes (pattern: "blockchain transaction TXHASH" or "blockchain transaction TXHASH from")
    IF NEW.notes IS NOT NULL THEN
        blockchain_tx_hash := substring(NEW.notes FROM 'blockchain transaction ([a-f0-9]{64})');
    END IF;
    
    -- If we have a blockchain TX hash, check for existing record with same wallet + TX
    IF blockchain_tx_hash IS NOT NULL THEN
        SELECT id INTO existing_event_id
        FROM public.unregistered_lana_events
        WHERE wallet_id = NEW.to_wallet_id
          AND notes LIKE '%' || blockchain_tx_hash || '%'
        LIMIT 1;
        
        IF existing_event_id IS NOT NULL THEN
            -- Aggregate: add amount to existing record
            UPDATE public.unregistered_lana_events
            SET unregistered_amount = unregistered_amount + NEW.amount
            WHERE id = existing_event_id;
            RETURN NEW;
        END IF;
    END IF;
    
    -- No existing record found — insert new
    INSERT INTO public.unregistered_lana_events (
        wallet_id,
        unregistered_amount,
        notes
    ) VALUES (
        NEW.to_wallet_id,
        NEW.amount,
        CASE 
            WHEN sender_address IS NOT NULL THEN 
                format('Unregistered sender: %s (TX: %s)', sender_address, COALESCE(blockchain_tx_hash, NEW.id::text))
            ELSE 
                format('Unknown sender (TX: %s)', COALESCE(blockchain_tx_hash, NEW.id::text))
        END
    );
    
    RETURN NEW;
END;
$function$;

-- 2. Clean up existing duplicates for wallet d0492a41-0878-478f-ba2e-17c521fab92a
-- Keep the first record, delete the other two, and set amount to total (412.5)
UPDATE public.unregistered_lana_events 
SET unregistered_amount = 412.5,
    notes = 'Unregistered sender: LVFb4m4Zkm48Swgm1uPcyWL7yRDF5ePsML (TX: 09467515831a0bb045f6ca1d42f3b92d784df53bfbba9a02d500db0866ffb79f)'
WHERE id = '9ad4e042-5b8f-4774-abe6-9ae414df941f';

DELETE FROM public.unregistered_lana_events 
WHERE id IN ('dc08641c-a805-4648-ba45-14ca94639206', '669ac413-fe2f-43be-8700-c00da9c43c12');
