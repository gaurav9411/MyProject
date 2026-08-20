(function () {
  const GLYPHS = {
    wK: "\u2654", wQ: "\u2655", wR: "\u2656", wB: "\u2657", wN: "\u2658", wP: "\u2659",
    bK: "\u265A", bQ: "\u265B", bR: "\u265C", bB: "\u265D", bN: "\u265E", bP: "\u265F",
  };
  const PROMO_ORDER = ["Q", "R", "B", "N"];

  const boardFrame = document.getElementById("boardFrame");
  const turnSwatch = document.getElementById("turnSwatch");
  const turnLabel = document.getElementById("turnLabel");
  const statusLine = document.getElementById("statusLine");
  const capturedWhiteEl = document.getElementById("capturedWhite");
  const capturedBlackEl = document.getElementById("capturedBlack");
  const movesListEl = document.getElementById("movesList");
  const newGameBtn = document.getElementById("newGameBtn");
  const undoBtn = document.getElementById("undoBtn");
  const flipBtn = document.getElementById("flipBtn");
  const promoOverlay = document.getElementById("promoOverlay");
  const promoChoices = document.getElementById("promoChoices");
  const offlinePill = document.getElementById("offlinePill");
  const offlineText = document.getElementById("offlineText");

  let appliedMoves = [];
  let state, moveNotations, capturedByWhite, capturedByBlack, status;
  let selected = null;
  let legalMoves = [];
  let flipped = false;

  function rebuildFromMoves() {
    state = ChessEngine.initialState();
    moveNotations = [];
    capturedByWhite = [];
    capturedByBlack = [];
    for (const mv of appliedMoves) {
      const notation = ChessEngine.algebraic(mv, state.board);
      const color = state.turn;
      state = ChessEngine.applyMove(state, mv);
      const s = ChessEngine.gameStatus(state);
      const suffix = s.checkmate ? "#" : s.check ? "+" : "";
      moveNotations.push({ notation: notation + suffix, color });
      const captured = state.lastMove.captured;
      if (captured) {
        if (captured[0] === "w") capturedByBlack.push(captured);
        else capturedByWhite.push(captured);
      }
    }
    status = ChessEngine.gameStatus(state);
  }

  function selectSquare(r, c) {
    selected = { r, c };
    legalMoves = ChessEngine.legalMovesFor(state, r, c);
  }

  function clearSelection() {
    selected = null;
    legalMoves = [];
  }

  function commitMove(move) {
    appliedMoves.push(move);
    rebuildFromMoves();
    clearSelection();
    render();
  }

  function onSquareClick(r, c) {
    if (!promoOverlay.hidden) return;
    if (status.over) return;
    const piece = state.board[r][c];

    if (selected) {
      const targets = legalMoves.filter(m => m.to.r === r && m.to.c === c);
      if (targets.length > 1) {
        openPromotionPicker(targets, commitMove);
        return;
      }
      if (targets.length === 1) {
        commitMove(targets[0]);
        return;
      }
      if (piece && piece[0] === state.turn) {
        selectSquare(r, c);
        render();
        return;
      }
      clearSelection();
      render();
      return;
    }

    if (piece && piece[0] === state.turn) {
      selectSquare(r, c);
      render();
    }
  }

  function openPromotionPicker(movesForSquare, onChoose) {
    promoChoices.innerHTML = "";
    const color = state.turn;
    for (const type of PROMO_ORDER) {
      const move = movesForSquare.find(m => m.promotion === type);
      const btn = document.createElement("button");
      btn.textContent = GLYPHS[color + type];
      btn.setAttribute("aria-label", "Promote to " + type);
      btn.addEventListener("click", () => {
        promoOverlay.hidden = true;
        onChoose(move);
      });
      promoChoices.appendChild(btn);
    }
    promoOverlay.hidden = false;
  }

  function squareClass(r, c) {
    const isLight = (r + c) % 2 === 0;
    return isLight ? "light" : "dark";
  }

  function render() {
    boardFrame.innerHTML = "";

    const rowOrder = flipped ? [...Array(8).keys()].reverse() : [...Array(8).keys()];
    const colOrder = flipped ? [...Array(8).keys()].reverse() : [...Array(8).keys()];

    const boardEl = document.createElement("div");
    boardEl.id = "board";

    const kingInCheck = status.check ? ChessEngine.findKing(state.board, state.turn) : null;
    const legalTargets = new Set(legalMoves.map(m => m.to.r + "," + m.to.c));

    for (const r of rowOrder) {
      for (const c of colOrder) {
        const sq = document.createElement("div");
        sq.className = "square " + squareClass(r, c);
        sq.setAttribute("role", "button");
        sq.setAttribute("aria-label", ChessEngine.sqName(r, c));

        if (state.lastMove) {
          const { from, to } = state.lastMove;
          if ((from.r === r && from.c === c) || (to.r === r && to.c === c)) {
            sq.classList.add("last-move");
          }
        }
        if (selected && selected.r === r && selected.c === c) sq.classList.add("selected");
        if (kingInCheck && kingInCheck.r === r && kingInCheck.c === c) sq.classList.add("in-check");

        const piece = state.board[r][c];
        if (piece) {
          const span = document.createElement("span");
          span.className = "piece " + (piece[0] === "w" ? "white" : "black");
          span.textContent = GLYPHS[piece];
          sq.appendChild(span);
        }

        if (legalTargets.has(r + "," + c)) {
          const hint = document.createElement("span");
          hint.className = piece ? "ring-hint" : "dot-hint";
          sq.appendChild(hint);
        }

        sq.addEventListener("click", () => onSquareClick(r, c));
        boardEl.appendChild(sq);
      }
    }

    // Coordinate labels
    for (let i = 0; i < 8; i++) {
      const r = rowOrder[i];
      const rankLabel = document.createElement("div");
      rankLabel.className = "coord";
      rankLabel.style.gridRow = i + 2;
      rankLabel.style.gridColumn = 1;
      rankLabel.textContent = 8 - r;
      boardFrame.appendChild(rankLabel);
    }
    for (let i = 0; i < 8; i++) {
      const c = colOrder[i];
      const fileLabel = document.createElement("div");
      fileLabel.className = "coord";
      fileLabel.style.gridRow = 10;
      fileLabel.style.gridColumn = i + 2;
      fileLabel.textContent = "abcdefgh"[c];
      boardFrame.appendChild(fileLabel);
    }

    boardEl.style.gridColumn = "2 / 10";
    boardEl.style.gridRow = "2 / 10";
    boardFrame.appendChild(boardEl);

    // Turn / status
    turnSwatch.className = "turn-swatch " + state.turn;
    turnLabel.textContent = (state.turn === "w" ? "White" : "Black") + " to move";
    statusLine.classList.remove("alert");
    if (status.over) {
      statusLine.textContent = status.result;
      statusLine.classList.add("alert");
      turnLabel.textContent = status.result;
    } else if (status.check) {
      statusLine.textContent = "Check!";
      statusLine.classList.add("alert");
    } else {
      statusLine.textContent = "";
    }

    // Captured pieces
    capturedWhiteEl.innerHTML = capturedByWhite.map(p => GLYPHS[p]).join(" ");
    capturedBlackEl.innerHTML = capturedByBlack.map(p => GLYPHS[p]).join(" ");

    // Move list
    movesListEl.innerHTML = "";
    for (let i = 0; i < moveNotations.length; i += 2) {
      const li = document.createElement("li");
      const white = moveNotations[i];
      const black = moveNotations[i + 1];
      li.innerHTML = `<span>${white ? white.notation : ""}</span> ${black ? black.notation : ""}`;
      movesListEl.appendChild(li);
    }
    movesListEl.parentElement.scrollTop = movesListEl.parentElement.scrollHeight;

    undoBtn.disabled = appliedMoves.length === 0;
  }

  newGameBtn.addEventListener("click", () => {
    appliedMoves = [];
    rebuildFromMoves();
    clearSelection();
    render();
  });

  undoBtn.addEventListener("click", () => {
    appliedMoves.pop();
    rebuildFromMoves();
    clearSelection();
    render();
  });

  flipBtn.addEventListener("click", () => {
    flipped = !flipped;
    render();
  });

  function updateOnlineStatus() {
    const online = navigator.onLine;
    offlinePill.classList.toggle("offline", !online);
    offlineText.textContent = online ? "Online" : "Offline — still works";
  }
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  updateOnlineStatus();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {
        /* offline caching just won't be available; the app still runs */
      });
    });
  }

  rebuildFromMoves();
  render();
})();
