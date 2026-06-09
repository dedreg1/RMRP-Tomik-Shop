const discord = "reva_ecstasy";

const fallbackProducts = [
  {
    id: "demo-1",
    title: "Маршрут заработка",
    category: "Гайды",
    price: "399 ₽",
    status: "В наличии",
    description: "План действий для быстрого старта и стабильного дохода на сервере.",
    createdAt: 3,
  },
  {
    id: "demo-2",
    title: "Сопровождение новичка",
    category: "Помощь",
    price: "699 ₽",
    status: "Под заказ",
    description: "Помощь с ориентацией, работами, маршрутами и базовыми вопросами.",
    createdAt: 2,
  },
  {
    id: "demo-3",
    title: "Подбор авто",
    category: "Авто",
    price: "549 ₽",
    status: "В наличии",
    description: "Подбор машины под бюджет, задачи, расходы и внешний вид.",
    createdAt: 1,
  },
];

const els = {
  productGrid: document.querySelector("#productGrid"),
  adminProducts: document.querySelector("#adminProducts"),
  adminOpen: document.querySelector("#adminOpen"),
  loginModal: document.querySelector("#loginModal"),
  editorModal: document.querySelector("#editorModal"),
  loginForm: document.querySelector("#loginForm"),
  loginName: document.querySelector("#loginName"),
  loginPassword: document.querySelector("#loginPassword"),
  productForm: document.querySelector("#productForm"),
  productId: document.querySelector("#productId"),
  titleInput: document.querySelector("#titleInput"),
  categoryInput: document.querySelector("#categoryInput"),
  priceInput: document.querySelector("#priceInput"),
  statusInput: document.querySelector("#statusInput"),
  descriptionInput: document.querySelector("#descriptionInput"),
  resetForm: document.querySelector("#resetForm"),
  logoutBtn: document.querySelector("#logoutBtn"),
  adminName: document.querySelector("#adminName"),
  productCount: document.querySelector("#productCount"),
  toast: document.querySelector("#toast"),
  clock: document.querySelector("#clock"),
  musicToggle: document.querySelector("#musicToggle"),
};

const state = {
  products: [],
  auth: { server: false, loggedIn: false, username: "" },
  music: { enabled: false, context: null, nodes: [] },
};

function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2500);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Ошибка запроса");
  return data;
}

function money(value) {
  if (typeof value === "number") return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
  return String(value || "0 ₽");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function applyAccent(accent) {
  document.body.dataset.accent = accent;
  localStorage.setItem("rmrp-accent", accent);
  document.querySelectorAll("[data-accent-choice]").forEach((button) => {
    button.classList.toggle("active", button.dataset.accentChoice === accent);
  });
}

function updateClock() {
  if (!els.clock) return;
  els.clock.textContent = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function stopMusic() {
  state.music.nodes.forEach((node) => {
    try {
      if (node.stop) node.stop();
      if (node.disconnect) node.disconnect();
    } catch (error) {
      // Node may already be stopped.
    }
  });
  state.music.nodes = [];
  state.music.enabled = false;
  els.musicToggle.textContent = "Музыка: выкл";
  els.musicToggle.classList.remove("active");
}

function startMusic() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    showToast("Музыка не поддерживается этим браузером");
    return;
  }

  const context = state.music.context || new AudioCtx();
  state.music.context = context;

  if (context.state === "suspended") {
    context.resume();
  }

  const master = context.createGain();
  master.gain.value = 0.035;
  master.connect(context.destination);

  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.connect(master);

  const notes = [130.81, 196.0, 246.94];
  const oscillators = notes.map((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = index === 0 ? "sine" : "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.value = index === 0 ? 0.5 : 0.18;
    oscillator.connect(gain);
    gain.connect(filter);
    oscillator.start();
    state.music.nodes.push(oscillator, gain);
    return oscillator;
  });

  const lfo = context.createOscillator();
  const lfoGain = context.createGain();
  lfo.type = "sine";
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = 120;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();

  state.music.nodes.push(lfo, lfoGain, filter, master, ...oscillators);
  state.music.enabled = true;
  els.musicToggle.textContent = "Музыка: вкл";
  els.musicToggle.classList.add("active");
}

function toggleMusic() {
  if (state.music.enabled) {
    stopMusic();
  } else {
    startMusic();
  }
}

function renderProducts() {
  const products = [...state.products].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  els.productGrid.innerHTML = products.length ? products.map((product) => `
    <article class="product-card">
      <div class="product-top">
        <span class="badge">${escapeHtml(product.category)}</span>
        <span class="badge">${escapeHtml(product.status)}</span>
      </div>
      <h3>${escapeHtml(product.title)}</h3>
      <p>${escapeHtml(product.description)}</p>
      <div class="product-bottom">
        <span class="price">${money(product.price)}</span>
        <button class="contact-link" type="button" data-copy-discord>Написать</button>
      </div>
    </article>
  `).join("") : '<p class="empty">Товары пока не добавлены.</p>';
}

function renderAdminProducts() {
  els.productCount.textContent = `${state.products.length} шт.`;
  els.adminProducts.innerHTML = state.products.length ? state.products.map((product) => `
    <article class="admin-item">
      <div>
        <strong>${escapeHtml(product.title)}</strong>
        <small>${escapeHtml(product.category)} · ${money(product.price)} · ${escapeHtml(product.status)}</small>
      </div>
      <div class="admin-actions">
        <button class="ghost-btn" type="button" data-edit="${product.id}">Изменить</button>
        <button class="ghost-btn danger" type="button" data-delete="${product.id}">Удалить</button>
      </div>
    </article>
  `).join("") : '<p class="empty">В базе пока нет товаров.</p>';
}

function renderAuth() {
  els.adminOpen.textContent = state.auth.loggedIn ? "Редактор" : "Админ";
  els.adminName.textContent = state.auth.username ? `Админ: ${state.auth.username}` : "Админ";
}

function renderAll() {
  renderProducts();
  renderAdminProducts();
  renderAuth();
}

function openModal(modal) {
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeModals() {
  els.loginModal.hidden = true;
  els.editorModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function resetProductForm() {
  els.productId.value = "";
  els.productForm.reset();
  els.titleInput.focus();
}

function fillProductForm(product) {
  els.productId.value = product.id;
  els.titleInput.value = product.title;
  els.categoryInput.value = product.category;
  els.priceInput.value = product.price;
  els.statusInput.value = product.status;
  els.descriptionInput.value = product.description;
}

async function copyDiscord() {
  try {
    await navigator.clipboard.writeText(discord);
    showToast("Discord скопирован: reva_ecstasy");
  } catch (error) {
    showToast("Discord: reva_ecstasy");
  }
}

async function refreshProducts() {
  const data = await api("/api/products");
  state.products = data.products || [];
  renderAll();
}

async function refreshAuth() {
  const data = await api("/api/auth/state");
  state.auth = { server: true, loggedIn: data.loggedIn, username: data.username || "" };
  renderAuth();
}

async function boot() {
  applyAccent(localStorage.getItem("rmrp-accent") || "lime");
  updateClock();
  setInterval(updateClock, 1000);
  try {
    await refreshAuth();
    await refreshProducts();
  } catch (error) {
    state.auth.server = false;
    state.products = fallbackProducts;
    renderAll();
    showToast("Запусти сайт через start-site.bat");
  }
}

document.querySelectorAll("[data-accent-choice]").forEach((button) => {
  button.addEventListener("click", () => applyAccent(button.dataset.accentChoice));
});

document.querySelectorAll("[data-close-modal]").forEach((item) => {
  item.addEventListener("click", closeModals);
});

document.querySelectorAll("#copyDiscordTop, #copyDiscordHero, #copyDiscordCard, #copyDiscordFooter").forEach((button) => {
  button.addEventListener("click", copyDiscord);
});

els.musicToggle.addEventListener("click", toggleMusic);

els.productGrid.addEventListener("click", async (event) => {
  if (!event.target.closest("[data-copy-discord]")) return;
  await copyDiscord();
  document.querySelector("#contact").scrollIntoView({ behavior: "smooth", block: "center" });
});

els.adminOpen.addEventListener("click", async () => {
  if (!state.auth.server) {
    showToast("Открой сайт через start-site.bat");
    return;
  }
  await refreshAuth();
  openModal(state.auth.loggedIn ? els.editorModal : els.loginModal);
});

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: els.loginName.value.trim(),
        password: els.loginPassword.value,
      }),
    });
    els.loginForm.reset();
    await refreshAuth();
    closeModals();
    openModal(els.editorModal);
    showToast("Вход выполнен");
  } catch (error) {
    showToast(error.message);
  }
});

els.logoutBtn.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST", body: "{}" });
  resetProductForm();
  await refreshAuth();
  closeModals();
  showToast("Вы вышли из редактора");
});

els.productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    title: els.titleInput.value.trim(),
    category: els.categoryInput.value.trim(),
    price: els.priceInput.value.trim(),
    status: els.statusInput.value,
    description: els.descriptionInput.value.trim(),
  };

  try {
    if (els.productId.value) {
      await api(`/api/products/${encodeURIComponent(els.productId.value)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      showToast("Товар изменен");
    } else {
      await api("/api/products", { method: "POST", body: JSON.stringify(payload) });
      showToast("Товар добавлен");
    }
    resetProductForm();
    await refreshProducts();
  } catch (error) {
    showToast(error.message);
  }
});

els.adminProducts.addEventListener("click", async (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;

  if (editId) {
    const product = state.products.find((item) => item.id === editId);
    if (product) fillProductForm(product);
  }

  if (deleteId) {
    try {
      await api(`/api/products/${encodeURIComponent(deleteId)}`, { method: "DELETE" });
      await refreshProducts();
      showToast("Товар удален");
    } catch (error) {
      showToast(error.message);
    }
  }
});

els.resetForm.addEventListener("click", resetProductForm);

boot();
