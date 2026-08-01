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

// ─── Completion Screen ───────────────────────────────────────────────────────
const LOGO_PATTERN = ["w", "w", "w", "w", "y", "g", "g", "g", "w"];

function CompletionScreen({ show, sentenceHTML, won, onAdmire, onSeeResults }) {
  if (!show) return null;

  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div id="completion-screen" role="dialog" aria-labelledby="completion-title">
      <button className="comp-back" aria-label="Back to puzzle" onClick={onAdmire}>
        <svg viewBox="0 0 24 24">
          <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
      </button>

      <div className="comp-logo" aria-hidden="true">
        {LOGO_PATTERN.map((c, i) => <span key={i} className={c} />)}
      </div>
      <div className="comp-brand">JJJordle</div>

      <div className="comp-body">
        <h1 className="comp-title" id="completion-title">Hi JJJordler</h1>

        {sentenceHTML && (
          <p className="reveal-sentence" dangerouslySetInnerHTML={{ __html: sentenceHTML }} />
        )}
        {won && <img src="/jj.png" alt="JJ" className="win-photo" />}

        <button className="comp-admire" onClick={onAdmire}>Admire Puzzle</button>
        <button className="comp-results" onClick={onSeeResults}>See Results</button>

        <p className="comp-date">{dateStr}</p>
      </div>
    </div>
  );
}

// ─── Results modal ───────────────────────────────────────────────────────────
function resultsShareText(rows, won) {
  const SQUARES = { correct: "🟩", present: "🟨", absent: "⬛" };
  const score = won ? String(rows.length) : "X";
  const gridText = rows
    .map(states => states.map(s => SQUARES[s] || "⬛").join(""))
    .join("\n");
  return `JJJORDLE ${score}/${ROWS}\n\n${gridText}`;
}

function ResultsModal({ show, rows, won, onClose, onCopied }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (show && closeRef.current) closeRef.current.focus();
  }, [show]);

  if (!show) return null;

  const score = won ? String(rows.length) : "X";

  const copyResults = () => {
    const text = resultsShareText(rows, won);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => onCopied(true), () => onCopied(false));
    } else {
      onCopied(false);
    }
  };

  return (
    <div
      id="results-overlay"
      className="show"
      role="dialog"
      aria-modal="true"
      aria-labelledby="results-title"
      onClick={e => { if (e.target.id === "results-overlay") onClose(); }}
    >
      <div className="reveal-card">
        <button className="close-x" aria-label="Close" ref={closeRef} onClick={onClose}>
          <svg viewBox="0 0 24 24">
            <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
        <p className="reveal-eyebrow" id="results-title">Results</p>
        <p className="results-score">{won ? `Solved in ${score}/${ROWS}` : `${score}/${ROWS} — so close!`}</p>
        <div className="results-grid" aria-hidden="true">
          {rows.map((states, ri) => (
            <div key={ri} className="results-row">
              {states.map((s, ci) => <span key={ci} data-state={s} />)}
            </div>
          ))}
        </div>
        <button className="comp-admire results-copy" onClick={copyResults}>Copy Results</button>
      </div>
    </div>
  );
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
const LS_PREFIX = "jjjordle_";

function saveState(sessionKey, data) {
  try { localStorage.setItem(LS_PREFIX + sessionKey, JSON.stringify(data)); } catch (_) {}
}

function loadState(sessionKey) {
  try { return JSON.parse(localStorage.getItem(LS_PREFIX + sessionKey)); } catch (_) { return null; }
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
  const [completionOpen, setCompletionOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [finished, setFinished]     = useState(false); // overlay has been closed at least once
  const [reveal, setReveal]         = useState({ eyebrow: "", sentenceHTML: "" });
  const [gameWon, setGameWon]       = useState(false);
  const [sessionKey, setSessionKey] = useState(null);

  // stable refs to avoid stale closures in keydown handler
  const stateRef = useRef({});
  stateRef.current = { current, rowIndex, locked, over };

  // stable ref so persist() always sees the latest sessionKey
  const sessionKeyRef = useRef(null);
  useEffect(() => { sessionKeyRef.current = sessionKey; }, [sessionKey]);

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

  // ── Persist current game state ─────────────────────────────────────────────
  const persist = useCallback((overrideGrid, overrideRowIndex, overrideKeyStates, overrideOver, overrideWon, overrideCompletion) => {
    const key = sessionKeyRef.current;
    if (!key) return;
    saveState(key, {
      grid: overrideGrid,
      rowIndex: overrideRowIndex,
      keyStates: overrideKeyStates,
      over: overrideOver,
      won: overrideWon,
      completion: overrideCompletion,
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

  // ── Fetch session key on mount; then restore any saved state ───────────────
  useEffect(() => {
    fetch("/api/session-key")
      .then(r => r.json())
      .then(data => setSessionKey(data.key))
      .catch(() => setSessionKey("default"));
  }, []);

  useEffect(() => {
    if (!sessionKey) return;
    const saved = loadState(sessionKey);
    if (!saved) return;

    setGrid(saved.grid);
    setRowIndex(saved.rowIndex);
    setKeyStates(saved.keyStates || {});
    setOver(saved.over || false);
    setGameWon(saved.won || false);
    // "sentencePanel" is the legacy key from saves made before the completion screen
    const wasCompleted = saved.completion || saved.sentencePanel || false;
    setFinished(wasCompleted);
    setCompletionOpen(wasCompleted);

    if (saved.over) {
      // If the game ended but the reveal was never acknowledged (e.g. the tab
      // closed before dismissing it), reopen the overlay so the flow resumes.
      fetchReveal().then(() => {
        if (!wasCompleted) setOverlay(true);
      });
    }
  }, [sessionKey, fetchReveal]);

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
      // Build the updated key states so we can persist them in one call
      const rank = { absent: 0, present: 1, correct: 2 };
      const nextKeyStates = ks => {
        const next = { ...ks };
        for (let i = 0; i < COLS; i++) {
          const k = letters[i];
          if (!k) continue;
          if (rank[states[i]] > (rank[next[k]] ?? -1)) next[k] = states[i];
        }
        return next;
      };

      paintKeyboard(letters, states);
      setLocked(false);

      // Snapshot of grid with this row's final states for localStorage.
      // Built directly from letters/states so we don't race with React state.
      const snapshotRow = Array.from({ length: COLS }, (_, i) => ({
        letter: letters[i], state: states[i], anim: null
      }));

      if (won) {
        showToast(WIN_MESSAGES[ri]);
        setKeyStates(prev => {
          const updated = nextKeyStates(prev);
          setGrid(prevGrid => {
            const newGrid = prevGrid.map(r => r.map(c => ({ ...c })));
            newGrid[ri] = snapshotRow;
            persist(newGrid, ri + 1, updated, true, true, false);
            return prevGrid;
          });
          return updated;
        });
        endGame(true, total + 1200, ri, letters, states);
      } else if (ri === ROWS - 1) {
        showToast("Better luck next time!", 4000);
        setKeyStates(prev => {
          const updated = nextKeyStates(prev);
          setGrid(prevGrid => {
            const newGrid = prevGrid.map(r => r.map(c => ({ ...c })));
            newGrid[ri] = snapshotRow;
            persist(newGrid, ri + 1, updated, true, false, false);
            return prevGrid;
          });
          return updated;
        });
        endGame(false, 900, ri, letters, states);
      } else {
        const nextRI = ri + 1;
        setKeyStates(prev => {
          const updated = nextKeyStates(prev);
          setGrid(prevGrid => {
            const newGrid = prevGrid.map(r => r.map(c => ({ ...c })));
            newGrid[ri] = snapshotRow;
            persist(newGrid, nextRI, updated, false, false, false);
            return prevGrid;
          });
          return updated;
        });
        setRowIndex(nextRI);
        setCurrent("");
      }
    }, total);
  }, [paintKeyboard, showToast, endGame, persist]);

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
      if (e.key !== "Escape") return;
      if (resultsOpen) setResultsOpen(false);
      else if (overlayOpen) closeReveal();
      else if (completionOpen) admirePuzzle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [overlayOpen, completionOpen, resultsOpen]);

  const closeReveal = () => {
    setOverlay(false);
    setFinished(true);
    setCompletionOpen(true);
    // Persist that the puzzle has been completed and acknowledged
    const key = sessionKeyRef.current;
    if (key) {
      const saved = loadState(key);
      if (saved) saveState(key, { ...saved, completion: true });
    }
  };

  const admirePuzzle = () => setCompletionOpen(false);

  const onResultsCopied = ok => {
    showToast(ok ? "Copied results to clipboard" : "Couldn't copy — try again", 1500);
  };

  // Committed guess rows (letter states only), for the results modal.
  // Derived from resolved tile states rather than rowIndex, because rowIndex
  // does not advance past the game-ending row in-session.
  const resultRows = grid
    .filter(row => row.every(c => c.state === "correct" || c.state === "present" || c.state === "absent"))
    .map(row => row.map(c => c.state));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div id="game">
      <header>
        <div className="title">JJJORDLE</div>
        {over && finished && (
          <button
            className="board-close-x"
            aria-label="Back to completion screen"
            onClick={() => setCompletionOpen(true)}
          >
            <svg viewBox="0 0 24 24">
              <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        )}
      </header>

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

      {over && finished ? (
        <div id="postgame-actions">
          <button className="postgame-btn" onClick={() => setResultsOpen(true)}>See results</button>
        </div>
      ) : (
        <Keyboard keyStates={keyStates} onKey={handleKey} />
      )}

      <Toast messages={toasts} />

      <Overlay
        show={overlayOpen}
        eyebrow={reveal.eyebrow}
        sentenceHTML={reveal.sentenceHTML}
        won={gameWon}
        onClose={closeReveal}
      />

      <CompletionScreen
        show={completionOpen}
        sentenceHTML={reveal.sentenceHTML}
        won={gameWon}
        onAdmire={admirePuzzle}
        onSeeResults={() => setResultsOpen(true)}
      />

      <ResultsModal
        show={resultsOpen}
        rows={resultRows}
        won={gameWon}
        onClose={() => setResultsOpen(false)}
        onCopied={onResultsCopied}
      />
    </div>
  );
}
