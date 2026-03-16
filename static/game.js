/* The Magical Kingdom Quest â€” client logic */
(() => {
  const assets = window.MKQ_ASSETS || {};
  const icons = window.MKQ_ICONS || {};

  const heroes = [
    {
      id: "wizard",
      name: "Wizard",
      img: assets.wizard,
      color: "#a78bfa",
      tagline: "Knows 14 spells. Uses 13 for snacks.",
    },
    {
      id: "fairy",
      name: "Fairy",
      img: assets.fairy,
      color: "#fb7185",
      tagline: "Glitter-powered. Emotionally unstoppable.",
    },
    {
      id: "knight",
      name: "Knight",
      img: assets.knight,
      color: "#34d399",
      tagline: "Honor, courage, and suspiciously loud armor.",
    },
    {
      id: "dragon_rider",
      name: "Dragon Rider",
      img: assets.dragon,
      color: "#fbbf24",
      tagline: "Arrives dramatically. Leavesâ€¦ also dramatically.",
    },
  ];

  const TILE_TYPES = {
    blank: { icon: icons.blank, label: "Blank" },
    star: { icon: icons.star, label: "Magic Trial" },
    dragon: { icon: icons.dragon, label: "Dragon" },
    crystal: { icon: icons.crystal, label: "Crystal" },
    trap: { icon: icons.trap, label: "Trap" },
  };

  const BOARD = {
    cols: 9,
    rows: 6,
    lastPos: 54,
  };

  const tileTypeByPos = new Map([
    [2, "crystal"],
    [3, "star"],
    [5, "dragon"],
    [7, "crystal"],
    [8, "star"],
    [9, "trap"],
    [11, "crystal"],
    [14, "star"],
    [15, "trap"],
    [16, "dragon"],
    [18, "crystal"],
    [21, "trap"],
    [22, "star"],
    [23, "dragon"],
    [26, "crystal"],
    [27, "star"],
    [28, "trap"],
    [31, "crystal"],
    [32, "star"],
    [34, "dragon"],
    [36, "trap"],
    [37, "crystal"],
    [39, "star"],
    [41, "dragon"],
    [43, "crystal"],
    [45, "trap"],
    [46, "star"],
    [48, "dragon"],
    [50, "crystal"],
    [51, "trap"],
    [52, "star"],
  ]);

  const biomeFor = (pos) => {
    if (pos <= 14) return { id: "forest", name: "Forest" };
    if (pos <= 22) return { id: "highland", name: "Highland" };
    if (pos <= 44) return { id: "cave", name: "Cave" };
    return { id: "castle", name: "Castle" };
  };

  const el = {
    startScreen: document.getElementById("startScreen"),
    heroGrid: document.getElementById("heroGrid"),
    startBtn: document.getElementById("startBtn"),
    startHint: document.getElementById("startHint"),
    gameScreen: document.getElementById("gameScreen"),
    winScreen: document.getElementById("winScreen"),
    board: document.getElementById("board"),
    toastHost: document.getElementById("toastHost"),
    message: document.getElementById("message"),
    die: document.getElementById("die"),
    currentRing: document.getElementById("currentRing"),
    currentAvatar: document.getElementById("currentAvatar"),
    currentName: document.getElementById("currentName"),
    currentCoins: document.getElementById("currentCoins"),
    currentShields: document.getElementById("currentShields"),
    currentPos: document.getElementById("currentPos"),
    playerStats: document.getElementById("playerStats"),
    restartBtn: document.getElementById("restartBtn"),
    rulesBtn: document.getElementById("rulesBtn"),
    muteBtn: document.getElementById("muteBtn"),
    playAgainBtn: document.getElementById("playAgainBtn"),
    winnerAvatar: document.getElementById("winnerAvatar"),
    winnerText: document.getElementById("winnerText"),
    confettiHost: document.getElementById("confettiHost"),
    buyShieldBtn: document.getElementById("buyShieldBtn"),
    modalOverlay: document.getElementById("modalOverlay"),
    modalTitle: document.getElementById("modalTitle"),
    modalBody: document.getElementById("modalBody"),
    modalBtns: document.getElementById("modalBtns"),
  };

  const state = {
    selectedHeroIds: new Set(),
    players: [],
    current: 0,
    phase: "select", // select | roll | rolled | moving | resolving | ended
    lastRoll: null,
    moveTimer: null,
    tileElsByPos: new Map(),
  };

  const RULES_HTML = `
    <ul class="rulesList" style="margin:0;padding-left:18px">
      <li><b>Roll</b> 1d6 → <b>Move</b> that many spaces → <b>Resolve</b> the tile.</li>
      <li><b>Star</b>: Answer a Magic Question. Correct = <b>+2</b> spaces.</li>
      <li><b>Dragon</b>: Use a <b>Shield</b>, bribe (2 coins), or take <b>-3</b> spaces.</li>
      <li><b>Crystal</b>: Draw a Magic Card (moves, coins, or shields).</li>
      <li><b>Trap</b>: Use a <b>Shield</b>, disarm (1 coin), or get <b>Stunned</b> (skip next turn).</li>
      <li>Exact win: Reach Space ${BOARD.lastPos}. If you overshoot, you bounce back.</li>
    </ul>
  `;

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  const sound = (() => {
    const STORAGE_KEY = "mkq_muted";
    let muted = false;
    let ctx = null;
    let musicTimer = null;
    let musicGain = null;
    let sfxGain = null;

    const noteFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

    const ensureCtx = () => {
      if (ctx) return ctx;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
      return ctx;
    };

    const ensureSfxGain = () => {
      const ac = ensureCtx();
      if (!ac) return null;
      if (sfxGain) return sfxGain;
      sfxGain = ac.createGain();
      sfxGain.gain.value = 0.95;
      sfxGain.connect(ac.destination);
      return sfxGain;
    };

    const unlock = () => {
      const ac = ensureCtx();
      if (!ac) return;
      if (ac.state === "suspended") {
        try {
          ac.resume().catch(() => {});
        } catch {
          // ignore
        }
      }
    };

    const initFromStorage = () => {
      try {
        muted = localStorage.getItem(STORAGE_KEY) === "1";
      } catch {
        muted = false;
      }
    };

    const setMuted = (value) => {
      muted = Boolean(value);
      try {
        localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
      } catch {
        // ignore
      }
      if (muted) stopMusic();
    };

    const isMuted = () => muted;

    const startMusic = () => {
      if (muted) return;
      const ac = ensureCtx();
      if (!ac) return;

      const start = () => {
        if (muted) return;
        if (musicTimer) return;

        musicGain = ac.createGain();
        musicGain.gain.value = 0.12;
        musicGain.connect(ac.destination);

        const seq = [72, 76, 79, 76, 74, 76, 79, 83];
        let i = 0;
        musicTimer = setInterval(() => {
          if (muted) return;
          const osc = ac.createOscillator();
          const g = ac.createGain();
          osc.type = "triangle";
          osc.frequency.value = noteFreq(seq[i++ % seq.length]);
          g.gain.value = 0.0001;
          osc.connect(g);
          g.connect(musicGain);
          const now = ac.currentTime;
          g.gain.setValueAtTime(0.0001, now);
          g.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
          osc.start(now);
          osc.stop(now + 0.2);
        }, 210);
      };

      if (ac.state === "suspended") ac.resume().then(start).catch(() => {});
      else start();
    };

    const stopMusic = () => {
      if (musicTimer) clearInterval(musicTimer);
      musicTimer = null;
      if (musicGain) {
        try {
          musicGain.disconnect();
        } catch {
          // ignore
        }
      }
      musicGain = null;
    };

    const playTone = ({
      freq,
      toFreq,
      ms = 120,
      startMs = 0,
      type = "sine",
      volume = 0.06,
    }) => {
      if (muted) return;
      const ac = ensureCtx();
      const out = ensureSfxGain();
      if (!ac || !out) return;

      const play = () => {
        if (muted) return;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = type;

        const t0 = ac.currentTime + startMs / 1000;
        osc.frequency.setValueAtTime(Math.max(1, freq), t0);
        if (toFreq != null) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(1, toFreq), t0 + ms / 1000);
        }

        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);

        osc.connect(gain);
        gain.connect(out);
        osc.start(t0);
        osc.stop(t0 + ms / 1000 + 0.03);
      };

      if (ac.state === "suspended") ac.resume().then(play).catch(() => {});
      else play();
    };

    const playNoise = ({
      ms = 120,
      startMs = 0,
      volume = 0.05,
      filter = "bandpass", // bandpass | highpass | lowpass
      freq = 900,
      q = 0.8,
    }) => {
      if (muted) return;
      const ac = ensureCtx();
      const out = ensureSfxGain();
      if (!ac || !out) return;

      const play = () => {
        if (muted) return;
        const duration = Math.max(0.03, ms / 1000);
        const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.85;

        const src = ac.createBufferSource();
        src.buffer = buffer;

        const biquad = ac.createBiquadFilter();
        biquad.type = filter;
        biquad.frequency.value = freq;
        biquad.Q.value = q;

        const gain = ac.createGain();
        const t0 = ac.currentTime + startMs / 1000;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

        src.connect(biquad);
        biquad.connect(gain);
        gain.connect(out);
        src.start(t0);
        src.stop(t0 + duration + 0.02);
      };

      if (ac.state === "suspended") ac.resume().then(play).catch(() => {});
      else play();
    };

    const beep = (freq, ms, type = "sine", volume = 0.06) => {
      playTone({ freq, ms, type, volume });
    };

    const hero = (heroId, kind = "turn") => {
      const h = String(heroId || "");
      const short = kind === "select_off" ? 70 : 90;
      if (h === "wizard") {
        if (kind === "turn") {
          playTone({ freq: 660, ms: 90, type: "triangle", volume: 0.05 });
          playTone({ freq: 880, ms: 90, startMs: 90, type: "triangle", volume: 0.05 });
          playTone({ freq: 990, ms: 110, startMs: 180, type: "sine", volume: 0.05 });
          return;
        }
        playTone({ freq: kind === "select_on" ? 740 : 320, ms: short, type: "triangle", volume: 0.045 });
        return;
      }
      if (h === "fairy") {
        if (kind === "turn") {
          playTone({ freq: 1200, ms: 70, type: "sine", volume: 0.045 });
          playTone({ freq: 1500, ms: 70, startMs: 70, type: "sine", volume: 0.04 });
          playTone({ freq: 1800, ms: 90, startMs: 140, type: "triangle", volume: 0.04 });
          return;
        }
        playTone({ freq: kind === "select_on" ? 1400 : 520, ms: short, type: "sine", volume: 0.04 });
        return;
      }
      if (h === "knight") {
        if (kind === "turn") {
          playNoise({ ms: 70, volume: 0.03, filter: "bandpass", freq: 1200, q: 1.2 });
          playTone({ freq: 220, ms: 120, startMs: 10, type: "square", volume: 0.045 });
          playTone({ freq: 330, ms: 90, startMs: 120, type: "triangle", volume: 0.04 });
          return;
        }
        playNoise({ ms: 50, volume: 0.022, filter: "bandpass", freq: 1400, q: 1.4 });
        playTone({ freq: kind === "select_on" ? 260 : 180, ms: short, type: "square", volume: 0.04 });
        return;
      }
      if (h === "dragon_rider") {
        if (kind === "turn") {
          playNoise({ ms: 150, volume: 0.03, filter: "lowpass", freq: 900, q: 0.7 });
          playTone({ freq: 220, toFreq: 110, ms: 260, startMs: 0, type: "sawtooth", volume: 0.05 });
          return;
        }
        playTone({ freq: kind === "select_on" ? 180 : 140, ms: 120, type: "sawtooth", volume: 0.045 });
        return;
      }

      // fallback
      playTone({ freq: kind === "turn" ? 660 : 520, ms: 70, type: "triangle", volume: 0.04 });
    };

    const sfx = (name, payload = {}) => {
      const n = String(name || "");
      if (n === "start") {
        playTone({ freq: 392, ms: 90, type: "triangle", volume: 0.05 });
        playTone({ freq: 523.25, ms: 110, startMs: 90, type: "triangle", volume: 0.05 });
        return;
      }
      if (n === "turn") return hero(payload.heroId, "turn");

      if (n === "dice") {
        const roll = Number(payload.roll || 0);
        for (let i = 0; i < 6; i++) {
          playTone({
            freq: 180 + Math.random() * 420 + roll * 18,
            ms: 35,
            startMs: i * 35,
            type: i % 2 ? "square" : "triangle",
            volume: 0.03,
          });
        }
        playTone({ freq: 220 + roll * 60, ms: 90, startMs: 210, type: "square", volume: 0.05 });
        return;
      }

      if (n === "step") {
        const heroId = String(payload.heroId || "");
        const baseByHero = {
          wizard: 520,
          fairy: 720,
          knight: 320,
          dragon_rider: 240,
        };
        const typeByHero = {
          wizard: "sine",
          fairy: "triangle",
          knight: "square",
          dragon_rider: "sawtooth",
        };
        const base = baseByHero[heroId] || 520;
        const type = typeByHero[heroId] || "triangle";
        const jitter = (Math.random() * 2 - 1) * 24;
        playTone({ freq: base + jitter, ms: 42, type, volume: 0.022 });
        return;
      }

      if (n === "blank") {
        playTone({ freq: 440, ms: 60, type: "triangle", volume: 0.018 });
        return;
      }

      if (n === "stunned") {
        playTone({ freq: 200, toFreq: 140, ms: 240, type: "square", volume: 0.04 });
        playNoise({ ms: 80, startMs: 40, volume: 0.02, filter: "bandpass", freq: 900, q: 0.9 });
        return;
      }

      if (n === "card_move") {
        playTone({ freq: 600, ms: 70, type: "triangle", volume: 0.035 });
        playTone({ freq: 900, ms: 90, startMs: 70, type: "sine", volume: 0.03 });
        return;
      }

      if (n === "star") {
        playTone({ freq: 784, ms: 90, type: "triangle", volume: 0.045 });
        playTone({ freq: 1046.5, ms: 110, startMs: 90, type: "sine", volume: 0.04 });
        return;
      }
      if (n === "star_ok") {
        playTone({ freq: 880, ms: 80, type: "sine", volume: 0.05 });
        playTone({ freq: 1174.7, ms: 120, startMs: 70, type: "triangle", volume: 0.05 });
        return;
      }
      if (n === "star_bad") {
        playTone({ freq: 220, toFreq: 160, ms: 220, type: "square", volume: 0.04 });
        return;
      }
      if (n === "crystal") {
        playTone({ freq: 740, ms: 70, type: "triangle", volume: 0.04 });
        playTone({ freq: 990, ms: 90, startMs: 70, type: "triangle", volume: 0.035 });
        playTone({ freq: 1320, ms: 110, startMs: 150, type: "sine", volume: 0.03 });
        return;
      }
      if (n === "dragon") {
        playNoise({ ms: 160, volume: 0.03, filter: "lowpass", freq: 1000, q: 0.7 });
        playTone({ freq: 170, toFreq: 95, ms: 280, type: "sawtooth", volume: 0.05 });
        return;
      }
      if (n === "trap") {
        playNoise({ ms: 90, volume: 0.045, filter: "highpass", freq: 1800, q: 0.9 });
        playTone({ freq: 260, ms: 70, startMs: 40, type: "square", volume: 0.035 });
        return;
      }
      if (n === "coin") {
        playTone({ freq: 988, ms: 70, type: "triangle", volume: 0.04 });
        playTone({ freq: 1318.5, ms: 90, startMs: 60, type: "sine", volume: 0.035 });
        return;
      }
      if (n === "shield") {
        playNoise({ ms: 60, volume: 0.02, filter: "bandpass", freq: 1400, q: 1.3 });
        playTone({ freq: 740, ms: 90, startMs: 10, type: "triangle", volume: 0.045 });
        return;
      }
      if (n === "modal_pop") {
        playTone({ freq: 520, ms: 50, type: "triangle", volume: 0.02 });
        return;
      }
      if (n === "win") {
        stopMusic();
        playTone({ freq: 523.25, ms: 110, type: "triangle", volume: 0.05 });
        playTone({ freq: 659.25, ms: 110, startMs: 110, type: "triangle", volume: 0.05 });
        playTone({ freq: 783.99, ms: 140, startMs: 220, type: "sine", volume: 0.05 });
        playTone({ freq: 1046.5, ms: 200, startMs: 340, type: "triangle", volume: 0.05 });
        return;
      }
    };

    return { initFromStorage, setMuted, isMuted, unlock, startMusic, stopMusic, beep, sfx, hero };
  })();

  function updateMuteButton() {
    if (!el.muteBtn) return;
    const muted = sound.isMuted();
    el.muteBtn.textContent = muted ? "Sound: Off" : "Sound: On";
    el.muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
  }

  function setDieEnabled(enabled) {
    const disabled = !enabled;
    el.die.classList.toggle("disabled", disabled);
    el.die.classList.toggle("attention", Boolean(enabled));
    el.currentRing.classList.toggle("turnPulse", Boolean(enabled));
    el.die.setAttribute("aria-disabled", disabled ? "true" : "false");
    el.die.tabIndex = disabled ? -1 : 0;
  }

  function toast(message, kind = "info") {
    const t = document.createElement("div");
    t.className = `toast ${kind}`;
    t.textContent = message;
    el.toastHost.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  function setMessage(msg) {
    el.message.textContent = msg;
    el.message.classList.remove("ping");
    // force reflow to restart animation
    void el.message.offsetWidth;
    el.message.classList.add("ping");
  }

  function showModal({ title, body, buttons }) {
    el.modalTitle.textContent = title;
    el.modalBody.innerHTML = body;
    el.modalBtns.textContent = "";

    for (const b of buttons) {
      const btn = document.createElement("button");
      btn.className = b.className || "btn btn-mini btn-gold";
      btn.textContent = b.label;
      btn.addEventListener("click", () => b.onClick?.());
      el.modalBtns.appendChild(btn);
    }

    sound.sfx("modal_pop");
    el.modalOverlay.classList.remove("hidden");
  }

  function closeModal() {
    el.modalOverlay.classList.add("hidden");
  }

  function showRules() {
    showModal({
      title: "Rules",
      body: RULES_HTML,
      buttons: [
        {
          label: "Close",
          className: "btn btn-mini btn-red",
          onClick: () => closeModal(),
        },
      ],
    });
  }

  function currentPlayer() {
    return state.players[state.current];
  }

  function updateSidebar() {
    const p = currentPlayer();
    el.currentAvatar.src = p.img;
    el.currentName.textContent = p.name;
    el.currentCoins.innerHTML = `<img class="miniIco" src="${icons.coin}" alt="" />${p.coins}`;
    el.currentShields.innerHTML = `<img class="miniIco" src="${icons.shield}" alt="" />${p.shields}`;
    el.currentPos.innerHTML = `<img class="miniIco" src="${icons.compass}" alt="" />${p.position}`;
    el.currentRing.style.boxShadow = `5px 5px 0 #140a2a, 0 0 0 4px ${p.color} inset`;

    el.buyShieldBtn.disabled = !(state.phase === "roll" && p.coins >= 2);

    renderInventory();
  }  function renderInventory() {
    el.playerStats.textContent = "";
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      const row = document.createElement("div");
      row.className = `playerStat ${i === state.current ? "active" : ""}`;
      row.innerHTML = `
        <img class="avatarTiny" src="${p.img}" alt="${p.name}" />
        <div>
          <div class="pname" style="color:${p.color}">${p.name}</div>
          <div class="pmeta">
            <span class="pill"><img class="miniIco" src="${icons.coin}" alt="" />${p.coins}</span>
            <span class="pill"><img class="miniIco" src="${icons.shield}" alt="" />${p.shields}</span>
          </div>
        </div>
      `;
      el.playerStats.appendChild(row);
    }
  }

  function clearTileHighlights() {
    for (const tile of state.tileElsByPos.values()) tile.classList.remove("current");
  }

  function highlightCurrentTile() {
    clearTileHighlights();
    const p = currentPlayer();
    const tile = state.tileElsByPos.get(p.position);
    if (tile) tile.classList.add("current");
  }

  function buildHeroSelect() {
    el.heroGrid.textContent = "";
    for (const h of heroes) {
      const card = document.createElement("div");
      card.className = "heroCard";
      card.dataset.heroId = h.id;
      card.innerHTML = `
        <img class="heroAvatar" src="${h.img}" alt="${h.name}" />
        <div>
          <div class="heroName" style="color:${h.color}">${h.name}</div>
          <div class="heroTag">${h.tagline}</div>
        </div>
      `;

      card.addEventListener("click", () => toggleHero(h.id, card));
      el.heroGrid.appendChild(card);
    }
    syncStartUi();
  }

  function toggleHero(heroId, cardEl) {
    if (state.phase !== "select") return;
    if (state.selectedHeroIds.has(heroId)) state.selectedHeroIds.delete(heroId);
    else state.selectedHeroIds.add(heroId);
    cardEl.classList.toggle("selected", state.selectedHeroIds.has(heroId));
    sound.hero(heroId, state.selectedHeroIds.has(heroId) ? "select_on" : "select_off");
    syncStartUi();
  }

  function syncStartUi() {
    const n = state.selectedHeroIds.size;
    const ok = n >= 2 && n <= 4;
    el.startBtn.disabled = !ok;
    el.startHint.textContent =
      n === 0
        ? "Select at least 2 heroes to begin."
        : ok
          ? `Perfect. ${n} heroes are ready to do something heroic-ish.`
          : "Pick 2â€“4 heroes. (A party of 1 is justâ€¦ a very motivated introvert.)";
  }

  function tileType(pos) {
    if (pos === BOARD.lastPos) return "blank";
    return tileTypeByPos.get(pos) || "blank";
  }

  function buildBoard() {
    state.tileElsByPos.clear();
    el.board.textContent = "";

    for (let pos = 1; pos <= BOARD.lastPos; pos++) {
      const row = Math.floor((pos - 1) / BOARD.cols);
      const colInRow = (pos - 1) % BOARD.cols;
      const col = row % 2 === 0 ? colInRow : BOARD.cols - 1 - colInRow;

      const biome = biomeFor(pos);
      const t = tileType(pos);
      const iconSrc = TILE_TYPES[t].icon;

      const tile = document.createElement("div");
      tile.className = `tile tile-${biome.id} ${pos === BOARD.lastPos ? "goal" : ""}`;
      tile.style.gridRow = `${row + 1}`;
      tile.style.gridColumn = `${col + 1}`;
      tile.dataset.pos = String(pos);
      tile.innerHTML = `
        <div class="num">${pos}</div>
        <div class="icon">
          <img class="tileIcon" src="${pos === BOARD.lastPos ? icons.castle : iconSrc}" alt="" />
        </div>
        <div class="tokens" aria-hidden="true"></div>
      `;

      state.tileElsByPos.set(pos, tile);
      el.board.appendChild(tile);
    }

    ensurePathOverlay();
    requestAnimationFrame(() => drawPathOverlay());
  }

  function ensurePathOverlay() {
    let svg = el.board.querySelector("svg.pathOverlay");
    if (svg) return svg;
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("pathOverlay");
    svg.setAttribute("aria-hidden", "true");
    el.board.appendChild(svg);
    return svg;
  }

  function drawPathOverlay() {
    const svg = ensurePathOverlay();
    const boardRect = el.board.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${boardRect.width} ${boardRect.height}`);
    svg.setAttribute("width", String(boardRect.width));
    svg.setAttribute("height", String(boardRect.height));
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "mkqArrow");
    marker.setAttribute("markerWidth", "12");
    marker.setAttribute("markerHeight", "12");
    marker.setAttribute("refX", "10");
    marker.setAttribute("refY", "6");
    marker.setAttribute("orient", "auto");
    const tip = document.createElementNS("http://www.w3.org/2000/svg", "path");
    tip.setAttribute("d", "M 0 0 L 12 6 L 0 12 z");
    tip.setAttribute("fill", "rgba(255,255,255,0.35)");
    tip.setAttribute("stroke", "rgba(0,0,0,0.35)");
    tip.setAttribute("stroke-width", "1");
    marker.appendChild(tip);
    defs.appendChild(marker);
    svg.appendChild(defs);

    const pts = [];
    for (let pos = 1; pos <= BOARD.lastPos; pos++) {
      const tile = state.tileElsByPos.get(pos);
      if (!tile) continue;
      const r = tile.getBoundingClientRect();
      pts.push([r.left + r.width / 2 - boardRect.left, r.top + r.height / 2 - boardRect.top]);
    }

    const mkPath = (cls, withArrow) => {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("class", cls);
      p.setAttribute(
        "d",
        pts
          .map((xy, i) => {
            const [x, y] = xy;
            return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(" ")
      );
      if (withArrow) p.setAttribute("marker-end", "url(#mkqArrow)");
      return p;
    };

    svg.appendChild(mkPath("pathGlow", false));
    svg.appendChild(mkPath("pathStroke", true));
  }

  function updateTokens() {
    for (const tile of state.tileElsByPos.values()) {
      const tokens = tile.querySelector(".tokens");
      if (tokens) tokens.textContent = "";
    }

    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      const tile = state.tileElsByPos.get(p.position);
      if (!tile) continue;
      const tokens = tile.querySelector(".tokens");
      if (!tokens) continue;

      const tileW = tile.clientWidth || 96;
      const tokenSize = tileW >= 90 ? 34 : 28;
      const pad = Math.max(4, Math.floor(tileW * 0.12));
      const delta = Math.max(0, tileW - pad * 2 - tokenSize);
      const step = Math.floor(delta / 1.25);
      const offsets = [
        { top: pad, left: pad },
        { top: pad, left: pad + step },
        { top: pad + step, left: pad },
        { top: pad + step, left: pad + step },
      ];

      const token = document.createElement("img");
      token.className = "token";
      token.alt = p.name;
      token.src = p.img;
      token.style.outline = `3px solid ${p.color}`;
      token.style.width = `${tokenSize}px`;
      token.style.height = `${tokenSize}px`;

      const onSame = state.players.filter((x) => x.position === p.position);
      const idx = Math.max(0, Math.min(offsets.length - 1, onSame.findIndex((x) => x === p)));
      const off = offsets[idx];
      token.style.top = `${off.top}px`;
      token.style.left = `${off.left}px`;

      tokens.appendChild(token);
    }
  }

  function startGame() {
    sound.unlock();
    const ids = [...state.selectedHeroIds];
    if (ids.length < 2 || ids.length > 4) return;

    state.players = ids.map((id) => {
      const h = heroes.find((x) => x.id === id);
      return {
        id: h.id,
        name: h.name,
        img: h.img,
        color: h.color,
        position: 1,
        coins: 3,
        shields: 0,
        skip: false,
      };
    });
    state.current = 0;
    state.phase = "roll";
    state.lastRoll = null;

    buildBoard();
    updateTokens();
    highlightCurrentTile();

    el.startScreen.classList.add("hidden");
    el.winScreen.classList.add("hidden");
    el.gameScreen.classList.remove("hidden");

    el.die.textContent = "?";
    setDieEnabled(true);
    {
      const p = currentPlayer();
      setMessage(`${p.name}'s turn — tap the die!`);
      document.title = `${p.name}'s turn • The Magical Kingdom Quest`;
      sound.sfx("start");
      sound.sfx("turn", { heroId: p.id });
    }
    updateSidebar();
    chaosMaybe();
    if (!sound.isMuted()) sound.startMusic();
  }

  function nextTurn() {
    state.current = (state.current + 1) % state.players.length;
    state.phase = "roll";
    state.lastRoll = null;
    el.die.textContent = "?";
    el.die.classList.remove("spin");
    setDieEnabled(true);
    updateSidebar();
    highlightCurrentTile();

    chaosMaybe();

    const p = currentPlayer();
    if (p.skip) {
      p.skip = false;
      toast(`${p.name} is stunned and misses a turn. Dramatic sigh!`, "bad");
      setMessage(`${p.name} is stunned — skipping turn!`);
      sound.sfx("stunned");
      setDieEnabled(false);
      setTimeout(() => nextTurn(), 1300);
      return;
    }
    setMessage(`${p.name}'s turn — tap the die!`);
    document.title = `${p.name}'s turn • The Magical Kingdom Quest`;
    sound.sfx("turn", { heroId: p.id });
  }

  function computeForwardPath(start, steps) {
    const path = [];
    let pos = start;
    for (let i = 0; i < steps; i++) {
      pos += 1;
      if (pos > BOARD.lastPos) {
        const over = pos - BOARD.lastPos;
        pos = BOARD.lastPos - over;
      }
      path.push(pos);
    }
    return path;
  }

  function computeBackwardPath(start, steps) {
    const path = [];
    let pos = start;
    for (let i = 0; i < steps; i++) {
      pos -= 1;
      if (pos < 1) pos = 1;
      path.push(pos);
    }
    return path;
  }

  function animateMove(path, { onDone }) {
    const p = currentPlayer();
    let i = 0;
    state.phase = "moving";

    const step = () => {
      if (i >= path.length) {
        onDone?.();
        return;
      }
      p.position = path[i++];
      updateTokens();
      highlightCurrentTile();
      sound.sfx("step", { heroId: p.id, pos: p.position });

      const tile = state.tileElsByPos.get(p.position);
      const tok = tile?.querySelector(`img.token[alt="${p.name}"]`);
      if (tok) {
        tok.classList.remove("boop");
        // force reflow to restart animation
        void tok.offsetWidth;
        tok.classList.add("boop");
      }
      setTimeout(step, 360);
    };
    step();
  }

  async function rollDice() {
    if (state.phase !== "roll") return;
    sound.unlock();
    const p = currentPlayer();
    setDieEnabled(false);

    const roll = randInt(1, 6);
    state.lastRoll = roll;
    state.phase = "rolled";

    el.die.classList.remove("spin");
    void el.die.offsetWidth;
    el.die.classList.add("spin");
    el.die.textContent = String(roll);
    sound.sfx("dice", { roll });

    setMessage(`${p.name} rolled a ${roll}. The board gasps.`);
    updateSidebar();

    if (state.moveTimer) clearTimeout(state.moveTimer);
    state.moveTimer = setTimeout(() => {
      state.moveTimer = null;
      const path = computeForwardPath(p.position, roll);
      animateMove(path, {
        onDone: () => resolveTile(),
      });
    }, 1200);
  }

  async function resolveTile() {
    state.phase = "resolving";
    updateSidebar();

    const p = currentPlayer();
    if (p.position === BOARD.lastPos) {
      win();
      return;
    }

    const t = tileType(p.position);

    if (t === "blank") {
      toast(`Space ${p.position}: Nothing happens. Suspiciousâ€¦`, "info");
      setMessage(`${p.name} lands on a blank tile. Nothing happens.`);
      sound.sfx("blank");
      setTimeout(() => nextTurn(), 900);
      return;
    }

    if (t === "star") {
      setMessage(`${p.name} hit a Star tile! Time for a Magic Trial!`);
      toast("Magic Trial! Answer with confidence (or vibes).", "info");
      sound.sfx("star");

      const q = await fetch("/api/magic-question").then((r) => r.json());
      showModal({
        title: "Magic Trial!",
        body: `<div>${q.question}</div>
              <div class="choiceGrid">
                ${q.options
                  .map((opt, idx) => `<button class="btn btn-mini btn-blue" data-idx="${idx}">${opt}</button>`)
                  .join("")}
              </div>`,
        buttons: [
          {
            label: "Close",
            className: "btn btn-mini btn-red",
            onClick: () => {
              closeModal();
              nextTurn();
            },
          },
        ],
      });

      const gridBtns = el.modalBody.querySelectorAll("button[data-idx]");
      gridBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.dataset.idx);
           closeModal();
           if (idx === q.answerIndex) {
             toast("Correct! The universe gives you a +2 high-five. (+2)", "good");
             setMessage(`${p.name} answered correctly! Zoom +2!`);
             sound.sfx("star_ok");
             const path = computeForwardPath(p.position, 2);
             animateMove(path, { onDone: () => resolveTile() });
           } else {
             toast("Wrong! The magic politely judges you. No bonus.", "bad");
             setMessage(`${p.name} answered wrong. The Star sighs.`);
             sound.sfx("star_bad");
             setTimeout(() => nextTurn(), 900);
           }
         });
       });
      return;
    }

    if (t === "crystal") {
      setMessage(`${p.name} found a Crystal tile! Loot time!`);
      toast("Crystal Loot! Summoning a cardâ€¦", "info");
      sound.sfx("crystal");

      const card = await fetch("/api/magic-card").then((r) => r.json());
      const title = `Magic Card: ${card.name}`;
      const body = `<div>${card.text}</div>`;
      showModal({
        title,
        body,
        buttons: [
          {
            label: "Take It!",
            className: "btn btn-mini btn-gold",
            onClick: () => {
              closeModal();
              applyCard(card);
            },
          },
        ],
      });
      return;
    }

    if (t === "dragon") {
      setMessage(`${p.name} met a Dragon. It looksâ€¦ argumentative.`);
      toast("Dragon Encounter! It challenges you to a snack-off.", "bad");
      sound.sfx("dragon");

      const canShield = p.shields > 0;
      const canBribe = p.coins >= 2;
      const btns = [];

      if (canShield) {
        btns.push({
          label: "Use Shield",
          className: "btn btn-mini btn-green",
          onClick: () => {
            p.shields -= 1;
            closeModal();
            toast("Shield deployed. The dragon bonks itself. You proceed.", "good");
            sound.sfx("shield");
            updateSidebar();
            setTimeout(() => nextTurn(), 900);
          },
        });
      }

      if (canBribe) {
        btns.push({
          label: "Bribe (2 coins)",
          className: "btn btn-mini btn-gold",
          onClick: () => {
            p.coins -= 2;
            closeModal();
            toast("You pay the dragon in snacks and compliments. It blushes.", "good");
            sound.sfx("coin");
            updateSidebar();
            setTimeout(() => nextTurn(), 900);
          },
        });
      }

      btns.push({
        label: "Take -3",
        className: "btn btn-mini btn-red",
        onClick: () => {
          closeModal();
          toast("The dragon SHOOOS you backward. (-3)", "bad");
          sound.sfx("dragon");
          const path = computeBackwardPath(p.position, 3);
          animateMove(path, { onDone: () => resolveTile() });
        },
      });

      showModal({
        title: "Dragon Encounter!",
        body: `<div>The dragon says: â€œI am very scary.â€ You say: â€œI am veryâ€¦ mobile.â€</div>
              <div style="margin-top:10px;opacity:.95;font-weight:900">
                Options: use a Shield, bribe with 2 coins, or accept the legendary -3 yeet.
              </div>`,
        buttons: btns,
      });
      return;
    }

    if (t === "trap") {
      setMessage(`${p.name} hit a Trap! The floor does a comedy betrayal.`);
      toast("Trap! You are now in a very serious sitcom.", "bad");
      sound.sfx("trap");

      const canShield = p.shields > 0;
      const canDisarm = p.coins >= 1;

      const btns = [];
      if (canShield) {
        btns.push({
          label: "Use Shield",
          className: "btn btn-mini btn-green",
          onClick: () => {
            p.shields -= 1;
            closeModal();
            toast("Shield used. Trap blocked!", "good");
            sound.sfx("shield");
            updateSidebar();
            setTimeout(() => nextTurn(), 900);
          },
        });
      }
      if (canDisarm) {
        btns.push({
          label: "Disarm (1 coin)",
          className: "btn btn-mini btn-gold",
          onClick: () => {
            p.coins -= 1;
            closeModal();
            toast("You pay the trap. It retires peacefully.", "good");
            sound.sfx("coin");
            updateSidebar();
            setTimeout(() => nextTurn(), 900);
          },
        });
      }

      btns.push({
        label: "Get Stunned",
        className: "btn btn-mini btn-red",
        onClick: () => {
          p.skip = true;
          closeModal();
          toast("Stunned! You will skip your next turn.", "bad");
          sound.sfx("stunned");
          updateSidebar();
          setTimeout(() => nextTurn(), 900);
        },
      });

      showModal({
        title: "Trap!",
        body: `<div>You are trapped byâ€¦ the ancient curse of inconvenient timing.</div>
              <div style="margin-top:10px;opacity:.95;font-weight:900">
                Use a Shield, disarm for 1 coin, or accept the stun and practice your fainting pose.
              </div>`,
        buttons: btns,
      });
      return;
    }

    toast("This tile is so mysterious it forgot its own type.", "info");
    setTimeout(() => nextTurn(), 900);
  }

  function applyCard(card) {
    const p = currentPlayer();
    if (card.type === "move") {
      toast(`Card effect: move +${card.value}!`, "good");
      setMessage(`${p.name} uses ${card.name}. ZOOM +${card.value}!`);
      sound.sfx("card_move");
      const path = computeForwardPath(p.position, card.value);
      animateMove(path, { onDone: () => resolveTile() });
      return;
    }
    if (card.type === "coins") {
      p.coins += Number(card.value || 0);
      toast(`Card effect: +${card.value} coins!`, "good");
      setMessage(`${p.name} gains coins. The economy applauds.`);
      sound.sfx("coin");
      updateSidebar();
      setTimeout(() => nextTurn(), 900);
      return;
    }
    if (card.type === "item" && card.item === "shield") {
      p.shields += 1;
      toast(`Item acquired: ${card.name}!`, "good");
      setMessage(`${p.name} gains a Shield. Very shiny.`);
      sound.sfx("shield");
      updateSidebar();
      setTimeout(() => nextTurn(), 900);
      return;
    }

    toast("The card isâ€¦ confusing. But in a fun way.", "info");
    setTimeout(() => nextTurn(), 900);
  }

  function buyShield() {
    const p = currentPlayer();
    if (state.phase !== "roll") {
      toast("Shop is only open before you roll. The cashier is very strict.", "bad");
      return;
    }
    const cost = 2;
    if (p.coins < cost) {
      toast("Not enough coins. Consider performing a dramatic side quest.", "bad");
      return;
    }
    p.coins -= cost;
    p.shields += 1;
    toast("Purchased: shield!", "good");
    sound.sfx("shield");
    updateSidebar();
  }

  function win() {
    state.phase = "ended";
    const p = currentPlayer();
    el.winnerAvatar.src = p.img;
    el.winnerText.innerHTML = `<span style="color:${p.color}">${p.name}</span> snatches the Magic Crown and yells â€œI DID A QUEST!â€`;
    sound.sfx("win", { heroId: p.id });

    el.gameScreen.classList.add("hidden");
    el.winScreen.classList.remove("hidden");
    closeModal();
    confetti();
  }

  function confetti() {
    const colors = ["#ff355e", "#ffcc33", "#2dd4ff", "#34d399", "#a78bfa", "#ffffff"];
    for (let i = 0; i < 80; i++) {
      const c = document.createElement("div");
      c.className = "confetti";
      c.style.left = `${Math.random() * 100}vw`;
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = `${Math.random() * 0.4}s`;
      c.style.opacity = String(0.85 + Math.random() * 0.15);
      c.style.transform = `translateY(0) rotate(${Math.random() * 120}deg)`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 2200);
    }
  }

  function restart() {
    closeModal();
    state.players = [];
    state.current = 0;
    state.phase = "select";
    state.lastRoll = null;
    if (state.moveTimer) clearTimeout(state.moveTimer);
    state.moveTimer = null;

    el.gameScreen.classList.add("hidden");
    el.winScreen.classList.add("hidden");
    el.startScreen.classList.remove("hidden");
    el.die.textContent = "?";
    setDieEnabled(false);
    setMessage("Pick heroes to begin!");
    buildHeroSelect();
  }

  function chaosMaybe() {
    if (state.phase === "select") return;
    if (Math.random() > 0.18) return;
    const p = currentPlayer();
    const events = [
      () => toast("A sparkle breeze blows. Everyone feels 7% more heroic.", "info"),
      () => toast("A banana peel appears but decides to be nice today.", "info"),
      () => toast("A wand sneezes in the distance. Bless you, wand.", "info"),
      () => toast(`A frog judges ${p.name}'s posture. Harsh but fair.`, "info"),
    ];
    events[randInt(0, events.length - 1)]();
  }

  // Events
  el.startBtn.addEventListener("click", () => {
    sound.unlock();
    startGame();
  });
  el.die.addEventListener("click", () => {
    sound.unlock();
    rollDice();
  });
  el.die.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    sound.unlock();
    rollDice();
  });
  el.restartBtn.addEventListener("click", restart);
  el.playAgainBtn.addEventListener("click", restart);

  el.buyShieldBtn.addEventListener("click", buyShield);
  el.rulesBtn.addEventListener("click", showRules);
  el.muteBtn.addEventListener("click", () => {
    sound.setMuted(!sound.isMuted());
    updateMuteButton();
    if (!sound.isMuted()) {
      sound.unlock();
      sound.startMusic();
      sound.beep(880, 80, "sine", 0.14);
    }
  });

  el.modalOverlay.addEventListener("click", (e) => {
    if (e.target === el.modalOverlay) closeModal();
  });

  // Init
  sound.initFromStorage();
  updateMuteButton();
  document.addEventListener(
    "pointerdown",
    () => sound.unlock(),
    { once: true, passive: true }
  );
  document.addEventListener(
    "keydown",
    () => sound.unlock(),
    { once: true }
  );
  setDieEnabled(false);
  buildHeroSelect();
  setMessage("Pick heroes to begin!");

  window.addEventListener("resize", () => {
    if (state.phase !== "select") requestAnimationFrame(() => drawPathOverlay());
  });
})();

