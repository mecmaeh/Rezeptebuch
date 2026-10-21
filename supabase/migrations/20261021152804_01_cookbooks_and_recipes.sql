/*
# Create shared cookbook schema with recipes, ingredients, steps, categories

1. Overview
   This migration sets up the full data model for a private, shared recipe book app.
   Two partners share one "cookbook" via an invite code. Each user authenticates
   with email/password and belongs to one or more cookbooks as a "member".

2. New Tables
   - cookbooks: a shared recipe collection (one per couple/family)
   - cookbook_members: membership join table (user <-> cookbook)
   - categories: user-managed category labels per cookbook
   - recipes: the core recipe record
   - recipe_ingredients: one row per ingredient, ordered
   - recipe_steps: one row per preparation step, ordered
   - recipe_category_links: many-to-many recipes <-> categories

3. Security
   - RLS on every table.
   - Access scoped to authenticated users who are members of the owning cookbook.
   - No anon access (sign-in required).
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Tables (created first, policies after)
-- ============================================================
CREATE TABLE IF NOT EXISTS cookbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text UNIQUE NOT NULL,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cookbook_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cookbook_id uuid NOT NULL REFERENCES cookbooks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cookbook_id, user_id)
);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cookbook_id uuid NOT NULL REFERENCES cookbooks(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cookbook_id, name)
);

CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cookbook_id uuid NOT NULL REFERENCES cookbooks(id) ON DELETE CASCADE,
  title text NOT NULL,
  portions int NOT NULL DEFAULT 4,
  prep_time_minutes int,
  notes text,
  source_url text,
  source_type text NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual','photo','link','video')),
  image_path text,
  image_url text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  name text NOT NULL,
  quantity numeric(10,3),
  unit text,
  quantity_per_portion numeric(12,6),
  note text
);

CREATE TABLE IF NOT EXISTS recipe_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  text text NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_category_links (
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, category_id)
);

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
ALTER TABLE cookbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cookbook_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_category_links ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Policies: cookbooks
-- ============================================================
DROP POLICY IF EXISTS "select_own_cookbooks" ON cookbooks;
CREATE POLICY "select_own_cookbooks" ON cookbooks FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM cookbook_members m WHERE m.cookbook_id = cookbooks.id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_cookbooks" ON cookbooks;
CREATE POLICY "insert_own_cookbooks" ON cookbooks FOR INSERT
  TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "update_own_cookbooks" ON cookbooks;
CREATE POLICY "update_own_cookbooks" ON cookbooks FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM cookbook_members m WHERE m.cookbook_id = cookbooks.id AND m.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM cookbook_members m WHERE m.cookbook_id = cookbooks.id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_cookbooks" ON cookbooks;
CREATE POLICY "delete_own_cookbooks" ON cookbooks FOR DELETE
  TO authenticated USING (owner_id = auth.uid());

-- ============================================================
-- Policies: cookbook_members
-- ============================================================
DROP POLICY IF EXISTS "select_own_memberships" ON cookbook_members;
CREATE POLICY "select_own_memberships" ON cookbook_members FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM cookbook_members m2 WHERE m2.cookbook_id = cookbook_members.cookbook_id AND m2.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_membership_as_owner" ON cookbook_members;
CREATE POLICY "insert_membership_as_owner" ON cookbook_members FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM cookbooks c WHERE c.id = cookbook_members.cookbook_id AND c.owner_id = auth.uid())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "delete_membership_as_owner_or_self" ON cookbook_members;
CREATE POLICY "delete_membership_as_owner_or_self" ON cookbook_members FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM cookbooks c WHERE c.id = cookbook_members.cookbook_id AND c.owner_id = auth.uid())
  );

-- ============================================================
-- Policies: categories
-- ============================================================
DROP POLICY IF EXISTS "select_own_categories" ON categories;
CREATE POLICY "select_own_categories" ON categories FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM cookbook_members m WHERE m.cookbook_id = categories.cookbook_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_categories" ON categories;
CREATE POLICY "insert_own_categories" ON categories FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM cookbook_members m WHERE m.cookbook_id = categories.cookbook_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_categories" ON categories;
CREATE POLICY "update_own_categories" ON categories FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM cookbook_members m WHERE m.cookbook_id = categories.cookbook_id AND m.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM cookbook_members m WHERE m.cookbook_id = categories.cookbook_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_categories" ON categories;
CREATE POLICY "delete_own_categories" ON categories FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM cookbook_members m WHERE m.cookbook_id = categories.cookbook_id AND m.user_id = auth.uid())
  );

-- ============================================================
-- Policies: recipes
-- ============================================================
DROP POLICY IF EXISTS "select_own_recipes" ON recipes;
CREATE POLICY "select_own_recipes" ON recipes FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM cookbook_members m WHERE m.cookbook_id = recipes.cookbook_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_recipes" ON recipes;
CREATE POLICY "insert_own_recipes" ON recipes FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM cookbook_members m WHERE m.cookbook_id = recipes.cookbook_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_recipes" ON recipes;
CREATE POLICY "update_own_recipes" ON recipes FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM cookbook_members m WHERE m.cookbook_id = recipes.cookbook_id AND m.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM cookbook_members m WHERE m.cookbook_id = recipes.cookbook_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_recipes" ON recipes;
CREATE POLICY "delete_own_recipes" ON recipes FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM cookbook_members m WHERE m.cookbook_id = recipes.cookbook_id AND m.user_id = auth.uid())
  );

-- ============================================================
-- Policies: recipe_ingredients
-- ============================================================
DROP POLICY IF EXISTS "select_own_ingredients" ON recipe_ingredients;
CREATE POLICY "select_own_ingredients" ON recipe_ingredients FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM recipes r
      JOIN cookbook_members m ON m.cookbook_id = r.cookbook_id
      WHERE r.id = recipe_ingredients.recipe_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_ingredients" ON recipe_ingredients;
CREATE POLICY "insert_own_ingredients" ON recipe_ingredients FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes r
      JOIN cookbook_members m ON m.cookbook_id = r.cookbook_id
      WHERE r.id = recipe_ingredients.recipe_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_ingredients" ON recipe_ingredients;
CREATE POLICY "update_own_ingredients" ON recipe_ingredients FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM recipes r
      JOIN cookbook_members m ON m.cookbook_id = r.cookbook_id
      WHERE r.id = recipe_ingredients.recipe_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes r
      JOIN cookbook_members m ON m.cookbook_id = r.cookbook_id
      WHERE r.id = recipe_ingredients.recipe_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_ingredients" ON recipe_ingredients;
CREATE POLICY "delete_own_ingredients" ON recipe_ingredients FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM recipes r
      JOIN cookbook_members m ON m.cookbook_id = r.cookbook_id
      WHERE r.id = recipe_ingredients.recipe_id AND m.user_id = auth.uid()
    )
  );

-- ============================================================
-- Policies: recipe_steps
-- ============================================================
DROP POLICY IF EXISTS "select_own_steps" ON recipe_steps;
CREATE POLICY "select_own_steps" ON recipe_steps FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM recipes r
      JOIN cookbook_members m ON m.cookbook_id = r.cookbook_id
      WHERE r.id = recipe_steps.recipe_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_steps" ON recipe_steps;
CREATE POLICY "insert_own_steps" ON recipe_steps FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes r
      JOIN cookbook_members m ON m.cookbook_id = r.cookbook_id
      WHERE r.id = recipe_steps.recipe_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_steps" ON recipe_steps;
CREATE POLICY "update_own_steps" ON recipe_steps FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM recipes r
      JOIN cookbook_members m ON m.cookbook_id = r.cookbook_id
      WHERE r.id = recipe_steps.recipe_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes r
      JOIN cookbook_members m ON m.cookbook_id = r.cookbook_id
      WHERE r.id = recipe_steps.recipe_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_steps" ON recipe_steps;
CREATE POLICY "delete_own_steps" ON recipe_steps FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM recipes r
      JOIN cookbook_members m ON m.cookbook_id = r.cookbook_id
      WHERE r.id = recipe_steps.recipe_id AND m.user_id = auth.uid()
    )
  );

-- ============================================================
-- Policies: recipe_category_links
-- ============================================================
DROP POLICY IF EXISTS "select_own_links" ON recipe_category_links;
CREATE POLICY "select_own_links" ON recipe_category_links FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM recipes r
      JOIN cookbook_members m ON m.cookbook_id = r.cookbook_id
      WHERE r.id = recipe_category_links.recipe_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_links" ON recipe_category_links;
CREATE POLICY "insert_own_links" ON recipe_category_links FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes r
      JOIN cookbook_members m ON m.cookbook_id = r.cookbook_id
      WHERE r.id = recipe_category_links.recipe_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_links" ON recipe_category_links;
CREATE POLICY "delete_own_links" ON recipe_category_links FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM recipes r
      JOIN cookbook_members m ON m.cookbook_id = r.cookbook_id
      WHERE r.id = recipe_category_links.recipe_id AND m.user_id = auth.uid()
    )
  );

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cookbook_members_user ON cookbook_members(user_id);
CREATE INDEX IF NOT EXISTS idx_cookbook_members_cb ON cookbook_members(cookbook_id);
CREATE INDEX IF NOT EXISTS idx_recipes_cookbook ON recipes(cookbook_id);
CREATE INDEX IF NOT EXISTS idx_recipes_title_lower ON recipes USING btree (lower(title));
CREATE INDEX IF NOT EXISTS idx_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_steps_recipe ON recipe_steps(recipe_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_name_lower ON recipe_ingredients USING btree (lower(name));
CREATE INDEX IF NOT EXISTS idx_categories_cookbook ON categories(cookbook_id);
CREATE INDEX IF NOT EXISTS idx_links_recipe ON recipe_category_links(recipe_id);
CREATE INDEX IF NOT EXISTS idx_links_category ON recipe_category_links(category_id);

-- ============================================================
-- Storage bucket for recipe images
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "read recipe images" ON storage.objects;
CREATE POLICY "read recipe images" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'recipe-images');

DROP POLICY IF EXISTS "insert recipe images" ON storage.objects;
CREATE POLICY "insert recipe images" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'recipe-images');

DROP POLICY IF EXISTS "update recipe images" ON storage.objects;
CREATE POLICY "update recipe images" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'recipe-images')
  WITH CHECK (bucket_id = 'recipe-images');

DROP POLICY IF EXISTS "delete recipe images" ON storage.objects;
CREATE POLICY "delete recipe images" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'recipe-images');
