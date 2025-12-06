-- Posodobljen trigger z izjemo za Knights denarnice
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
BEGIN
    -- Samo procesiraj transakcije kjer je prejemnik določen
    IF NEW.to_wallet_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Preveri če je prejemnik registrirana denarnica in pridobi wallet_type
    SELECT EXISTS(SELECT 1 FROM public.wallets WHERE id = NEW.to_wallet_id)
    INTO receiver_exists;
    
    -- Nadaljuj samo če je prejemnik registrirana denarnica
    IF NOT receiver_exists THEN
        RETURN NEW;
    END IF;
    
    -- Pridobi wallet_type prejemnika
    SELECT wallet_type INTO receiver_wallet_type 
    FROM public.wallets 
    WHERE id = NEW.to_wallet_id;
    
    -- NOVA LOGIKA: Če je prejemnik Knights denarnica, preskoči 
    -- (te transakcije obravnava blockchain-monitor in jih zapisuje v registered_lana_events)
    IF receiver_wallet_type = 'Knights' THEN
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
    IF NEW.notes IS NOT NULL THEN
        sender_address := substring(NEW.notes FROM 'From:\s*([A-Za-z0-9]+)');
        IF sender_address IS NULL THEN
            sender_address := substring(NEW.notes FROM 'Sender:\s*([A-Za-z0-9]+)');
        END IF;
        IF sender_address IS NULL THEN
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