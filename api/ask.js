// api/ask.js
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST /api/ask" });

  try {
    // robust JSON body parsing (covers cases where req.body is empty)
    let body = req.body;
    if (!body || typeof body !== "object") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString("utf8");
      try { body = JSON.parse(raw || "{}"); } catch { body = {}; }
    }

    const question = (body.question || "").trim();
    const lang = (body.lang || "pap").trim();
    const mode = (body.mode || "regular").trim();
    if (!question) return res.status(400).json({ error: "Missing 'question'." });

    // language line
    const langLine = {
      pap: "Kontesta den Papiamentu, kla i ku respet.",
      en:  "Answer in clear English, respectfully.",
      es:  "Responde en español claro, con respeto.",
      nl:  "Antwoord in helder Nederlands, met respect."
    }[lang] || "Answer clearly and respectfully.";

    // prompts
    const basePrompt = `${langLine}
You are a gentle, knowledgeable Bible guide.
- Cite book/chapter/verse when useful.
- Respect different Christian traditions.
- Keep answers concise unless asked for depth.`;

    const patronchiPrompt = `${langLine}
You are a gentle Bible guide using the Patronchi framework.
Core lenses:
- Egipto → Desierto → Canaán (spiritual formation in 3 stages)
- Santa Sena as preparation for Pentecost (transformation)
- Consider 180° counter-traditional view when the text invites it (without disrespect)
Always provide:
1) Biblical grounding (with references)
2) Patronchi angle (what shifts in practice)`;

    const systemPrompt = mode === "patronchi" ? patronchiPrompt : basePrompt;

    // OpenAI call
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.5,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ]
      })
    });

    if (!resp.ok) {
      const fallback = fallbackAnswer(question, lang, mode);
      return res.status(200).json({ answer: fallback, note: "fallback" });
    }

    const data = await resp.json();
    const answer = data?.choices?.[0]?.message?.content ?? null;
    if (!answer) {
      const fallback = fallbackAnswer(question, lang, mode);
      return res.status(200).json({ answer: fallback, note: "fallback" });
    }
    return res.status(200).json({ answer });
  } catch (e) {
    const fallback = fallbackAnswer("", "pap", "regular");
    return res.status(200).json({ answer: fallback, note: "fallback-error:"+e.message });
  }
}

// simple local fallback
function fallbackAnswer(q, lang, mode) {
  const base = {
    pap: "No a logra haña un respuesta kompletu awor. Riprobá likit mas tad. Leé Salmo 23 i Juan 3:16 pa ánimo.",
    en:  "Couldn’t complete a full answer now. Please try again shortly. See Psalm 23 and John 3:16 for encouragement.",
    es:  "No pude completar una respuesta ahora. Intenta de nuevo pronto. Lee Salmo 23 y Juan 3:16 para ánimo.",
    nl:  "Kon geen volledig antwoord geven. Probeer het zo meteen opnieuw. Lees Psalm 23 en Johannes 3:16 voor bemoediging."
  }[lang] || "Please try again later.";

  if (mode === "patronchi") {
    const extra = {
      pap: " (Patronchi: pensa riba e biahe Egipto→Desierto→Canaán den e pasahé.)",
      en:  " (Patronchi: reflect on Egypt→Desert→Canaan journey in the passage.)",
      es:  " (Patronchi: reflexiona sobre Egipto→Desierto→Canaán en el pasaje.)",
      nl:  " (Patronchi: denk aan Egypte→Woestijn→Kanaän in de passage.)"
    }[lang] || "";
    return base + extra;
  }
  return base;
}
