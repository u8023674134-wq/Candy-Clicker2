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

  const coinsEl = document.getElementById("coins");
  const powerEl = document.getElementById("power");
  const passiveEl = document.getElementById("passive");
  const tapBtn = document.getElementById("tap-btn");
  const tapEmoji = document.getElementById("tap-emoji");
  const floatContainer = document.getElementById("float-container");
  const shopList = document.getElementById("shop-list");

  let state = {
    coins: 0,
    click_power: 1,
    passive_income: 0,
    skin: "candy",
  };

  let pendingTaps = 0;
  let flushTimer = null;
  let flushing = false;
  let lastLocalPassive = Date.now();

  const SKIN_EMOJI = {
    candy: "🍬",
    cookie: "🍪",
    star: "⭐",
    rocket: "🚀",
  };

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

  function displayCoins() {
    return state.coins + pendingTaps * state.click_power;
  }

  function updateUI() {
    coinsEl.textContent = formatNum(displayCoins());
    powerEl.textContent = "⚡ " + state.click_power;
    passiveEl.textContent = "⏱ " + formatNum(state.passive_income) + "/с";
    tapEmoji.textContent = SKIN_EMOJI[state.skin] || "🍬";
    tapBtn.className = "tap-btn skin-" + (state.skin || "candy");
  }

  function showFloat(amount) {
    const el = document.createElement("div");
    el.className = "float";
    el.textContent = "+" + amount;
    const rect = tapBtn.getBoundingClientRect();
    el.style.left = rect.width / 2 + (Math.random() - 0.5) * 40 + "px";
    el.style.top = rect.height / 2 - 20 + "px";
    floatContainer.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 900);
  }

  async function loadMe() {
    try {
      const res = await fetch(API + "/me", { headers: headers() });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      state.coins = data.user.coins;
      state.click_power = data.user.click_power;
      state.passive_income = data.user.passive_income;
      state.skin = data.user.skin;
      updateUI();
      renderShop(data.shop || []);
    } catch (e) {
      console.error("loadMe failed", e);
      shopList.innerHTML =
        '<p style="color:#f87171;padding:12px">Ошибка загрузки. Открой игру через бота.</p>';
    }
  }

  async function flushTaps() {
    if (pendingTaps <= 0 || flushing) return;
    flushing = true;
    const count = pendingTaps;
    pendingTaps = 0;
    try {
      const res = await fetch(API + "/tap", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ count: count }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      state.coins = data.coins;
      state.click_power = data.click_power;
      updateUI();
    } catch (e) {
      console.error("tap flush failed", e);
      pendingTaps += count;
      updateUI();
    } finally {
      flushing = false;
    }
  }

  async function buyUpgrade(id) {
    await flushTaps();
    try {
      const res = await fetch(API + "/buy", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ upgrade_id: id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(function () {
          return {};
        });
        alert(
          err.detail === "not_enough_coins"
            ? "Не хватает монет"
            : "Не удалось купить"
        );
        return;
      }
      const data = await res.json();
      state.coins = data.user.coins;
      state.click_power = data.user.click_power;
      state.passive_income = data.user.passive_income;
      state.skin = data.user.skin;
      updateUI();
      await loadMe();
      if (tg && tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred("success");
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка сети");
    }
  }

  const TYPE_ICON = { click: "👆", passive: "⏱", skin: "🎨" };

  function renderShop(items) {
    shopList.innerHTML = "";
    items.forEach(function (item) {
      const isSkin = item.type === "skin";
      const owned = isSkin && item.level > 0;
      const maxed = item.level >= item.max_level;
      const div = document.createElement("div");
      div.className = "shop-item" + (owned ? " owned" : "");

      let btnLabel;
      if (owned && isSkin) {
        btnLabel =
          state.skin === item.id.replace("skin_", "") ? "Надет" : "Надеть";
      } else if (maxed) {
        btnLabel = "Макс";
      } else if (item.price === 0) {
        btnLabel = "Бесплатно";
      } else {
        btnLabel = formatNum(item.price) + " 🍬";
      }

      const skinName = item.id.replace("skin_", "");
      const disabled =
        maxed ||
        (owned && isSkin && state.skin === skinName) ||
        (!owned && item.price > displayCoins() && item.price > 0);

      div.innerHTML =
        '<div class="icon">' +
        (TYPE_ICON[item.type] || "📦") +
        "</div>" +
        '<div class="info">' +
        '<div class="name">' +
        item.name_ru +
        "</div>" +
        '<div class="desc">' +
        (item.description || "") +
        "</div>" +
        (!isSkin
          ? '<div class="level">Ур. ' +
            item.level +
            "/" +
            item.max_level +
            "</div>"
          : "") +
        "</div>" +
        '<button class="buy-btn ' +
        (owned ? "owned-btn" : "") +
        '" data-id="' +
        item.id +
        '" ' +
        (disabled ? "disabled" : "") +
        ">" +
        btnLabel +
        "</button>";

      const btn = div.querySelector("button");
      if (!disabled) {
        btn.addEventListener("click", function () {
          buyUpgrade(item.id);
        });
      }
      shopList.appendChild(div);
    });
  }

  function onTap(e) {
    e.preventDefault();
    const power = state.click_power;
    pendingTaps += 1;
    updateUI();

    tapBtn.classList.add("pressed");
    setTimeout(function () {
      tapBtn.classList.remove("pressed");
    }, 80);
    showFloat(power);
    if (tg && tg.HapticFeedback) {
      tg.HapticFeedback.impactOccurred("light");
    }

    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flushTaps, 350);
  }

  tapBtn.addEventListener("pointerdown", onTap);

  setInterval(function () {
    if (state.passive_income <= 0) return;
    const now = Date.now();
    const dt = (now - lastLocalPassive) / 1000;
    lastLocalPassive = now;
    state.coins += state.passive_income * dt;
    updateUI();
  }, 500);

  setInterval(function () {
    flushTaps().then(function () {
      loadMe();
    });
  }, 20000);

  loadMe();
})();
