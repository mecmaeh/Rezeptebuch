import { useState } from 'react';
import { useCookbook } from '@/context/CookbookContext';
import { ChefHat, Plus, KeyRound, Users } from 'lucide-react';

export function OnboardingScreen() {
  const { createCookbook, joinCookbook } = useCookbook();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    if (mode === 'create') {
      if (!name.trim()) { setError('Bitte gib einen Namen ein.'); setBusy(false); return; }
      const { error } = await createCookbook(name.trim());
      if (error) setError(error);
    } else {
      if (!code.trim()) { setError('Bitte gib einen Code ein.'); setBusy(false); return; }
      const { error } = await joinCookbook(code);
      if (error) setError(error);
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-stone-50">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center mb-3 shadow-lg shadow-emerald-600/20">
            <ChefHat className="w-8 h-8 text-white" strokeWidth={1.8} />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Kochbuch einrichten</h1>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
          <div className="flex gap-1 p-1 bg-stone-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => { setMode('create'); setError(null); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                mode === 'create' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
              }`}
            >
              <Plus className="w-4 h-4" /> Neu erstellen
            </button>
            <button
              type="button"
              onClick={() => { setMode('join'); setError(null); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                mode === 'join' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
              }`}
            >
              <KeyRound className="w-4 h-4" /> Mit Code beitreten
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'create' ? (
              <div>
                <label className="text-sm font-medium text-stone-700 mb-1.5 block">Name des Kochbuchs</label>
                <div className="relative">
                  <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-stone-900"
                    placeholder="z.B. Max & Anna"
                  />
                </div>
                <p className="text-xs text-stone-400 mt-2">
                  Du erhältst einen Einladungscode, den du mit deinem Partner teilen kannst.
                </p>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-stone-700 mb-1.5 block">Einladungscode</label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    required
                    maxLength={6}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-stone-900 tracking-widest font-mono uppercase"
                    placeholder="ABCD12"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3 border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60 shadow-sm shadow-emerald-600/20"
            >
              {busy ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto block" />
              ) : mode === 'create' ? 'Kochbuch erstellen' : 'Kochbuch beitreten'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
