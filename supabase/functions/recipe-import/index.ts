import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExtractedRecipe {
  title: string;
  portions: number;
  prep_time_minutes: number | null;
  ingredients: { name: string; quantity: number | null; unit: string | null; note: string | null }[];
  steps: string[];
  categories: string[];
  notes: string | null;
}

interface ImportResponse extends ExtractedRecipe {
  image_url: string | null;
}

const SYSTEM_PROMPT = `You are a recipe extraction assistant. Extract structured recipe data from the given input.
Return ONLY valid JSON (no markdown fences) with this exact schema:
{
  "title": string,
  "portions": number (default 4 if not specified),
  "prep_time_minutes": number | null,
  "ingredients": [{ "name": string, "quantity": number | null, "unit": string | null, "note": string | null }],
  "steps": string[],
  "categories": string[] (e.g. "Suppe", "Vegetarisch", "Dessert", "Hauptgericht"),
  "notes": string | null
}
Rules:
- Extract quantities as numbers (e.g. "200g" -> quantity: 200, unit: "g"; "2 EL" -> quantity: 2, unit: "EL").
- If no quantity is given, set quantity to null.
- Steps should be clear, numbered preparation instructions.
- Categories should be in German, short, and commonly used.
- If the input is not a recipe, return {"title": "", "portions": 4, "prep_time_minutes": null, "ingredients": [], "steps": [], "categories": [], "notes": null}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OpenAI API-Schlüssel nicht konfiguriert." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const mode: 'photo' | 'link' | 'video' = body.mode;
    const imageUrl: string | null = body.imageUrl ?? null;
    const url: string | null = body.url ?? null;
    const text: string | null = body.text ?? null;

    let userContent: any;
    let extractedImageUrl: string | null = null;

    if (mode === 'photo' && imageUrl) {
      userContent = [
        { type: "text", text: "Extrahiere das Rezept aus diesem Bild (OCR + Strukturierung)." },
        { type: "image_url", image_url: { url: imageUrl } },
      ];
      extractedImageUrl = imageUrl;
    } else if (mode === 'link' && url) {
      const pageContent = await fetchPageContent(url);
      if (!pageContent) {
        return new Response(JSON.stringify({ error: "Seite konnte nicht geladen werden." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userContent = `Extrahiere das Rezept von dieser Webseite.\nURL: ${url}\n\nInhalt:\n${pageContent}`;
      extractedImageUrl = await extractOgImage(url);
    } else if (mode === 'video' && text) {
      userContent = `Extrahiere das Rezept aus diesem Videobeschreibung/Transkript:\n\n${text}`;
    } else {
      return new Response(JSON.stringify({ error: "Ungültiger Import-Modus oder fehlende Eingabe." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!openaiResponse.ok) {
      const errorBody = await openaiResponse.json().catch(() => null) as { error?: { message?: string } } | null;
      const openaiMessage = errorBody?.error?.message ?? '';
      const message = openaiResponse.status === 401
        ? 'Der OpenAI-Schlüssel ist ungültig oder abgelaufen. Bitte hinterlege einen gültigen OpenAI-Schlüssel in den Supabase-Edge-Function-Geheimnissen.'
        : openaiResponse.status === 429
          ? 'Das OpenAI-Nutzungslimit wurde erreicht. Bitte prüfe das Guthaben und die Limits des OpenAI-Kontos.'
          : `OpenAI konnte das Rezept nicht verarbeiten (${openaiResponse.status}).`;
      console.error('OpenAI request failed', openaiResponse.status, openaiMessage);
      return new Response(JSON.stringify({ error: message }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiData = await openaiResponse.json() as { choices?: { message?: { content?: string } }[] };
    const content = openaiData.choices?.[0]?.message?.content ?? "";
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let extracted: ExtractedRecipe;
    try {
      extracted = JSON.parse(jsonStr) as ExtractedRecipe;
    } catch {
      return new Response(JSON.stringify({ error: 'OpenAI hat kein gültiges Rezeptformat zurückgegeben. Bitte versuche es erneut.' }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!extracted.title || extracted.ingredients.length === 0) {
      return new Response(JSON.stringify({ error: "Kein Rezept erkannt. Bitte versuche es mit einer anderen Eingabe." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result: ImportResponse = { ...extracted, image_url: extractedImageUrl };
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RecipeBot/1.0)",
        "Accept": "text/html",
      },
      redirect: "follow",
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const text = htmlToText(html);
    return text.slice(0, 8000);
  } catch {
    return null;
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractOgImage(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RecipeBot/1.0)" },
      redirect: "follow",
    });
    if (!resp.ok) return null;
    const html = await resp.text();

    const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogMatch) return resolveUrl(ogMatch[1], url);

    const twitterMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
    if (twitterMatch) return resolveUrl(twitterMatch[1], url);

    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (imgMatch) return resolveUrl(imgMatch[1], url);

    return null;
  } catch {
    return null;
  }
}

function resolveUrl(src: string, baseUrl: string): string {
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}
