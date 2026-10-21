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
      ...normalizeIngredientMeasurement(ing.quantity, ing.unit),
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

export function normalizeIngredientMeasurement(
  quantity: number | null,
  unit: string | null,
): { quantity: number | null; unit: string | null } {
  if (quantity == null || !unit) return { quantity, unit };

  const normalizedUnit = unit.trim().toLowerCase().replace(/[.\s]/g, '');
  const conversions: Record<string, { unit: string; factor: number }> = {
    g: { unit: 'g', factor: 1 },
    gramm: { unit: 'g', factor: 1 },
    gram: { unit: 'g', factor: 1 },
    kg: { unit: 'g', factor: 1000 },
    kilogramm: { unit: 'g', factor: 1000 },
    kilogramme: { unit: 'g', factor: 1000 },
    mg: { unit: 'g', factor: 0.001 },
    ml: { unit: 'ml', factor: 1 },
    milliliter: { unit: 'ml', factor: 1 },
    millilitre: { unit: 'ml', factor: 1 },
    l: { unit: 'ml', factor: 1000 },
    liter: { unit: 'ml', factor: 1000 },
    litre: { unit: 'ml', factor: 1000 },
    dl: { unit: 'ml', factor: 100 },
    cl: { unit: 'ml', factor: 10 },
    el: { unit: 'EL', factor: 1 },
    essloeffel: { unit: 'EL', factor: 1 },
    esslöffel: { unit: 'EL', factor: 1 },
    tbsp: { unit: 'EL', factor: 1 },
    tl: { unit: 'TL', factor: 1 },
    teeloeffel: { unit: 'TL', factor: 1 },
    teelöffel: { unit: 'TL', factor: 1 },
    tsp: { unit: 'TL', factor: 1 },
    tasse: { unit: 'ml', factor: 240 },
    cups: { unit: 'ml', factor: 240 },
    cup: { unit: 'ml', factor: 240 },
    // Imperial / US customary (weight -> g)
    lb: { unit: 'g', factor: 453.59 },
    lbs: { unit: 'g', factor: 453.59 },
    pound: { unit: 'g', factor: 453.59 },
    pounds: { unit: 'g', factor: 453.59 },
    oz: { unit: 'g', factor: 28.35 },
    ounce: { unit: 'g', factor: 28.35 },
    ounces: { unit: 'g', factor: 28.35 },
    // Imperial / US customary (volume -> ml)
    fl: { unit: 'ml', factor: 30 },
    floz: { unit: 'ml', factor: 30 },
    fluidounce: { unit: 'ml', factor: 30 },
    fluidounces: { unit: 'ml', factor: 30 },
    pt: { unit: 'ml', factor: 473 },
    pint: { unit: 'ml', factor: 473 },
    pints: { unit: 'ml', factor: 473 },
    qt: { unit: 'ml', factor: 946 },
    quart: { unit: 'ml', factor: 946 },
    quarts: { unit: 'ml', factor: 946 },
    gal: { unit: 'ml', factor: 3785 },
    gallon: { unit: 'ml', factor: 3785 },
    gallons: { unit: 'ml', factor: 3785 },
    // English spoon measures
    tablespoon: { unit: 'EL', factor: 1 },
    tablespoons: { unit: 'EL', factor: 1 },
    teaspoon: { unit: 'TL', factor: 1 },
    teaspoons: { unit: 'TL', factor: 1 },
    // Sticks (US butter) -> g
    stick: { unit: 'g', factor: 113 },
    sticks: { unit: 'g', factor: 113 },
  };

  const conversion = conversions[normalizedUnit];
  if (!conversion) return { quantity, unit };

  return {
    quantity: Math.round(quantity * conversion.factor * 100) / 100,
    unit: conversion.unit,
  };
}

export function formatQuantity(q: number | null): string {
  if (q == null) return '';
  if (Number.isInteger(q)) return String(q);
  return q.toFixed(2).replace(/\.?0+$/, '');
}
