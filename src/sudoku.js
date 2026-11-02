// Sudoku 数独 : moteur (générateur, solveur par techniques, raisonnements) puis interface
const SudoEngine = (function () {
  const N = 81, ALL = 0x3FE;   // bits 1..9
  const ROW = [], COL = [], BOX = [], PEERS = [], UNITS = [];
  for (let i = 0; i < N; i++) { ROW.push((i / 9) | 0); COL.push(i % 9); BOX.push(((ROW[i] / 3) | 0) * 3 + ((COL[i] / 3) | 0)); }
  const unitCells = [];
  for (let u = 0; u < 9; u++) unitCells.push([...Array(9).keys()].map(k => u * 9 + k));                       // rows
  for (let u = 0; u < 9; u++) unitCells.push([...Array(9).keys()].map(k => k * 9 + u));                       // cols
  for (let u = 0; u < 9; u++) { const r0 = ((u / 3) | 0) * 3, c0 = (u % 3) * 3; const l = []; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) l.push((r0 + a) * 9 + c0 + b); unitCells.push(l); }
  for (let i = 0; i < N; i++) {
    UNITS.push([ROW[i], 9 + COL[i], 18 + BOX[i]]);
    const s = new Set(); for (const u of UNITS[i]) for (const j of unitCells[u]) if (j !== i) s.add(j);
    PEERS.push([...s]);
  }
  const bits = m => { const l = []; for (let d = 1; d <= 9; d++) if (m & (1 << d)) l.push(d); return l; };
  const pop = m => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  const unitName = u => u < 9 ? 'cette ligne' : u < 18 ? 'cette colonne' : 'ce carré';
  // candidates from values
  function cands(v) {
    const c = new Int16Array(N);
    for (let i = 0; i < N; i++) {
      if (v[i]) { c[i] = 1 << v[i]; continue; }
      let m = ALL; for (const j of PEERS[i]) if (v[j]) m &= ~(1 << v[j]);
      c[i] = m;
    }
    return c;
  }
  // Logical solver. note(i, d, text, unit) -> true to stop. Returns false on contradiction.
  function propagate(v, c, note, opts) {
    opts = opts || {};
    let changed = true;
    const place = (i, d, why, unit) => {
      v[i] = d; c[i] = 1 << d;
      for (const j of PEERS[i]) if (!v[j]) c[j] &= ~(1 << d);
      return note ? note(i, d, why, unit) : false;
    };
    while (changed) {
      changed = false;
      for (let i = 0; i < N; i++) {
        if (v[i]) continue;
        if (!c[i]) return false;
        if (pop(c[i]) === 1) {
          const d = bits(c[i])[0];
          if (place(i, d, `Cette case ne peut contenir que le ${d} : tous les autres chiffres sont déjà dans sa ligne, sa colonne ou son carré.`, -1)) return 'stop';
          changed = true;
        }
      }
      if (changed) continue;
      for (let u = 0; u < 27 && !changed; u++) {
        for (let d = 1; d <= 9; d++) {
          let where = -1, n = 0, placed = false;
          for (const j of unitCells[u]) { if (v[j] === d) { placed = true; break; } if (!v[j] && (c[j] & (1 << d))) { n++; where = j; } }
          if (placed) continue;
          if (!n) return false;
          if (n === 1) {
            if (place(where, d, `Dans ${unitName(u)}, le ${d} ne peut aller qu'ici : toutes les autres cases libres le voient déjà.`, u)) return 'stop';
            changed = true; break;
          }
        }
      }
      if (changed || !opts.advanced) continue;
      // pointing / claiming : a digit confined to one box line removes it elsewhere
      for (let b = 18; b < 27 && !changed; b++) for (let d = 1; d <= 9; d++) {
        const cells = unitCells[b].filter(j => !v[j] && (c[j] & (1 << d)));
        if (cells.length < 2) continue;
        for (const lineOf of [ROW, COL]) {
          const l = lineOf[cells[0]];
          if (!cells.every(j => lineOf[j] === l)) continue;
          const lineUnit = lineOf === ROW ? l : 9 + l;
          for (const j of unitCells[lineUnit]) if (!v[j] && BOX[j] !== b - 18 && (c[j] & (1 << d))) { c[j] &= ~(1 << d); changed = true; }
        }
      }
      // naked pairs
      for (let u = 0; u < 27 && !changed; u++) {
        const cs = unitCells[u].filter(j => !v[j] && pop(c[j]) === 2);
        for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) if (c[cs[a]] === c[cs[b]]) {
          for (const j of unitCells[u]) if (j !== cs[a] && j !== cs[b] && !v[j] && (c[j] & c[cs[a]])) { c[j] &= ~c[cs[a]]; changed = true; }
        }
      }
    }
    return true;
  }
  function solve(v0, limit) {        // fast backtracking for counting
    let count = 0, sol = null;
    const rec = (v, c) => {
      if (count >= limit) return;
      if (propagate(v, c) === false) return;
      let best = -1, bc = 10;
      for (let i = 0; i < N; i++) if (!v[i]) { const p = pop(c[i]); if (p < bc) { bc = p; best = i; if (p === 2) break; } }
      if (best < 0) { count++; sol = Array.from(v); return; }
      for (const d of bits(c[best])) {
        const v2 = v.slice(), c2 = c.slice();
        v2[best] = d; c2[best] = 1 << d;
        for (const j of PEERS[best]) if (!v2[j]) c2[j] &= ~(1 << d);
        rec(v2, c2);
        if (count >= limit) return;
      }
    };
    const v = Int8Array.from(v0);
    rec(v, cands(v));
    return { count, sol };
  }
  function fullGrid() {
    const v = new Int8Array(N);
    const rec = i => {
      if (i === N) return true;
      const c = cands(v)[i], ds = bits(c).sort(() => Math.random() - 0.5);
      for (const d of ds) { v[i] = d; if (rec(i + 1)) return true; }
      v[i] = 0; return false;
    };
    rec(0);
    return Array.from(v);
  }
  // difficulty: 0 = singles only, 1 = needs pairs/pointing, 2 = needs proofs by contradiction (look = count)
  function rate(given) {
    let v = Int8Array.from(given), c = cands(v);
    if (propagate(v, c) === false) return { level: -1 };
    const open = () => v.filter(x => !x).length;
    if (!open()) return { level: 0, look: 0 };
    if (propagate(v, c, null, { advanced: true }) === false) return { level: -1 };
    if (!open()) return { level: 1, look: 0 };
    let look = 0;
    while (open()) {
      let progress = false;
      for (let i = 0; i < N && !progress; i++) {
        if (v[i]) continue;
        for (const d of bits(c[i])) {
          const v2 = v.slice(), c2 = c.slice();
          v2[i] = d; c2[i] = 1 << d; for (const j of PEERS[i]) if (!v2[j]) c2[j] &= ~(1 << d);
          if (propagate(v2, c2, null, { advanced: true }) === false) { c[i] &= ~(1 << d); look++; progress = true; break; }
        }
        if (progress && propagate(v, c, null, { advanced: true }) === false) return { level: -1 };
      }
      if (!progress) return { level: 3, look };
    }
    return { level: 2, look };
  }
  function generate(L) {
    const t0 = Date.now();
    let best = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      const sol = fullGrid(), g = sol.slice();
      const order = [...Array(41).keys()].sort(() => Math.random() - 0.5);  // symmetric pairs (i, 80 - i)
      for (const i of order) {
        if (g.filter(x => x).length <= L.givens) break;
        const j = 80 - i, a = g[i], b = g[j];
        g[i] = 0; g[j] = 0;
        const r = solve(g, 2);
        if (r.count !== 1) { g[i] = a; g[j] = b; continue; }
        const rt = rate(g);
        if (rt.level > L.maxLevel) { g[i] = a; g[j] = b; }
      }
      const rt = rate(g);
      const ok = rt.level >= L.minLevel && (!L.look || rt.look >= L.look);
      if (ok) return { W: 9, H: 9, given: g, sol, rating: rt };
      if (!best || rt.level > best.rating.level || (rt.level === best.rating.level && rt.look > best.rating.look)) best = { W: 9, H: 9, given: g, sol, rating: rt };
      if (Date.now() - t0 > 6000) break;
    }
    return best;
  }
  return { N, ROW, COL, BOX, PEERS, UNITS, unitCells, bits, pop, cands, propagate, solve, rate, generate };
})();
if (typeof module !== 'undefined') module.exports = SudoEngine;

// ---------------------------------------------------------------------------
// Interface Sudoku. st.x : 0..80 chiffres du joueur, 81..161 notes (masques).
// ---------------------------------------------------------------------------
(function () {
  if (typeof registerGame === 'undefined') return;
  const E = SudoEngine;
  let sel = -1, notesMode = false;
  const LV = {
    facile:    { W: 9, H: 9, givens: 38, minLevel: 0, maxLevel: 0, label: 'Facile',    kanji: '易', sizeLabel: '9×9 · déductions simples' },
    moyen:     { W: 9, H: 9, givens: 30, minLevel: 0, maxLevel: 0, label: 'Moyen',     kanji: '中', sizeLabel: '9×9 · moins de chiffres' },
    difficile: { W: 9, H: 9, givens: 26, minLevel: 1, maxLevel: 1, label: 'Difficile', kanji: '難', sizeLabel: '9×9 · paires et alignements' },
    expert:    { W: 9, H: 9, givens: 24, minLevel: 2, maxLevel: 2, label: 'Expert',    kanji: '極', sizeLabel: '9×9 · raisonnement par l\'absurde' },
    maitre:    { W: 9, H: 9, givens: 22, minLevel: 2, maxLevel: 2, look: 6, label: 'Maître', kanji: '鬼', sizeLabel: '9×9 · chaînes d\'absurdes' }
  };
  const val = (s, i) => s.given[i] || s.x[i];
  const values = s => { const v = new Int8Array(81); for (let i = 0; i < 81; i++) v[i] = val(s, i); return v; };
  function conflicts(s) {
    const bad = new Set(), v = values(s);
    for (let i = 0; i < 81; i++) if (v[i]) for (const j of E.PEERS[i]) if (v[j] === v[i]) bad.add(i);
    return bad;
  }
  function setDigit(s, d) {
    if (sel < 0 || s.given[sel]) return;
    const i = sel;
    if (notesMode && d) {
      if (s.x[i]) return;
      commit(() => { s.x[81 + i] ^= 1 << d; });
      return;
    }
    if (s.x[i] === d) d = 0;
    commit(() => {
      s.x[i] = d; s.x[81 + i] = 0;
      if (d) for (const j of E.PEERS[i]) s.x[81 + j] &= ~(1 << d);   // clean notes of peers
      fresh = d ? i : null;
    });
  }
  function findHint(s) {
    for (let i = 0; i < 81; i++) if (s.x[i] && s.x[i] !== s.sol[i]) return { type: 'wrong', i, d: 0, text: `Ce ${s.x[i]} n'est pas à sa place : retire-le.` };
    const v = Int8Array.from(s.sol.map((x, i) => (s.given[i] || (s.x[i] === x ? x : 0))));
    const c = E.cands(v);
    let found = null;
    const note = (i, d, why, u) => { found = { i, d, text: why, unit: u }; return true; };
    E.propagate(v, c, note);
    if (!found) {
      E.propagate(v, c, note, { advanced: true });
      if (found) found.text += ' (Après avoir appliqué les paires et les alignements de chiffres dans les carrés.)';
    }
    for (let round = 0; round < 60 && !found; round++) {
      let progress = false;
      for (let i = 0; i < 81 && !progress; i++) {
        if (v[i]) continue;
        for (const d of E.bits(c[i])) {
          const v2 = v.slice(), c2 = c.slice();
          v2[i] = d; c2[i] = 1 << d; for (const j of E.PEERS[i]) if (!v2[j]) c2[j] &= ~(1 << d);
          if (E.propagate(v2, c2, null, { advanced: true }) === false) {
            c[i] &= ~(1 << d); progress = true;
            if (E.pop(c[i]) === 1) {
              const left = E.bits(c[i])[0];
              found = { i, d: left, text: `Raisonnement par l'absurde : si on mettait le ${d} ici, une autre case n'aurait plus aucun chiffre possible. Il ne reste donc que le ${left}.` };
            }
            break;
          }
        }
      }
      if (!progress) break;
      if (!found) E.propagate(v, c, (i, d, why, u) => { found = { i, d, unit: u, text: why + ' (Après avoir éliminé certains chiffres par l\'absurde.)' }; return true; }, { advanced: true });
    }
    if (!found) for (let i = 0; i < 81; i++) if (!val(s, i)) { found = { i, d: s.sol[i], text: `Déduction avancée : cette case contient le ${s.sol[i]}.` }; break; }
    return found;
  }
  function padRefresh(s) {
    const pad = document.getElementById('sdPad');
    if (!pad || !s) return;
    const v = values(s), cnt = new Array(10).fill(0);
    for (let i = 0; i < 81; i++) if (v[i]) cnt[v[i]]++;
    pad.querySelectorAll('[data-d]').forEach(b => {
      const d = +b.dataset.d;
      b.classList.toggle('done', cnt[d] >= 9);
      b.classList.toggle('same', sel >= 0 && v[sel] === d);
    });
    document.getElementById('sdNotes').classList.toggle('on', notesMode);
  }
  const FIGS = (() => {
    const s = 18;
    const row = [3, 7, 1, 9, 4, 6, 2, 8, 5];
    let a = figGrid(9, 1, s, 0, 0, (k, t) => t === 'c' && k % 3 === 0);
    row.forEach((d, k) => a += figNum(k * s + s / 2, s / 2, d, '', 12));
    const box = [[5, 3, 8], [1, 5, 2], [7, 4, 6]];
    let b = figGrid(3, 3, s * 1.4, 0, 0);
    box.forEach((l, r) => l.forEach((d, c) => b += figNum(c * s * 1.4 + s * .7, r * s * 1.4 + s * .7, d, d === 5 ? 'r' : '', 15)));
    b += `<circle class="frs" cx="${s * .7}" cy="${s * .7}" r="10"/><circle class="frs" cx="${s * 1.4 + s * .7}" cy="${s * 1.4 + s * .7}" r="10"/>`;
    const box2 = [[2, 7, 4], [8, 0, 1], [6, 3, 5]];
    let c = figGrid(3, 3, s * 1.4, 0, 0);
    box2.forEach((l, r) => l.forEach((d, k) => { if (d) c += figNum(k * s * 1.4 + s * .7, r * s * 1.4 + s * .7, d, '', 15); }));
    c += `<rect class="fh" x="${s * 1.4}" y="${s * 1.4}" width="${s * 1.4}" height="${s * 1.4}"/>` + figNum(s * 1.4 + s * .7, s * 1.4 + s * .7, 9, 'r', 15);
    return figFigs(
      ruleFig(a, 9 * s, s, 'Une ligne contient chaque chiffre de 1 à 9 une seule fois (de même pour chaque colonne et chaque carré).', 'ok', true),
      ruleFig(b, 3 * s * 1.4, 3 * s * 1.4, 'Deux 5 dans le même carré : c\'est impossible.', 'no'),
      ruleFig(c, 3 * s * 1.4, 3 * s * 1.4, 'Il ne manque qu\'un chiffre à ce carré : forcément le 9.'));
  })();
  registerGame({
    id: 'sudoku', name: 'Sudoku', kanji: '数', winText: 'Grille complète',
    levels: LV,
    rules: `<h3 style="margin-top:0">Sudoku 数 : les règles</h3><ul>
      <li>Remplis la grille avec les chiffres de <b>1 à 9</b>.</li>
      <li>Chaque <b>ligne</b>, chaque <b>colonne</b> et chaque <b>carré 3×3</b> contient une seule fois chaque chiffre.</li></ul>${FIGS}
      <h3>Commandes</h3><ul>
      <li>Touche une case, puis un chiffre du pavé. Retoucher le même chiffre l'efface.</li>
      <li>Le bouton <b>Notes</b> écrit de petits chiffres candidats au lieu du chiffre final.</li>
      <li>Les chiffres en conflit apparaissent en rouge. Les chiffres déjà placés 9 fois s'estompent dans le pavé.</li></ul>`,
    valid: s => !!s.given && !!s.sol && s.x && s.x.length === 162,
    generate: L => { const g = E.generate(L); return { W: 9, H: 9, given: g.given, sol: g.sol }; },
    emptyX: s => new Array(162).fill(0),
    prepare: s => { sel = -1; notesMode = false; },
    progress: s => { let p = 0; for (let i = 0; i < 81; i++) if (!s.given[i] && s.x[i] === s.sol[i]) p++; return p; },
    check: s => {
      for (let i = 0; i < 81; i++) if (!val(s, i)) return false;
      return conflicts(s).size === 0 ? true : 'La grille est pleine, mais certains chiffres se répètent.';
    },
    wrong: s => { const b = new Set(); for (let i = 0; i < 81; i++) if (s.x[i] && s.x[i] !== s.sol[i]) b.add(i); return b; },
    wrongText: n => `${plural(n, 'chiffre')} faux, en rouge.`,
    findHint: s => {
      const h = findHint(s);
      if (!h) return null;
      h.r = E.ROW[h.i]; h.c = E.COL[h.i];
      h.focusText = h.type === 'wrong' ? 'L\'erreur est dans cette case.' : (h.unit >= 0 && h.unit !== undefined ? `Regarde ${h.unit < 9 ? 'cette ligne' : h.unit < 18 ? 'cette colonne' : 'ce carré'}.` : 'Regarde cette case.');
      h.fresh = h.i;
      h.apply = st => { st.x[h.i] = h.d; st.x[81 + h.i] = 0; if (h.d) for (const j of E.PEERS[h.i]) st.x[81 + j] &= ~(1 << h.d); sel = h.i; };
      return h;
    },
    render: (s, ctx) => {
      const out = [], v = values(s), bad = conflicts(s), h = ctx.hint;
      const sv = sel >= 0 ? v[sel] : 0;
      for (let i = 0; i < 81; i++) {
        const r = E.ROW[i], c = E.COL[i], x = c * S, y = r * S;
        let cls = 'sd-cell';
        if (sel >= 0 && (E.ROW[sel] === r || E.COL[sel] === c || E.BOX[sel] === E.BOX[i])) cls += ' zone2';
        if (sv && v[i] === sv) cls += ' samed';
        if (i === sel) cls += ' sel';
        out.push(`<rect class="${cls}" x="${x}" y="${y}" width="${S}" height="${S}"/>`);
      }
      if (h && h.level >= 2 && h.unit >= 0 && h.unit !== undefined) {
        const cells = E.unitCells[h.unit];
        const rs = cells.map(i => E.ROW[i]), cs = cells.map(i => E.COL[i]);
        const r0 = Math.min(...rs), r1 = Math.max(...rs), c0 = Math.min(...cs), c1 = Math.max(...cs);
        out.push(`<rect class="hcell" x="${c0 * S + 3}" y="${r0 * S + 3}" width="${(c1 - c0 + 1) * S - 6}" height="${(r1 - r0 + 1) * S - 6}" rx="6"/>`);
      }
      for (let k = 0; k <= 9; k++) {
        const b = k % 3 === 0 ? ' b' : '';
        out.push(`<line class="gl${b}" x1="0" y1="${k * S}" x2="${9 * S}" y2="${k * S}"/><line class="gl${b}" x1="${k * S}" y1="0" x2="${k * S}" y2="${9 * S}"/>`);
      }
      for (let i = 0; i < 81; i++) {
        const r = E.ROW[i], c = E.COL[i], cx = c * S + S / 2, cy = r * S + S / 2;
        if (s.given[i]) out.push(`<text class="sd-g${bad.has(i) ? ' bad' : ''}" x="${cx}" y="${cy + 11}">${s.given[i]}</text>`);
        else if (s.x[i]) {
          const wrong = ctx.flash && ctx.flash.has(i);
          out.push(`<text class="sd-u${bad.has(i) || wrong ? ' bad' : ''}${ctx.fresh === i ? ' fresh' : ''}" x="${cx}" y="${cy + 11}">${s.x[i]}</text>`);
        } else if (s.x[81 + i]) {
          for (const d of E.bits(s.x[81 + i])) {
            const nx = c * S + 12 + ((d - 1) % 3) * 18, ny = r * S + 17 + (((d - 1) / 3) | 0) * 18;
            out.push(`<text class="sd-n" x="${nx}" y="${ny}">${d}</text>`);
          }
        }
      }
      if (h && h.level >= 2 && (h.unit === undefined || h.unit < 0)) {
        const r = E.ROW[h.i], c = E.COL[h.i];
        out.push(`<rect class="hcell" x="${c * S + 3}" y="${r * S + 3}" width="${S - 6}" height="${S - 6}" rx="5"/>`);
      }
      if (h && h.level >= 3 && h.d && !val(s, h.i)) {
        const r = E.ROW[h.i], c = E.COL[h.i];
        out.push(`<text class="sd-ghost" x="${c * S + S / 2}" y="${r * S + S / 2 + 11}">${h.d}</text>`);
      }
      return out.join('');
    },
    afterRender: s => padRefresh(s),
    padHTML: () => `<div id="sdPad" class="sd-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<button data-d="${d}">${d}</button>`).join('')}<button id="sdNotes" class="sd-wide">Notes</button><button id="sdErase" class="sd-wide">Gomme</button></div>`,
    padBind: s => {
      document.querySelectorAll('#sdPad [data-d]').forEach(b => b.addEventListener('click', () => { if (!won) setDigit(st, +b.dataset.d); }));
      document.getElementById('sdNotes').addEventListener('click', () => { notesMode = !notesMode; padRefresh(st); });
      document.getElementById('sdErase').addEventListener('click', () => {
        if (won || sel < 0 || st.given[sel] || (!st.x[sel] && !st.x[81 + sel])) return;
        commit(() => { st.x[sel] = 0; st.x[81 + sel] = 0; });
      });
    },
    onKey: (s, e) => {
      if (/^[1-9]$/.test(e.key)) { setDigit(s, +e.key); e.preventDefault(); }
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { if (sel >= 0 && !s.given[sel] && s.x[sel]) commit(() => { s.x[sel] = 0; }); }
      else if (e.key === 'n') { notesMode = !notesMode; padRefresh(s); }
      else if (e.key.startsWith('Arrow') && sel >= 0) {
        const r = E.ROW[sel], c = E.COL[sel];
        const m = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
        sel = ((r + m[0] + 9) % 9) * 9 + (c + m[1] + 9) % 9; render(); e.preventDefault();
      }
    },
    pointerDown: (s, pt) => {
      const cell = cellAt(pt);
      if (!cell) return { pan: true };
      sel = cell.r * 9 + cell.c; render();
      return { pan: false };
    },
    pointerUp: () => {}
  });
})();
