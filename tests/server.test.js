'use strict';

const http = require('http');
const path = require('path');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load a fresh server instance and bind it to a random OS-assigned port.
 * Returns { server, port, close }.
 */
function startServer() {
  // Clear require cache so each beforeAll gets a fresh server instance
  const serverPath = path.resolve(__dirname, '../server.js');
  delete require.cache[serverPath];

  const server = require(serverPath);

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        port,
        close: () => new Promise((res, rej) => server.close((err) => (err ? rej(err) : res()))),
      });
    });
    server.on('error', reject);
  });
}

/**
 * Minimal HTTP GET helper that resolves with { statusCode, headers, body }.
 */
function get(port, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: urlPath }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () =>
        resolve({ statusCode: res.statusCode, headers: res.headers, body })
      );
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Static file server', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await startServer();
  }, 10000);

  afterAll(async () => {
    await ctx.close();
  });

  // ── index.html ──────────────────────────────────────────────────────────────────────────────

  test('GET / returns 200 with HTML content', async () => {
    const { statusCode, headers, body } = await get(ctx.port, '/');
    expect(statusCode).toBe(200);
    expect(headers['content-type']).toMatch(/text\/html/);
    expect(body).toContain('<!DOCTYPE html>');
  });

  test('GET /index.html returns 200', async () => {
    const { statusCode, headers } = await get(ctx.port, '/index.html');
    expect(statusCode).toBe(200);
    expect(headers['content-type']).toMatch(/text\/html/);
  });

  test('index.html body contains calculator structure', async () => {
    const { body } = await get(ctx.port, '/');
    expect(body).toContain('class="calculator"');
    expect(body).toContain('id="result"');
    expect(body).toContain('app.js');
  });

  // ── CSS ────────────────────────────────────────────────────────────────────────────────

  test('GET /style.css returns 200 with CSS content-type', async () => {
    const { statusCode, headers, body } = await get(ctx.port, '/style.css');
    expect(statusCode).toBe(200);
    expect(headers['content-type']).toMatch(/text\/css/);
    expect(body).toContain('.calculator');
  });

  // ── JavaScript ─────────────────────────────────────────────────────────────────────

  test('GET /app.js returns 200 with JS content-type', async () => {
    const { statusCode, headers, body } = await get(ctx.port, '/app.js');
    expect(statusCode).toBe(200);
    expect(headers['content-type']).toMatch(/javascript/);
    expect(body).toContain('handleNumber');
  });

  // ── Caching headers ────────────────────────────────────────────────────────────────────

  test('responses include Cache-Control header', async () => {
    const { headers } = await get(ctx.port, '/');
    expect(headers['cache-control']).toBeDefined();
  });

  // ── 404 falls back to index.html (SPA routing) ─────────────────────────────────────────────

  test('GET /nonexistent falls back to index.html with 200', async () => {
    const { statusCode, headers, body } = await get(ctx.port, '/nonexistent-route');
    expect(statusCode).toBe(200);
    expect(headers['content-type']).toMatch(/text\/html/);
    expect(body).toContain('<!DOCTYPE html>');
  });

  // ── Query string stripping ───────────────────────────────────────────────────────────────────────

  test('GET /?foo=bar still returns index.html', async () => {
    const { statusCode, body } = await get(ctx.port, '/?foo=bar');
    expect(statusCode).toBe(200);
    expect(body).toContain('<!DOCTYPE html>');
  });

  test('GET /style.css?v=2 still returns CSS', async () => {
    const { statusCode, headers } = await get(ctx.port, '/style.css?v=2');
    expect(statusCode).toBe(200);
    expect(headers['content-type']).toMatch(/text\/css/);
  });

  // ── Unknown file extension gets octet-stream ───────────────────────────────────────────

  test('unknown extension falls back to SPA index.html', async () => {
    const { statusCode, body } = await get(ctx.port, '/file.xyz');
    // file doesn't exist → SPA fallback
    expect(statusCode).toBe(200);
    expect(body).toContain('<!DOCTYPE html>');
  });

  // ── Correct MIME types for all served assets ───────────────────────────────────────────

  test('GET /index.html has correct charset in content-type', async () => {
    const { headers } = await get(ctx.port, '/index.html');
    expect(headers['content-type']).toContain('charset=utf-8');
  });

  test('GET /app.js has correct charset in content-type', async () => {
    const { headers } = await get(ctx.port, '/app.js');
    expect(headers['content-type']).toContain('charset=utf-8');
  });

  // ── Cache-Control value ────────────────────────────────────────────────────────────────────────────

  test('Cache-Control header has correct max-age', async () => {
    const { headers } = await get(ctx.port, '/style.css');
    expect(headers['cache-control']).toContain('max-age=3600');
  });

  // ── calculator-logic.js served as JS ───────────────────────────────────────────────────────────

  test('GET /calculator-logic.js returns 200 with JS content-type', async () => {
    const { statusCode, headers } = await get(ctx.port, '/calculator-logic.js');
    expect(statusCode).toBe(200);
    expect(headers['content-type']).toMatch(/javascript/);
  });
});

// ---------------------------------------------------------------------------
// Server module exports
// ---------------------------------------------------------------------------

describe('Server module exports', () => {
  test('server.js exports an http.Server instance', () => {
    const serverPath = require.resolve('../server.js');
    delete require.cache[serverPath];
    const server = require(serverPath);
    expect(server).toBeDefined();
    // http.Server instances have a 'listen' method
    expect(typeof server.listen).toBe('function');
    expect(typeof server.close).toBe('function');
  });

  test('exported server has a request listener registered', () => {
    const serverPath = require.resolve('../server.js');
    delete require.cache[serverPath];
    const server = require(serverPath);
    expect(server.listenerCount('request')).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Server error-path tests (500 responses) – using the real server + bad paths
// ---------------------------------------------------------------------------

describe('Server error handling via real server', () => {
  // The real server already has SPA fallback for ENOENT. To exercise the
  // non-ENOENT (500) path and the double-ENOENT (fallback also fails) path
  // we test the underlying http.createServer handler directly by calling it
  // with mock req/res objects.

  const fs = require('fs');
  const path = require('path');

  // Build a minimal mock res that records calls
  function mockRes() {
    const res = {
      _status: null,
      _body: '',
      writeHead(code) { this._status = code; },
      end(body) { this._body = body || ''; },
    };
    return res;
  }

  function mockReq(url) {
    return { url };
  }

  // Re-require server to get a fresh http.Server whose request listener we can call directly
  function getHandler() {
    const serverPath = require.resolve('../server.js');
    delete require.cache[serverPath];
    const server = require(serverPath);
    // listeners('request')[0] is the handler passed to http.createServer
    return server.listeners('request')[0];
  }

  // ── Non-ENOENT primary error → 500 ──────────────────────────────────────────────────────────────────

  test('non-ENOENT primary read error writes 500 Server Error', (done) => {
    const handler = getHandler();
    const nonEnoentErr = Object.assign(new Error('EACCES'), { code: 'EACCES' });
    const origReadFile = fs.readFile;

    // Intercept fs.readFile to always error with EACCES
    fs.readFile = (_fp, cb) => cb(nonEnoentErr);

    const req = mockReq('/index.html');
    const res = {
      _status: null,
      _body: '',
      writeHead(code) { this._status = code; },
      end(body) {
        this._body = body || '';
        fs.readFile = origReadFile; // restore
        expect(this._status).toBe(500);
        expect(this._body).toContain('Server Error');
        done();
      },
    };

    handler(req, res);
  });

  // ── ENOENT on primary + error on fallback → 500 ────────────────────────────────────────────

  test('ENOENT primary with error on fallback index.html writes 500', (done) => {
    const handler = getHandler();
    const enoentErr = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    const eaccesErr = Object.assign(new Error('EACCES'), { code: 'EACCES' });
    const origReadFile = fs.readFile;

    let callCount = 0;
    fs.readFile = (_fp, cb) => {
      callCount++;
      if (callCount === 1) cb(enoentErr);   // primary → ENOENT → trigger fallback
      else cb(eaccesErr);                    // fallback → non-ENOENT → 500
    };

    const req = mockReq('/no-such-file.xyz');
    const res = {
      _status: null,
      _body: '',
      writeHead(code) { this._status = code; },
      end(body) {
        this._body = body || '';
        fs.readFile = origReadFile;
        expect(this._status).toBe(500);
        expect(this._body).toContain('Server Error');
        expect(callCount).toBe(2);
        done();
      },
    };

    handler(req, res);
  });
});
