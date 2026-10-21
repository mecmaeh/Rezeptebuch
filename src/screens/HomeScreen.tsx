import { useState, useEffect } from 'react';
import { useCookbook } from '@/context/CookbookContext';
import { fetchRecipes } from '@/lib/recipes';
import type { Recipe } from '@/types';
import { ChefHat, Plus, BookOpen, Search } from 'lucide-react';
import { RecipeListItem } from './SearchScreen';

interface Props {
  onSelectRecipe: (id: string) => void;
  onAddRecipe: () => void;
  onGoToSearch: () => void;
}

export function HomeScreen({ onSelectRecipe, onAddRecipe, onGoToSearch }: Props) {
  const { cookbook } = useCookbook();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cookbook) return;
    fetchRecipes(cookbook.id).then((r) => {
      setRecipes(r);
      setLoading(false);
    });
  }, [cookbook]);

  if (!cookbook) return null;

  return (
    <div className="flex flex-col h-screen bg-stone-50">
      <header className="px-4 pt-3 pb-3 bg-white border-b border-stone-100 safe-area-top">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">{cookbook.name}</h1>
            <p className="text-sm text-stone-400">{recipes.length} Rezept{recipes.length !== 1 ? 'e' : ''}</p>
          </div>
          <button
            onClick={onGoToSearch}
            className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 hover:bg-stone-200 transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : recipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-20 h-20 rounded-3xl bg-emerald-50 flex items-center justify-center mb-4">
              <BookOpen className="w-10 h-10 text-emerald-600" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-semibold text-stone-900 mb-2">Noch keine Rezepte</h2>
            <p className="text-sm text-stone-500 mb-6">
              Füge dein erstes Rezept hinzu — manuell oder per Foto-, Link- oder Video-Import.
            </p>
            <button
              onClick={onAddRecipe}
              className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold flex items-center gap-2 hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-5 h-5" /> Rezept hinzufügen
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Featured: first recipe with image */}
            {recipes[0]?.image_url && (
              <button
                onClick={() => onSelectRecipe(recipes[0].id)}
                className="w-full relative rounded-2xl overflow-hidden aspect-[16/10] mb-3 group active:scale-[0.99] transition-transform"
              >
                <img src={recipes[0].image_url} alt={recipes[0].title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
                  <h2 className="text-white font-bold text-lg">{recipes[0].title}</h2>
                  <p className="text-white/80 text-sm">{recipes[0].portions} Portionen</p>
                </div>
              </button>
            )}
            {recipes.slice(recipes[0]?.image_url ? 1 : 0).map((recipe) => (
              <RecipeListItem
                key={recipe.id}
                recipe={recipe}
                categories={[]}
                query=""
                onClick={() => onSelectRecipe(recipe.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      {recipes.length > 0 && (
        <button
          onClick={onAddRecipe}
          className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center active:scale-90 transition-transform z-20"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
