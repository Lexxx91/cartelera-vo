-- ================================================
-- VOSE WhatsApp Linking — Migration
-- ================================================

-- 1. Tokens temporales para vincular WhatsApp al perfil
-- El usuario pulsa "Conectar WhatsApp" → se genera un token corto
-- Se abre wa.me/34XXX?text=vose-TOKEN → Baileys recibe el mensaje
-- y vincula el JID del remitente al perfil del usuario.
CREATE TABLE IF NOT EXISTS whatsapp_link_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false
);

-- Index para buscar tokens no usados rapido
CREATE INDEX IF NOT EXISTS idx_wa_tokens_lookup
  ON whatsapp_link_tokens(token)
  WHERE used = false;

-- RLS: usuarios solo ven sus propios tokens
ALTER TABLE whatsapp_link_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own tokens"
  ON whatsapp_link_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own tokens"
  ON whatsapp_link_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- El service role (backend WhatsApp) puede leer/actualizar todo
-- (usa SUPABASE_SERVICE_ROLE_KEY, bypasea RLS)

-- 2. Columnas nuevas en perfiles para WhatsApp
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS whatsapp_jid TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS whatsapp_linked_at TIMESTAMPTZ;

-- Index unico: un numero de WhatsApp = un solo usuario
CREATE UNIQUE INDEX IF NOT EXISTS idx_perfiles_whatsapp_jid
  ON perfiles(whatsapp_jid)
  WHERE whatsapp_jid IS NOT NULL;
