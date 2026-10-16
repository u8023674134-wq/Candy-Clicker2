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
    // показываем серверные + ещё не отправленные тапы
    return state.coins + pendingTaps * state.click_power;
  }

  function updateUI() {
    coinsEl.textContent = formatNum(displayCoins());
    powerEl.textContent = `⚡ ${state.click_power}`;
    passiveEl.textContent = `⏱ ${formatNum(state.passive_income)}/с`;
    tapEmoji.textContent = SKIN_EMOJI[state.skin] || "🍬";
    tapBtn.className = "tap-btn skin-" + (state.skin || "candy");
  }

  function showFloat(amount) {
    const el = document.createElement("div");
    el.className = "float";
    el.textContent = `+${amount}`;
    const rect = tapBtn.getBoundingClientRect();
    el.style.left = rect.width / 2 + (Math.random() - 0.5) * 40 + "px";
    el.style.top = rect.height / 2 - 20 + "px";
    floatContainer.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  async function loadMe() {
    try {
      const res = await fetch(`${API}/me`, { headers: headers() });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      // сервер — истина; pending тапы не теряем визуально
      state.coins = data.user.coins;
      state.click_power = data.user.click_power;
      state.passive_income = data.user.passive_income;
      state.skin = data.user.skin;
      updateUI();
      renderShop(data.shop || []);
    } catch (e) {
      console.error("loadMe failed", e);
      shopList.innerHTML =
        `<p style="color:#f87171;padding:12px">Ошибка загрузки. Открой игру через бота.</p>`;
    }
  }

  async function flushTaps() {
    if (pendingTaps <= 0 || flushing) return;
    flushing = true;
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
      // сервер подтвердил count; новые тапы за время запроса уже в pendingTaps
      state.coins = data.coins;
      state.click_power = data.click_power;
      updateUI();
    } catch (e) {
      console.error("tap flush failed", e);
      pendingTaps += count; // вернём, чтобы не потерять
      updateUI();
    } finally {
      flushing = false;
    }
  }

  async function buyUpgrade(id) {
    await flushTaps
