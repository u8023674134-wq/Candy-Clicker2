(() => {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    try { tg.disableVerticalSwipes(); } catch (e) {}
    try { tg.setHeaderColor("#2b1240"); } catch (e) {}
    try { tg.setBackgroundColor("#2b1240"); } catch (e) {}
  }

  const initData = tg?.initData || "";
  const API = "/api";
  const ASSETS = "/assets";
  const $ = (id) => document.getElementById(id);

  const coinsEl = $("coins"), powerEl = $("power"), passiveEl = $("passive");
  const tapBtn = $("tap-btn"), tapImg = $("tap-img");
  const world = $("world"), stage = $("stage");
  const slotsEl = $("slots"), popsEl = $("pops"), floatBox = $("float-container");
  const shopList = $("shop-list"), panel = $("panel"), panelTitle = $("panel-title"), toastEl = $("toast");

  let state = { coins: 0, click_power: 1, passive_income: 0, skin: "lollipop" };
  let pendingTaps = 0, flushTimer = null, flushing = false;
  let shopItems = [], buying = false, activePanel = "home";
  let justBuilt = null, worldSig = "", shopSig = "";

  const SKINS = ["lollipop", "candy", "choco", "heart", "gummy", "peppermint", "strawberry", "rainbow",
    "gumdrop", "swirl", "cat", "gingerbread", "cupcake", "panda", "raccoon", "penguin", "bear", "bunny", "unicorn"];
  const SKIN_IMG = {};
  SKINS.forEach((s) => { SKIN_IMG[s] = ASSETS + (s === "lollipop" ? "/clicker.png" : "/skin_" + s + ".png"); });

  // Участки базы: x/y — % сцены (точка под зданием). Дальние выше, ближние ниже.
  const b = (n) => ASSETS + "/building_" + n + ".png";
  const SLOTS = {
    space_factory: { img: b("space_factory"), x: 50, y: 20 },
    sweet_castle:  { img: b("sweet_castle"),  x: 24, y: 31 },
    choco_factory: { img: b("choco_factory"), x: 76, y: 31 },
    candy_mine:    { img: b("candy_mine"),    x: 14, y: 52 },
    fruit_farm:    { img: b("fruit_farm"),    x: 86, y: 52 },
    pastry:        { img: b("pastry"),        x: 20, y: 72 },
    bakery:        { img: b("bakery"),        x: 80, y: 72 },
    shop_candy:    { img: b("shop_candy"),    x: 36, y: 90 },
    factory_candy: { img: b("factory_candy"), x: 64, y: 90 },
  };

  const ITEM_EMOJI = { click_power: "👆", golden_tap: "✨", rainbow_tap: "🌈" };
  const PANEL_TITLE = { shop: "Здания", click: "Сила клика", skins: "Скины" };
  const PANEL_FILTER = { shop: "passive", click: "click", skins: "skin" };

  const headers = () => ({ "Content-Type": "application/json", "X-Telegram-Init-Data": initData });

  function fmt(n) {
    n = Number(n) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e4) return (n / 1e3).toFixed(1) + "K";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(n < 10 ? 1 : 0);
  }
  const displayCoins = () => state.coins + pendingTaps * state.click_power;
  const coinImg = '<img src="' + ASSETS + '/coin.png" alt="" />';

  function toast(msg, err) {
    toastEl.textContent = msg;
    toastEl.classList.toggle("err", !!err);
    toastEl.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  function fit() {
    const u = Math.min(world.clientWidth / 100, (world.clientHeight - 24) / 122);
    stage.style.setProperty("--u", Math.max(u, 2) + "px");
    document.documentElement.style.setProperty("--u", Math.max(u, 2) + "px");
  }
  new ResizeObserver(fit).observe(world);
  fit();

  function updateHud() {
    coinsEl.textContent = fmt(Math.floor(displayCoins()));
    powerEl.textContent = "⚡ " + state.click_power;
    passiveEl.textContent = "+" + fmt(state.passive_income) + "/с";
    const src = SKIN_IMG[state.skin] || SKIN_IMG.lollipop;
    if (tapImg.getAttribute("src") !== src) tapImg.src = src;
  }

  // ── Карта ──
  function passiveItems() { return shopItems.filter((i) => i.type === "passive" && SLOTS[i.id]); }
  const canAfford = (it) => it.level < it.max_level && (it.price === 0 || displayCoins() + 0.001 >= it.price);

  function renderWorld(force) {
    const items = passiveItems();
    const sig = items.map((i) => i.id + ":" + i.level + ":" + (canAfford(i) ? 1 : 0)).join("|") + "|" + justBuilt;
    if (!force && sig === worldSig) return;
    worldSig = sig;

    const ownedAny = items.some((i) => i.level > 0);
    const cheapest = items.slice().sort((a, c) => a.price - c.price)[0];
    slotsEl.innerHTML = "";

    items.forEach((it) => {
      const c = SLOTS[it.id], lvl = Number(it.level) || 0, ok = canAfford(it);
      const el = document.createElement("button");
      el.className = "slot " + (lvl ? "built" : "locked") + (!lvl && ok ? " ready" : "") +
        (it.id === justBuilt ? " fresh" : "") + (!ownedAny && cheapest && cheapest.id === it.id ? " hint" : "");
      el.style.left = c.x + "%";
      el.style.top = c.y + "%";
      el.style.zIndex = String(Math.round(c.y * 10));
      el.setAttribute("aria-label", it.name_ru);
      el.innerHTML =
        (lvl ? "" : '<span class="pad"></span>') +
        '<img class="bimg" src="' + c.img + '" alt="" draggable="false" />' +
        (lvl ? '<span class="lvl">' + lvl + "</span>" : "") +
        (lvl && ok ? '<span class="up">▲</span>' : "") +
        '<span class="inc">' + (lvl ? "+" + fmt(it.effect * lvl) + "/с" : coinImg + fmt(it.price)) + "</span>";
      el.addEventListener("click", () => openPanel("shop", it.id));
      slotsEl.appendChild(el);
    });
    justBuilt = null;
  }

  // Монетки над зданиями: каждое здание действительно приносит effect*level в секунду
  function spawnPop() {
    if (document.hidden) return;
    const owned = passiveItems().filter((i) => i.level > 0);
    if (!owned.length) return;
    const it = owned[Math.floor(Math.random() * owned.length)];
    const c = SLOTS[it.id];
    const el = document.createElement("div");
    el.className = "pop";
    el.style.left = c.x + "%";
    el.style.top = "calc(" + c.y + "% - " + (27 * 0.8) + " * var(--u))";
    el.innerHTML = coinImg + "+" + fmt(it.effect * it.level);
    popsEl.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  // ── Магазин ──
  function iconHtml(it) {
    if (it.type === "skin") {
      const k = it.id.replace("skin_", "");
      if (SKIN_IMG[k]) return '<img src="' + SKIN_IMG[k] + '" alt="" />';
    }
    if (SLOTS[it.id]) return '<img src="' + SLOTS[it.id].img + '" alt="" />';
    return ITEM_EMOJI[it.id] || "📦";
  }

  function renderShop(focusId) {
    const filter = PANEL_FILTER[activePanel];
    if (!filter) return;
    const coins = displayCoins();
    const list = shopItems.filter((i) => i.type === filter);
    shopList.classList.toggle("grid", filter === "skin");
    shopList.innerHTML = "";
    if (!list.length) {
      shopList.innerHTML = '<p style="color:#8a6aa3;padding:16px;text-align:center">Пока пусто</p>';
      return;
    }
    list.forEach((it) => {
      const isSkin = it.type === "skin";
      const skinName = it.id.replace("skin_", "");
      const owned = isSkin && it.level > 0;
      const wearing = owned && state.skin === skinName;
      const maxed = it.level >= it.max_level;
      const afford = it.price === 0 || coins + 0.001 >= it.price;
      const canClick = owned ? !wearing : (!maxed && afford);

      let label, sub = "", cls = "";
      if (owned) { label = wearing ? "Надет" : "Надеть"; cls = wearing ? "on" : "equip"; }
      else if (maxed) { label = "Макс"; }
      else if (it.price === 0) { label = "Бесплатно"; }
      else if (isSkin) { label = "Купить"; sub = coinImg + fmt(it.price); }
      else { label = it.level > 0 ? "Улучшить" : (filter === "passive" ? "Построить" : "Купить"); sub = coinImg + fmt(it.price); }

      let stat = "";
      if (it.type === "passive") {
        stat = it.level > 0
          ? "Ур. " + it.level + "/" + it.max_level + " — <b>+" + fmt(it.effect * it.level) + "/с</b>" + (maxed ? "" : ", далее +" + fmt(it.effect * (it.level + 1)) + "/с")
          : "Даст <b>+" + fmt(it.effect) + "/с</b>";
      } else if (it.type === "click") {
        stat = "Ур. " + it.level + "/" + it.max_level + " — <b>+" + fmt(it.effect) + "</b> к клику";
      }
      const showBar = !isSkin ? !maxed : !owned;
      const pct = it.price > 0 ? Math.min(100, (coins / it.price) * 100) : 100;

      const row = document.createElement("div");
      row.className = "shop-item";
      row.dataset.id = it.id;
      row.innerHTML =
        '<div class="icon">' + iconHtml(it) + "</div>" +
        '<div class="info"><div class="name">' + it.name_ru + "</div>" +
        (isSkin ? "" : '<div class="desc">' + (it.description || "") + "</div>") +
        (stat ? '<div class="stat">' + stat + "</div>" : "") +
        (showBar && it.price > 0 && !isSkin ? '<div class="bar"><i style="width:' + pct + '%"></i></div>' : "") +
        "</div>" +
        '<button class="buy-btn ' + cls + '"' + (canClick ? "" : " disabled") + "><span>" + label + "</span>" + (sub ? "<i>" + sub + "</i>" : "") + "</button>";
      if (canClick) row.querySelector("button").addEventListener("click", () => buyUpgrade(it.id));
      shopList.appendChild(row);
    });
    shopSig = shopSigNow();

    if (focusId) {
      const row = shopList.querySelector('[data-id="' + focusId + '"]');
      if (row) {
        row.scrollIntoView({ block: "nearest" });
        row.classList.add("flash");
      }
    }
  }
  function shopSigNow() {
    const c = displayCoins();
    return activePanel + state.skin + shopItems.map((i) => i.id + i.level + (i.price === 0 || c >= i.price ? 1 : 0)).join("");
  }

  function openPanel(name, focusId) {
    if (name === activePanel && name !== "home" && !focusId) name = "home"; // повторный тап по табу закрывает
    activePanel = name;
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-panel") === name);
    });
    if (name === "home") { panel.classList.add("hidden"); return; }
    panelTitle.textContent = PANEL_TITLE[name] || "";
    panel.classList.remove("hidden");
    renderShop(focusId);
  }

  // ── Сеть ──
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
      updateHud();
      renderWorld(true);
      if (activePanel !== "home") renderShop();
    } catch (e) {
      console.error("loadMe failed", e);
    }
  }

  async function flushTaps() {
    if (pendingTaps <= 0 || flushing) return;
    flushing = true;
    const count = Math.min(pendingTaps, 100);
    pendingTaps -= count;
    try {
      const res = await fetch(API + "/tap", { method: "POST", headers: headers(), body: JSON.stringify({ count }) });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      state.coins = data.coins;
      state.click_power = data.click_power;
      updateHud();
    } catch (e) {
      pendingTaps += count;
      updateHud();
    } finally {
      flushing = false;
      if (pendingTaps > 0) flushTimer = setTimeout(flushTaps, 250);
    }
  }

  async function syncAll() {
    for (let i = 0; i < 8; i++) {
      if (pendingTaps <= 0 && !flushing) break;
      await flushTaps();
      await new Promise((r) => setTimeout(r, 70));
    }
    await loadMe();
  }

  async function buyUpgrade(id) {
    if (buying) return;
    buying = true;
    try {
      await syncAll();
      const it = shopItems.find((x) => x.id === id);
      const isSkinOwned = it && it.type === "skin" && it.level > 0;
      if (it && !isSkinOwned && it.price > 0 && state.coins + 0.001 < it.price) {
        toast("Не хватает " + fmt(Math.ceil(it.price - state.coins)) + " монет", true);
        return;
      }
      const res = await fetch(API + "/buy", { method: "POST", headers: headers(), body: JSON.stringify({ upgrade_id: id }) });
      if (!res.ok) {
        toast("Не удалось купить. Попробуй ещё раз", true);
        await loadMe();
        return;
      }
      if (it && it.type === "passive") justBuilt = id;
      await loadMe();
      if (it && it.type === "passive") toast(it.level > 0 ? "Улучшено: " + it.name_ru : "Построено: " + it.name_ru);
      if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
    } catch (e) {
      toast("Нет связи с сервером", true);
    } finally {
      buying = false;
    }
  }

  // ── Тап ──
  function showFloat(amount, cx, cy) {
    const el = document.createElement("div");
    el.className = "float";
    el.textContent = "+" + amount;
    const r = world.getBoundingClientRect();
    el.style.left = cx - r.left + (Math.random() - 0.5) * 24 + "px";
    el.style.top = cy - r.top - 24 + "px";
    floatBox.appendChild(el);
    setTimeout(() => el.remove(), 850);
  }

  tapBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (buying) return;
    pendingTaps += 1;
    updateHud();
    tapBtn.classList.add("pressed");
    setTimeout(() => tapBtn.classList.remove("pressed"), 80);
    showFloat(state.click_power, e.clientX, e.clientY);
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flushTaps, pendingTaps >= 100 ? 0 : 250);
  });

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => openPanel(btn.getAttribute("data-panel")));
  });
  $("panel-close").addEventListener("click", () => openPanel("home"));
  // тап по пустому месту карты закрывает панель
  world.addEventListener("pointerdown", (e) => {
    if (activePanel !== "home" && !e.target.closest(".slot, .core")) openPanel("home");
  });

  // ── Тики ──
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 5);
    last = now;
    if (state.passive_income > 0) state.coins += state.passive_income * dt; // сервер сверит при следующем /me
    updateHud();
    renderWorld(false);
    if (activePanel !== "home" && shopSig !== shopSigNow()) renderShop();
  }, 250);

  setInterval(spawnPop, 1100);

  setInterval(() => {
    if (document.hidden || buying) return;
    if (pendingTaps > 0) flushTaps(); else loadMe();
  }, 5000);

  document.addEventListener("visibilitychange", () => {
    last = performance.now();
    if (!document.hidden) loadMe();
  });

  loadMe();
})();
