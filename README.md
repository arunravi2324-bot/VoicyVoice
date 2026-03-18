# VoicyVoice

AI-powered voice customer support agent for Wise, built with Twilio, OpenAI Realtime API, and Convex.

## How It Works

Phone calls come in via Twilio, audio is streamed over WebSocket to OpenAI's GPT-4o Realtime API for live conversation. The bot answers FAQs about Wise transfers and can transfer to a human agent when needed. A React dashboard provides real-time call monitoring and analytics.

## Tech Stack

- **Runtime:** Bun
- **Server:** Hono
- **AI:** OpenAI GPT-4o Realtime API
- **Voice:** Twilio
- **Database:** Convex
- **Dashboard:** React + Vite + Tailwind CSS
- **Observability:** OpenTelemetry + Arize Phoenix

## Setup

### Prerequisites

- [Bun](https://bun.sh) installed
- Twilio account with a phone number
- OpenAI API key
- Convex account

### Environment Variables

Copy `.env.example` and fill in values:

```sh
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number (E.164) |
| `HUMAN_AGENT_PHONE` | Phone number to transfer calls to |
| `CONVEX_URL` | Convex deployment URL |
| `PHOENIX_COLLECTOR_ENDPOINT` | Phoenix tracing endpoint |
| `PHOENIX_API_KEY` | Phoenix API key |
| `PUBLIC_URL` | Public URL of the server (for Twilio webhooks) |
| `PORT` | Server port (default: 5050) |
| `DASHBOARD_USER` | Dashboard login username |
| `DASHBOARD_PASS` | Dashboard login password |

### Install & Run

```sh
bun install
cd dashboard && bun install && cd ..
```

Run all three in separate terminals:

```sh
bun run dev           # server on port 5050
bun run dev:dashboard # dashboard on port 5173
bun run dev:convex    # convex dev server
```

### Twilio Configuration

Point your Twilio phone number webhooks to:
- **Incoming call:** `https://<your-domain>/incoming-call` (POST)
- **Status callback:** `https://<your-domain>/call-status` (POST)

## Project Structure

```
src/
  index.ts              # Entry point
  server.ts             # HTTP & WebSocket routes
  system-prompt.ts      # AI personality & FAQ knowledge
  services/
    call-manager.ts     # In-memory call state
    openai-relay.ts     # Twilio <-> OpenAI audio bridge
    transcript.ts       # Transcript persistence
    transfer.ts         # Transfer to human agent
convex/
  schema.ts             # Database schema
  calls.ts              # Call mutations & queries
  transcripts.ts        # Transcript mutations & queries
  analytics.ts          # Dashboard analytics queries
dashboard/
  src/
    pages/
      LiveCalls.tsx     # Active calls & history
      Analytics.tsx     # Metrics & charts
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | None | Health check |
| `POST` | `/incoming-call` | Twilio | Incoming call webhook |
| `POST` | `/call-status` | Twilio | Call lifecycle webhook |
| `POST` | `/whisper` | Twilio | Transfer summary for human agent |
| `POST` | `/transfer-fallback` | Twilio | Handles failed transfers |
| `GET` | `/media-stream` | None | WebSocket audio relay |
| `GET` | `/api/calls/active` | Basic | List active calls |
| `POST` | `/trigger-call` | Basic | Trigger outbound call |
| `GET` | `/dashboard/*` | None | React dashboard |

## Deployment

The project includes a Dockerfile for deployment. Railway is used for hosting.

```sh
docker build --build-arg VITE_CONVEX_URL=<your-convex-url> -t voicyvoice .
docker run -p 5050:5050 --env-file .env voicyvoice
```

For local tracing with Phoenix:

```sh
docker compose up -d
```
