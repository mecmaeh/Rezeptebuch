import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Cookbook, Category } from '@/types';
import { useAuth } from './AuthContext';

interface CookbookContextValue {
  cookbook: Cookbook | null;
  categories: Category[];
  loading: boolean;
  refresh: () => Promise<void>;
  createCookbook: (name: string) => Promise<{ error: string | null }>;
  joinCookbook: (inviteCode: string) => Promise<{ error: string | null }>;
  addCategory: (name: string) => Promise<{ error: string | null }>;
}

const CookbookContext = createContext<CookbookContextValue | undefined>(undefined);

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function CookbookProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [cookbook, setCookbook] = useState<Cookbook | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCookbook = useCallback(async () => {
    if (!user) {
      setCookbook(null);
      setCategories([]);
      setLoading(false);
      return;
    }

    const { data: membership } = await supabase
      .from('cookbook_members')
      .select('cookbook_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      setCookbook(null);
      setCategories([]);
      setLoading(false);
      return;
    }

    const { data: cb } = await supabase
      .from('cookbooks')
      .select('*')
      .eq('id', membership.cookbook_id)
      .maybeSingle();

    if (cb) {
      setCookbook(cb as Cookbook);
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('cookbook_id', cb.id)
        .order('name');
      setCategories((cats as Category[]) ?? []);
    } else {
      setCookbook(null);
      setCategories([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadCookbook();
  }, [loadCookbook]);

  const refresh = useCallback(async () => {
    await loadCookbook();
  }, [loadCookbook]);

  const createCookbook = useCallback(async (name: string) => {
    if (!user) return { error: 'Nicht eingeloggt.' };

    const inviteCode = generateInviteCode();
    const { data, error } = await supabase.rpc('create_cookbook', {
      p_name: name,
      p_invite_code: inviteCode,
    });

    if (error) return { error: error.message };
    if (data?.error) return { error: data.error };

    await refresh();
    return { error: null };
  }, [user, refresh]);

  const joinCookbook = useCallback(async (inviteCode: string) => {
    if (!user) return { error: 'Nicht eingeloggt.' };

    const { data, error } = await supabase.rpc('join_cookbook', {
      p_invite_code: inviteCode,
    });

    if (error) return { error: error.message };
    if (data?.error) return { error: data.error };

    await refresh();
    return { error: null };
  }, [user, refresh]);

  const addCategory = useCallback(async (name: string) => {
    if (!cookbook) return { error: 'Kein Kochbuch ausgewählt.' };
    const { error } = await supabase
      .from('categories')
      .insert({ cookbook_id: cookbook.id, name: name.trim() });
    if (error) {
      if (error.code === '23505') return { error: 'Kategorie existiert bereits.' };
      return { error: error.message };
    }
    await refresh();
    return { error: null };
  }, [cookbook, refresh]);

  return (
    <CookbookContext.Provider value={{ cookbook, categories, loading, refresh, createCookbook, joinCookbook, addCategory }}>
      {children}
    </CookbookContext.Provider>
  );
}

export function useCookbook() {
  const ctx = useContext(CookbookContext);
  if (!ctx) throw new Error('useCookbook must be used within CookbookProvider');
  return ctx;
}
