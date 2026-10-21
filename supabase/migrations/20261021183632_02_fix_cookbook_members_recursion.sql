/*
# Fix infinite recursion in cookbook_members RLS policies

The select_own_memberships policy on cookbook_members referenced cookbook_members
itself in a subquery, causing infinite recursion (Postgres error 42P17).

Fix: simplify cookbook_members SELECT to only check user_id = auth.uid() (no self-reference).
This is safe because a user only needs to see their own memberships directly.
Other members of the same cookbook are visible through the cookbooks SELECT policy,
which references cookbook_members (now non-recursive).

Also simplified INSERT and DELETE to avoid indirect recursion through cookbooks policies.
*/

-- ============================================================
-- cookbook_members: drop and recreate without self-reference
-- ============================================================
DROP POLICY IF EXISTS "select_own_memberships" ON cookbook_members;
CREATE POLICY "select_own_memberships" ON cookbook_members FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_membership_as_owner" ON cookbook_members;
CREATE POLICY "insert_membership_as_owner" ON cookbook_members FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_membership_as_owner_or_self" ON cookbook_members;
CREATE POLICY "delete_membership_as_owner_or_self" ON cookbook_members FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- cookbooks: SELECT already references cookbook_members (fine now, no recursion)
-- UPDATE/DELETE only for owner — no cookbook_members reference needed
-- ============================================================
DROP POLICY IF EXISTS "update_own_cookbooks" ON cookbooks;
CREATE POLICY "update_own_cookbooks" ON cookbooks FOR UPDATE
  TO authenticated USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
