-- ============================================================================
-- Cartelera VO — Social Matching System Migration
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================================

-- 1. Update perfiles table with invite_code and avatar_url
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS nombre_display text;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS email text;

-- Generate invite codes for existing rows (Canarian words)
-- See generate_invite_code() function below for the word list
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
              OR invite_code ~ '^[A-F0-9]{6}$' -- replace old MD5-style codes too
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

-- Auto-generate invite_code on new inserts (Canarian lexicon!)
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
        NEW.invite_code := upper(substr(md5(random()::text), 1, 8));
        EXIT;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_generate_invite_code ON perfiles;
CREATE TRIGGER tr_generate_invite_code
  BEFORE INSERT ON perfiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_invite_code();

-- 2. Create amistades table
CREATE TABLE IF NOT EXISTS amistades (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_a, user_b),
  CHECK(user_a != user_b)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_amistades_users ON amistades(user_a, user_b);
CREATE INDEX IF NOT EXISTS idx_amistades_status ON amistades(status);

-- RLS for amistades
ALTER TABLE amistades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see their own friendships" ON amistades;
CREATE POLICY "Users can see their own friendships" ON amistades
  FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "Users can send friend requests" ON amistades;
CREATE POLICY "Users can send friend requests" ON amistades
  FOR INSERT WITH CHECK (auth.uid() = user_a);

DROP POLICY IF EXISTS "Users can accept friend requests" ON amistades;
CREATE POLICY "Users can accept friend requests" ON amistades
  FOR UPDATE USING (auth.uid() = user_b AND status = 'pending');

DROP POLICY IF EXISTS "Users can delete their friendships" ON amistades;
CREATE POLICY "Users can delete their friendships" ON amistades
  FOR DELETE USING (auth.uid() = user_a OR auth.uid() = user_b);

-- 3. Create votos table
CREATE TABLE IF NOT EXISTS votos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_title text NOT NULL,
  vote text NOT NULL CHECK (vote IN ('voy', 'paso')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, movie_title)
);

CREATE INDEX IF NOT EXISTS idx_votos_user ON votos(user_id);
CREATE INDEX IF NOT EXISTS idx_votos_movie ON votos(movie_title);

-- RLS for votos
ALTER TABLE votos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see their own votes" ON votos;
CREATE POLICY "Users can see their own votes" ON votos
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can see friend votes" ON votos;
CREATE POLICY "Users can see friend votes" ON votos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM amistades
      WHERE status = 'accepted'
        AND ((user_a = auth.uid() AND user_b = votos.user_id)
          OR (user_b = auth.uid() AND user_a = votos.user_id))
    )
  );

DROP POLICY IF EXISTS "Users can insert their own votes" ON votos;
CREATE POLICY "Users can insert their own votes" ON votos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own votes" ON votos;
CREATE POLICY "Users can update their own votes" ON votos
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own votes" ON votos;
CREATE POLICY "Users can delete their own votes" ON votos
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Create planes table
CREATE TABLE IF NOT EXISTS planes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  movie_title text NOT NULL,
  state text NOT NULL DEFAULT 'proposed' CHECK (state IN (
    'proposed', 'waiting_them', 'pick_avail', 'waiting_pick',
    'pick_theirs', 'confirmed', 'no_match'
  )),
  initiator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposed_session jsonb,
  initiator_response text CHECK (initiator_response IN ('yes', 'no')),
  partner_response text CHECK (partner_response IN ('yes', 'no')),
  initiator_availability jsonb DEFAULT '[]'::jsonb,
  partner_availability jsonb DEFAULT '[]'::jsonb,
  chosen_session jsonb,
  participants uuid[] DEFAULT '{}',
  first_no_user uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planes_initiator ON planes(initiator_id);
CREATE INDEX IF NOT EXISTS idx_planes_partner ON planes(partner_id);
CREATE INDEX IF NOT EXISTS idx_planes_state ON planes(state);
CREATE INDEX IF NOT EXISTS idx_planes_movie ON planes(movie_title);

-- RLS for planes
ALTER TABLE planes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see their own plans" ON planes;
CREATE POLICY "Users can see their own plans" ON planes
  FOR SELECT USING (
    auth.uid() = initiator_id
    OR auth.uid() = partner_id
    OR auth.uid() = ANY(participants)
  );

DROP POLICY IF EXISTS "Friends can see confirmed plans" ON planes;
CREATE POLICY "Friends can see confirmed plans" ON planes
  FOR SELECT USING (
    state = 'confirmed'
    AND EXISTS (
      SELECT 1 FROM amistades
      WHERE status = 'accepted'
        AND ((user_a = auth.uid() AND (user_b = planes.initiator_id OR user_b = planes.partner_id))
          OR (user_b = auth.uid() AND (user_a = planes.initiator_id OR user_a = planes.partner_id)))
    )
  );

DROP POLICY IF EXISTS "Participants can insert plans" ON planes;
CREATE POLICY "Participants can insert plans" ON planes
  FOR INSERT WITH CHECK (auth.uid() = initiator_id OR auth.uid() = partner_id);

DROP POLICY IF EXISTS "Participants can update plans" ON planes;
CREATE POLICY "Participants can update plans" ON planes
  FOR UPDATE USING (
    auth.uid() = initiator_id
    OR auth.uid() = partner_id
    OR auth.uid() = ANY(participants)
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_planes_updated_at ON planes;
CREATE TRIGGER tr_planes_updated_at
  BEFORE UPDATE ON planes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 5. Friends-of-Friends Discovery RPC Functions
-- ============================================================================

-- Returns profiles of a friend's friends, excluding:
--   - The calling user
--   - Users already friends with the caller
--   - Users with pending requests involving the caller
CREATE OR REPLACE FUNCTION get_friends_of_friend(p_friend_id uuid)
RETURNS TABLE (
  id uuid,
  nombre text,
  nombre_display text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  -- Verify caller is actually friends with p_friend_id
  IF NOT EXISTS (
    SELECT 1 FROM amistades
    WHERE status = 'accepted'
      AND ((user_a = v_caller AND user_b = p_friend_id)
        OR (user_b = v_caller AND user_a = p_friend_id))
  ) THEN
    RAISE EXCEPTION 'Not friends with this user';
  END IF;

  RETURN QUERY
  SELECT p.id, p.nombre, p.nombre_display, p.avatar_url
  FROM perfiles p
  WHERE p.id IN (
    -- All accepted friends of p_friend_id
    SELECT CASE WHEN a.user_a = p_friend_id THEN a.user_b ELSE a.user_a END
    FROM amistades a
    WHERE a.status = 'accepted'
      AND (a.user_a = p_friend_id OR a.user_b = p_friend_id)
  )
  -- Exclude the caller
  AND p.id != v_caller
  -- Exclude users already friends with caller (accepted)
  AND p.id NOT IN (
    SELECT CASE WHEN a2.user_a = v_caller THEN a2.user_b ELSE a2.user_a END
    FROM amistades a2
    WHERE a2.status = 'accepted'
      AND (a2.user_a = v_caller OR a2.user_b = v_caller)
  )
  -- Exclude users with pending requests involving caller
  AND p.id NOT IN (
    SELECT CASE WHEN a3.user_a = v_caller THEN a3.user_b ELSE a3.user_a END
    FROM amistades a3
    WHERE a3.status = 'pending'
      AND (a3.user_a = v_caller OR a3.user_b = v_caller)
  );
END;
$$;

-- Send a friend request directly by user_id (for friends-of-friends discovery)
CREATE OR REPLACE FUNCTION send_friend_request_direct(p_target_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_existing record;
  v_target_profile record;
BEGIN
  -- Prevent self-request
  IF v_caller = p_target_id THEN
    RETURN json_build_object('error', 'No puedes agregarte a ti mismo');
  END IF;

  -- Check target exists
  SELECT perfiles.nombre, perfiles.nombre_display INTO v_target_profile
  FROM perfiles WHERE perfiles.id = p_target_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Usuario no encontrado');
  END IF;

  -- Check existing friendship in either direction
  SELECT amistades.id, amistades.status INTO v_existing
  FROM amistades
  WHERE (user_a = v_caller AND user_b = p_target_id)
     OR (user_a = p_target_id AND user_b = v_caller)
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.status = 'accepted' THEN
      RETURN json_build_object('error', 'Ya sois amigos');
    ELSE
      RETURN json_build_object('error', 'Solicitud ya enviada');
    END IF;
  END IF;

  -- Create the friendship request
  INSERT INTO amistades (user_a, user_b, status)
  VALUES (v_caller, p_target_id, 'pending');

  RETURN json_build_object(
    'success', true,
    'name', COALESCE(v_target_profile.nombre_display, v_target_profile.nombre, 'Usuario')
  );
END;
$$;

-- ============================================================================
-- 6. Invite Code Gated Signup
-- ============================================================================

-- Add invited_by column to track who invited whom
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES auth.users(id);

-- Validate an invite code (callable without auth — for login screen)
CREATE OR REPLACE FUNCTION validate_invite_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM perfiles WHERE invite_code = upper(trim(p_code))
  );
END;
$$;

-- ============================================================================
-- 7. Social Discovery — Discover other users on the app
-- ============================================================================

-- Returns profiles of other users on the app, excluding:
--   - The calling user
--   - Users already friends with the caller
--   - Users with pending requests involving the caller
-- Ordered by newest first, limited to p_limit
CREATE OR REPLACE FUNCTION discover_users(p_limit int DEFAULT 20)
RETURNS TABLE (
  id uuid,
  nombre text,
  nombre_display text,
  avatar_url text,
  invited_by_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  RETURN QUERY
  SELECT p.id, p.nombre, p.nombre_display, p.avatar_url,
         inviter.nombre_display AS invited_by_name
  FROM perfiles p
  LEFT JOIN perfiles inviter ON inviter.id = p.invited_by
  WHERE p.id != v_caller
  -- Exclude existing friends and pending requests (both directions)
  AND p.id NOT IN (
    SELECT CASE WHEN a.user_a = v_caller THEN a.user_b ELSE a.user_a END
    FROM amistades a
    WHERE a.user_a = v_caller OR a.user_b = v_caller
  )
  ORDER BY p.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- 8. Email Notifications — Helper to get user email (for Edge Functions)
-- ============================================================================

-- Returns the email of a user from auth.users
-- Only callable server-side (Edge Functions use service_role key)
CREATE OR REPLACE FUNCTION get_user_email(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = p_user_id);
END;
$$;

-- Returns the display name of a user from perfiles
CREATE OR REPLACE FUNCTION get_user_display_name(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(p.nombre_display, p.nombre, 'Alguien')
    FROM perfiles p WHERE p.id = p_user_id
  );
END;
$$;

-- ============================================================================
-- 9. Game Scores (Brick Breaker leaderboard)
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_scores (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

-- Anyone can read scores (for leaderboard)
CREATE POLICY "game_scores_select" ON game_scores FOR SELECT USING (true);

-- Users can insert/update their own score
CREATE POLICY "game_scores_insert" ON game_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "game_scores_update" ON game_scores FOR UPDATE USING (auth.uid() = user_id);

-- Allow anon key to insert/read (game uses anon key directly)
GRANT SELECT, INSERT, UPDATE ON game_scores TO anon;

-- Leaderboard view: joins scores with profiles for names + avatars
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  gs.user_id,
  gs.score,
  COALESCE(p.nombre_display, p.nombre, 'Cinero') AS nombre_display,
  p.avatar_url
FROM game_scores gs
LEFT JOIN perfiles p ON p.id = gs.user_id
ORDER BY gs.score DESC;

-- Grant access to anon
GRANT SELECT ON leaderboard TO anon;

-- ============================================================================
-- Done! Verify with: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- ============================================================================
