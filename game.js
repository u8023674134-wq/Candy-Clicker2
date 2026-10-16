(() => {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor("#0f0f13");
    tg.setBackgroundColor("#0f0f13");
  }

  const initData = tg?.initData || "";
  const API = "/api";

  // DOM
  const coinsEl = document.getElementById("coins");
  const powerEl = document.getElementById("power");
  const passiveEl = document.getElementById("passive");
  const tapBtn = document.getElementById("tap-btn");
  const tapEmoji = document.getElementById("tap-emoji");
  const floatContainer = document.getElementById("float-container");
  const shopList = document.getElementById("shop-list");

  // State
  let state = {
    coins: 0,
    click_power: 1,
    passive_income: 0,
    skin: "candy",
  };

  let pendingTaps = 0;
  let flushTimer = null;
  let lastLocalPassive = Date.now();

  const SKIN_EMOJI = {
    candy: "🍬",
    cookie: "🍪",
    star: "⭐",
    rocket: "🚀",
  };

  // ── helpers ────────────────────────────────────────────────────────────

  function headers() {
    return {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": initData,
    };
  }

  function formatNum(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
    if (n >= 10_000) return (n / 1_000).toFixed(1) + "K";
    if (n >= 1000) return (n / 1_000).toFixed(2) + "K";
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  function updateUI() {
    coinsEl.textContent = formatNum(state.coins);
    powerEl.textContent = `⚡ ${state.click_power}`;
    passiveEl.textContent = `⏱ ${formatNum(state.passive_income)}/с`;
    tapEmoji.textContent = SKIN_EMOJI[state.skin] || "🍬";
    tapBtn.className = "tap-btn skin-" + (state.skin || "candy");
  }

  function showFloat(amount, x, y) {
    const el = document.createElement("div");
    el.className = "float";
    el.textContent = `+${amount}`;
    el.style.left = x + "px";
    el.style.top = y + "px";
    floatContainer.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  // ── API ────────────────────────────────────────────────────────────────

  async function loadMe() {
    try {
      const res = await fetch(`${API}/me`, { headers: headers() });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      state = { ...state, ...data.user };
      if (data.passive_earned > 0) {
        // можно показать тост
      }
      updateUI();
      renderShop(data.shop || []);
    } catch (e) {
      console.error("loadMe failed", e);
      shopList.innerHTML = `<p style="color:#f87171;padding:12px">Ошибка загрузки. Открой игру через бота.</p>`;
    }
  }

  async function flushTaps() {
    if (pendingTaps <= 0) return;
    const count = pendingTaps;
    pendingTaps = 0;
    try {
      const res = await fetch(`${API}/tap`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ count }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      state.coins = data.coins;
      state.click_power = data.click_power;
      updateUI();
    } catch (e) {
      console.error("tap flush failed", e);
      // вернём тапы обратно, чтобы не потерять
      pendingTaps += count;
    }
  }

  async function buyUpgrade(id) {
    try {
      const res = await fetch(`${API}/buy`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ upgrade_id: id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail === "not_enough_coins" ? "Не хватает монет 😢" : "Не удалось купить");
        return;
      }
      const data = await res.json();
      state = { ...state, ...data.user };
      updateUI();
      // перезагружаем магазин
      await loadMe();
      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
    } catch (e) {
      console.error(e);
      alert("Ошибка сети");
    }
  }

  // ── Shop render ────────────────────────────────────────────────────────

  const TYPE_ICON = {
    click: "👆",
    passive: "⏱",
    skin: "🎨",
  };

  function renderShop(items) {
    shopList.innerHTML = "";
    items.forEach((item) => {
      const isSkin = item.type === "skin";
      const owned = isSkin && item.level > 0;
      const maxed = item.level >= item.max_level;

      const div = document.createElement("div");
      div.className = "shop-item" + (owned ? " owned" : "");

      let btnLabel;
      if (owned && isSkin) {
        btnLabel = state.skin === item.id.replace("skin_", "") ? "Надет" : "Надеть";
      } else if (maxed) {
        btnLabel = "Макс";
      } else if (item.price === 0) {
        btnLabel = "Бесплатно";
      } else {
        btnLabel = `${formatNum(item.price)} 🍬`;
      }

      const disabled = maxed || (owned && isSkin && state.skin === item.id.replace("skin_", "")) || (!owned && item.price > state.coins && item.price > 0);

      div.innerHTML = `
        <div class="icon">${TYPE_ICON[item.type] || "📦"}</div>
        <div class="info">
          <div class="name">${item.name_ru}</div>
          <div class="desc">${item.description || ""}</div>
          ${!isSkin ? `<div class="level">Ур. ${item.level}/${item.max_level}</div>` : ""}
        </div>
        <button class="buy-btn ${owned ? "owned-btn" : ""}" data-id="${item.id}" ${disabled ? "disabled" : ""}>
          ${btnLabel}
        </button>
      `;

      const btn = div.querySelector("button");
      if (!disabled) {
        btn.addEventListener("click", () => {
          if (isSkin && owned) {
            // просто переключаем скин (уже куплен)
            state.skin = item.id.replace("skin_", "");
            updateUI();
            // бэкенд уже поставил скин при покупке, для уже купленных можно дернуть buy снова (он max_level=1)
            // или отдельный endpoint — для простоты buy сработает как "уже макс"
            buyUpgrade(item.id); // безопасно: max_level
          } else {
            buyUpgrade(item.id);
          }
        });
      }

      shopList.appendChild(div);
    });
  }

  // ── Tap handling ───────────────────────────────────────────────────────

  function onTap(e) {
    e.preventDefault();
    const power = state.click_power;
    state.coins += power;
    pendingTaps += 1;
    updateUI();

    // визуал
    tapBtn.classList.add("pressed");
    setTimeout(() => tapBtn.classList.remove("pressed"), 80);

    const rect = tapBtn.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left + rect.width / 2 - 20;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top + 20;
    // упрощённо — в центре кнопки
    const cx = rect.width / 2 + (Math.random() - 0.5) * 40;
    const cy = rect.height / 2 - 20;
    showFloat(power, cx, cy);

    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("light");

    // батчим отправку
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flushTaps, 400);
  }

  tapBtn.addEventListener("pointerdown", onTap);

  // локальный пассивный тик (для красоты UI)
  setInterval(() => {
    if (state.passive_income <= 0) return;
    const now = Date.now();
    const dt = (now - lastLocalPassive) / 1000;
    lastLocalPassive = now;
    state.coins += state.passive_income * dt;
    updateUI();
  }, 250);

  // периодический синк
  setInterval(() => {
    flushTaps();
    loadMe();
  }, 15000);

  // старт
  loadMe();
})();
