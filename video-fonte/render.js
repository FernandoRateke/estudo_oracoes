// uso: node render.js preview t1,t2,...   |   node render.js video out.mp4 [fps]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = __dirname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});

(async () => {
  await new Promise(r => server.listen(8765, r));
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[err]', e.message));
  await page.goto('http://localhost:8765/index.html');
  await page.waitForFunction(() => window.READY === true, null, { timeout: 120000 });
  const total = await page.evaluate(() => window.TOTAL);
  console.log('TOTAL', total);
  const mode = process.argv[2];
  if (mode === 'preview') {
    const ts = process.argv[3].split(',').map(Number);
    fs.mkdirSync(path.join(ROOT, 'preview'), { recursive: true });
    for (const t of ts) {
      const t0 = Date.now();
      await page.evaluate(t => window.renderAt(t), t);
      await page.screenshot({ path: path.join(ROOT, 'preview', `t${String(t).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 85 });
      console.log('frame', t, Date.now() - t0, 'ms');
    }
  } else {
    const out = process.argv[3], fps = +(process.argv[4] || 30);
    const n = Math.round(total * fps);
    const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let i = 0; i < n; i++) {
      await page.evaluate(t => window.renderAt(t), i / fps);
      const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 90 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close(); server.close();
})();
