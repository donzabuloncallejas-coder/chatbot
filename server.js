const crypto = require("crypto");
const net = require("net");
const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const morgan = require("morgan");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const RAW_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  "http://localhost:5678/webhook/whatsapp-in";
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);

function normalizeWebhookUrl(url) {
  if (typeof url !== "string") {
    return "";
  }

  return url.trim().replace(/\/+$/, "");
}

const WEBHOOK_URL = normalizeWebhookUrl(RAW_WEBHOOK_URL);

app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));
app.use(express.static(path.join(__dirname, "public")));

function extractAssistantMessage(webhookPayload) {
  const MAX_DEPTH = 8;
  const priorityKeys = [
    "reply",
    "response",
    "message",
    "output",
    "text",
    "answer",
    "content",
    "result"
  ];

  function findText(node, depth = 0) {
    if (depth > MAX_DEPTH || node == null) {
      return null;
    }

    if (typeof node === "string") {
      const normalized = node.trim();
      return normalized || null;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = findText(item, depth + 1);
        if (found) {
          return found;
        }
      }

      return null;
    }

    if (typeof node === "object") {
      for (const key of priorityKeys) {
        if (key in node) {
          const found = findText(node[key], depth + 1);
          if (found) {
            return found;
          }
        }
      }

      for (const [key, value] of Object.entries(node)) {
        if (priorityKeys.includes(key)) {
          continue;
        }

        const found = findText(value, depth + 1);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  return findText(webhookPayload) || "Mensaje enviado a n8n correctamente.";
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "GACHAPT",
    webhookUrl: WEBHOOK_URL,
    serverTime: new Date().toISOString()
  });
});

app.post("/api/chat", async (req, res) => {
  const { message, sessionId } = req.body ?? {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      ok: false,
      error: "El campo message es obligatorio."
    });
  }

  const safeSessionId =
    typeof sessionId === "string" && sessionId.trim()
      ? sessionId.trim()
      : crypto.randomUUID();

  const payload = {
    app: "GACHAPT",
    channel: "web",
    sessionId: safeSessionId,
    message: message.trim(),
    sentAt: new Date().toISOString()
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timer);

    const contentType = webhookResponse.headers.get("content-type") || "";
    let webhookData;

    if (contentType.includes("application/json")) {
      webhookData = await webhookResponse.json();
    } else {
      webhookData = await webhookResponse.text();
    }

    return res.status(200).json({
      ok: true,
      forwarded: true,
      webhookStatus: webhookResponse.status,
      webhookData,
      assistantMessage: extractAssistantMessage(webhookData),
      sessionId: safeSessionId
    });
  } catch (error) {
    clearTimeout(timer);

    return res.status(502).json({
      ok: false,
      forwarded: false,
      error: "No fue posible reenviar el mensaje al webhook de n8n.",
      details: error instanceof Error ? error.message : "Error desconocido",
      sessionId: safeSessionId
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port);
  });
}

async function findAvailablePort(initialPort, maxAttempts = 20) {
  let candidatePort = initialPort;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (await isPortAvailable(candidatePort)) {
      return candidatePort;
    }

    candidatePort += 1;
  }

  throw new Error(
    `No hay puertos disponibles desde ${initialPort} hasta ${candidatePort - 1}.`
  );
}

async function startServer() {
  try {
    const effectivePort = await findAvailablePort(PORT);

    if (effectivePort !== PORT) {
      console.warn(
        `Puerto ${PORT} ocupado. GACHAPT usara automaticamente el puerto ${effectivePort}.`
      );
    }

    app.listen(effectivePort, () => {
      console.log(`GACHAPT corriendo en http://localhost:${effectivePort}`);
      console.log(`Webhook configurado en ${WEBHOOK_URL}`);

      if (WEBHOOK_URL.includes("/webhook-test/")) {
        console.warn(
          "Estas usando webhook-test en n8n. Ese modo requiere Execute workflow en cada prueba. Para modo siempre activo usa /webhook/ y activa el workflow."
        );
      }
    });
  } catch (error) {
    console.error(
      `No fue posible iniciar GACHAPT: ${
        error instanceof Error ? error.message : "Error desconocido"
      }`
    );
    process.exit(1);
  }
}

startServer();
