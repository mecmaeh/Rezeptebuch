export type SourceType = 'manual' | 'photo' | 'link' | 'video';

export interface Cookbook {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  created_at: string;
}

export interface CookbookMember {
  id: string;
  cookbook_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
}

export interface Category {
  id: string;
  cookbook_id: string;
  name: string;
  created_at: string;
}

export interface Recipe {
  id: string;
  cookbook_id: string;
  title: string;
  portions: number;
  prep_time_minutes: number | null;
  notes: string | null;
  source_url: string | null;
  source_type: SourceType;
  image_path: string | null;
  image_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  id?: string;
  recipe_id?: string;
  position: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  quantity_per_portion: number | null;
  note: string | null;
}

export interface RecipeStep {
  id?: string;
  recipe_id?: string;
  position: number;
  text: string;
}

export interface RecipeWithDetails extends Recipe {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  categories: Category[];
}

export interface ExtractedRecipe {
  title: string;
  portions: number;
  prep_time_minutes: number | null;
  ingredients: { name: string; quantity: number | null; unit: string | null; note: string | null }[];
  steps: string[];
  categories: string[];
  notes: string | null;
  image_url: string | null;
}
