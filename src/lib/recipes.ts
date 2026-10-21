import { supabase, STORAGE_BUCKET } from './supabase';
import type { Recipe, RecipeIngredient, RecipeStep, RecipeWithDetails, Category } from '@/types';

export async function fetchRecipes(cookbookId: string): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('cookbook_id', cookbookId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Recipe[];
}

export async function fetchRecipeDetails(recipeId: string): Promise<RecipeWithDetails | null> {
  const { data: recipe, error: rErr } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', recipeId)
    .maybeSingle();
  if (rErr) throw rErr;
  if (!recipe) return null;

  const [ingRes, stepRes, linkRes] = await Promise.all([
    supabase.from('recipe_ingredients').select('*').eq('recipe_id', recipeId).order('position'),
    supabase.from('recipe_steps').select('*').eq('recipe_id', recipeId).order('position'),
    supabase
      .from('recipe_category_links')
      .select('category_id, categories(id, cookbook_id, name, created_at)')
      .eq('recipe_id', recipeId),
  ]);

  if (ingRes.error) throw ingRes.error;
  if (stepRes.error) throw stepRes.error;
  if (linkRes.error) throw linkRes.error;

  const categories = (linkRes.data ?? [])
    .map((row: any) => row.categories)
    .filter(Boolean) as Category[];

  return {
    ...(recipe as Recipe),
    ingredients: ingRes.data as RecipeIngredient[],
    steps: stepRes.data as RecipeStep[],
    categories,
  };
}

export interface RecipeDraft {
  title: string;
  portions: number;
  prep_time_minutes: number | null;
  notes: string | null;
  source_url: string | null;
  source_type: Recipe['source_type'];
  ingredients: { name: string; quantity: number | null; unit: string | null; note: string | null }[];
  steps: string[];
  categoryNames: string[];
  imageBytes?: ArrayBuffer | null;
  imageContentType?: string | null;
  imageUrl?: string | null;
  existingImagePath?: string | null;
}

export async function saveRecipe(
  cookbookId: string,
  draft: RecipeDraft,
  recipeId?: string
): Promise<{ id: string; error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  let imagePath = draft.existingImagePath ?? null;
  let imageUrl: string | null = draft.imageUrl ?? null;

  if (draft.imageBytes && userId) {
    const ext = (draft.imageContentType ?? 'image/jpeg').split('/')[1] ?? 'jpeg';
    const fileName = `${Date.now()}.${ext}`;
    const path = `${cookbookId}/${fileName}`;
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, draft.imageBytes, { contentType: draft.imageContentType ?? 'image/jpeg', upsert: true });
    if (upErr) return { id: '', error: upErr.message };
    imagePath = path;
    const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    imageUrl = pub.publicUrl;
  }

  const recipeRow = {
    cookbook_id: cookbookId,
    title: draft.title.trim(),
    portions: draft.portions,
    prep_time_minutes: draft.prep_time_minutes,
    notes: draft.notes,
    source_url: draft.source_url,
    source_type: draft.source_type,
    image_path: imagePath,
    image_url: imageUrl,
    updated_at: new Date().toISOString(),
  };

  let id = recipeId;
  if (recipeId) {
    const { error } = await supabase.from('recipes').update(recipeRow).eq('id', recipeId);
    if (error) return { id: '', error: error.message };
    await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
    await supabase.from('recipe_steps').delete().eq('recipe_id', recipeId);
    await supabase.from('recipe_category_links').delete().eq('recipe_id', recipeId);
  } else {
    const { data, error } = await supabase
      .from('recipes')
      .insert({ ...recipeRow, created_by: userId })
      .select()
      .single();
    if (error) return { id: '', error: error.message };
    id = (data as Recipe).id;
  }

  if (!id) return { id: '', error: 'Rezept-ID fehlt.' };

  const ingredients: RecipeIngredient[] = draft.ingredients
    .filter((i) => i.name.trim())
    .map((ing, idx) => ({
      recipe_id: id,
      position: idx,
      name: ing.name.trim(),
      quantity: ing.quantity,
      unit: ing.unit,
      quantity_per_portion: ing.quantity != null ? ing.quantity / draft.portions : null,
      note: ing.note,
    }));

  if (ingredients.length > 0) {
    const { error: ingErr } = await supabase.from('recipe_ingredients').insert(ingredients);
    if (ingErr) return { id, error: ingErr.message };
  }

  const steps: RecipeStep[] = draft.steps
    .filter((s) => s.trim())
    .map((text, idx) => ({ recipe_id: id, position: idx, text: text.trim() }));

  if (steps.length > 0) {
    const { error: stepErr } = await supabase.from('recipe_steps').insert(steps);
    if (stepErr) return { id, error: stepErr.message };
  }

  for (const catName of draft.categoryNames) {
    const trimmed = catName.trim();
    if (!trimmed) continue;

    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('cookbook_id', cookbookId)
      .eq('name', trimmed)
      .maybeSingle();

    let categoryId = existing?.id;
    if (!categoryId) {
      const { data: newCat, error: catErr } = await supabase
        .from('categories')
        .insert({ cookbook_id: cookbookId, name: trimmed })
        .select()
        .single();
      if (catErr) continue;
      categoryId = (newCat as Category).id;
    }

    if (categoryId) {
      await supabase.from('recipe_category_links').insert({ recipe_id: id, category_id: categoryId });
    }
  }

  return { id, error: null };
}

export async function deleteRecipe(recipeId: string): Promise<{ error: string | null }> {
  const { data: recipe } = await supabase
    .from('recipes')
    .select('image_path')
    .eq('id', recipeId)
    .maybeSingle();

  if (recipe?.image_path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([recipe.image_path]);
  }

  const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
  return { error: error?.message ?? null };
}

export function scaleQuantity(ingredient: RecipeIngredient, targetPortions: number): number | null {
  if (ingredient.quantity_per_portion == null) return ingredient.quantity;
  return Math.round(ingredient.quantity_per_portion * targetPortions * 100) / 100;
}

export function formatQuantity(q: number | null): string {
  if (q == null) return '';
  if (Number.isInteger(q)) return String(q);
  return q.toFixed(2).replace(/\.?0+$/, '');
}
