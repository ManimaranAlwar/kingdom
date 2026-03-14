/* The Magical Kingdom Quest — client logic */
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
      tagline: "Arrives dramatically. Leaves… also dramatically.",
    },
  ];

  const TILE_TYPES = {
    blank: { icon: icons.blank, label: "Blank" },
    star: { icon: icons.star, label: "Magic Trial" },
    dragon: { icon: icons.dragon, label: "Dragon" },
    crystal: { icon: icons.crystal, label: "Crystal" },
    trap: { icon: icons.trap, label: "Trap" },
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
  ]);

  const biomeFor = (pos) => {
    if (pos <= 8) return { id: "forest", name: "Forest" };
    if (pos <= 12) return { id: "highland", name: "Highland" };
    if (pos <= 24) return { id: "cave", name: "Cave" };
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
    rollBtn: document.getElementById("rollBtn"),
    useRerollBtn: document.getElementById("useRerollBtn"),
    die: document.getElementById("die"),
    currentRing: document.getElementById("currentRing"),
    currentAvatar: document.getElementById("currentAvatar"),
    currentName: document.getElementById("currentName"),
    currentCoins: document.getElementById("currentCoins"),
    currentPos: document.getElementById("currentPos"),
    inventory: document.getElementById("inventory"),
    restartBtn: document.getElementById("restartBtn"),
    playAgainBtn: document.getElementById("playAgainBtn"),
    winnerAvatar: document.getElementById("winnerAvatar"),
    winnerText: document.getElementById("winnerText"),
    confettiHost: document.getElementById("confettiHost"),
    buyWardBtn: document.getElementById("buyWardBtn"),
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

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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

    el.modalOverlay.classList.remove("hidden");
  }

  function closeModal() {
    el.modalOverlay.classList.add("hidden");
  }

  function currentPlayer() {
    return state.players[state.current];
  }

  function countItem(player, item) {
    return player.items.filter((i) => i === item).length;
  }

  function removeOneItem(player, item) {
    const idx = player.items.indexOf(item);
    if (idx >= 0) player.items.splice(idx, 1);
  }

  function updateSidebar() {
    const p = currentPlayer();
    el.currentAvatar.src = p.img;
    el.currentName.textContent = p.name;
    el.currentCoins.innerHTML = `<img class="miniIco" src="${icons.coin}" alt="" />${p.coins}`;
    el.currentPos.innerHTML = `<img class="miniIco" src="${icons.compass}" alt="" />${p.position}`;
    el.currentRing.style.boxShadow = `5px 5px 0 #140a2a, 0 0 0 4px ${p.color} inset`;

    el.buyWardBtn.disabled = !(state.phase === "roll" && p.coins >= 1);
    el.buyShieldBtn.disabled = !(state.phase === "roll" && p.coins >= 2);

    renderInventory();
  }

  function renderInventory() {
    const p = currentPlayer();
    el.inventory.textContent = "";

    const items = [
      { key: "ward", name: "Mystic Ward", icon: icons.ward, desc: "Cancels ONE Trap (stun)." },
      { key: "shield", name: "Dragon-Proof Shield", icon: icons.shield, desc: "Blocks ONE Dragon encounter." },
      { key: "reroll", name: "Reroll Raccoon", icon: icons.reroll, desc: "Lets you reroll once after rolling." },
    ];

    let any = false;
    for (const it of items) {
      const n = countItem(p, it.key);
      if (!n) continue;
      any = true;
      const row = document.createElement("div");
      row.className = "invItem";
      const left = document.createElement("div");
      left.innerHTML = `<div class="invName"><img class="miniIco" src="${it.icon}" alt="" />${it.name} ×${n}</div><div class="invDesc">${it.desc}</div>`;
      row.appendChild(left);
      const right = document.createElement("div");
      right.textContent = "✅";
      row.appendChild(right);
      el.inventory.appendChild(row);
    }

    if (!any) {
      const empty = document.createElement("div");
      empty.className = "invItem";
      empty.innerHTML =
        '<div><div class="invName">Empty Pockets</div><div class="invDesc">Your pockets echo heroically.</div></div>';
      el.inventory.appendChild(empty);
    }

    const canReroll = state.phase === "rolled" && countItem(p, "reroll") > 0;
    el.useRerollBtn.classList.toggle("hidden", !canReroll);
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
          : "Pick 2–4 heroes. (A party of 1 is just… a very motivated introvert.)";
  }

  function tileType(pos) {
    if (pos === 30) return "blank";
    return tileTypeByPos.get(pos) || "blank";
  }

  function buildBoard() {
    state.tileElsByPos.clear();
    el.board.textContent = "";

    for (let pos = 1; pos <= 30; pos++) {
      const row = Math.floor((pos - 1) / 6);
      const colInRow = (pos - 1) % 6;
      const col = row % 2 === 0 ? colInRow : 5 - colInRow;

      const biome = biomeFor(pos);
      const t = tileType(pos);
      const iconSrc = TILE_TYPES[t].icon;

      const tile = document.createElement("div");
      tile.className = `tile tile-${biome.id} ${pos === 30 ? "goal" : ""}`;
      tile.style.gridRow = `${row + 1}`;
      tile.style.gridColumn = `${col + 1}`;
      tile.dataset.pos = String(pos);
      tile.innerHTML = `
        <div class="num">${pos}</div>
        <div class="icon">
          <img class="tileIcon" src="${pos === 30 ? icons.castle : iconSrc}" alt="" />
        </div>
        <div class="biome">${pos === 30 ? "Golden Castle" : biome.name}</div>
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
    for (let pos = 1; pos <= 30; pos++) {
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

    const offsets = [
      { top: 6, left: 6 },
      { top: 6, left: 44 },
      { top: 44, left: 6 },
      { top: 44, left: 44 },
    ];

    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      const tile = state.tileElsByPos.get(p.position);
      if (!tile) continue;
      const tokens = tile.querySelector(".tokens");
      if (!tokens) continue;

      const token = document.createElement("img");
      token.className = "token";
      token.alt = p.name;
      token.src = p.img;
      token.style.outline = `3px solid ${p.color}`;

      const onSame = state.players.filter((x) => x.position === p.position);
      const idx = Math.max(0, Math.min(offsets.length - 1, onSame.findIndex((x) => x === p)));
      const off = offsets[idx];
      token.style.top = `${off.top}px`;
      token.style.left = `${off.left}px`;

      tokens.appendChild(token);
    }
  }

  function startGame() {
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
        items: [],
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
    el.rollBtn.disabled = false;
    setMessage(`${currentPlayer().name}'s turn — roll the die!`);
    updateSidebar();
    chaosMaybe();
  }

  function nextTurn() {
    state.current = (state.current + 1) % state.players.length;
    state.phase = "roll";
    state.lastRoll = null;
    el.rollBtn.disabled = false;
    el.die.textContent = "?";
    el.die.classList.remove("spin");
    updateSidebar();
    highlightCurrentTile();

    chaosMaybe();

    const p = currentPlayer();
    if (p.skip) {
      p.skip = false;
      toast(`${p.name} is stunned and misses a turn. Dramatic sigh!`, "bad");
      setMessage(`${p.name} is stunned — skipping turn!`);
      el.rollBtn.disabled = true;
      setTimeout(() => nextTurn(), 900);
      return;
    }
    setMessage(`${p.name}'s turn — roll the die!`);
  }

  function computeForwardPath(start, steps) {
    const path = [];
    let pos = start;
    for (let i = 0; i < steps; i++) {
      pos += 1;
      if (pos > 30) {
        const over = pos - 30;
        pos = 30 - over;
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

      const tile = state.tileElsByPos.get(p.position);
      const tok = tile?.querySelector(`img.token[alt="${p.name}"]`);
      if (tok) {
        tok.classList.remove("boop");
        // force reflow to restart animation
        void tok.offsetWidth;
        tok.classList.add("boop");
      }
      setTimeout(step, 220);
    };
    step();
  }

  async function rollDice() {
    if (state.phase !== "roll") return;
    const p = currentPlayer();
    el.rollBtn.disabled = true;

    const roll = randInt(1, 6);
    state.lastRoll = roll;
    state.phase = "rolled";

    el.die.classList.remove("spin");
    void el.die.offsetWidth;
    el.die.classList.add("spin");
    el.die.textContent = String(roll);

    setMessage(`${p.name} rolled a ${roll}. The board gasps.`);
    updateSidebar();

    if (state.moveTimer) clearTimeout(state.moveTimer);
    state.moveTimer = setTimeout(() => {
      state.moveTimer = null;
      const path = computeForwardPath(p.position, roll);
      animateMove(path, {
        onDone: () => resolveTile(),
      });
    }, 900);
  }

  function useReroll() {
    if (state.phase !== "rolled") return;
    const p = currentPlayer();
    if (countItem(p, "reroll") <= 0) return;
    removeOneItem(p, "reroll");

    if (state.moveTimer) clearTimeout(state.moveTimer);
    toast("Reroll Raccoon has spoken. The die trembles.", "info");
    state.phase = "roll";
    updateSidebar();
    rollDice();
  }

  async function resolveTile() {
    state.phase = "resolving";
    updateSidebar();

    const p = currentPlayer();
    if (p.position === 30) {
      win();
      return;
    }

    const t = tileType(p.position);
    const biome = biomeFor(p.position);

    const biomeLines = {
      forest: "Forest air smells like pine… and pranksters.",
      highland: "Highland winds whisper: “nice socks.”",
      cave: "Caves echo your bravery. And your squeaky shoes.",
      castle: "Castle stones judge you silently. Harshly.",
    };

    if (t === "blank") {
      toast(`Space ${p.position}: Nothing happens. Suspicious…`, "info");
      setMessage(`${p.name} rests on a blank tile in the ${biome.name}. (${biomeLines[biome.id]})`);
      setTimeout(() => nextTurn(), 650);
      return;
    }

    if (t === "star") {
      setMessage(`${p.name} hit a Star tile! Time for a Magic Trial!`);
      toast("Magic Trial! Answer with confidence (or vibes).", "info");

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
            const path = computeForwardPath(p.position, 2);
            animateMove(path, { onDone: () => resolveTile() });
          } else {
            toast("Wrong! The magic politely judges you. No bonus.", "bad");
            setMessage(`${p.name} answered wrong. The Star sighs. (${biomeLines[biome.id]})`);
            setTimeout(() => nextTurn(), 650);
          }
        });
      });
      return;
    }

    if (t === "crystal") {
      setMessage(`${p.name} found a Crystal tile! Loot time!`);
      toast("Crystal Loot! Summoning a card…", "info");

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
      setMessage(`${p.name} met a Dragon. It looks… argumentative.`);
      toast("Dragon Encounter! It challenges you to a snack-off.", "bad");

      const canShield = countItem(p, "shield") > 0;
      const canBribe = p.coins >= 2;
      const btns = [];

      if (canShield) {
        btns.push({
          label: "Use Shield",
          className: "btn btn-mini btn-green",
          onClick: () => {
            removeOneItem(p, "shield");
            closeModal();
            toast("Shield deployed. The dragon bonks itself. You proceed.", "good");
            setTimeout(() => nextTurn(), 650);
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
            updateSidebar();
            setTimeout(() => nextTurn(), 650);
          },
        });
      }

      btns.push({
        label: "Take -3",
        className: "btn btn-mini btn-red",
        onClick: () => {
          closeModal();
          toast("The dragon SHOOOS you backward. (-3)", "bad");
          const path = computeBackwardPath(p.position, 3);
          animateMove(path, { onDone: () => resolveTile() });
        },
      });

      showModal({
        title: "Dragon Encounter!",
        body: `<div>The dragon says: “I am very scary.” You say: “I am very… mobile.”</div>
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

      const canWard = countItem(p, "ward") > 0;
      const canDisarm = p.coins >= 1;

      const btns = [];
      if (canWard) {
        btns.push({
          label: "Use Ward",
          className: "btn btn-mini btn-blue",
          onClick: () => {
            removeOneItem(p, "ward");
            closeModal();
            toast("Mystic Ward pops! Trap defeated by sparkly bureaucracy.", "good");
            updateSidebar();
            setTimeout(() => nextTurn(), 650);
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
            updateSidebar();
            setTimeout(() => nextTurn(), 650);
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
          updateSidebar();
          setTimeout(() => nextTurn(), 650);
        },
      });

      showModal({
        title: "Trap!",
        body: `<div>You are trapped by… the ancient curse of inconvenient timing.</div>
              <div style="margin-top:10px;opacity:.95;font-weight:900">
                Use a Ward, disarm for 1 coin, or accept the stun and practice your fainting pose.
              </div>`,
        buttons: btns,
      });
      return;
    }

    toast("This tile is so mysterious it forgot its own type.", "info");
    setTimeout(() => nextTurn(), 650);
  }

  function applyCard(card) {
    const p = currentPlayer();
    if (card.type === "move") {
      toast(`Card effect: move +${card.value}!`, "good");
      setMessage(`${p.name} uses ${card.name}. ZOOM +${card.value}!`);
      const path = computeForwardPath(p.position, card.value);
      animateMove(path, { onDone: () => resolveTile() });
      return;
    }
    if (card.type === "coins") {
      p.coins += Number(card.value || 0);
      toast(`Card effect: +${card.value} coins!`, "good");
      setMessage(`${p.name} gains coins. The economy applauds.`);
      updateSidebar();
      setTimeout(() => nextTurn(), 650);
      return;
    }
    if (card.type === "item") {
      const item = card.item;
      p.items.push(item);
      toast(`Item acquired: ${card.name}!`, "good");
      setMessage(`${p.name} pockets a magical item. It sparkles ominously.`);
      updateSidebar();
      setTimeout(() => nextTurn(), 650);
      return;
    }

    toast("The card is… confusing. But in a fun way.", "info");
    setTimeout(() => nextTurn(), 650);
  }

  function buyItem(item, cost) {
    const p = currentPlayer();
    if (state.phase !== "roll") {
      toast("Shop is only open before you roll. The cashier is very strict.", "bad");
      return;
    }
    if (p.coins < cost) {
      toast("Not enough coins. Consider performing a dramatic side quest.", "bad");
      return;
    }
    p.coins -= cost;
    p.items.push(item);
    toast(`Purchased: ${item}!`, "good");
    updateSidebar();
  }

  function win() {
    state.phase = "ended";
    const p = currentPlayer();
    el.winnerAvatar.src = p.img;
    el.winnerText.innerHTML = `<span style="color:${p.color}">${p.name}</span> snatches the Magic Crown and yells “I DID A QUEST!”`;

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
  el.startBtn.addEventListener("click", startGame);
  el.rollBtn.addEventListener("click", rollDice);
  el.die.addEventListener("click", rollDice);
  el.useRerollBtn.addEventListener("click", useReroll);
  el.restartBtn.addEventListener("click", restart);
  el.playAgainBtn.addEventListener("click", restart);

  el.buyWardBtn.addEventListener("click", () => buyItem("ward", 1));
  el.buyShieldBtn.addEventListener("click", () => buyItem("shield", 2));

  el.modalOverlay.addEventListener("click", (e) => {
    if (e.target === el.modalOverlay) closeModal();
  });

  // Init
  buildHeroSelect();
  setMessage("Pick heroes to begin!");

  window.addEventListener("resize", () => {
    if (state.phase !== "select") requestAnimationFrame(() => drawPathOverlay());
  });
})();
