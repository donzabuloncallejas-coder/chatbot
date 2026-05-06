const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("message-input");
const sendButtonEl = document.getElementById("send-button");
const typingEl = document.getElementById("typing");
const chipsEl = document.getElementById("chips");
const statusTextEl = document.getElementById("status-text");
const statusDotEl = document.getElementById("status-dot");

const SESSION_KEY = "gachapt-session-id";

function makeSessionId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `s-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

let sessionId = localStorage.getItem(SESSION_KEY);
if (!sessionId) {
  sessionId = makeSessionId();
  localStorage.setItem(SESSION_KEY, sessionId);
}

function nowLabel() {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

function setWebhookStatus(online, text) {
  statusTextEl.textContent = text;
  statusDotEl.classList.toggle("online", online);
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    setWebhookStatus(true, "Conectado y listo para reenviar mensajes");
  } catch (error) {
    setWebhookStatus(false, "Sin conexion. Revisa si el backend esta activo");
  }
}

function addMessage(role, text, meta) {
  const bubble = document.createElement("article");
  bubble.className = `message ${role}`;

  const body = document.createElement("p");
  body.textContent = text;
  body.style.margin = "0";

  const footer = document.createElement("span");
  footer.className = "message-meta";
  footer.textContent = meta || nowLabel();

  bubble.appendChild(body);
  bubble.appendChild(footer);
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setTyping(show) {
  typingEl.classList.toggle("hidden", !show);
}

async function sendMessage() {
  const message = inputEl.value.trim();
  if (!message) {
    return;
  }

  addMessage("user", message);
  inputEl.value = "";
  inputEl.style.height = "auto";
  setTyping(true);
  sendButtonEl.disabled = true;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        sessionId
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      const reason = data.error || "No se pudo enviar al webhook";
      throw new Error(reason);
    }

    const assistantText =
      data.assistantMessage ||
      "Mensaje recibido y reenviado a n8n correctamente.";

    addMessage("assistant", assistantText, `n8n HTTP ${data.webhookStatus}`);
    setWebhookStatus(true, "Mensaje reenviado al webhook de n8n");
  } catch (error) {
    addMessage(
      "assistant",
      `No pude conectar con n8n: ${error.message}`,
      "Error"
    );
    setWebhookStatus(false, "Error de conexion con webhook");
  } finally {
    setTyping(false);
    sendButtonEl.disabled = false;
    inputEl.focus();
  }
}

formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage();
});

inputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 220)}px`;
});

chipsEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-prompt]");
  if (!button) {
    return;
  }

  inputEl.value = button.dataset.prompt || "";
  inputEl.dispatchEvent(new Event("input"));
  inputEl.focus();
});

window.addEventListener("load", () => {
  addMessage(
    "assistant",
    "Hola. Soy GACHAPT. Todo lo que escribas aqui se envia al backend y luego al webhook de n8n.",
    "Sistema"
  );
  checkHealth();
});
