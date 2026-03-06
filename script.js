/*
  Asset-only birthday catch game.

  Edit these values only:
  - girlfriendName: change display name
  - targetScore: points to win
  - startingLives: number of hearts
  - spawnInterval: ms between spawns
  - baseFallSpeed / speedIncreasePerPoint: difficulty tuning
  - secretMessage: edit the modal text
*/

const GAME_CONFIG = {
  girlfriendName: "Alisha", // rename here
  targetScore: 23,           // change win score here
  startingLives: 5,          // change lives here
  spawnInterval: 1200,       // tune spawn here (ms)
  baseFallSpeed: 2.4,        // tune difficulty here
  speedIncreasePerPoint: 0.05,
  secretMessage: `Happy Birthday my dear Alisha!

My dear Alisha,

I am truly grateful that I met you, and I’m so glad you were born because the world would have missed an angel like you. You are kind, sweet, and compassionate, and you bring happiness to everyone whose life you become a part of.

Your presence makes people feel warm, valued, and cared for, and that is such a beautiful thing.

On your birthday, I just want to wish you all the happiness in the world. I hope this year brings you closer to all your dreams and goals. May every step you take lead you toward the amazing future you deserve .

Love you always,
 Yours Bhargav` // edit message here
};

(() => {
  "use strict";

  const ASSETS = {
    characters: [
      "assets/sanrio character 1.png",
      "assets/sanrio character 2.png",
      "assets/sanrio character 3.png"
    ],
    cloud: "assets/cloud.png",
    basket: "assets/basket.png"
  };

  const screens = {
    start: document.getElementById("screen-start"),
    game: document.getElementById("screen-game"),
    win: document.getElementById("screen-win")
  };

  const startBtn = document.getElementById("start-btn");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const girlfriendNameEl = document.getElementById("girlfriend-name");

  const gameArea = document.getElementById("game-area");
  const cloudEl = document.getElementById("cloud");
  const basketEl = document.getElementById("basket");
  const fallingLayer = document.getElementById("falling-layer");

  const overlayGameOver = document.getElementById("overlay-gameover");
  const retryBtn = document.getElementById("retry-btn");
  const backStartBtn = document.getElementById("back-start-btn");

  const winPhoto = document.getElementById("win-photo");
  const winPhotoFallback = document.getElementById("win-photo-fallback");
  const confettiEl = document.getElementById("confetti");

  const secretBtn = document.getElementById("secret-btn");
  const modal = document.getElementById("modal");
  const modalClose = document.getElementById("modal-close");
  const secretMessage = document.getElementById("secret-message");

  let score = 0;
  let lives = GAME_CONFIG.startingLives;
  let running = false;

  /** @type {{ el: HTMLImageElement, x: number, y: number, vy: number, w: number, h: number }[]} */
  let items = [];

  let spawnTimer = null;
  let rafId = null;

  let targetBasketX = 0;
  let keyLeft = false;
  let keyRight = false;

  function showScreen(which) {
    Object.entries(screens).forEach(([key, el]) => {
      el.classList.toggle("is-active", key === which);
    });
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function setScore(v) {
    score = v;
    scoreEl.textContent = String(score);
  }

  function setLives(v) {
    lives = v;
    renderLives();
  }

  function renderLives() {
    const total = GAME_CONFIG.startingLives;
    let html = "";
    for (let i = 0; i < total; i++) {
      const off = i >= lives;
      html += `<span class="${off ? "life-off" : ""}">♥</span>`;
    }
    livesEl.innerHTML = html;
  }

  function updateGirlfriendName() {
    girlfriendNameEl.textContent = `${GAME_CONFIG.girlfriendName.toUpperCase()} :)`;
    document.title = `Happy Birthday ${GAME_CONFIG.girlfriendName}`;
  }

  function setBasketXFromClientX(clientX) {
    const area = gameArea.getBoundingClientRect();
    const basketRect = basketEl.getBoundingClientRect();
    const desiredLeft = clientX - area.left - basketRect.width / 2;
    const minLeft = 0;
    const maxLeft = area.width - basketRect.width;
    const left = clamp(desiredLeft, minLeft, Math.max(minLeft, maxLeft));
    basketEl.style.left = `${left}px`;
    basketEl.style.transform = "translateX(0)";
  }

  function setTargetBasketXFromClientX(clientX) {
    targetBasketX = clientX;
  }

  function clearItems() {
    items.forEach((it) => it.el.remove());
    items = [];
  }

  function spawnItem() {
    if (!running) return;

    const area = gameArea.getBoundingClientRect();
    const cloudRect = cloudEl.getBoundingClientRect();

    const spawnXMin = cloudRect.left - area.left + cloudRect.width * 0.2;
    const spawnXMax = cloudRect.left - area.left + cloudRect.width * 0.8;

    const src = ASSETS.characters[Math.floor(Math.random() * ASSETS.characters.length)];

    const el = document.createElement("img");
    el.className = "falling-item";
    el.src = src;
    el.alt = "Falling character";
    el.draggable = false;
    fallingLayer.appendChild(el);

    const baseSize = Math.min(area.width * 0.18, 110);
    el.style.width = `${baseSize}px`;

    const startX = clamp(Math.random() * (spawnXMax - spawnXMin) + spawnXMin, 0, area.width - baseSize);
    const startY = clamp(cloudRect.bottom - area.top - baseSize * 0.2, 0, area.height * 0.35);

    const speed = GAME_CONFIG.baseFallSpeed + score * GAME_CONFIG.speedIncreasePerPoint;

    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;

    items.push({ el, x: startX, y: startY, vy: speed, w: baseSize, h: baseSize });
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function getBasketCatchZone() {
    const area = gameArea.getBoundingClientRect();
    const b = basketEl.getBoundingClientRect();
    const x = b.left - area.left;
    const y = b.top - area.top;
    const catchX = x + b.width * 0.16;
    const catchW = b.width * 0.68;
    const catchY = y + b.height * 0.05;
    const catchH = b.height * 0.32;
    return { x: catchX, y: catchY, w: catchW, h: catchH };
  }

  function getItemCatchRect(item) {
    const ix = item.x;
    const iy = item.y + item.h * 0.35;
    const iw = item.w;
    const ih = item.h * 0.65;
    return { x: ix, y: iy, w: iw, h: ih };
  }

  function gameLoop() {
    if (!running) return;

    const area = gameArea.getBoundingClientRect();

    const basketRect = basketEl.getBoundingClientRect();
    const basketCenter = basketRect.left + basketRect.width / 2;
    if (keyLeft || keyRight) {
      const step = Math.max(5, area.width * 0.012);
      const dir = (keyRight ? 1 : 0) - (keyLeft ? 1 : 0);
      setTargetBasketXFromClientX(basketCenter + dir * step);
    }

    if (targetBasketX) {
      setBasketXFromClientX(targetBasketX);
    }

    const catchZone = getBasketCatchZone();

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy;
      it.el.style.top = `${it.y}px`;

      const itemRect = getItemCatchRect(it);

      if (rectsOverlap(itemRect, catchZone)) {
        it.el.remove();
        items.splice(i, 1);
        setScore(score + 1);
        if (score >= GAME_CONFIG.targetScore) {
          win();
          return;
        }
        continue;
      }

      if (it.y > area.height + 40) {
        it.el.remove();
        items.splice(i, 1);
        setLives(lives - 1);
        if (lives <= 0) {
          gameOver();
          return;
        }
      }
    }

    rafId = requestAnimationFrame(gameLoop);
  }

  function startConfetti() {
    confettiEl.innerHTML = "";
    const colors = ["#ff3b30", "#34c759", "#007aff", "#ffcc00", "#af52de", "#ff2d55"];
    const count = 90;
    const width = window.innerWidth;

    for (let i = 0; i < count; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.top = "-20px";
      piece.style.opacity = String(0.8 + Math.random() * 0.2);

      const sizeW = 6 + Math.random() * 8;
      const sizeH = 8 + Math.random() * 12;
      piece.style.width = `${sizeW}px`;
      piece.style.height = `${sizeH}px`;

      const drift = (Math.random() - 0.5) * Math.max(120, width * 0.25);
      const rot = (Math.random() - 0.5) * 720;
      const duration = 2600 + Math.random() * 2200;
      const delay = Math.random() * 500;

      confettiEl.appendChild(piece);

      setTimeout(() => {
        piece.style.transition = `transform ${duration}ms linear, top ${duration}ms linear`;
        piece.style.transform = `translateX(${drift}px) rotate(${rot}deg)`;
        piece.style.top = "110%";
      }, delay);
    }
  }

  function stop() {
    running = false;
    if (spawnTimer) {
      clearInterval(spawnTimer);
      spawnTimer = null;
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function start() {
    overlayGameOver.classList.add("overlay-hidden");
    clearItems();
    setScore(0);
    setLives(GAME_CONFIG.startingLives);
    showScreen("game");

    basketEl.style.left = "50%";
    basketEl.style.transform = "translateX(-50%)";

    requestAnimationFrame(() => {
      setTargetBasketXFromClientX(window.innerWidth / 2);
      setBasketXFromClientX(window.innerWidth / 2);
    });

    running = true;
    spawnTimer = setInterval(spawnItem, GAME_CONFIG.spawnInterval);
    spawnItem();
    rafId = requestAnimationFrame(gameLoop);
  }

  function gameOver() {
    stop();
    overlayGameOver.classList.remove("overlay-hidden");
  }

  function win() {
    stop();
    showScreen("win");
    startConfetti();
  }

  function openModal() {
    modal.classList.remove("overlay-hidden");
  }

  function closeModal() {
    modal.classList.add("overlay-hidden");
  }

  winPhoto.addEventListener("error", () => {
    winPhoto.style.display = "none";
    winPhotoFallback.style.display = "grid";
  });

  startBtn.addEventListener("click", start);
  retryBtn.addEventListener("click", start);
  backStartBtn.addEventListener("click", () => {
    stop();
    overlayGameOver.classList.add("overlay-hidden");
    showScreen("start");
  });

  secretBtn.addEventListener("click", openModal);
  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") keyLeft = true;
    if (e.key === "ArrowRight") keyRight = true;
    if (e.key === "Escape") closeModal();
  });

  document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") keyLeft = false;
    if (e.key === "ArrowRight") keyRight = false;
  });

  gameArea.addEventListener("mousemove", (e) => {
    if (!running) return;
    setTargetBasketXFromClientX(e.clientX);
  });

  let dragging = false;
  gameArea.addEventListener("pointerdown", (e) => {
    if (!running) return;
    dragging = true;
    gameArea.setPointerCapture(e.pointerId);
    setTargetBasketXFromClientX(e.clientX);
  });

  gameArea.addEventListener("pointermove", (e) => {
    if (!running || !dragging) return;
    setTargetBasketXFromClientX(e.clientX);
  });

  gameArea.addEventListener("pointerup", () => {
    dragging = false;
  });

  gameArea.addEventListener("pointercancel", () => {
    dragging = false;
  });

  cloudEl.src = ASSETS.cloud;
  basketEl.src = ASSETS.basket;

  secretMessage.value = GAME_CONFIG.secretMessage;
  updateGirlfriendName();
  renderLives();
  showScreen("start");
})();
