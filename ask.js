// api/ask.js
export default async function handler(req, res) {
  // Basic CORS (you can restrict origin later)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST /api/ask" });
  }

  try {
    const body = req.body || {};
    const question = (body.question || "").trim();
    if (!question) {
      return res.status(400).json({ error: "Missing 'question'." });
    }

    const systemPrompt = `You are a gentle, knowledgeable Bible guide.
- Answer clearly and cite book/chapter/verse when helpful.
- Be respectful of different traditions.
- Languages: English, Papiamentu, Spanish.
- Keep answers concise unless asked to go deeper.`;

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
      const text = await resp.text();
      return res.status(502).json({ error: "OpenAI error", details: text });
    }

    const data = await resp.json();
    const answer = data?.choices?.[0]?.message?.content ?? "I couldn't produce an answer.";
    return res.status(200).json({ answer });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error." });
  }
}
