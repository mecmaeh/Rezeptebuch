import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CookbookProvider, useCookbook } from '@/context/CookbookContext';
import { AuthScreen } from '@/screens/AuthScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { SearchScreen } from '@/screens/SearchScreen';
import { RecipeDetail } from '@/screens/RecipeDetail';
import { RecipeEditor, extractedToDraft } from '@/screens/RecipeEditor';
import { ImportScreen } from '@/screens/ImportScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { saveRecipe, type RecipeDraft } from '@/lib/recipes';
import { supabase } from '@/lib/supabase';
import { fetchRecipeDetails } from '@/lib/recipes';
import type { ExtractedRecipe, SourceType } from '@/types';
import { Home, Search, Plus, Settings as SettingsIcon, ChefHat, Camera, Link as LinkIcon, Video } from 'lucide-react';

type Tab = 'home' | 'search' | 'settings';
type Overlay =
  | { type: 'detail'; recipeId: string }
  | { type: 'editor'; recipeId?: string; initial?: Partial<RecipeDraft>; sourceType?: SourceType }
  | { type: 'import' }
  | { type: 'addChoose' };

function AppContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { cookbook, loading: cbLoading } = useCookbook();
  const [tab, setTab] = useState<Tab>('home');
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (cbLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!cookbook) {
    return <OnboardingScreen />;
  }

  // Full-screen overlays
  if (overlay) {
    if (overlay.type === 'detail') {
      return (
        <>
          <RecipeDetail
            key={`detail-${overlay.recipeId}-${refreshKey}`}
            recipeId={overlay.recipeId}
            onBack={() => setOverlay(null)}
            onEdit={() => setOverlay({ type: 'editor', recipeId: overlay.recipeId })}
            onDeleted={() => { setOverlay(null); setRefreshKey((k) => k + 1); }}
          />
        </>
      );
    }

    if (overlay.type === 'editor') {
      return (
        <EditorWrapper
          key={`editor-${overlay.recipeId ?? 'new'}-${refreshKey}`}
          cookbookId={cookbook.id}
          recipeId={overlay.recipeId}
          initial={overlay.initial}
          sourceType={overlay.sourceType ?? 'manual'}
          onSave={async (draft) => {
            const { error } = await saveRecipe(cookbook.id, draft, overlay.recipeId);
            if (!error) { setOverlay(null); setRefreshKey((k) => k + 1); }
            return { error };
          }}
          onCancel={() => setOverlay(null)}
        />
      );
    }

    if (overlay.type === 'import') {
      return (
        <ImportScreen
          onComplete={(extracted, sourceType, sourceUrl) => {
            const draft = extractedToDraft(extracted, sourceType, sourceUrl);
            setOverlay({ type: 'editor', initial: draft, sourceType });
          }}
          onCancel={() => setOverlay(null)}
        />
      );
    }

    if (overlay.type === 'addChoose') {
      return (
        <AddChooseScreen
          onManual={() => setOverlay({ type: 'editor', sourceType: 'manual' })}
          onImport={() => setOverlay({ type: 'import' })}
          onCancel={() => setOverlay(null)}
        />
      );
    }
  }

  // Tab content
  return (
    <div className="flex flex-col h-screen bg-stone-50">
      <div className="flex-1 overflow-hidden" key={refreshKey}>
        {tab === 'home' && (
          <HomeScreen
            onSelectRecipe={(id) => setOverlay({ type: 'detail', recipeId: id })}
            onAddRecipe={() => setOverlay({ type: 'addChoose' })}
            onGoToSearch={() => setTab('search')}
          />
        )}
        {tab === 'search' && (
          <SearchScreen
            cookbookId={cookbook.id}
            categories={[]}
            onSelectRecipe={(id) => setOverlay({ type: 'detail', recipeId: id })}
          />
        )}
        {tab === 'settings' && (
          <SettingsScreen onSignOut={() => signOut()} />
        )}
      </div>

      {/* Bottom navigation */}
      <nav className="flex items-center justify-around px-2 py-2 bg-white border-t border-stone-100 safe-area-bottom">
        <TabButton icon={<Home className="w-5 h-5" />} label="Kochbuch" active={tab === 'home'} onClick={() => setTab('home')} />
        <TabButton icon={<Search className="w-5 h-5" />} label="Suche" active={tab === 'search'} onClick={() => setTab('search')} />
        <TabButton
          icon={<div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center -mt-3 shadow-md shadow-emerald-600/30"><Plus className="w-5 h-5 text-white" /></div>}
          label="Hinzufügen"
          active={false}
          onClick={() => setOverlay({ type: 'addChoose' })}
          highlight
        />
        <TabButton icon={<ChefHat className="w-5 h-5" />} label="Rezepte" active={false} onClick={() => setTab('home')} />
        <TabButton icon={<SettingsIcon className="w-5 h-5" />} label="Einstellungen" active={tab === 'settings'} onClick={() => setTab('settings')} />
      </nav>
    </div>
  );
}

function TabButton({ icon, label, active, onClick, highlight }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; highlight?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-2 py-1 transition-colors ${
        active ? 'text-emerald-600' : 'text-stone-400'
      }`}
    >
      {icon}
      {!highlight && <span className="text-[10px] font-medium">{label}</span>}
    </button>
  );
}

function AddChooseScreen({ onManual, onImport, onCancel }: { onManual: () => void; onImport: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-end" onClick={onCancel}>
      <div className="bg-white rounded-t-3xl w-full p-6 safe-area-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-5" />
        <h2 className="text-lg font-semibold text-stone-900 mb-4">Rezept hinzufügen</h2>
        <div className="space-y-2">
          <button
            onClick={onManual}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-stone-900">Manuell erstellen</p>
              <p className="text-sm text-stone-500">Rezept von Grund auf neu anlegen</p>
            </div>
          </button>
          <button
            onClick={onImport}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-stone-900">Importieren</p>
              <p className="text-sm text-stone-500">Foto, Link oder Video/Text — per KI strukturiert</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function EditorWrapper({ cookbookId, recipeId, initial, sourceType, onSave, onCancel }: {
  cookbookId: string;
  recipeId?: string;
  initial?: Partial<RecipeDraft>;
  sourceType: SourceType;
  onSave: (draft: RecipeDraft) => Promise<{ error: string | null }>;
  onCancel: () => void;
}) {
  const [editorInitial, setEditorInitial] = useState<Partial<RecipeDraft> | undefined>(initial);
  const [categories, setCategories] = useState<any[]>([]);
  const [loadedRecipe, setLoadedRecipe] = useState<any>(null);

  useEffect(() => {
    // Load categories for this cookbook
    supabase.from('categories').select('*').eq('cookbook_id', cookbookId).order('name').then(({ data }) => {
      setCategories(data ?? []);
    });

    // If editing existing recipe, load its details
    if (recipeId && !initial) {
      fetchRecipeDetails(recipeId).then((details) => {
        if (details) {
          setLoadedRecipe(details);
          setEditorInitial({
            title: details.title,
            portions: details.portions,
            prep_time_minutes: details.prep_time_minutes,
            notes: details.notes,
            source_url: details.source_url,
            source_type: details.source_type,
            ingredients: details.ingredients.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, note: i.note })),
            steps: details.steps.map((s) => s.text),
            categoryNames: details.categories.map((c) => c.name),
            imageUrl: details.image_url,
            existingImagePath: details.image_path,
          });
        }
      });
    }
  }, [cookbookId, recipeId, initial]);

  // Get category names from recipe categories if editing
  const recipeCategoryNames = loadedRecipe?.categories?.map((c: any) => c.name) ?? [];

  if (!editorInitial && recipeId && !loadedRecipe) {
    return (
      <div className="flex flex-col h-screen bg-stone-50 items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <RecipeEditor
      initial={editorInitial ?? {}}
      categories={categories}
      sourceType={sourceType}
      title={recipeId ? 'Rezept bearbeiten' : 'Neues Rezept'}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CookbookProvider>
        <AppContent />
      </CookbookProvider>
    </AuthProvider>
  );
}
