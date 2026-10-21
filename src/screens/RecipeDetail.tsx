import { useState, useEffect } from 'react';
import { fetchRecipeDetails, scaleQuantity, formatQuantity, deleteRecipe } from '@/lib/recipes';
import type { RecipeWithDetails } from '@/types';
import { Clock, Users, X, Plus, Minus, FileDown, Pencil, Trash2, Check, Link as LinkIcon } from 'lucide-react';

interface Props {
  recipeId: string;
  onEdit: () => void;
  onBack: () => void;
  onDeleted: () => void;
}

export function RecipeDetail({ recipeId, onEdit, onBack, onDeleted }: Props) {
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [portions, setPortions] = useState(4);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchRecipeDetails(recipeId)
      .then((r) => {
        setRecipe(r);
        if (r) setPortions(r.portions);
      })
      .finally(() => setLoading(false));
  }, [recipeId]);

  const toggleCheck = (idx: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const handleDelete = async () => {
    const { error } = await deleteRecipe(recipeId);
    if (!error) onDeleted();
  };

  const handleExportPDF = async () => {
    if (!recipe) return;
    setExporting(true);
    try {
      await exportRecipePDF(recipe, portions);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-stone-50 items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="flex flex-col h-screen bg-stone-50 items-center justify-center">
        <p className="text-stone-500">Rezept nicht gefunden.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-stone-50">
      <header className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-md border-b border-stone-100 safe-area-top sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2 text-stone-600 hover:text-stone-900">
          <X className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-2 text-stone-600 hover:text-emerald-600">
            <Pencil className="w-5 h-5" />
          </button>
          <button onClick={() => setConfirmDelete(true)} className="p-2 text-stone-600 hover:text-red-500">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Hero image */}
        {recipe.image_url && (
          <div className="w-full aspect-[4/3] bg-stone-200 overflow-hidden">
            <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="px-4 py-5 space-y-5">
          {/* Title + meta */}
          <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">{recipe.title}</h1>
            <div className="flex items-center gap-4 mt-3 text-sm text-stone-500">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {recipe.prep_time_minutes ? `${recipe.prep_time_minutes} Min.` : '—'}
              </div>
              {recipe.source_url && (
                <a href={recipe.source_url} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-emerald-600">
                  <LinkIcon className="w-4 h-4" /> Quelle
                </a>
              )}
            </div>
          </div>

          {/* Categories */}
          {recipe.categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recipe.categories.map((cat) => (
                <span key={cat.id} className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                  {cat.name}
                </span>
              ))}
            </div>
          )}

          {/* Portions scaler */}
          <div className="bg-white rounded-2xl p-4 border border-stone-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-stone-700">
                <Users className="w-5 h-5 text-emerald-600" />
                <span className="font-medium">Portionen</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPortions((p) => Math.max(1, p - 1))}
                  className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 hover:bg-stone-200 active:scale-95 transition-all"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center font-semibold text-lg text-stone-900">{portions}</span>
                <button
                  onClick={() => setPortions((p) => p + 1)}
                  className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 hover:bg-stone-200 active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            {portions !== recipe.portions && (
              <p className="text-xs text-stone-400 mt-2">Mengen wurden auf {portions} Portionen angepasst.</p>
            )}
          </div>

          {/* Ingredients */}
          <div>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">Zutaten</h2>
            <div className="space-y-1.5">
              {recipe.ingredients.map((ing, idx) => {
                const scaled = scaleQuantity(ing, portions);
                const isChecked = checked.has(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => toggleCheck(idx)}
                    className="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-stone-100 text-left active:scale-[0.99] transition-transform"
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isChecked ? 'bg-emerald-600 border-emerald-600' : 'border-stone-300'
                    }`}>
                      {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <span className={`text-sm flex-1 ${isChecked ? 'line-through text-stone-400' : 'text-stone-700'}`}>
                      <span className="font-medium">{formatQuantity(scaled)}{ing.unit ? ` ${ing.unit}` : ''}</span>
                      {' '}{ing.name}
                      {ing.note && <span className="text-stone-400">, {ing.note}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Steps */}
          <div>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">Zubereitung</h2>
            <div className="space-y-3">
              {recipe.steps.map((step, idx) => (
                <div key={idx} className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-sm text-stone-700 leading-relaxed pt-0.5">{step.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {recipe.notes && (
            <div>
              <h2 className="text-lg font-semibold text-stone-900 mb-2">Notizen</h2>
              <p className="text-sm text-stone-600 bg-amber-50 rounded-xl p-4 border border-amber-100">{recipe.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* PDF export FAB */}
      <div className="fixed bottom-6 right-4 z-20">
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="px-5 py-3.5 rounded-full bg-stone-900 text-white font-medium text-sm flex items-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-60"
        >
          {exporting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FileDown className="w-5 h-5" />}
          PDF
        </button>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-30" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-md p-6 safe-area-bottom" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-stone-900 mb-2">Rezept löschen?</h3>
            <p className="text-sm text-stone-500 mb-6">"{recipe.title}" wird endgültig aus eurem Kochbuch entfernt.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-3 rounded-xl bg-stone-100 text-stone-700 font-medium hover:bg-stone-200"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function exportRecipePDF(recipe: RecipeWithDetails, portions: number) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (h: number) => {
    if (y + h > pageH - margin) { doc.addPage(); y = margin; }
  };

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  const titleLines = doc.splitTextToSize(recipe.title, contentW);
  ensureSpace(titleLines.length * 26);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 26 + 8;

  // Meta
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(120);
  const metaParts: string[] = [`${portions} Portionen`];
  if (recipe.prep_time_minutes) metaParts.push(`${recipe.prep_time_minutes} Min. Zubereitung`);
  if (recipe.categories.length > 0) metaParts.push(recipe.categories.map((c) => c.name).join(', '));
  doc.text(metaParts.join('  ·  '), margin, y);
  y += 20;
  doc.setTextColor(0);

  // Divider
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 20;

  // Ingredients
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  ensureSpace(20);
  doc.text('Zutaten', margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  for (const ing of recipe.ingredients) {
    const scaled = scaleQuantity(ing, portions);
    const line = `${formatQuantity(scaled)}${ing.unit ? ' ' + ing.unit : ''}  ${ing.name}${ing.note ? ', ' + ing.note : ''}`;
    const lines = doc.splitTextToSize(line, contentW);
    ensureSpace(lines.length * 15 + 4);
    doc.text(lines, margin, y);
    y += lines.length * 15 + 4;
  }
  y += 12;

  // Steps
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  ensureSpace(20);
  doc.text('Zubereitung', margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  recipe.steps.forEach((step, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${step.text}`, contentW);
    ensureSpace(lines.length * 15 + 6);
    doc.text(lines, margin, y);
    y += lines.length * 15 + 6;
  });

  if (recipe.notes) {
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    ensureSpace(20);
    doc.text('Notizen', margin, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(recipe.notes, contentW);
    ensureSpace(lines.length * 15);
    doc.text(lines, margin, y);
  }

  // Try to add image
  if (recipe.image_url) {
    try {
      const imgResp = await fetch(recipe.image_url);
      const blob = await imgResp.blob();
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const imgW = contentW;
      const imgH = imgW * 0.6;
      doc.addPage();
      doc.addImage(dataUrl, 'JPEG', margin, margin, imgW, imgH);
    } catch {
      // Skip image if it fails to load
    }
  }

  doc.save(`${recipe.title.replace(/[^a-zA-Z0-9äöüßÄÖÜ]/g, '_')}.pdf`);
}
