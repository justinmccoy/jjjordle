import React, { useState, useEffect, useCallback, useRef } from "react";

const ROWS = 6;
const COLS = 5;
const BACKSPACE_SVG = (
  <svg viewBox="0 0 24 24">
    <path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z" />
  </svg>
);
const WIN_MESSAGES = ["Genius", "Magnificent", "Impressive", "Splendid", "Great", "Phew"];
const KEYBOARD_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

// ─── Tile ────────────────────────────────────────────────────────────────────
function Tile({ letter, state, animClass }) {
  return (
    <div
      className={`tile${animClass ? " " + animClass : ""}`}
      data-state={state || "empty"}
    >
      {letter}
    </div>
  );
}

// ─── Board Row ───────────────────────────────────────────────────────────────
function BoardRow({ letters, states, animClass }) {
  return (
    <div className={`row${animClass ? " " + animClass : ""}`}>
      {Array.from({ length: COLS }, (_, i) => (
        <Tile
          key={i}
          letter={letters[i] || ""}
          state={states[i] || "empty"}
          animClass={undefined}
        />
      ))}
    </div>
  );
}

// ─── Keyboard ────────────────────────────────────────────────────────────────
function Keyboard({ keyStates, onKey }) {
  return (
    <div id="keyboard-container">
      {KEYBOARD_ROWS.map((row, ri) => (
        <div className="keyboard-row" key={ri}>
          {ri === 2 && (
            <button className="wide" onClick={() => onKey("ENTER")}>Enter</button>
          )}
          {ri === 1 && <div className="spacer" />}
          {row.split("").map(k => (
            <button
              key={k}
              data-state={keyStates[k] || ""}
              onClick={() => onKey(k)}
            >
              {k}
            </button>
          ))}
          {ri === 1 && <div className="spacer" />}
          {ri === 2 && (
            <button className="wide" aria-label="Backspace" onClick={() => onKey("BACKSPACE")}>
              {BACKSPACE_SVG}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function Toast({ messages }) {
  return (
    <div id="toaster" aria-live="polite">
      {messages.map(m => (
        <div key={m.id} className={`toast${m.fading ? " fade" : ""}`}>{m.text}</div>
      ))}
    </div>
  );
}

// ─── Overlay ─────────────────────────────────────────────────────────────────
function Overlay({ show, eyebrow, sentenceHTML, won, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (show && closeRef.current) closeRef.current.focus();
  }, [show]);

  return (
    <div
      id="overlay"
      className={show ? "show" : ""}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reveal-text"
      onClick={e => { if (e.target.id === "overlay") onClose(); }}
    >
      <div className="reveal-card">
        <button className="close-x" aria-label="Close" ref={closeRef} onClick={onClose}>
          <svg viewBox="0 0 24 24">
            <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
        <p className="reveal-eyebrow">{eyebrow}</p>
        <p
          className="reveal-sentence"
          id="reveal-text"
          dangerouslySetInnerHTML={{ __html: sentenceHTML }}
        />
        {won && <img src="/jj.png" alt="JJ" className="win-photo" />}
      </div>
    </div>
  );
}

// ─── Sentence Panel ──────────────────────────────────────────────────────────
function SentencePanel({ show, eyebrow, sentenceHTML, won }) {
  return (
    <div id="sentence-panel" className={show ? "show" : ""}>
      <p className="reveal-eyebrow">{eyebrow}</p>
      <p className="reveal-sentence" dangerouslySetInnerHTML={{ __html: sentenceHTML }} />
      {won && <img src="/jj.png" alt="JJ" className="win-photo" />}
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  // rows × cols state: { letter, state }
  const [grid, setGrid] = useState(
    () => Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ({ letter: "", state: "empty" })))
  );
  const [rowAnims, setRowAnims]     = useState(Array(ROWS).fill(null));
  const [current, setCurrent]       = useState("");       // letters typed this row
  const [rowIndex, setRowIndex]     = useState(0);
  const [locked, setLocked]         = useState(false);    // animating
  const [over, setOver]             = useState(false);
  const [keyStates, setKeyStates]   = useState({});
  const [toasts, setToasts]         = useState([]);
  const [overlayOpen, setOverlay]   = useState(false);
  const [sentencePanel, setSentencePanel] = useState(false);
  const [reveal, setReveal]         = useState({ eyebrow: "", sentenceHTML: "" });
  const [gameWon, setGameWon]       = useState(false);

  // stable refs to avoid stale closures in keydown handler
  const stateRef = useRef({});
  stateRef.current = { current, rowIndex, locked, over };

  // ── Toast helper ───────────────────────────────────────────────────────────
  const showToast = useCallback((text, duration = 1000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [{ id, text, fading: false }, ...prev]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, fading: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350);
    }, duration);
  }, []);

  // ── Shake row ──────────────────────────────────────────────────────────────
  const shakeRow = useCallback((ri, msg) => {
    showToast(msg);
    setRowAnims(prev => {
      const next = [...prev];
      next[ri] = "shake";
      return next;
    });
    setTimeout(() => {
      setRowAnims(prev => {
        const next = [...prev];
        next[ri] = null;
        return next;
      });
    }, 650);
  }, [showToast]);

  // ── Paint keyboard ─────────────────────────────────────────────────────────
  const paintKeyboard = useCallback((letters, states) => {
    const rank = { absent: 0, present: 1, correct: 2 };
    setKeyStates(prev => {
      const next = { ...prev };
      for (let i = 0; i < COLS; i++) {
        const k = letters[i];
        if (!k) continue;
        if (rank[states[i]] > (rank[next[k]] ?? -1)) next[k] = states[i];
      }
      return next;
    });
  }, []);

  // ── Fetch reveal content (after game ends) ─────────────────────────────────
  const fetchReveal = useCallback(async () => {
    try {
      const r = await fetch("/api/reveal");
      const data = await r.json();
      setReveal({ eyebrow: data.eyebrow, sentenceHTML: data.sentenceHTML });
    } catch (_) {
      setReveal({ eyebrow: "", sentenceHTML: "" });
    }
  }, []);

  // ── End game ───────────────────────────────────────────────────────────────
  const endGame = useCallback((won, delay, ri, rowLetters, rowStates) => {
    setOver(true);
    if (won) setGameWon(true);
    fetchReveal().then(() => {
      setTimeout(() => setOverlay(true), delay);
    });
    if (won) {
      // Bounce tiles
      for (let i = 0; i < COLS; i++) {
        setTimeout(() => {
          setGrid(prev => {
            const next = prev.map(r => r.map(c => ({ ...c })));
            next[ri][i] = { ...next[ri][i], bounce: true };
            return next;
          });
          setTimeout(() => {
            setGrid(prev => {
              const next = prev.map(r => r.map(c => ({ ...c })));
              next[ri][i] = { ...next[ri][i], bounce: false };
              return next;
            });
          }, 1050);
        }, i * 100);
      }
    }
  }, [fetchReveal]);

  // ── Reveal animation ───────────────────────────────────────────────────────
  const revealRow = useCallback((ri, letters, states, won) => {
    const DELAY = 300;
    const FLIP  = 250;

    for (let i = 0; i < COLS; i++) {
      setTimeout(() => {
        // flip-in
        setGrid(prev => {
          const next = prev.map(r => r.map(c => ({ ...c })));
          next[ri][i] = { letter: letters[i], state: "empty", anim: "flip-in" };
          return next;
        });
        setTimeout(() => {
          // flip-out — apply state
          setGrid(prev => {
            const next = prev.map(r => r.map(c => ({ ...c })));
            next[ri][i] = { letter: letters[i], state: states[i], anim: "flip-out" };
            return next;
          });
          setTimeout(() => {
            setGrid(prev => {
              const next = prev.map(r => r.map(c => ({ ...c })));
              next[ri][i] = { letter: letters[i], state: states[i], anim: null };
              return next;
            });
          }, FLIP);
        }, FLIP);
      }, i * DELAY);
    }

    const total = (COLS - 1) * DELAY + FLIP * 2;

    setTimeout(() => {
      paintKeyboard(letters, states);
      setLocked(false);

      if (won) {
        showToast(WIN_MESSAGES[ri]);
        endGame(true, total + 1200, ri, letters, states);
      } else if (ri === ROWS - 1) {
        // Show error toast — we don't reveal the answer in the toast,
        // it will be shown in the overlay via /api/reveal instead.
        showToast("Better luck next time!", 4000);
        endGame(false, 900, ri, letters, states);
      } else {
        setRowIndex(ri + 1);
        setCurrent("");
      }
    }, total);
  }, [paintKeyboard, showToast, endGame]);

  // ── Submit guess ───────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    const { current: cur, rowIndex: ri } = stateRef.current;
    if (cur.length < COLS) { shakeRow(ri, "Not enough letters"); return; }

    setLocked(true);

    let data;
    try {
      const resp = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guess: cur })
      });
      data = await resp.json();
    } catch (_) {
      setLocked(false);
      shakeRow(ri, "Network error");
      return;
    }

    if (data.error) {
      setLocked(false);
      // 422 = not in word list; 400 = bad input
      shakeRow(ri, data.error);
      return;
    }

    revealRow(ri, cur.split(""), data.states, data.won);
  }, [shakeRow, revealRow]);

  // ── Key handler ────────────────────────────────────────────────────────────
  const handleKey = useCallback((key) => {
    const { over: isOver, locked: isLocked, current: cur, rowIndex: ri } = stateRef.current;
    if (isOver || isLocked) return;

    if (key === "ENTER") { submit(); return; }

    if (key === "BACKSPACE") {
      if (!cur.length) return;
      const next = cur.slice(0, -1);
      setCurrent(next);
      setGrid(prev => {
        const g = prev.map(r => r.map(c => ({ ...c })));
        g[ri][next.length] = { letter: "", state: "empty", anim: null };
        return g;
      });
      return;
    }

    if (!/^[A-Z]$/.test(key) || cur.length >= COLS) return;

    const next = cur + key;
    setCurrent(next);
    setGrid(prev => {
      const g = prev.map(r => r.map(c => ({ ...c })));
      g[ri][cur.length] = { letter: key, state: "tbd", anim: "pop" };
      return g;
    });
  }, [submit]);

  // ── Physical keyboard ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Enter")     handleKey("ENTER");
      else if (e.key === "Backspace") handleKey("BACKSPACE");
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKey]);

  // ── Escape key closes overlay ──────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = e => {
      if (e.key === "Escape" && overlayOpen) closeReveal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [overlayOpen]);

  const closeReveal = () => {
    setOverlay(false);
    setSentencePanel(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div id="game">
      <header><div className="title">JJJORDLE</div></header>

      <div id="board-container">
        <div id="board" role="group" aria-label="Guess grid">
          {grid.map((row, ri) => {
            // Collect letters and states for this row
            const letters = row.map(c => c.letter);
            const states  = row.map(c => c.state);
            return (
              <div
                key={ri}
                className={`row${rowAnims[ri] ? " " + rowAnims[ri] : ""}`}
              >
                {row.map((cell, ci) => (
                  <div
                    key={ci}
                    className={`tile${cell.anim ? " " + cell.anim : ""}`}
                    data-state={cell.state || "empty"}
                  >
                    {cell.letter}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <Keyboard keyStates={keyStates} onKey={handleKey} />

      <SentencePanel
        show={sentencePanel}
        eyebrow={reveal.eyebrow}
        sentenceHTML={reveal.sentenceHTML}
        won={gameWon}
      />

      <Toast messages={toasts} />

      <Overlay
        show={overlayOpen}
        eyebrow={reveal.eyebrow}
        sentenceHTML={reveal.sentenceHTML}
        won={gameWon}
        onClose={closeReveal}
      />
    </div>
  );
}
