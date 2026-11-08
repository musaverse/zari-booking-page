// Renders the Deepavali film to MP4 (H.264, 30 fps). Usage, from this folder:
//   node render-video.js                       -> all four films
//   ONLY=forest-story node render-video.js     -> one film
//   STILLS=0,45,60,120 OUT=/some/dir node render-video.js   -> PNG stills only (for checking)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path'), http = require('http'), fs = require('fs');
const root = __dirname, outDir = process.env.OUT || path.join(__dirname, '..');
const types = { '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.js': 'text/javascript' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
}).listen(0, async () => {
  const port = srv.address().port;
  const b = await chromium.launch();
  let jobs = [['forest', 'story', 1920], ['maroon', 'story', 1920], ['forest', 'portrait', 1350], ['maroon', 'portrait', 1350]];
  if (process.env.ONLY) jobs = jobs.filter(([t, f]) => `${t}-${f}` === process.env.ONLY);
  const stills = process.env.STILLS ? process.env.STILLS.split(',').map(Number) : null;
  for (const [theme, format, h] of jobs) {
    const p = await b.newPage({ viewport: { width: 1080, height: h } });
    p.on('console', m => console.log('page:', m.text())); p.on('pageerror', e => console.log('pageerror:', e.message));
    await p.goto(`http://127.0.0.1:${port}/video.html?theme=${theme}&format=${format}`, { waitUntil: 'networkidle' });
    await p.evaluate(() => window.ready);
    const N = await p.evaluate(() => window.FRAMES);
    const name = `zari-deepavali-film-${theme}-${format}`;
    const t0 = Date.now();
    if (stills) {
      for (const i of stills) {
        const d = await p.evaluate(i => window.frame(i), i);
        fs.writeFileSync(path.join(outDir, `${name}-f${String(i).padStart(3, '0')}.png`), Buffer.from(d.split(',')[1], 'base64'));
      }
    } else {
      const out = path.join(outDir, `${name}.mp4`);
      const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-i', '-',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-tune', 'grain', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
      const done = new Promise(r => ff.on('close', r));
      for (let i = 0; i < N; i++) {
        const d = await p.evaluate(i => window.frame(i), i);
        if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
      }
      ff.stdin.end(); await done;
      console.log(name, 'done in', ((Date.now() - t0) / 1000).toFixed(0) + 's');
    }
    await p.close();
  }
  await b.close(); srv.close();
});
