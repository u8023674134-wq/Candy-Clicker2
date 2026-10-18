(() => {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor("#1a0a2e");
    tg.setBackgroundColor("#1a0a2e");
  }

  const initData = tg?.initData || "";
  const API = "/api";
  const ASSETS = "/assets";

  const coinsEl = document.getElementById("coins");
  const powerEl = document.getElementById("power");
  const passiveEl = document.getElementById("passive");
  const tapBtn = document.getElementById("tap-btn");
  const tapImg = document.getElementById("tap-img");
  const floatContainer = document.getElementById("float-container");
  const shopList = document.getElementById("shop-list");

  let state = { coins: 0, click_power: 1, passive_income: 0, skin: "lollipop" };
  let pendingTaps = 0;
  let flushTimer = null;
  let flushing = false;
  let shopItems = [];
  let shopRefreshTimer = null;
  let buying = false;
  let activeTab = "all";

  // skin id → картинка (кликер / скин)
  const SKIN_IMG = {
    lollipop: ASSETS + "/clicker.png",
    candy: ASSETS + "/skin_candy.png",
    choco: ASSETS + "/skin_choco.png",
    heart: ASSETS + "/skin_heart.png",
    gummy: ASSETS + "/skin_gummy.png",
    peppermint: ASSETS + "/skin_peppermint.png",
    strawberry: ASSETS + "/skin_strawberry.png",
    rainbow: ASSETS + "/skin_rainbow.png",
    gumdrop: ASSETS + "/skin_gumdrop.png",
    swirl: ASSETS + "/skin_swirl.png",
    cat: ASSETS + "/skin_cat.png",
    gingerbread: ASSETS + "/skin_gingerbread.png",
    cupcake: ASSETS + "/skin_cupcake.png",
    panda: ASSETS + "/skin_panda.png",
    raccoon: ASSETS + "/skin_raccoon.png",
    penguin: ASSETS + "/skin_penguin.png",
    bear: ASSETS + "/skin_bear.png",
    bunny: ASSETS + "/skin_bunny.png",
    unicorn: ASSETS + "/skin_unicorn.png",
  };

  // id апгрейда → иконка в магазине
  const ITEM_IMG = {
    shop_candy: ASSETS + "/building_shop_candy.png",
    factory_candy: ASSETS + "/building_factory_candy.png",
    pastry: ASSETS + "/building_pastry.png",
    bakery: ASSETS + "/building_bakery.png",
    fruit_farm: ASSETS + "/building_fruit_farm.png",
    sweet_castle: ASSETS + "/building_sweet_castle.png",
    candy_mine: ASSETS + "/building_candy_mine.png",
    choco_factory: ASSETS + "/building_choco_factory.png",
    space_factory: ASSETS + "/building_space_factory.png",
    click_power: null,
    golden_tap: null,
    rainbow_tap: null,
  };

  const ITEM_EMOJI = {
    click_power: "👆",
    golden_tap: "✨",
    rainbow_tap: "🌈",
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

  function skinSrc(skin) {
    return SKIN_IMG[skin] || SKIN_IMG.lollipop;
  }

  function updateUI() {
    coinsEl.textContent = formatNum(displayCoins());
    powerEl.textContent = "⚡ " + state.click_power;
    passiveEl.textContent = "⏱ " + formatNum(state.passive_income) + "/с";
    tapImg.src = skinSrc(state.skin);
    if (shopRefreshTimer) clearTimeout(shopRefreshTimer);
    shopRefreshTimer = setTimeout(function () {
      if (shopItems.length) renderShop(shopItems);
    }, 120);
  }

  function showFloat(amount) {
    const el = document.createElement("div");
    el.className = "float";
    el.textContent = "+" + amount;
    const rect = tapBtn.getBoundingClientRect();
    el.style.left = rect.width / 2 + (Math.random() - 0.5) * 40 + "px";
    el.style.top = rect.height / 2 - 20 + "px";
    floatContainer.appendChild(el);
    setTimeout(function () { el.remove(); }, 900);
  }

  async function loadMe() {
    try {
      const res = await fetch(API + "/me", { headers: headers() });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      state.coins = data.user.coins;
      state.click_power = data.user.click_power;
      state.passive_income = data.user.passive_income;
      state.skin = data.user.skin || "lollipop";
      shopItems = data.shop || [];
      updateUI();
      renderShop(shopItems);
    } catch (e) {
      console.error("loadMe failed", e);
      shopList.innerHTML = '<p style="color:#ff6b81;padding:12px">Ошибка загрузки. Открой игру через бота.</p>';
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

  async function syncAll() {
    for (let i = 0; i < 5; i++) {
      if (pendingTaps <= 0 && !flushing) break;
      await flushTaps();
      await new Promise(function (r) { setTimeout(r, 80); });
    }
    await loadMe();
  }

  async function buyUpgrade(id) {
    if (buying) return;
    buying = true;
    try {
      await syncAll();
      const item = shopItems.find(function (x) { return x.id === id; });
      const price = item ? item.price : 0;
      if (price > 0 && state.coins + 0.001 < price) {
        alert("Не хватает монет.\nНужно: " + formatNum(price) + "\nЕсть: " + formatNum(state.coins));
        return;
      }
      const res = await fetch(API + "/buy", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ upgrade_id: id }),
      });
      if (!res.ok) {
        alert("Не удалось купить");
        await loadMe();
        return;
      }
      const data = await res.json();
      state.coins = data.user.coins;
      state.click_power = data.user.click_power;
      state.passive_income = data.user.passive_income;
      state.skin = data.user.skin;
      await loadMe();
      if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
    } catch (e) {
      console.error(e);
      alert("Ошибка сети");
    } finally {
      buying = false;
    }
  }

  function iconHtml(item) {
    if (item.type === "skin") {
      const key = item.id.replace("skin_", "");
      const src = SKIN_IMG[key];
      if (src) return '<img src="' + src + '" alt="" />';
    }
    if (ITEM_IMG[item.id]) {
      return '<img src="' + ITEM_IMG[item.id] + '" alt="" />';
    }
    return '<span class="emoji">' + (ITEM_EMOJI[item.id] || "📦") + "</span>";
  }

  function renderShop(items) {
    shopItems = items;
    const coins = displayCoins();
    const filtered =
      activeTab === "all" ? items : items.filter(function (i) { return i.type === activeTab; });

    shopList.innerHTML = "";
    if (!filtered.length) {
      shopList.innerHTML = '<p style="color:#c4a8e0;padding:12px;text-align:center">Пусто</p>';
      return;
    }

    filtered.forEach(function (item) {
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
        btnLabel = formatNum(item.price) + " 🍭";
      }

      const skinName = item.id.replace("skin_", "");
      const disabled =
        maxed ||
        (owned && isSkin && state.skin === skinName) ||
        (!owned && item.price > coins && item.price > 0);

      div.innerHTML =
        '<div class="icon">' + iconHtml(item) + "</div>" +
        '<div class="info">' +
        '<div class="name">' + item.name_ru + "</div>" +
        '<div class="desc">' + (item.description || "") + "</div>" +
        (!isSkin ? '<div class="level">Ур. ' + item.level + "/" + item.max_level + "</div>" : "") +
        "</div>" +
        '<button class="buy-btn ' + (owned ? "owned-btn" : "") + '" ' + (disabled ? "disabled" : "") + ">" +
        btnLabel + "</button>";

      const btn = div.querySelector("button");
      if (!disabled) {
        btn.addEventListener("click", function () { buyUpgrade(item.id); });
      }
      shopList.appendChild(div);
    });
  }

  function onTap(e) {
    e.preventDefault();
    if (buying) return;
    pendingTaps += 1;
    updateUI();
    tapBtn.classList.add("pressed");
    setTimeout(function () { tapBtn.classList.remove("pressed"); }, 80);
    showFloat(state.click_power);
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flushTaps, 250);
  }

  tapBtn.addEventListener("pointerdown", onTap);

  document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      activeTab = tab.getAttribute("data-tab");
      renderShop(shopItems);
    });
  });

  setInterval(function () {
    if (document.hidden || buying) return;
    if (pendingTaps > 0) flushTaps();
    else loadMe();
  }, 4000);

  loadMe();
})();
