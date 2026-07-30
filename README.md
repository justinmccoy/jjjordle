# jjjordle

A custom Wordle game built with React + Node.js/Express, deployable on a small AWS instance.

The **answer is kept server-side** in an environment variable — it is never included in the JavaScript bundle or any API response, so players can't cheat by reading browser source.

## How it works

```
Browser (React)  ──POST /api/guess──►  Express server
                 ◄── { states: [...] } ─  (colours only, never the answer)
```

- `POST /api/guess` — returns tile colours (`correct` / `present` / `absent`), never the word  
- `GET /api/reveal` — returns the flavour sentence after the game ends  
- A rate-limiter (30 req / 10 min / IP) blocks brute-force enumeration

## Project layout

```
jjjordle/
├── server/           Express API  (answer lives here only)
│   ├── index.js
│   ├── words.txt     ~14 000 valid 5-letter words
│   └── .env.example  ← copy to .env and fill in your answer
├── client/           React + Vite front-end
│   └── src/
│       ├── App.jsx
│       └── index.css
├── nginx.conf        Reverse-proxy config for the EC2 instance
├── ecosystem.config.json  PM2 process config
└── deploy.sh         One-time setup script for Amazon Linux / Ubuntu
```

## Quick start (local dev)

```bash
# 1. Install dependencies
npm run install:all

# 2. Create server config
cp server/.env.example server/.env
#    → edit WORDLE_ANSWER, WORDLE_SENTENCE, etc.

# 3. Run both processes (two terminals)
npm run dev:server   # http://localhost:3001
npm run dev:client   # http://localhost:5173  (proxied to server)
```

## Deploying to AWS EC2

```bash
# Build the React app
npm run build

# Copy project to your instance
rsync -av ./ ec2-user@<YOUR_IP>:/srv/wordle/

# On the instance — one-time setup
sudo ./deploy.sh
# then follow the printed instructions to:
#   • copy nginx.conf, enable nginx
#   • start the Node server with PM2
```

See [`deploy.sh`](deploy.sh) and [`nginx.conf`](nginx.conf) for full details.

## Configuration (server/.env)

| Variable | Default | Description |
|---|---|---|
| `WORDLE_ANSWER` | `CRANE` | The 5-letter answer (never sent to browser) |
| `WORDLE_SENTENCE` | `Time to play Wordle!` | Sentence shown at game end |
| `WORDLE_EYEBROW` | `The answer was` | Label above the sentence |
| `WORDLE_HIGHLIGHT` | `true` | Highlight the answer word in the sentence |
| `WORDLE_VALIDATE` | `true` | Reject guesses not in the word list |
| `PORT` | `3001` | Port the Node server listens on |

## Tech stack

- **Frontend** — React 18, Vite 5  
- **Backend** — Node.js, Express 4, express-rate-limit  
- **Deployment** — nginx (reverse proxy) + PM2 (process manager)
