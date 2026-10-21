import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ChefHat, Mail, Lock, UserPlus, LogIn } from 'lucide-react';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fn = mode === 'login' ? signIn : signUp;
    const { error } = await fn(email.trim(), password);
    if (error) setError(error);
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-stone-50">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-emerald-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-600/20">
            <ChefHat className="w-10 h-10 text-white" strokeWidth={1.8} />
          </div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Unser Kochbuch</h1>
          <p className="text-stone-500 mt-2 text-center">
            Euer gemeinsames, privates Rezeptbuch
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
          <div className="flex gap-1 p-1 bg-stone-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'login' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
              }`}
            >
              Anmelden
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'signup' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
              }`}
            >
              Registrieren
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-stone-700 mb-1.5 block">E-Mail</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-stone-900"
                  placeholder="euer@email.de"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-stone-700 mb-1.5 block">Passwort</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-stone-900"
                  placeholder="mindestens 6 Zeichen"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3 border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60 shadow-sm shadow-emerald-600/20"
            >
              {busy ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : mode === 'login' ? (
                <><LogIn className="w-5 h-5" /> Anmelden</>
              ) : (
                <><UserPlus className="w-5 h-5" /> Konto erstellen</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-stone-400 mt-6">
          {mode === 'signup'
            ? 'Nach der Registrierung erstellst du dein Kochbuch oder joinst mit einem Code.'
            : 'Melde dich an, um auf euer gemeinsames Kochbuch zuzugreifen.'}
        </p>
      </div>
    </div>
  );
}
