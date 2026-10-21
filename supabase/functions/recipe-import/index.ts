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
- Convert ALL units to the German/metric set: g, ml, EL, TL. Examples: "1 cup" -> 240 ml; "1 tbsp" -> 1 EL; "1 tsp" -> 1 TL; "1 lb" -> 453.59 g; "2 oz" -> 56.7 g; "1 pint" -> 473 ml; "1 quart" -> 946 ml; "1 stick butter" -> 113 g.
- Keep the original unit only if it is already g, ml, EL or TL.
- If no quantity is given, set quantity to null.
- Translate English ingredient names and instructions into German.
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
    } else if (mode === 'video' && url) {
      if (!isSupportedVideoUrl(url)) {
        return new Response(JSON.stringify({ error: "Bitte füge einen gültigen YouTube-, Instagram-, TikTok- oder Facebook-Videolink ein." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const pageContent = await fetchVideoContent(url);
      if (!pageContent) {
        return new Response(JSON.stringify({ error: "Die Videoseite konnte nicht geladen werden oder enthält keine auslesbare Beschreibung." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userContent = `Extrahiere das Rezept aus diesem Kochvideo oder Reel. Nutze die Videobeschreibung, den Seitentitel und alle verfügbaren Textinhalte. Wenn keine vollständigen Mengen vorhanden sind, leite nur aus eindeutig genannten Angaben etwas ab und erfinde keine Zutaten.\nVideo-Link: ${url}\n\nVerfügbare Videodaten:\n${pageContent}`;
      extractedImageUrl = await extractOgImage(url);
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
  const html = await fetchHtml(url);
  return html ? htmlToText(html).slice(0, 8000) : null;
}

async function fetchVideoContent(url: string): Promise<string | null> {
  const html = await fetchHtml(url);
  if (!html) return null;

  const parts = [
    extractMetaContent(html, 'description'),
    extractMetaContent(html, 'og:title'),
    extractMetaContent(html, 'og:description'),
    extractEmbeddedYouTubeDescription(html),
    htmlToText(html),
  ].filter((part): part is string => Boolean(part?.trim()));

  return [...new Set(parts)].join('\n\n').slice(0, 12000) || null;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RecipeBot/1.0)",
        "Accept": "text/html",
      },
      redirect: "follow",
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

function extractMetaContent(html: string, name: string): string | null {
  const escapedName = name.replace(':', '\\:');
  const match = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${escapedName}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'));
  return match ? decodeHtmlEntities(match[1]) : null;
}

function extractEmbeddedYouTubeDescription(html: string): string | null {
  const match = html.match(/"shortDescription":"((?:\\.|[^"\\])*)"/);
  if (!match) return null;
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return null;
  }
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
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

function isSupportedVideoUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    return [
      'youtube.com',
      'youtu.be',
      'instagram.com',
      'tiktok.com',
      'facebook.com',
    ].some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function resolveUrl(src: string, baseUrl: string): string {
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}
