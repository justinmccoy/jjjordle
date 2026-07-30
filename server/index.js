require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

// ─── Config (all secret — never sent to the client) ───────────────────────
const ANSWER = (process.env.WORDLE_ANSWER || "CRANE").toUpperCase().trim();
const SENTENCE = process.env.WORDLE_SENTENCE || "Time to play Wordle!";
const EYEBROW = process.env.WORDLE_EYEBROW || "The answer was";
const HIGHLIGHT_ANSWER = process.env.WORDLE_HIGHLIGHT !== "false";
const VALIDATE_GUESSES = process.env.WORDLE_VALIDATE !== "false";
const PORT = parseInt(process.env.PORT || "3001", 10);

if (ANSWER.length !== 5 || !/^[A-Z]{5}$/.test(ANSWER)) {
  console.error("FATAL: WORDLE_ANSWER must be exactly 5 letters. Got:", ANSWER);
  process.exit(1);
}

// ─── Word list (same blob the original HTML used) ─────────────────────────
const WORD_BLOB_PATH = path.join(__dirname, "words.txt");
let DICT = new Set();
if (fs.existsSync(WORD_BLOB_PATH)) {
  const blob = fs.readFileSync(WORD_BLOB_PATH, "utf8").replace(/\s/g, "").toLowerCase();
  for (let i = 0; i < blob.length; i += 5) DICT.add(blob.substr(i, 5));
}
DICT.add(ANSWER.toLowerCase());

// ─── Evaluate (two-pass, handles repeated letters) ────────────────────────
function evaluate(guess, answer) {
  const COLS = 5;
  const result = new Array(COLS).fill("absent");
  const pool = {};
  for (let i = 0; i < COLS; i++) {
    if (guess[i] === answer[i]) result[i] = "correct";
    else pool[answer[i]] = (pool[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < COLS; i++) {
    if (result[i] === "correct") continue;
    if (pool[guess[i]] > 0) { result[i] = "present"; pool[guess[i]]--; }
  }
  return result;
}

// ─── Sentence HTML (highlight answer word) ────────────────────────────────
function sentenceHTML() {
  function escapeHTML(s) {
    return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  if (!HIGHLIGHT_ANSWER) return escapeHTML(SENTENCE);
  const re = new RegExp("\\b(" + ANSWER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")\\b", "gi");
  return escapeHTML(SENTENCE).replace(re, '<span class="hl">$1</span>');
}

// ─── Express ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// In production the React build is served from the same origin, so CORS is
// only needed during local development.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(s => s.trim())
  : ["http://localhost:5173"];

app.use(cors({ origin: allowedOrigins }));

// Rate-limit the guess endpoint to prevent brute-force enumeration.
// 6 rows × some tolerance = 30 requests per 10 minutes per IP.
const guessLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many guesses. Please try again later." }
});

// ─── API ───────────────────────────────────────────────────────────────────

// POST /api/guess
// Body: { guess: "crane" }
// Response: { states: ["correct","absent",...], won: bool }
//           or { error: "..." }
// The answer is NEVER included in any response.
app.post("/api/guess", guessLimiter, (req, res) => {
  const raw = (req.body.guess || "").toUpperCase().trim();

  if (!/^[A-Z]{5}$/.test(raw)) {
    return res.status(400).json({ error: "Guess must be exactly 5 letters." });
  }

  if (VALIDATE_GUESSES && !DICT.has(raw.toLowerCase())) {
    return res.status(422).json({ error: "Not in word list." });
  }

  const states = evaluate(raw, ANSWER);
  const won = states.every(s => s === "correct");
  return res.json({ states, won });
});

// GET /api/reveal
// Called only after the game ends (won or lost).
// Returns the sentence and eyebrow — still no raw ANSWER string.
app.get("/api/reveal", (req, res) => {
  res.json({
    eyebrow: EYEBROW.replace("{word}", ""),  // don't embed the word
    sentenceHTML: sentenceHTML(),
    cols: 5,
    rows: 6
  });
});

// GET /api/config
// Returns non-secret UI config (row/col counts, validate flag).
app.get("/api/config", (req, res) => {
  res.json({ rows: 6, cols: 5, validateGuesses: VALIDATE_GUESSES });
});

// ─── Serve React build in production ──────────────────────────────────────
const CLIENT_BUILD = path.join(__dirname, "../client/dist");
if (fs.existsSync(CLIENT_BUILD)) {
  app.use(express.static(CLIENT_BUILD));
  app.get("*", (_req, res) => res.sendFile(path.join(CLIENT_BUILD, "index.html")));
}

app.listen(PORT, () => {
  console.log(`Wordle server listening on :${PORT}`);
  console.log(`  Answer length: ${ANSWER.length} ✓ (answer kept server-side)`);
});
