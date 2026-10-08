// Fonction serveur Vercel (api/assistant.js) : relie le chat du portfolio à Google Gemini (offre gratuite AI Studio).
// Variables d'environnement à définir sur Vercel :
//   GEMINI_API_KEY  (obligatoire) : votre clé créée sur aistudio.google.com
//   GEMINI_MODEL    (facultatif)  : nom du modèle, par défaut "gemini-flash-latest"

const SYSTEM = `Tu es l'assistant du portfolio de Mardochée Yombu (MyM), développeur Full-Stack & Machine Learning en RDC.
Tu réponds aux visiteurs et clients potentiels en français, de façon courte, claire et professionnelle.

Informations sur Mardochée :
- Compétences : développement web (HTML, CSS, JavaScript, PHP), C#, Java, Python, Machine Learning, applications mobiles (MIT App Inventor, React Native), bases de données, analyse de données, développement de logiciels, gestion de projets informatiques, accompagnement des utilisateurs.
- Parcours : BAC à l'École Polytechnique Prof LUMANU (2021-2022), Licence puis Master en informatique à l'Université Officielle de Mbujimayi (UOM), Diplôme d'État en pédagogie générale, certificat INPP en bureautique, formation React Native chez INCUBATOR Inst.
- Expérience : plus de 10 formations en présentiel, plus de 5 en ligne, stage à la DGI, formateur permanent à BECIAS.
- Réalisations : application DACOS (mobile/desktop), site d'inscription en ligne de l'ISPTK.
- Contact : WhatsApp +243 85 058 6886, e-mail Mardocheyombu7@gmail.com.
- Langues : français, tshiluba, lingala, anglais (notions).

Règles : n'invente aucune information (prix, délais, disponibilité). Si tu ne sais pas, invite le visiteur à contacter Mardochée sur WhatsApp. Reste sur le sujet du portfolio et des services.`;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Méthode non autorisée." });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ reply: "Configuration manquante : la variable GEMINI_API_KEY n'est pas définie sur Vercel (ou le projet n'a pas été redéployé après l'avoir ajoutée)." });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { messages } = body;
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ reply: "Message vide." });
    }
    // Nettoyage + limites anti-abus
    let clean = messages.slice(-10).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "").slice(0, 1000) }],
    }));
    while (clean.length && clean[0].role !== "user") clean.shift(); // doit commencer par l'utilisateur
    if (!clean.length) return res.status(400).json({ reply: "Message vide." });

    const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM + "\nRéponds en 2 à 4 phrases maximum." }] },
        contents: clean,
        generationConfig: { maxOutputTokens: 1000, temperature: 0.6 },
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error("Gemini error", r.status, txt);
      let msg = "";
      try { msg = JSON.parse(txt).error.message || ""; } catch (e) {}
      throw new Error("Gemini " + r.status + " : " + msg);
    }
    const data = await r.json();
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    const reply = parts.filter(p => p.text && !p.thought).map(p => p.text).join("").trim();
    if (!reply) throw new Error("Réponse vide");
    return res.status(200).json({ reply });
  } catch (e) {
    console.error(e);
    // Message technique temporaire pour faciliter le diagnostic (à remplacer par un message simple ensuite)
    return res.status(500).json({ reply: "Erreur technique : " + String(e.message || e).slice(0, 220) });
  }
};
