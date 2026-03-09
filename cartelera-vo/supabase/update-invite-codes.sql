-- ============================================================================
-- Actualizar códigos de invitación a léxico canario
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================================

-- 1. Actualizar la función que genera códigos para nuevos usuarios
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS trigger AS $$
DECLARE
  v_words text[] := ARRAY[
    'GOFIO','MILLO','GUAGUA','PAPA','TIMPLE','BAIFO','PELETE','JAREA',
    'MAGUA','CHERNE','TUNERA','CALIMA','CHOLAS','COTUFAS','ROQUE','LEPE',
    'BUBANGO','PELLA','VIEJA','SANCOCHO','GAVETA','CHOSO','FECHILLO',
    'BEMBA','ENYESQUE','GUAYETE','TABAIBA','BOCHINCHE','CAMBADO',
    'GUINCHO','TENDERETE','PERENQUEN','MACHANGO','DRAGO','TAJINASTE',
    'TOLETE','FISCO','CHERCHA','EMBULLADO','PAPAYA','TEIDE','GUANCHE',
    'MENCEY','ALPISPA','RELEQUE'
  ];
  v_code text;
  v_attempts int := 0;
BEGIN
  IF NEW.invite_code IS NULL THEN
    LOOP
      v_code := v_words[1 + floor(random() * array_length(v_words, 1))::int]
                || (10 + floor(random() * 90))::int::text;
      IF NOT EXISTS (SELECT 1 FROM perfiles WHERE invite_code = v_code) THEN
        NEW.invite_code := v_code;
        EXIT;
      END IF;
      v_attempts := v_attempts + 1;
      IF v_attempts > 50 THEN
        -- Fallback en caso de muchas colisiones
        NEW.invite_code := upper(substr(md5(random()::text), 1, 8));
        EXIT;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Actualizar códigos existentes (reemplazar los viejos alfanuméricos)
DO $$
DECLARE
  r record;
  v_words text[] := ARRAY[
    'GOFIO','MILLO','GUAGUA','PAPA','TIMPLE','BAIFO','PELETE','JAREA',
    'MAGUA','CHERNE','TUNERA','CALIMA','CHOLAS','COTUFAS','ROQUE','LEPE',
    'BUBANGO','PELLA','VIEJA','SANCOCHO','GAVETA','CHOSO','FECHILLO',
    'BEMBA','ENYESQUE','GUAYETE','TABAIBA','BOCHINCHE','CAMBADO',
    'GUINCHO','TENDERETE','PERENQUEN','MACHANGO','DRAGO','TAJINASTE',
    'TOLETE','FISCO','CHERCHA','EMBULLADO','PAPAYA','TEIDE','GUANCHE',
    'MENCEY','ALPISPA','RELEQUE'
  ];
  v_code text;
BEGIN
  FOR r IN SELECT id FROM perfiles WHERE invite_code IS NULL
              OR length(invite_code) <= 6  -- old MD5-style codes are 6 chars
  LOOP
    LOOP
      v_code := v_words[1 + floor(random() * array_length(v_words, 1))::int]
                || (10 + floor(random() * 90))::int::text;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM perfiles WHERE invite_code = v_code);
    END LOOP;
    UPDATE perfiles SET invite_code = v_code WHERE id = r.id;
  END LOOP;
END;
$$;

-- 3. Verificar los nuevos códigos
SELECT nombre_display, invite_code FROM perfiles ORDER BY created_at;
