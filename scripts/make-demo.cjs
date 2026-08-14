#!/usr/bin/env node
/* Generates demo-events.json: a fictional two-builder story so the page plays
 * anywhere (GitHub Pages, a laptop with no repos) with no server attached.
 * Deterministic seed; regenerate after changing the story shape. */
'use strict';
const fs = require('fs');
let seed = 42;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = a => a[Math.floor(rnd() * a.length)];

const FEATURES = {
  landing:   ['app/landing.tsx', 'app/hero.tsx', 'styles/landing.css'],
  auth:      ['app/auth/login.tsx', 'app/auth/session.ts', 'api/auth.ts'],
  pricing:   ['app/pricing.tsx', 'app/calculator.ts', 'api/pricing.ts'],
  api:       ['api/core.ts', 'api/routes.ts', 'api/db.ts'],
  dashboard: ['app/dashboard.tsx', 'app/charts.tsx', 'app/widgets.tsx'],
  billing:   ['api/billing.ts', 'api/invoices.ts', 'app/billing.tsx'],
  design:    ['design/tokens.css', 'design/logo.svg', 'design/type.css'],
  tests:     ['tests/auth.test.ts', 'tests/pricing.test.ts', 'tests/api.test.ts'],
};
const MSGS = f => [
  'feat(' + f + '): ' + pick(['first cut', 'skeleton', 'real copy', 'mobile pass', 'empty states', 'happy path']),
  'fix(' + f + '): ' + pick(['rounding in calculator', 'session leak', 'null on first load', 'off-by-one in totals', 'contrast pass']),
  'style(' + f + '): ' + pick(['spacing rhythm', 'type scale', 'dark tokens']),
  'test(' + f + '): ' + pick(['happy path', 'edge cases', 'regression']),
  'refactor(' + f + '): ' + pick(['split routes', 'name things', 'pull hook out']),
];

const evs = [];
let ts = Date.parse('2026-08-14T09:00:00+04:00');
const NAMES = ['Wassim Moumneh', 'Rabih'];
for (let i = 0; i < 170; i++) {
  const author = rnd() < .52 ? NAMES[0] : NAMES[1];
  const f1 = pick(Object.keys(FEATURES));
  const cross = rnd() < .22;
  const f2 = cross ? pick(Object.keys(FEATURES).filter(f => f !== f1)) : null;
  const files = [pick(FEATURES[f1])];
  if (f2) files.push(pick(FEATURES[f2]));
  const spike = rnd() < .07;
  const add = spike ? 900 + Math.floor(rnd() * 1600) : 2 + Math.floor(rnd() * 140);
  const del = Math.floor(add * rnd() * .4);
  ts += 4000 + Math.floor(rnd() * 40000);
  evs.push({ type: 'commit', hash: 'demo' + i.toString(16), author, repo: 'ecomma',
    add, del, files: files.length, top: files[0], feats: f2 ? [f1, f2] : [f1],
    msg: pick(MSGS(f1)), ts });
}
fs.writeFileSync(__dirname + '/../demo-events.json', JSON.stringify(evs));
console.log('demo events written:', evs.length);
