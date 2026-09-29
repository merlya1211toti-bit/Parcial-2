import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;
const model = process.env.OPENAI_MODEL || "gpt-5.4";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "missing-key" });

function config() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "agent.config.json"), "utf8"));
}

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config", (_req, res) => {
  const c = config();
  const { systemPrompt, ...safe } = c;
  res.json(safe);
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, previousResponseId } = req.body || {};
    if (!message) return res.status(400).json({ error: "Escribe un mensaje." });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "Falta OPENAI_API_KEY en .env" });

    const c = config();
    const payload = {
      model,
      instructions: c.systemPrompt,
      input: message,
      max_output_tokens: 550
    };
    if (previousResponseId) payload.previous_response_id = previousResponseId;

    const response = await client.responses.create(payload);
    res.json({ id: response.id, text: response.output_text || "Sin respuesta." });
  } catch (e) {
    console.error(e);
    if (e?.status === 401) return res.status(401).json({ error: "API key no válida." });
    if (e?.status === 429) return res.status(429).json({ error: "Límite de API alcanzado temporalmente." });
    res.status(500).json({ error: "Error al consultar el agente." });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, model }));
app.listen(port, () => console.log(`SMART AVATAR EXPERIENCE listo en http://localhost:${port}`));
