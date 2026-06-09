const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const dbFile = process.env.DB_FILE || path.join(root, "db.json");
const port = Number(process.env.PORT || 8080);
const adminLogin = "Tom1k";
const adminPassword = "tomik5267";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

const defaultProducts = [
  {
    id: "p1",
    title: "Маршрут заработка",
    category: "Гайды",
    price: "399 ₽",
    status: "В наличии",
    description: "План действий для быстрого старта и стабильного дохода на сервере.",
    createdAt: 5,
  },
  {
    id: "p2",
    title: "Сопровождение новичка",
    category: "Помощь",
    price: "699 ₽",
    status: "Под заказ",
    description: "Помощь с ориентацией, работами, маршрутами и базовыми вопросами.",
    createdAt: 4,
  },
  {
    id: "p3",
    title: "Подбор авто",
    category: "Авто",
    price: "549 ₽",
    status: "В наличии",
    description: "Подбор машины под бюджет, задачи, расходы и внешний вид.",
    createdAt: 3,
  },
];

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

function createAdmin() {
  return {
    username: adminLogin,
    ...hashPassword(adminPassword),
    createdAt: Date.now(),
  };
}

function createDb() {
  return {
    admin: createAdmin(),
    sessions: {},
    products: defaultProducts,
  };
}

function ensureDbShape(db) {
  db.admin = createAdmin();
  db.sessions ||= {};
  db.products ||= defaultProducts;
  db.products = db.products.map((product) => ({
    ...product,
    price: typeof product.price === "number" ? `${product.price} ₽` : String(product.price || "0 ₽"),
  }));
  return db;
}

function readDb() {
  try {
    return ensureDbShape(JSON.parse(fs.readFileSync(dbFile, "utf8")));
  } catch (error) {
    const db = createDb();
    writeDb(db);
    return db;
  }
}

function writeDb(db) {
  fs.writeFileSync(dbFile, JSON.stringify(ensureDbShape(db), null, 2), "utf8");
}

function sendJson(response, status, data, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(data));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 128) {
        reject(new Error("Body too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body ? JSON.parse(body) : {}));
    request.on("error", reject);
  });
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function verifyPassword(password, admin) {
  const { hash } = hashPassword(password, admin.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(admin.hash, "hex"));
}

function parseCookies(request) {
  return Object.fromEntries(String(request.headers.cookie || "")
    .split(";")
    .map((part) => part.trim().split("="))
    .filter(([key, value]) => key && value)
    .map(([key, value]) => [key, decodeURIComponent(value)]));
}

function getSession(request, db) {
  const token = parseCookies(request).rmrp_session;
  if (!token || !db.sessions[token]) return null;
  return { token, username: db.sessions[token].username };
}

function requireAdmin(request, response, db) {
  const session = getSession(request, db);
  if (!session) {
    sendJson(response, 401, { error: "Нужно войти как админ." });
    return null;
  }
  return session;
}

function sessionCookie(token) {
  return `rmrp_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`;
}

function clearSessionCookie() {
  return "rmrp_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
}

function normalizeProduct(payload, existing = {}) {
  const title = cleanText(payload.title, 70);
  const category = cleanText(payload.category, 32);
  const price = cleanText(payload.price, 32);
  const status = cleanText(payload.status, 32) || "В наличии";
  const description = cleanText(payload.description, 280);

  if (!title || !category || !price || !description) {
    throw new Error("Заполни название, категорию, цену и описание.");
  }

  return {
    id: existing.id || crypto.randomUUID(),
    title,
    category,
    price,
    status,
    description,
    createdAt: existing.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
}

async function handleApi(request, response) {
  const db = readDb();
  const url = new URL(request.url, `http://localhost:${port}`);

  try {
    if (url.pathname === "/api/auth/state" && request.method === "GET") {
      const session = getSession(request, db);
      sendJson(response, 200, {
        loggedIn: Boolean(session),
        username: session?.username || "",
      });
      return;
    }

    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      const body = await readBody(request);
      const username = cleanText(body.username, 32);
      if (username !== db.admin.username || !verifyPassword(body.password || "", db.admin)) {
        sendJson(response, 401, { error: "Неверный логин или пароль." });
        return;
      }

      const token = crypto.randomBytes(32).toString("hex");
      db.sessions[token] = { username: db.admin.username, createdAt: Date.now() };
      writeDb(db);
      sendJson(response, 200, { ok: true, username: db.admin.username }, { "Set-Cookie": sessionCookie(token) });
      return;
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      const session = getSession(request, db);
      if (session) delete db.sessions[session.token];
      writeDb(db);
      sendJson(response, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
      return;
    }

    if (url.pathname === "/api/products" && request.method === "GET") {
      sendJson(response, 200, { products: db.products });
      return;
    }

    if (url.pathname === "/api/products" && request.method === "POST") {
      if (!requireAdmin(request, response, db)) return;
      const product = normalizeProduct(await readBody(request));
      db.products.unshift(product);
      writeDb(db);
      sendJson(response, 201, { product });
      return;
    }

    const productMatch = url.pathname.match(/^\/api\/products\/([^/]+)$/);
    if (productMatch && request.method === "PUT") {
      if (!requireAdmin(request, response, db)) return;
      const id = decodeURIComponent(productMatch[1]);
      const index = db.products.findIndex((product) => product.id === id);
      if (index === -1) {
        sendJson(response, 404, { error: "Товар не найден." });
        return;
      }
      db.products[index] = normalizeProduct(await readBody(request), db.products[index]);
      writeDb(db);
      sendJson(response, 200, { product: db.products[index] });
      return;
    }

    if (productMatch && request.method === "DELETE") {
      if (!requireAdmin(request, response, db)) return;
      const id = decodeURIComponent(productMatch[1]);
      db.products = db.products.filter((product) => product.id !== id);
      writeDb(db);
      sendJson(response, 200, { ok: true });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 400, { error: error.message || "Ошибка запроса." });
  }
}

function serveStatic(request, response) {
  const urlPath = decodeURIComponent(request.url.split("?")[0]);
  const safePath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(root, safePath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream" });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  if (request.url.startsWith("/api/")) {
    handleApi(request, response);
    return;
  }
  serveStatic(request, response);
});

server.listen(port, () => {
  console.log(`RMRP Tomik Shop запущен: http://localhost:${port}`);
});
