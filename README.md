# GACHAPT

Chatbot web estilo asistente grande, conectado a un webhook de n8n.

## Que hace

- Frontend tipo chat grande (GACHAPT).
- Backend en Node.js con Express.
- Cada mensaje enviado en la interfaz se reenvia al webhook de n8n.
- Si n8n responde texto o JSON con `reply`, `response`, `message`, `text` u `output`, se muestra en el chat.

## Requisitos

- Node.js 18 o superior

## Instalacion

```bash
npm install
```

## Configuracion

1. Copia `.env.example` a `.env`.
2. Usa la URL de produccion del Webhook en n8n (no `webhook-test`):

```env
N8N_WEBHOOK_URL=http://localhost:5678/webhook/whatsapp-in
```

3. Activa el workflow en n8n con el toggle `Active` (o `Publish` en versiones nuevas).

Notas importantes:

- `webhook-test` requiere `Execute workflow` para cada prueba.
- `webhook` de produccion responde siempre mientras n8n este encendido y el workflow este activo.

## Ejecutar

```bash
npm run dev
```

Para modo normal:

```bash
npm start
```

Abre en el navegador:

- http://localhost:3000

## Flujo de mensajes

1. Usuario escribe en GACHAPT.
2. Frontend envia `POST /api/chat` al backend.
3. Backend reenvia el mensaje al webhook de n8n.
4. El resultado se muestra en el chat.

## Estructura

- `server.js`: backend y relay al webhook.
- `public/index.html`: interfaz principal.
- `public/styles.css`: diseno y responsive.
- `public/app.js`: logica del chat en navegador.
