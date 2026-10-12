// Renders the retro profile cards (dist/player.svg, dist/streak.svg) from the
// public contribution calendar. Runs in the snake workflow; needs GITHUB_TOKEN.
import { mkdirSync, writeFileSync } from 'node:fs';

const USER = 'AadityaPanda';
const DAY = 864e5;
const C = { bg: '#0d1117', panel: '#161b22', off: '#21262d', text: '#c9d1d9', dim: '#8b949e', cyan: '#00b4d8', pink: '#FF4FD8', yellow: '#FFD93D' };

async function gql(query) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `bearer ${process.env.GITHUB_TOKEN}` },
    body: JSON.stringify({ query: `{ user(login: "${USER}") { ${query} } }` }),
  });
  const { data, errors } = await res.json();
  if (errors || !data?.user) throw new Error(JSON.stringify(errors ?? res.status));
  return data.user;
}

// --- data: one calendar per year (the API caps a range at one year)
const now = new Date();
const { contributionsCollection: { contributionYears } } = await gql('contributionsCollection { contributionYears }');
const years = await gql(contributionYears.map((y) => {
  const to = y < now.getUTCFullYear() ? `${y}-12-31T23:59:59Z` : now.toISOString();
  return `y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${to}") { contributionCalendar { weeks { contributionDays { date contributionCount } } } }`;
}).join('\n'));
const days = [...new Map(Object.values(years)
  .flatMap((c) => c.contributionCalendar.weeks.flatMap((w) => w.contributionDays))
  .map((d) => [d.date, d.contributionCount]))]
  .sort(([a], [b]) => a.localeCompare(b));

const runs = [];
for (const [date, n] of days) {
  if (!n) continue;
  const t = Date.parse(date), run = runs.at(-1);
  if (run && t - run.end === DAY) { run.end = t; run.len++; } else runs.push({ start: t, end: t, len: 1 });
}
const today = Date.parse(days.at(-1)[0]);
const total = days.reduce((sum, [, n]) => sum + n, 0);
const last = runs.at(-1);
// Today not being done yet doesn't break the streak.
const current = today - last.end <= DAY ? last : { len: 0 };
const longest = runs.reduce((best, r) => (r.len >= best.len ? r : best));
const lvl = Math.floor(Math.sqrt(total / 5)), xpFrom = 5 * lvl ** 2, xpTo = 5 * (lvl + 1) ** 2;

const year = (t) => new Date(t).getUTCFullYear();
const fmt = (t, withYear) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: withYear ? 'numeric' : undefined, timeZone: 'UTC' }).toUpperCase();
const span = (r) => (r.start === r.end ? fmt(r.end, true) : `${fmt(r.start, year(r.start) !== year(r.end))} - ${fmt(r.end, true)}`);

// --- drawing
let glyphs = '';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const text = (x, y, s, size, fill, anchor = 'start', cls = '') => {
  s = String(s);
  glyphs += s;
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" class="${cls}">${esc(s)}</text>`;
};
// Rectangle with notched pixel corners.
const box = (x, y, w, h, fill, p = 4) =>
  `<path fill="${fill}" d="M${x + p} ${y}h${w - 2 * p}v${p}h${p}v${h - 2 * p}h${-p}v${p}h${2 * p - w}v${-p}h${-p}v${2 * p - h}h${p}z"/>`;
const sprite = (rows, x, y, px, pal) => rows.flatMap((row, j) => [...row].map((c, i) =>
  pal[c] ? `<rect x="${x + i * px}" y="${y + j * px}" width="${px}" height="${px}" fill="${pal[c]}"/>` : '')).join('');
const dashes = (d) => `<path d="${d}" stroke="${C.dim}" stroke-width="2" stroke-dasharray="4 6" opacity=".5"/>`;

const GOLD = { Y: C.yellow, O: '#E09F00', W: '#FFF6C8', P: C.pink, C: C.cyan };
const COIN = ['..OOOO..', '.OYYYYO.', 'OYWYOYYO', 'OYWYOYYO', 'OYYYOYYO', 'OYYYOYYO', '.OYYYYO.', '..OOOO..'];
const CROWN = ['Y...Y...Y', 'YY.YYY.YY', 'YYYYYYYYY', 'YPYYCYYPY', 'YYYYYYYYY', 'OOOOOOOOO'];
const FLAME = ['...R....', '...RR...', '..RRR.R.', '.RRFRRR.', '.RFFFRR.', 'RRFYFFRR', 'RFYYYFFR', 'RFYWYYFR', '.RFYYFR.', '..RRRR..'];
const FIRE = { R: '#FF4F4F', F: '#FF9F1C', Y: C.yellow, W: '#FFF6C8' };
const AVATAR = [
  '...HHHHHH...', '..HHHHHHHH..', '.HHHHHHHHHH.', '.HHHSSSSHHH.', '.HSSSSSSSSH.', '.SGGGSSGGGS.', '.SGLGGGGLGS.',
  '.SGGGSSGGGS.', '.SSSSSSSSSS.', '..SSSMMSSS..', '...SSSSSS...', '..CCCSSCCC..', '.CCCCCCCCCC.', 'CCCCPCCPCCCC',
];
const DEV = { H: '#2b1d14', S: '#c68642', G: '#111111', L: '#9be7ff', M: '#8d5524', C: C.cyan, P: C.pink };

const col = (x, art, pal, value, color, label, sub) => {
  const px = 5, w = art[0].length * px;
  return sprite(art, x - w / 2, 108 - art.length * px, px, pal)
    + text(x, 150, value, 28, color, 'middle')
    + text(x, 178, label, 10, color, 'middle')
    + text(x, 198, sub, 8, C.dim, 'middle');
};

const streak = text(40, 46, '1UP', 10, C.pink, 'start', 'blink')
  + text(420, 46, 'HIGH SCORES', 16, C.yellow, 'middle')
  + text(800, 46, fmt(today, true), 8, C.dim, 'end')
  + dashes('M280 70V200M560 70V200M40 218H800')
  + col(140, COIN, GOLD, String(total).padStart(6, '0'), C.cyan, 'CONTRIBUTIONS', `${fmt(runs[0].start, true)} - NOW`)
  + col(420, FLAME, FIRE, current.len, C.pink, 'CURRENT STREAK', current.len ? span(current) : `LAST ACTIVE ${fmt(last.end, true)}`)
  + col(700, CROWN, GOLD, longest.len, C.yellow, 'LONGEST STREAK', span(longest))
  + text(40, 246, 'LAST 30 DAYS', 8, C.dim)
  + days.slice(-30).map(([, n], i) => {
    const fill = !n ? C.off : n < 3 ? '#0e4429' : n < 6 ? '#006d32' : n < 10 ? '#26a641' : '#39d353';
    return `<rect x="${152 + i * 13}" y="237" width="10" height="10" fill="${fill}"/>`;
  }).join('')
  + text(800, 246, current.len ? `COMBO x${current.len}! KEEP IT UP` : 'INSERT COMMIT TO CONTINUE', 8, C.yellow, 'end', 'blink');

const SEGS = 24, filled = Math.round(((total - xpFrom) / (xpTo - xpFrom)) * SEGS);
const info = [
  ['GUILD', 'BITCHIEF TECHNOLOGY SERVICES'],
  ['HOME', 'GHAZIABAD, UTTAR PRADESH, INDIA'],
  ['ACADEMY', 'CSE @ RKGIT, CLASS OF 2024'],
  ['SKILLS', 'SOFTWARE DEV / IoT / EMBEDDED SYSTEMS'],
  ['FUEL', 'COFFEE (UNLIMITED)'],
  ['MOTTO', '"CODE. CREATE. INNOVATE."'],
];
const player = box(32, 36, 88, 100, C.cyan) + box(36, 40, 80, 92, C.panel)
  + `<g class="bob">${sprite(AVATAR, 40, 48, 6, DEV)}</g>`
  + text(140, 66, 'AADITYA PANDA', 20, C.text)
  + text(800, 66, `LVL ${lvl}`, 16, C.yellow, 'end')
  + text(140, 92, 'SOFTWARE DEVELOPER', 10, C.pink)
  + text(140, 123, 'EXP', 10, C.cyan)
  + Array.from({ length: SEGS }, (_, i) => `<rect x="${180 + i * 20}" y="111" width="16" height="12" fill="${i < filled ? C.cyan : C.off}"/>`).join('')
  + text(800, 123, `${total} / ${xpTo}`, 10, C.dim, 'end')
  + dashes('M40 156H800')
  + info.map(([k, v], i) => text(40, 186 + i * 24, k, 10, C.cyan) + text(150, 186 + i * 24, v, 10, C.text)).join('');

// --- font: Press Start 2P, subset to the glyphs used and embedded (README images can't load external fonts)
const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Press+Start+2P&text=${encodeURIComponent([...new Set(glyphs)].join(''))}`)).text();
const [, fontUrl, format] = css.match(/url\((.+?)\) format\('(.+?)'\)/);
const font = Buffer.from(await (await fetch(fontUrl)).arrayBuffer()).toString('base64');
const style = `@font-face{font-family:P2P;src:url(data:font/${format === 'woff2' ? 'woff2' : 'ttf'};base64,${font})}`
  + 'text{font-family:P2P,monospace}.blink{animation:blink 1s steps(1) infinite}@keyframes blink{50%{opacity:0}}'
  + '.bob{animation:bob 1.2s steps(1) infinite}@keyframes bob{50%{transform:translateY(-4px)}}';
const frame = (w, h) => box(0, 0, w, h, C.cyan) + box(4, 4, w - 8, h - 8, C.bg) + box(10, 10, w - 20, h - 20, C.pink, 2) + box(12, 12, w - 24, h - 24, C.bg, 2);
const svg = (w, h, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" role="img" aria-label="${title}"><title>${title}</title><style>${style}</style>${frame(w, h)}${body}</svg>`;

mkdirSync('dist', { recursive: true });
writeFileSync('dist/player.svg', svg(840, 330, `Aaditya Panda, level ${lvl} software developer`, player));
writeFileSync('dist/streak.svg', svg(840, 280, `${total} contributions, current streak ${current.len}, longest streak ${longest.len}`, streak));
console.log({ total, current: current.len, longest: longest.len, lvl });
