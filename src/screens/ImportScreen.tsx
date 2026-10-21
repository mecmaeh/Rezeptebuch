import { useState } from 'react';
import { callImportFunction, uploadImageForImport } from '@/lib/import-api';
import type { ExtractedRecipe, SourceType } from '@/types';
import { X, Camera, Link as LinkIcon, Video, Image as ImageIcon, Loader2 } from 'lucide-react';

interface Props {
  onComplete: (extracted: ExtractedRecipe, sourceType: SourceType, sourceUrl?: string) => void;
  onCancel: () => void;
}

export function ImportScreen({ onComplete, onCancel }: Props) {
  const [mode, setMode] = useState<'choose' | 'photo' | 'link' | 'video'>('choose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePhotoImport = async () => {
    if (!photoFile) return;
    setBusy(true);
    setError(null);
    const { url: uploadedUrl, error: uploadErr } = await uploadImageForImport(photoFile, photoFile.type);
    if (uploadErr || !uploadedUrl) { setError(uploadErr ?? 'Upload fehlgeschlagen.'); setBusy(false); return; }

    const { data, error } = await callImportFunction({ mode: 'photo', imageUrl: uploadedUrl });
    if (error || !data) { setError(error ?? 'Extraktion fehlgeschlagen.'); setBusy(false); return; }

    onComplete(data as ExtractedRecipe, 'photo');
    setBusy(false);
  };

  const handleLinkImport = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    const { data, error } = await callImportFunction({ mode: 'link', url: url.trim() });
    if (error || !data) { setError(error ?? 'Extraktion fehlgeschlagen.'); setBusy(false); return; }
    onComplete(data as ExtractedRecipe, 'link', url.trim());
    setBusy(false);
  };

  const handleVideoImport = async () => {
    if (!videoUrl.trim()) return;
    setBusy(true);
    setError(null);
    const { data, error } = await callImportFunction({ mode: 'video', url: videoUrl.trim() });
    if (error || !data) { setError(error ?? 'Extraktion fehlgeschlagen.'); setBusy(false); return; }
    onComplete(data as ExtractedRecipe, 'video', videoUrl.trim());
    setBusy(false);
  };

  return (
    <div className="flex flex-col h-screen bg-stone-50">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-stone-100 safe-area-top">
        <button onClick={onCancel} className="p-2 -ml-2 text-stone-500 hover:text-stone-900">
          <X className="w-6 h-6" />
        </button>
        <h1 className="font-semibold text-stone-900">Rezept importieren</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {mode === 'choose' && (
          <div className="space-y-3 max-w-md mx-auto">
            <p className="text-stone-500 text-center text-sm mb-6">
              Wähle eine Import-Methode. Alle Importe werden vor dem Speichern bearbeitet.
            </p>
            <ImportOption
              icon={<Camera className="w-6 h-6" />}
              title="Foto-Upload"
              desc="Foto eines geschriebenen oder gedruckten Rezepts — wird per OCR gelesen und strukturiert."
              onClick={() => setMode('photo')}
            />
            <ImportOption
              icon={<LinkIcon className="w-6 h-6" />}
              title="URL-Eingabe"
              desc="Rezeptlink wird geladen und automatisch strukturiert."
              onClick={() => setMode('link')}
            />
            <ImportOption
              icon={<Video className="w-6 h-6" />}
              title="Video / Reel"
              desc="Videolink einfügen — Rezept wird aus Beschreibung und verfügbaren Inhalten extrahiert."
              onClick={() => setMode('video')}
            />
          </div>
        )}

        {mode === 'photo' && (
          <div className="max-w-md mx-auto space-y-4">
            <h2 className="text-lg font-semibold text-stone-900">Foto hochladen</h2>
            <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-white border-2 border-dashed border-stone-300 flex items-center justify-center relative">
              {photoPreview ? (
                <img src={photoPreview} alt="Ausgewähltes Rezeptfoto" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-stone-400">
                  <ImageIcon className="w-10 h-10" />
                  <span className="text-sm">Noch kein Bild ausgewählt</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-50 text-emerald-700 font-medium cursor-pointer hover:bg-emerald-100 transition-colors">
                <Camera className="w-5 h-5" />
                <span>Kamera</span>
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoPick} className="hidden" />
              </label>
              <label className="flex items-center justify-center gap-2 py-3 rounded-xl bg-stone-100 text-stone-700 font-medium cursor-pointer hover:bg-stone-200 transition-colors">
                <ImageIcon className="w-5 h-5" />
                <span>Galerie</span>
                <input type="file" accept="image/*" onChange={handlePhotoPick} className="hidden" />
              </label>
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3 border border-red-100">{error}</div>}
            <button
              onClick={handlePhotoImport}
              disabled={!photoFile || busy}
              className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> Wird verarbeitet...</> : 'Rezept extrahieren'}
            </button>
          </div>
        )}

        {mode === 'link' && (
          <div className="max-w-md mx-auto space-y-4">
            <h2 className="text-lg font-semibold text-stone-900">Rezept-Link</h2>
            <p className="text-sm text-stone-500">Füge die URL einer Rezeptseite ein. Der Text wird geladen und strukturiert.</p>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://chefkoch.de/..."
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-stone-900"
            />
            {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3 border border-red-100">{error}</div>}
            <button
              onClick={handleLinkImport}
              disabled={!url.trim() || busy}
              className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> Wird geladen...</> : 'Rezept extrahieren'}
            </button>
          </div>
        )}

        {mode === 'video' && (
          <div className="max-w-md mx-auto space-y-4">
            <h2 className="text-lg font-semibold text-stone-900">Video- oder Reel-Link</h2>
            <p className="text-sm text-stone-500">Füge den Link eines Kochvideos oder Reels ein. Die Rezeptinformationen werden automatisch aus der Videoseite und Beschreibung gelesen.</p>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-stone-900"
            />
            {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3 border border-red-100">{error}</div>}
            <button
              onClick={handleVideoImport}
              disabled={!videoUrl.trim() || busy}
              className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> Wird verarbeitet...</> : 'Rezept extrahieren'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ImportOption({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-stone-100 hover:border-emerald-300 hover:shadow-sm transition-all text-left active:scale-[0.99]"
    >
      <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-stone-900">{title}</h3>
        <p className="text-sm text-stone-500 mt-0.5">{desc}</p>
      </div>
    </button>
  );
}
