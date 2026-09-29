const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const root = __dirname;
const dataFile = path.join(root, 'data', 'rsvps.json');
const port = Number(process.env.PORT) || 3000;
const adminPassword = process.env.ADMIN_PASSWORD || '2023';
const shortUrl = process.env.SHORT_URL || 'https://shuga19bd.ru/s/shuga19bd';
const sessions = new Set();

async function readResponses() {
  try {
    return JSON.parse(await fs.readFile(dataFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeResponses(responses) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, `${JSON.stringify(responses, null, 2)}\n`, 'utf8');
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16_384) throw new Error('Слишком большой запрос');
  }
  return JSON.parse(body || '{}');
}

function isAdmin(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  return Boolean(token && sessions.has(token));
}

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  try {
    if (request.method === 'GET' && pathname === '/api/short-url') {
      return sendJson(response, 200, { shortUrl });
    }

    if (request.method === 'POST' && pathname === '/api/rsvp') {
      const body = await readBody(request);
      const name = String(body.name || '').trim().slice(0, 100);
      if (!name || !['yes', 'no'].includes(body.attendance)) {
        return sendJson(response, 400, { ok: false, message: 'Проверьте имя и ответ о присутствии.' });
      }

      const responses = await readResponses();
      responses.push({
        id: crypto.randomUUID(),
        name,
        attendance: body.attendance,
        plusOne: body.attendance === 'yes' && body.plusOne === 'yes' ? 'yes' : 'no',
        plusOneName: String(body.plusOneName || '').trim().slice(0, 100),
        drinks: Array.isArray(body.drinks) ? body.drinks.map(value => String(value).slice(0, 100)).slice(0, 10) : [],
        timestamp: new Date().toISOString()
      });
      await writeResponses(responses);
      return sendJson(response, 201, { ok: true });
    }

    if (request.method === 'POST' && pathname === '/api/admin/login') {
      const body = await readBody(request);
      if (String(body.password || '') !== adminPassword) {
        return sendJson(response, 401, { ok: false, message: 'Неверный пароль.' });
      }
      const token = crypto.randomBytes(32).toString('hex');
      sessions.add(token);
      return sendJson(response, 200, { ok: true, token });
    }

    if (pathname.startsWith('/api/admin/') && !isAdmin(request)) {
      return sendJson(response, 401, { ok: false, message: 'Войдите в админ-панель.' });
    }

    if (request.method === 'GET' && pathname === '/api/admin/responses') {
      return sendJson(response, 200, { ok: true, data: await readResponses() });
    }

    if (request.method === 'POST' && pathname === '/api/admin/clear') {
      await writeResponses([]);
      return sendJson(response, 200, { ok: true });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return sendJson(response, 404, { ok: false, message: 'Не найдено.' });
    }

    const requestedPath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).slice(1);
    const filePath = path.resolve(root, requestedPath);
    if (!filePath.startsWith(`${root}${path.sep}`) || filePath === dataFile) {
      return sendJson(response, 404, { ok: false, message: 'Не найдено.' });
    }

    const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
    const content = await fs.readFile(filePath);
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (error instanceof SyntaxError || error.message === 'Слишком большой запрос') {
      return sendJson(response, 400, { ok: false, message: 'Некорректный запрос.' });
    }
    if (error.code === 'ENOENT') return sendJson(response, 404, { ok: false, message: 'Не найдено.' });
    console.error(error);
    return sendJson(response, 500, { ok: false, message: 'Внутренняя ошибка сервера.' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Приглашение доступно: http://localhost:${port}`);
});