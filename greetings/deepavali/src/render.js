// Renders the Deepavali greeting to PNG. Usage: node render.js  (run from this folder)
const { chromium } = require('playwright');
const path = require('path');
const http = require('http'); const fs = require('fs');
const root = __dirname, out = path.join(__dirname, '..');
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': f.endsWith('.svg') ? 'image/svg+xml' : f.endsWith('.png') ? 'image/png' : 'text/html' }); r.end(d); });
}).listen(0, async () => {
  const port = srv.address().port;
  const b = await chromium.launch();
  const jobs = [
    ['forest', 'portrait', 1350], ['maroon', 'portrait', 1350],
    ['forest', 'square', 1080], ['maroon', 'square', 1080],
    ['forest', 'story', 1920], ['maroon', 'story', 1920],
  ];
  const scale = Number(process.env.SCALE || 2);
  for (const [theme, format, h] of jobs) {
    const p = await b.newPage({ viewport: { width: 1080, height: h }, deviceScaleFactor: scale });
    await p.goto(`http://127.0.0.1:${port}/greeting.html?theme=${theme}&format=${format}`, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.locator('#card').screenshot({ path: path.join(out, `zari-deepavali-${theme}-${format}.png`) });
    await p.close();
  }
  await b.close(); srv.close();
});
