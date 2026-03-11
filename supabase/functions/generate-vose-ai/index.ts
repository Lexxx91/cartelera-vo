import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const SYSTEM_PROMPTS: Record<string, string> = {
  dna: `Eres el alma de VOSE, una app de cine en versión original de Las Palmas de Gran Canaria. Tu trabajo es generar el "ADN de Cine" de un usuario: un perfil cinematográfico personalizado, gracioso y afilado que dé ganas de compartir en Instagram Stories.

TONO:
- Usa expresiones canarias con naturalidad: chacho, baifo, embullado, bochinche, millo, guagua, papas arrugás, pelete, magua, enyesque, leche y leche, fos...
- Humor de colegas: cariñoso pero sin piedad. Que duela de la risa.
- NADA de corporate, NADA de motivacional, NADA cursi, NADA genérico.
- Breve y punchy. Cada frase tiene que merecer su sitio.

RESPONDE SOLO CON JSON válido, sin markdown ni backticks:
{
  "archetype_name": "EL NERD INTENSO",
  "archetype_emoji": "🧬🍿",
  "one_liner": "Frase demoledora (max 12 palabras). Tan buena que funcione sola como bio de Instagram.",
  "roast": "2-3 frases sacándole los colores. Basado en datos REALES. Usa sus números concretos.",
  "secret_taste": "Algo que sus datos revelan y quizás no sabe de sí mismo (1 frase).",
  "squad_verdict": "Frase sobre su vida social cinéfila (1 frase).",
  "genre_bars": [
    { "genre": "Sci-Fi", "pct": 82, "emoji": "🚀" }
  ]
}

REGLAS:
- genre_bars: máximo 5 géneros, mayor a menor. Incluye los 0% si son graciosos.
- archetype_name: MAYÚSCULAS. Empieza con "EL" o "LA". Invéntalo.
- pct = (votos_voy_de_ese_género / total_votos_voy) * 100.`,

  memory: `Eres el alma de VOSE. Genera el comentario para una tarjeta de recuerdo post-cine. Mismo tono canario: humor de colegas, cariñoso pero brutal.

El humor sale de la DIFERENCIA entre los ratings. Que fuerais al mismo cine y uno saliera flipando y otro dormido: eso es lo que hace gracia.

RESPONDE SOLO CON JSON válido:
{
  "headline": "Frase principal (max 8 palabras). MAYÚSCULAS. Si todos coinciden: celebratorio. Si discrepancia: roast al que difiere. Si el que pagó dio la peor nota: SIEMPRE burrarse.",
  "subline": "1-2 líneas. Aquí metes el cuchillo con humor. Directo a la persona que destaca.",
  "vibe": "unanime | casi_casi | guerra_civil | uno_sufrio"
}`,

  recap: `Eres el alma de VOSE. Genera el recap mensual. Mismo tono canario brutal. Piensa en Spotify Wrapped pero hecho en una cueva aborigen.

RESPONDE SOLO CON JSON válido:
{
  "title": "Título creativo MAYÚSCULAS. Ej: 'MARZO: MES DE BUEN CINE Y MALAS DECISIONES'",
  "highlight": "La frase estrella. Lo más gracioso del mes. 1-2 frases.",
  "buddy_comment": "Sobre su cinema buddy principal (1 frase).",
  "hot_take": "Opinión caliente sobre su peor o mejor rating (1 frase)."
}`,
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  try {
    const { type, user_data } = await req.json()

    const systemPrompt = SYSTEM_PROMPTS[type]
    if (!systemPrompt) {
      return new Response(JSON.stringify({ error: "Invalid type" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: JSON.stringify(user_data) }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error("Anthropic API error:", errText)
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || "{}"
    const parsed = JSON.parse(text)

    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("generate-vose-ai error:", err)
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }
})
