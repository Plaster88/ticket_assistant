import { spawn } from 'child_process';
import http from 'http';

const PORT = process.env.PORT || 4001;
const BASE = `http://localhost:${PORT}`;

function waitForHealth(timeout = 10000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function poll() {
      http.get(`${BASE}/api/health`, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            if (j && j.status === 'ok') return resolve();
          } catch (e) {}
          if (Date.now() - start > timeout) return reject(new Error('Health check timeout'));
          setTimeout(poll, 200);
        });
      }).on('error', () => {
        if (Date.now() - start > timeout) return reject(new Error('Health check timeout'));
        setTimeout(poll, 200);
      });
    })();
  });
}

function postChat(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ userPrompt: prompt });
    const req = http.request(
      `${BASE}/api/chat`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  console.log('[test] Starting server...');
  const child = spawn(process.execPath, ['src/index.js'], { cwd: process.cwd(), env: { ...process.env, PORT } , stdio:['ignore','pipe','pipe']});

  child.stdout.on('data', (d) => process.stdout.write('[server] ' + d.toString()));
  child.stderr.on('data', (d) => process.stderr.write('[server] ' + d.toString()));

  try {
    await waitForHealth(15000);
    console.log('[test] Server is healthy — running chat smoke test');
    const res = await postChat('Show open critical tickets');
    if (!res || typeof res.body !== 'object' || !('reply' in res.body)) {
      throw new Error('Chat endpoint did not return expected JSON with reply');
    }
    console.log('[test] Chat response OK:', res.body.reply.slice(0, 120));
    console.log('[test] Smoke test passed');
    child.kill();
    process.exit(0);
  } catch (err) {
    console.error('[test] Smoke test failed:', err.message);
    child.kill();
    process.exit(2);
  }
})();
