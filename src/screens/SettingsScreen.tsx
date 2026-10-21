import { useState } from 'react';
import { useCookbook } from '@/context/CookbookContext';
import { useAuth } from '@/context/AuthContext';
import { ChefHat, LogOut, Copy, Check, Users } from 'lucide-react';

interface Props {
  onSignOut: () => void;
}

export function SettingsScreen({ onSignOut }: Props) {
  const { cookbook } = useCookbook();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (!cookbook) return;
    navigator.clipboard.writeText(cookbook.invite_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col h-screen bg-stone-50">
      <header className="px-4 pt-3 pb-3 bg-white border-b border-stone-100 safe-area-top">
        <h1 className="text-xl font-bold text-stone-900">Einstellungen</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {/* Profile */}
        <div className="bg-white rounded-2xl p-5 border border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-lg font-semibold">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-stone-900 truncate">{user?.email ?? 'Unbekannt'}</p>
              <p className="text-sm text-stone-400">Angemeldet</p>
            </div>
          </div>
        </div>

        {/* Cookbook info */}
        {cookbook && (
          <div className="bg-white rounded-2xl p-5 border border-stone-100">
            <div className="flex items-center gap-2 mb-4">
              <ChefHat className="w-5 h-5 text-emerald-600" />
              <h2 className="font-semibold text-stone-900">Kochbuch</h2>
            </div>
            <p className="text-stone-700 font-medium mb-3">{cookbook.name}</p>

            <div className="bg-stone-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-stone-400" />
                <p className="text-sm text-stone-500">Einladungscode für deinen Partner</p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <code className="text-2xl font-mono font-bold text-stone-900 tracking-widest">
                  {cookbook.invite_code}
                </code>
                <button
                  onClick={handleCopyCode}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium flex items-center gap-1.5 hover:bg-emerald-700 transition-colors"
                >
                  {copied ? <><Check className="w-4 h-4" /> Kopiert</> : <><Copy className="w-4 h-4" /> Kopieren</>}
                </button>
              </div>
              <p className="text-xs text-stone-400 mt-3">
                Teile diesen Code mit deinem Partner. Er kann sich registrieren und den Code im Onboarding eingeben.
              </p>
            </div>
          </div>
        )}

        {/* About */}
        <div className="bg-white rounded-2xl p-5 border border-stone-100">
          <h2 className="font-semibold text-stone-900 mb-2">Über die App</h2>
          <p className="text-sm text-stone-500 leading-relaxed">
            Euer gemeinsames, privates Rezeptbuch. Importiere Rezepte per Foto, Link oder Video.
            Skaliere Portionen, exportiere als PDF und durchsuche nach Kategorien und Zutaten.
          </p>
        </div>

        {/* Logout */}
        <button
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white text-red-500 font-medium border border-stone-100 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5" /> Abmelden
        </button>
      </div>
    </div>
  );
}
