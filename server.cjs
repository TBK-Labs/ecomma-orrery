#!/usr/bin/env node
/* ORRERY LIVE — the commit-feed server for the hackathon orrery.
 * Node stdlib only, zero deps, like everything else in this repo.
 *
 *   the real thing: node server.cjs --watch <repoDir> [more dirs...] [--poll ms]
 *   kiosk / proof:  node server.cjs --replay <repoDir> [--last N] [--speed commits/s] [--repeat ms]
 *   no repos handy: node server.cjs --demo   (replays the bundled demo-events.json)
 *
 * Serves index.html at / and a server-sent event stream at /events.
 * Watch mode tails live commits (fetching each poll so two laptops pushing
 * to one shared remote both appear); replay replays real git history;
 * demo replays the bundled fictional story. The page also falls back to
 * demo-events.json by itself when opened with no server at all (GitHub Pages).
 */
'use strict';
const http = require('http');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const a = process.argv.slice(2);
  const o = { watch: [], replay: null, demo: false, last: 300, speed: 3, repeat: 0, poll: 5000, port: 8899, team: 'Team Ecomma' };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--watch') { while (a[i + 1] && !a[i + 1].startsWith('--')) o.watch.push(a[++i]); }
    else if (a[i] === '--replay') { o.replay = true; while (a[i + 1] && !a[i + 1].startsWith('--')) o.watch.push(a[++i]); }
    else if (a[i] === '--last') o.last = Math.max(1, +a[++i] || 300);
    else if (a[i] === '--speed') o.speed = Math.max(0.2, +a[++i] || 3);
    else if (a[i] === '--repeat') o.repeat = Math.max(0, +a[++i] || 0);
    else if (a[i] === '--poll') o.poll = Math.max(500, +a[++i] || 2500);
    else if (a[i] === '--port') o.port = +a[++i] || 8899;
    else if (a[i] === '--team') o.team = a[++i] || o.team;
    else if (a[i] === '--demo') o.demo = true;
  }
  return o;
}
const OPT = parseArgs();
const REPOS = OPT.watch.map(d => path.resolve(d));
if (!REPOS.length && !OPT.demo) {
  console.error('usage: node server.cjs --watch <dir> [dir2 ...] | --replay <dir> | --demo');
  process.exit(1);
}

/* unit separators kept out of the source text on purpose */
const S1 = String.fromCharCode(1), S2 = String.fromCharCode(2);
const PRETTY = '--pretty=format:' + S1 + '%H' + S2 + '%an' + S2 + '%ad' + S2 + '%s';

function parseLog(out, dir) {
  const name = path.basename(dir);
  const evs = [];
  for (const chunk of out.split(S1)) {
    if (!chunk.trim()) continue;
    const nl = chunk.indexOf('\n');
    const meta = (nl === -1 ? chunk : chunk.slice(0, nl)).split(S2);
    const hash = meta[0] || '', author = meta[1] || 'unknown', ad = meta[2] || '', msg = meta[3] || '';
    let add = 0, del = 0, files = 0, top = '', topAdd = -1;
    const paths = [];
    for (const line of chunk.slice(nl + 1).split('\n')) {
      const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
      if (!m) continue;
      const a = m[1] === '-' ? 0 : +m[1], d = m[2] === '-' ? 0 : +m[2];
      add += a; del += d; files++;
      paths.push(m[3]);
      if (a > topAdd) { topAdd = a; top = m[3]; }
    }
    /* distinct features touched by this commit, for constellation threads */
    const feats = [];
    for (const p of paths) {
      const seg = p.split('/');
      const f = seg.length > 1 ? seg[0] : seg[0].replace(/\.[^.]+$/, '');
      if (f && feats.indexOf(f) === -1 && feats.length < 3) feats.push(f);
    }
    evs.push({ type: 'commit', hash, author, repo: name, add, del, files, top, feats, msg: msg.slice(0, 90), ts: Date.parse(ad) || Date.now() });
  }
  return evs;
}

function gitLog(dir, extra) {
  return new Promise((res, rej) => {
    execFile('git', ['-C', dir, 'log', '--date=iso', PRETTY, '--numstat'].concat(extra),
      { maxBuffer: 64 * 1024 * 1024 },
      (e, out) => (e ? rej(e) : res(parseLog(out, dir))));
  });
}

/* ---- SSE fan-out ---- */
const clients = new Set();
function send(obj) {
  const line = 'data: ' + JSON.stringify(obj) + '\n\n';
  for (const res of clients) { try { res.write(line); } catch {} }
}

const PAGE = path.join(__dirname, 'index.html');
const DEMO = path.join(__dirname, 'demo-events.json');
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/' || url === '/index.html') {
    fs.readFile(PAGE, (e, buf) => {
      if (e) { res.writeHead(500); res.end('index.html missing'); return; }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(buf);
    });
  } else if (url === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write('data: ' + JSON.stringify({
      type: 'hello', mode: OPT.demo ? 'demo' : OPT.replay ? 'replay' : 'live',
      repos: REPOS.map(d => path.basename(d)), speed: OPT.speed, team: OPT.team,
    }) + '\n\n');
    clients.add(res);
    res.on('close', () => clients.delete(res));
  } else if (url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, mode: OPT.demo ? 'demo' : OPT.replay ? 'replay' : 'live', clients: clients.size }));
  } else { res.writeHead(404); res.end('no'); }
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function replay() {
  let evs = [];
  for (const dir of REPOS) evs = evs.concat(await gitLog(dir, ['--reverse', '-n', String(OPT.last)]));
  evs.sort((a, b) => a.ts - b.ts);
  const gap = 1000 / OPT.speed;
  for (;;) {
    for (const ev of evs) { send(ev); await sleep(gap); }
    send({ type: 'done', commits: evs.length });
    if (!OPT.repeat) return;
    await sleep(OPT.repeat);
    send({ type: 'reset' });
    await sleep(400);
  }
}

/* two laptops, one screen: best-effort fetch each poll so a shared clone
 * sees both builders' pushes; offline or no remote just no-ops */
function fetchQuiet(dir) {
  return new Promise(res => { execFile('git', ['-C', dir, 'fetch', '--quiet'], { timeout: 20000 }, () => res()); });
}

async function watch() {
  const seen = new Set();
  for (;;) {
    for (const dir of REPOS) {
      try {
        await fetchQuiet(dir);
        const evs = (await gitLog(dir, ['-n', '50'])).filter(e => !seen.has(e.hash));
        for (const e of evs) seen.add(e.hash);
        evs.sort((a, b) => a.ts - b.ts).forEach(send);
      } catch (e) { send({ type: 'probe-fail', repo: path.basename(dir), err: String(e.message || e) }); }
    }
    await sleep(OPT.poll);
  }
}

async function replayDemo() {
  const evs = JSON.parse(fs.readFileSync(DEMO, 'utf8'));
  const gap = 1000 / OPT.speed;
  for (;;) {
    for (const ev of evs) { send(ev); await sleep(gap); }
    send({ type: 'done', commits: evs.length });
    if (!OPT.repeat) return;
    await sleep(OPT.repeat);
    send({ type: 'reset' });
    await sleep(400);
  }
}

server.listen(OPT.port, '0.0.0.0', () => {
  console.log('orrery-live ' + (OPT.demo ? 'DEMO' : OPT.replay ? 'REPLAY' : 'LIVE') + ' on :' + OPT.port + ' repos=' + (REPOS.length ? REPOS.map(d => path.basename(d)).join(',') : 'bundled story'));
  (OPT.demo ? replayDemo() : OPT.replay ? replay() : watch()).catch(e => { console.error('feed died:', e); process.exit(1); });
});
