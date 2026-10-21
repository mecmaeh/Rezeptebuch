/*
# Fix cookbook creation: use SECURITY DEFINER function

The RLS insert policy on cookbooks (owner_id = auth.uid()) was blocking inserts
from the client. Use a SECURITY DEFINER function that runs as the postgres user
to atomically create a cookbook + owner membership. This bypasses RLS safely
because the function validates auth.uid() itself.
*/

-- ============================================================
-- create_cookbook: atomic cookbook + membership creation
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_cookbook(p_name text, p_invite_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_cookbook_id uuid;
  v_result json;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Nicht eingeloggt.');
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN json_build_object('error', 'Name darf nicht leer sein.');
  END IF;

  IF p_invite_code IS NULL OR length(p_invite_code) < 6 THEN
    RETURN json_build_object('error', 'Einladungscode ungültig.');
  END IF;

  -- Check if user already has a cookbook
  IF EXISTS (SELECT 1 FROM cookbook_members WHERE user_id = v_user_id) THEN
    RETURN json_build_object('error', 'Du bist bereits Mitglied eines Kochbuchs.');
  END IF;

  -- Check invite code uniqueness
  IF EXISTS (SELECT 1 FROM cookbooks WHERE invite_code = p_invite_code) THEN
    RETURN json_build_object('error', 'Einladungscode bereits vergeben. Bitte erneut versuchen.');
  END IF;

  -- Insert cookbook
  INSERT INTO cookbooks (name, invite_code, owner_id)
  VALUES (trim(p_name), p_invite_code, v_user_id)
  RETURNING id INTO v_cookbook_id;

  -- Insert owner membership
  INSERT INTO cookbook_members (cookbook_id, user_id, role)
  VALUES (v_cookbook_id, v_user_id, 'owner');

  SELECT json_build_object(
    'id', c.id,
    'name', c.name,
    'invite_code', c.invite_code,
    'owner_id', c.owner_id,
    'created_at', c.created_at
  ) INTO v_result
  FROM cookbooks c
  WHERE c.id = v_cookbook_id;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.create_cookbook(text, text) TO authenticated;

-- ============================================================
-- join_cookbook: join via invite code
-- ============================================================
CREATE OR REPLACE FUNCTION public.join_cookbook(p_invite_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_cookbook_id uuid;
  v_result json;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Nicht eingeloggt.');
  END IF;

  IF p_invite_code IS NULL OR trim(p_invite_code) = '' THEN
    RETURN json_build_object('error', 'Einladungscode fehlt.');
  END IF;

  -- Find cookbook by invite code
  SELECT id INTO v_cookbook_id FROM cookbooks WHERE invite_code = upper(trim(p_invite_code));
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Einladungscode nicht gefunden.');
  END IF;

  -- Check if already a member
  IF EXISTS (SELECT 1 FROM cookbook_members WHERE cookbook_id = v_cookbook_id AND user_id = v_user_id) THEN
    RETURN json_build_object('error', 'Du bist bereits Mitglied dieses Kochbuchs.');
  END IF;

  -- Insert membership
  INSERT INTO cookbook_members (cookbook_id, user_id, role)
  VALUES (v_cookbook_id, v_user_id, 'member');

  SELECT json_build_object(
    'id', c.id,
    'name', c.name,
    'invite_code', c.invite_code,
    'owner_id', c.owner_id,
    'created_at', c.created_at
  ) INTO v_result
  FROM cookbooks c
  WHERE c.id = v_cookbook_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_cookbook(text) TO authenticated;
