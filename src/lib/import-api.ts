export async function callImportFunction(
  payload: { mode: 'photo'; imageUrl: string } | { mode: 'link'; url: string } | { mode: 'video'; text: string }
): Promise<{ data: any | null; error: string | null }> {
  const supUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://pfljdqjtkqrvbmfuynug.supabase.co';
  const supKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmbGpkcWp0a3FydmJtZnV5bnVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1OTE3NzksImV4cCI6MjEwODE2Nzc3OX0.Np4MutIfmXxaUmQ6lq0WUvbdZolV2kvlYWRzC6EjHUk';
  const apiUrl = `${supUrl}/functions/v1/recipe-import`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${supKey}`,
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return { data: null, error: errBody.error ?? `Anfrage fehlgeschlagen (${response.status})` };
    }

    const data = await response.json();
    if (data.error) return { data: null, error: data.error };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? 'Netzwerkfehler' };
  }
}

export async function uploadImageForImport(
  file: File | Blob,
  contentType: string = 'image/jpeg'
): Promise<{ url: string | null; error: string | null }> {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://pfljdqjtkqrvbmfuynug.supabase.co';
  const bucket = 'recipe-images';
  const path = `_temp_import/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

  try {
    const { supabase } = await import('@/lib/supabase');
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { contentType, upsert: true });

    if (error) return { url: null, error: error.message };

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  } catch (err: any) {
    return { url: null, error: err.message };
  }
}
