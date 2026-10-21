import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchRecipes } from '@/lib/recipes';
import type { Recipe, Category } from '@/types';
import { Search, X, Filter, ChefHat } from 'lucide-react';

interface Props {
  cookbookId: string;
  categories: Category[];
  onSelectRecipe: (id: string) => void;
}

interface SearchResult {
  recipe: Recipe;
  matchedCategories: string[];
  matchedIngredients: string[];
}

export function SearchScreen({ cookbookId, categories, onSelectRecipe }: Props) {
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [allIngredientNames, setAllIngredientNames] = useState<Map<string, string[]>>(new Map());
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const recipeCategoryMap = useRef<Map<string, string[]>>(new Map());

  useEffect(() => {
    fetchRecipes(cookbookId).then(async (recipes) => {
      setAllRecipes(recipes);
      setLoading(false);

      // Fetch categories and ingredients for each recipe
      const { supabase } = await import('@/lib/supabase');
      const ingMap = new Map<string, string[]>();
      const catMap = new Map<string, string[]>();

      if (recipes.length > 0) {
        const recipeIds = recipes.map((r) => r.id);
        const [ingResp, linkResp] = await Promise.all([
          supabase.from('recipe_ingredients').select('recipe_id, name').in('recipe_id', recipeIds),
          supabase
            .from('recipe_category_links')
            .select('recipe_id, category_id, categories!inner(name)')
            .in('recipe_id', recipeIds),
        ]);

        if (ingResp.data) {
          for (const row of ingResp.data as any[]) {
            const existing = ingMap.get(row.recipe_id) ?? [];
            existing.push(row.name.toLowerCase());
            ingMap.set(row.recipe_id, existing);
          }
        }
        setAllIngredientNames(ingMap);

        if (linkResp.data) {
          for (const row of linkResp.data as any[]) {
            const existing = catMap.get(row.recipe_id) ?? [];
            if (row.categories?.name) existing.push(row.categories.name);
            catMap.set(row.recipe_id, existing);
          }
        }
        recipeCategoryMap.current = catMap;
      }
    });
  }, [cookbookId]);

  const performSearch = useCallback(() => {
    const q = query.trim().toLowerCase();
    const filtered: SearchResult[] = [];

    for (const recipe of allRecipes) {
      const recipeCats = recipeCategoryMap.current.get(recipe.id) ?? [];
      const ingredients = allIngredientNames.get(recipe.id) ?? [];

      // Category filter
      if (activeCategory && !recipeCats.includes(activeCategory)) continue;

      // Text search
      if (q) {
        const titleMatch = recipe.title.toLowerCase().includes(q);
        const catMatch = recipeCats.some((c) => c.toLowerCase().includes(q));
        const ingMatch = ingredients.some((i) => i.includes(q));
        if (!titleMatch && !catMatch && !ingMatch) continue;
      }

      filtered.push({
        recipe,
        matchedCategories: recipeCats,
        matchedIngredients: ingredients,
      });
    }

    setResults(filtered);
  }, [query, activeCategory, allRecipes, allIngredientNames]);

  useEffect(() => {
    performSearch();
  }, [performSearch]);

  return (
    <div className="flex flex-col h-screen bg-stone-50">
      <header className="px-4 pt-3 pb-3 bg-white border-b border-stone-100 safe-area-top">
        <h1 className="text-xl font-bold text-stone-900 mb-3">Suche</h1>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rezept, Zutat oder Kategorie..."
            className="w-full pl-11 pr-10 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-stone-900"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => setActiveCategory(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                !activeCategory ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600'
              }`}
            >
              Alle
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeCategory === cat.name ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-stone-400">
            <Filter className="w-10 h-10 mb-3" />
            <p className="text-sm">{query || activeCategory ? 'Keine Rezepte gefunden.' : 'Noch keine Rezepte.'}</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-stone-400 mb-3">{results.length} Rezept{results.length !== 1 ? 'e' : ''}</p>
            <div className="space-y-3">
              {results.map(({ recipe, matchedCategories }) => (
                <RecipeListItem
                  key={recipe.id}
                  recipe={recipe}
                  categories={matchedCategories}
                  query={query.toLowerCase()}
                  onClick={() => onSelectRecipe(recipe.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-emerald-200 text-stone-900 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function RecipeListItem({
  recipe,
  categories,
  query,
  onClick,
}: {
  recipe: Recipe;
  categories: string[];
  query: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex gap-3 p-3 bg-white rounded-2xl border border-stone-100 hover:shadow-sm active:scale-[0.99] transition-all text-left"
    >
      <div className="w-20 h-20 rounded-xl overflow-hidden bg-stone-100 flex-shrink-0">
        {recipe.image_url ? (
          <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300">
            <ChefHat className="w-8 h-8" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-stone-900 truncate">{highlightMatch(recipe.title, query)}</h3>
        <p className="text-xs text-stone-400 mt-0.5">{recipe.portions} Portionen</p>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {categories.slice(0, 3).map((cat, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                {highlightMatch(cat, query)}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
