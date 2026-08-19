import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Body parsers for large images/PDFs
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Lazy Google GenAI initialization helper
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please configure it in the Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Lista ordenada de modelos para fallback resiliente em picos de demanda
const CANDIDATE_MODELS = [
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-3.7-flash",
  "gemini-3.1-flash-lite",
];

async function executeGenAiWithFallback<T>(
  ai: GoogleGenAI,
  fn: (model: string) => Promise<T>
): Promise<T> {
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await fn(model);
        return result;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || "");
        const status = err?.status || err?.code;
        const isTransient =
          status === 503 ||
          status === 429 ||
          msg.includes("503") ||
          msg.includes("UNAVAILABLE") ||
          msg.includes("high demand") ||
          msg.includes("ResourceExhausted") ||
          msg.includes("overloaded");

        console.warn(`[Gemini Request] Falha com modelo ${model} (tentativa ${attempt + 1}): ${msg}`);

        if (isTransient) {
          // Pausa antes de tentar novamente ou trocar de modelo
          await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
        } else {
          // Erro não transitório, tenta o próximo modelo
          break;
        }
      }
    }
  }

  throw lastError;
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "CorteFácil API", time: new Date().toISOString() });
});

// AI Document/Photo Extraction Endpoint
app.post("/api/ai/analyze-media", async (req, res) => {
  try {
    const { base64Data, mimeType, documentType, hints } = req.body;

    if (!base64Data || !mimeType) {
      return res.status(400).json({
        success: false,
        error: "Arquivo base64Data e mimeType são obrigatórios.",
      });
    }

    const ai = getAiClient();

    const prompt = `Você é um especialista em corte de chapas metálicas, funilaria e calhas.
Analise o documento/imagem fornecido (que pode ser foto de projeto, anotação manual, orçamento, PDF de desenho técnico ou lista de corte).

Sua tarefa é extrair TODAS as peças que precisam ser fabricadas com suas medidas de desenvolvimento (largura da chapa esticada) e comprimento.

REGRAS RÍGIDAS:
1. DESENVOLVIMENTO (largura do corte em mm): É a largura da chapa necessária para dobrar a peça (ex: 300mm, 400mm, 600mm, 800mm, 1000mm). Se houver medidas em cm ou m, CONVERTA PARA MILÍMETROS (ex: 60cm = 600mm, 3m = 3000mm).
2. Se a peça tiver desenvolvimento variável (trapezoidal), identifique devStart e devEnd (ex: 400mm para 350mm). Se for constante, devStart e devEnd devem ter o mesmo valor.
3. COMPRIMENTO (comprimento da chapa em mm): Ex: 3 metros = 3000mm.
4. QUANTIDADE: Número de peças requeridas.
5. TIPO DE PEÇA: calha, rufo, pingadeira, colarinho, contra_rufo, perfil, ou outro.
6. CONFIANÇA (0.0 a 1.0): NUNCA invente medidas. Se uma cota estiver ilegível ou ambígua, marque confiança baixa (< 0.7) e adicione um aviso em "warnings".
7. MATERIAL: Se especificado (Galvanizado, Galvalume, Inox, Alumínio, etc.), caso contrário informe "".
8. ESPESSURA: Se especificada (ex: 0.43, 0.50, 0.65 mm), caso contrário informe "".

Informações contextuais fornecidas pelo usuário: "${hints || "Nenhuma informação extra"}".

Retorne a resposta estritamente no esquema JSON solicitado.`;

    const response = await executeGenAiWithFallback(ai, async (model) => {
      return await ai.models.generateContent({
        model,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              success: { type: Type.BOOLEAN },
              documentSummary: {
                type: Type.STRING,
                description: "Resumo do documento analisado e observações gerais.",
              },
              warnings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Avisos sobre cotas incertas, medidas não identificadas com segurança ou observações críticas.",
              },
              extractedPieces: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pieceName: { type: Type.STRING, description: "Nome ou identificador da peça (ex: Calha Moldura, Rufo Pingadeira)" },
                    type: { type: Type.STRING, description: "calha, rufo, pingadeira, colarinho, contra_rufo, perfil ou outro" },
                    quantity: { type: Type.INTEGER, description: "Quantidade de peças" },
                    devStart: { type: Type.NUMBER, description: "Desenvolvimento inicial em mm" },
                    devEnd: { type: Type.NUMBER, description: "Desenvolvimento final em mm" },
                    length: { type: Type.NUMBER, description: "Comprimento da peça em mm" },
                    material: { type: Type.STRING, description: "Material (Galvanizado, Galvalume, Inox, etc.)" },
                    thickness: { type: Type.STRING, description: "Espessura (ex: 0.50mm)" },
                    confidence: { type: Type.NUMBER, description: "Nível de confiança entre 0.0 e 1.0" },
                    notes: { type: Type.STRING, description: "Observações da cota ou dobra" },
                  },
                  required: ["pieceName", "type", "quantity", "devStart", "devEnd", "length", "confidence"],
                },
              },
            },
            required: ["success", "documentSummary", "warnings", "extractedPieces"],
          },
        },
      });
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (error: any) {
    console.error("Erro na análise de mídia com IA:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Falha ao processar arquivo com IA. Os servidores podem estar com alta demanda temporária. Tente novamente em alguns segundos.",
    });
  }
});

// AI Cutting Assistant Chat Endpoint
app.post("/api/ai/assistant", async (req, res) => {
  try {
    const { message, inventory, scraps, currentOrder, machineLimits, chatHistory } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Mensagem obrigatória" });
    }

    const ai = getAiClient();

    const systemInstruction = `Você é o Assistente Especialista em Corte e Funilaria do aplicativo CorteFácil.
Você possui conhecimento técnico profundo sobre corte de chapas metálicas, fabricação de calhas, rufos, pingadeiras, otimização de guilhotina e aproveitamento de retalhos.

DADOS REAIS DO ESTOQUE ATUAL DO USUÁRIO:
- Chapas Inteiras no Estoque: ${JSON.stringify(inventory || [])}
- Retalhos e Sobras Disponíveis: ${JSON.stringify(scraps || [])}
- Peças da Ordem Atual: ${JSON.stringify(currentOrder || [])}
- Configuração da Máquina: ${JSON.stringify(machineLimits || { maxCutLength: 5000, kerf: 2 })}

REGRAS DE RESPOSTA:
1. Responda de forma direta, técnica, prestativa e objetiva em Português (Brasil).
2. NUNCA dê respostas genéricas quando o usuário perguntar sobre o estoque. SEMPRE consulte as chapas e retalhos cadastrados acima e cite as dimensões reais existentes no estoque!
3. Se o usuário perguntar qual chapa usar, analise o desenvolvimento e comprimento necessários e indique a chapa ou retalho específico do estoque que minimiza o desperdício.
4. Lembre que peças trapezoidais (ex: 400 -> 350mm) podem ser encaixadas de forma invertida para economizar material.
5. Se uma peça ultrapassar o comprimento máximo da máquina, recomende cortes com sobreposição técnica (ex: 100mm de transpasse para emenda de calha).
6. Formate sua resposta com tópicos claros, destaques em negrito e cálculos matemáticos exatos de aproveitamento.`;

    const response = await executeGenAiWithFallback(ai, async (model) => {
      const chat = ai.chats.create({
        model,
        config: {
          systemInstruction,
          temperature: 0.4,
        },
      });

      return await chat.sendMessage({
        message: message,
      });
    });

    return res.json({
      text: response.text,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Erro no Assistente IA:", error);
    return res.status(500).json({
      error: error?.message || "Falha ao consultar o Assistente IA. Os servidores podem estar com alta demanda temporária. Tente novamente em alguns segundos.",
    });
  }
});

// AI Cut Optimization Analysis Endpoint
app.post("/api/ai/optimize-cut", async (req, res) => {
  try {
    const { pieces, inventory, scraps, machineLimits } = req.body;

    if (!pieces || !Array.isArray(pieces) || pieces.length === 0) {
      return res.status(400).json({ error: "Lista de peças obrigatória para análise de corte." });
    }

    const ai = getAiClient();

    const prompt = `Você é um engenheiro sênior especialista em otimização de corte 2D de chapas metálicas, funilaria e fabricação de calhas/rufos.

Analise as seguintes peças solicitadas para corte:
${JSON.stringify(pieces, null, 2)}

Configurações e limites da guilhotina/máquina:
${JSON.stringify(machineLimits || { maxCutLength: 7000, kerf: 2, safetyMargin: 5 })}

Estoque disponível:
- Chapas: ${JSON.stringify(inventory || [])}
- Retalhos: ${JSON.stringify(scraps || [])}

Larguras comerciais padrão de bobina disponíveis no mercado: 30cm, 40cm, 50cm, 60cm, 70cm, 80cm, 90cm, 100cm (1m), 120cm (1.20m).

SUA MISSÃO:
1. Calcule como empilhar as tiras na largura (colocando uma peça embaixo da outra ao longo do eixo Y da chapa) para minimizar o comprimento desenrolado da bobina.
2. Identifique qual largura de bobina comercial gera a menor sobra lateral residual e maior aproveitamento (% Yield).
3. Se houver peças trapezoidais (ex: 400->350mm), detalhe o pareamento inverso (ponta maior com ponta menor) que elimina o desperdício diagonal.
4. Forneça instruções passo a passo para o operador da guilhotina.

Retorne sua resposta estritamente no esquema JSON solicitado.`;

    const response = await executeGenAiWithFallback(ai, async (model) => {
      return await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              success: { type: Type.BOOLEAN },
              bestCoilWidthCm: {
                type: Type.NUMBER,
                description: "Largura ideal da bobina em centímetros (ex: 80 para 80cm)",
              },
              unrollLengthMeters: {
                type: Type.NUMBER,
                description: "Comprimento total da folha a ser desenrolada do rolo em metros (ex: 3.0)",
              },
              lateralWasteCm: {
                type: Type.NUMBER,
                description: "Sobra lateral restante em centímetros (ex: 5.0)",
              },
              estimatedYieldPercentage: {
                type: Type.NUMBER,
                description: "Taxa estimada de aproveitamento percentual (ex: 93.8)",
              },
              expertDiagnosis: {
                type: Type.STRING,
                description: "Diagnóstico técnico resumido explicando por que essa é a melhor escolha geométrica.",
              },
              stripStackingExplanation: {
                type: Type.STRING,
                description: "Explicação de como as peças ficam distribuídas na largura (uma embaixo da outra).",
              },
              guillotineStepByStep: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Passos práticos de corte para o operador da guilhotina.",
              },
              alternativeOptions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    coilWidthCm: { type: Type.NUMBER },
                    unrollMeters: { type: Type.NUMBER },
                    lateralWasteCm: { type: Type.NUMBER },
                    yieldPercentage: { type: Type.NUMBER },
                    comment: { type: Type.STRING },
                  },
                  required: ["coilWidthCm", "unrollMeters", "lateralWasteCm", "yieldPercentage"],
                },
                description: "Comparativo das outras opções de bobina testadas.",
              },
            },
            required: [
              "success",
              "bestCoilWidthCm",
              "unrollLengthMeters",
              "lateralWasteCm",
              "estimatedYieldPercentage",
              "expertDiagnosis",
              "stripStackingExplanation",
              "guillotineStepByStep",
            ],
          },
        },
      });
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (error: any) {
    console.error("Erro na otimização com IA Gemini:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Falha ao processar otimização com IA Gemini.",
    });
  }
});

// Vite Middleware or Static Production Serving
async function startServer() {
  try {
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`CorteFácil server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
