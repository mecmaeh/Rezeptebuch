import { useState, useEffect, useRef } from 'react';
import type { RecipeDraft } from '@/lib/recipes';
import type { ExtractedRecipe, SourceType, Category } from '@/types';
import { Camera, X, Plus, Trash2, GripVertical, Image as ImageIcon, Tag } from 'lucide-react';

interface Props {
  initial?: Partial<RecipeDraft> & { id?: string };
  categories: Category[];
  sourceType: SourceType;
  onSave: (draft: RecipeDraft) => Promise<{ error: string | null }>;
  onCancel: () => void;
  title: string;
}

function defaultDraft(sourceType: SourceType): RecipeDraft {
  return {
    title: '',
    portions: 4,
    prep_time_minutes: null,
    notes: null,
    source_url: null,
    source_type: sourceType,
    ingredients: [{ name: '', quantity: null, unit: null, note: null }],
    steps: [''],
    categoryNames: [],
    imageBytes: null,
    imageUrl: null,
  };
}

export function RecipeEditor({ initial, categories, sourceType, onSave, onCancel, title }: Props) {
  const [draft, setDraft] = useState<RecipeDraft>(() => ({
    ...defaultDraft(sourceType),
    ...initial,
    ingredients: initial?.ingredients?.length ? initial.ingredients : [{ name: '', quantity: null, unit: null, note: null }],
    steps: initial?.steps?.length ? initial.steps : [''],
    categoryNames: initial?.categoryNames ?? [],
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initial?.imageUrl ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initial?.imageUrl) setImagePreview(initial.imageUrl);
  }, [initial?.imageUrl]);

  const update = (patch: Partial<RecipeDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      fetch(result)
        .then((r) => r.blob())
        .then((blob) => blob.arrayBuffer())
        .then((buf) => update({ imageBytes: buf, imageContentType: file.type, imageUrl: null }));
    };
    reader.readAsDataURL(file);
  };

  const handleAddIngredient = () => {
    update({ ingredients: [...draft.ingredients, { name: '', quantity: null, unit: null, note: null }] });
  };

  const handleRemoveIngredient = (idx: number) => {
    update({ ingredients: draft.ingredients.filter((_, i) => i !== idx) });
  };

  const handleUpdateIngredient = (idx: number, patch: Partial<typeof draft.ingredients[0]>) => {
    update({ ingredients: draft.ingredients.map((ing, i) => i === idx ? { ...ing, ...patch } : ing) });
  };

  const handleAddStep = () => update({ steps: [...draft.steps, ''] });
  const handleRemoveStep = (idx: number) => update({ steps: draft.steps.filter((_, i) => i !== idx) });
  const handleUpdateStep = (idx: number, text: string) => {
    update({ steps: draft.steps.map((s, i) => i === idx ? text : s) });
  };

  const toggleCategory = (name: string) => {
    const has = draft.categoryNames.includes(name);
    update({ categoryNames: has ? draft.categoryNames.filter((c) => c !== name) : [...draft.categoryNames, name] });
  };

  const handleSave = async () => {
    if (!draft.title.trim()) { setError('Bitte gib einen Titel ein.'); return; }
    if (!draft.ingredients.some((i) => i.name.trim())) { setError('Mindestens eine Zutat erforderlich.'); return; }
    setBusy(true);
    setError(null);
    const { error } = await onSave(draft);
    if (error) setError(error);
    setBusy(false);
  };

  return (
    <div className="flex flex-col h-screen bg-stone-50">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-stone-100 safe-area-top">
        <button onClick={onCancel} className="p-2 -ml-2 text-stone-500 hover:text-stone-900">
          <X className="w-6 h-6" />
        </button>
        <h1 className="font-semibold text-stone-900 truncate">{title}</h1>
        <button
          onClick={handleSave}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-60 transition-colors"
        >
          {busy ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" /> : 'Speichern'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto pb-32">
        <div className="px-4 py-4 space-y-5">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3 border border-red-100">{error}</div>
          )}

          {/* Image */}
          <div>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleImagePick} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 flex items-center justify-center relative group"
            >
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Vorschau" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <span className="text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity">Foto ändern</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-stone-400">
                  <Camera className="w-8 h-8" />
                  <span className="text-sm">Foto hinzufügen</span>
                </div>
              )}
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium text-stone-700 mb-1.5 block">Titel</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-stone-900"
              placeholder="z.B. Spaghetti Carbonara"
            />
          </div>

          {/* Portions + Prep time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-stone-700 mb-1.5 block">Portionen</label>
              <input
                type="number"
                min={1}
                value={draft.portions}
                onChange={(e) => update({ portions: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-stone-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 mb-1.5 block">Min. Zubereitung</label>
              <input
                type="number"
                min={0}
                value={draft.prep_time_minutes ?? ''}
                onChange={(e) => update({ prep_time_minutes: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-stone-900"
                placeholder="optional"
              />
            </div>
          </div>

          {/* Categories */}
          <div>
            <label className="text-sm font-medium text-stone-700 mb-2 block flex items-center gap-1.5">
              <Tag className="w-4 h-4" /> Kategorien
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const active = draft.categoryNames.includes(cat.name);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.name)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      active
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-stone-600 border border-stone-200 hover:border-emerald-300'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
              {categories.length === 0 && (
                <p className="text-sm text-stone-400">Keine Kategorien yet. Tippe unten eine ein.</p>
              )}
            </div>
            <CategoryInput
              existing={categories.map((c) => c.name)}
              onAdd={(name) => { if (!draft.categoryNames.includes(name)) toggleCategory(name); }}
            />
          </div>

          {/* Ingredients */}
          <div>
            <label className="text-sm font-medium text-stone-700 mb-2 block">Zutaten</label>
            <div className="space-y-2">
              {draft.ingredients.map((ing, idx) => (
                <div key={idx} className="flex gap-2 items-start bg-white rounded-xl p-2 border border-stone-100">
                  <div className="flex items-center pt-2 text-stone-300">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className="flex-1 grid grid-cols-[5rem_4rem_1fr] gap-2">
                    <input
                      type="number"
                      step="any"
                      value={ing.quantity ?? ''}
                      onChange={(e) => handleUpdateIngredient(idx, { quantity: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="Menge"
                      className="w-full px-2 py-2 rounded-lg border border-stone-200 text-sm focus:border-emerald-500 outline-none"
                    />
                    <input
                      type="text"
                      value={ing.unit ?? ''}
                      onChange={(e) => handleUpdateIngredient(idx, { unit: e.target.value || null })}
                      placeholder="Einheit"
                      className="w-full px-2 py-2 rounded-lg border border-stone-200 text-sm focus:border-emerald-500 outline-none"
                    />
                    <input
                      type="text"
                      value={ing.name}
                      onChange={(e) => handleUpdateIngredient(idx, { name: e.target.value })}
                      placeholder="Zutat"
                      className="w-full px-2 py-2 rounded-lg border border-stone-200 text-sm focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveIngredient(idx)}
                    className="p-2 text-stone-300 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddIngredient}
              className="mt-2 flex items-center gap-1.5 text-sm text-emerald-600 font-medium hover:text-emerald-700"
            >
              <Plus className="w-4 h-4" /> Zutat hinzufügen
            </button>
          </div>

          {/* Steps */}
          <div>
            <label className="text-sm font-medium text-stone-700 mb-2 block">Zubereitung</label>
            <div className="space-y-2">
              {draft.steps.map((step, idx) => (
                <div key={idx} className="flex gap-2 items-start bg-white rounded-xl p-2 border border-stone-100">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold flex items-center justify-center mt-1">
                    {idx + 1}
                  </span>
                  <textarea
                    value={step}
                    onChange={(e) => handleUpdateStep(idx, e.target.value)}
                    rows={2}
                    placeholder="Zubereitungsschritt..."
                    className="flex-1 px-2 py-2 rounded-lg border border-stone-200 text-sm focus:border-emerald-500 outline-none resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveStep(idx)}
                    className="p-2 text-stone-300 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddStep}
              className="mt-2 flex items-center gap-1.5 text-sm text-emerald-600 font-medium hover:text-emerald-700"
            >
              <Plus className="w-4 h-4" /> Schritt hinzufügen
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-stone-700 mb-1.5 block">Notizen</label>
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => update({ notes: e.target.value || null })}
              rows={3}
              placeholder="Optionale Notizen..."
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-stone-900 text-sm resize-none"
            />
          </div>

          {draft.source_url && (
            <div>
              <label className="text-sm font-medium text-stone-700 mb-1.5 block">Quelle</label>
              <a href={draft.source_url} target="_blank" rel="noopener" className="text-sm text-emerald-600 break-all">
                {draft.source_url}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryInput({ existing, onAdd }: { existing: string[]; onAdd: (name: string) => void }) {
  const [value, setValue] = useState('');
  const handleAdd = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!existing.includes(trimmed)) onAdd(trimmed);
    setValue('');
  };
  return (
    <div className="flex gap-2 mt-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
        placeholder="Neue Kategorie..."
        className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:border-emerald-500 outline-none"
      />
      <button
        type="button"
        onClick={handleAdd}
        className="px-3 py-2 rounded-lg bg-stone-100 text-stone-600 text-sm font-medium hover:bg-stone-200"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

export function extractedToDraft(extracted: ExtractedRecipe, sourceType: SourceType, sourceUrl?: string): Partial<RecipeDraft> {
  return {
    title: extracted.title,
    portions: extracted.portions || 4,
    prep_time_minutes: extracted.prep_time_minutes,
    notes: extracted.notes,
    source_url: sourceUrl ?? null,
    source_type: sourceType,
    ingredients: extracted.ingredients.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, note: i.note })),
    steps: extracted.steps,
    categoryNames: extracted.categories,
    imageUrl: extracted.image_url ?? null,
  };
}
