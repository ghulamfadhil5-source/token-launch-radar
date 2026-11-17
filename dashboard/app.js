// Launch Radar page: renders the board from window.RADAR (written by main.ts),
// with search, category/chain filters, sorting, a live-token view and a detail
// card for every protocol. No network: all data comes from data.js beside it.
//
// Views are hash-routed so each screenshot is one address:
//   #/                       the board
//   #/protocol/<slug>        the board with one protocol's detail open
//   #/filter/<category>      the board filtered to one category
//   #/live                   the live-token view (market values, not a model)

(function () {
  'use strict';

  var D = window.RADAR;
  if (!D || !Array.isArray(D.rows)) {
    document.getElementById('rows').innerHTML = '<tr><td class="empty" colspan="7">No radar data loaded.</td></tr>';
    return;
  }

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- formatting ---------- */

  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + trim2(n / 1e9) + 'B';
    if (n >= 1e6) return '$' + trim2(n / 1e6) + 'M';
    if (n >= 1e3) return '$' + trim2(n / 1e3) + 'K';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function trim2(n) {
    var s = n.toFixed(2);
    return s.replace(/0$/, '').replace(/\.0$/, '');
  }
  function pct(n) {
    if (n === null || n === undefined) return { text: '—', cls: 'flat' };
    var v = n.toFixed(2);
    if (n > 0) return { text: '+' + v + '%', cls: 'up' };
    if (n < 0) return { text: '−' + Math.abs(n).toFixed(2) + '%', cls: 'down' };
    return { text: '0.00%', cls: 'flat' };
  }
  function ageText(days) {
    if (days === null || days === undefined) return '—';
    if (days < 365) return days + 'd';
    return (days / 365).toFixed(1) + 'y';
  }
  function chainsText(chains) {
    if (!chains || chains.length === 0) return '—';
    return chains.slice(0, 2).join(', ') + (chains.length > 2 ? ' +' + (chains.length - 2) : '');
  }

  /* ---------- state ---------- */

  var state = {
    q: '',
    category: '',
    chain: '',
    sort: 'rank',
    sortDir: 1,
    view: 'pre', // 'pre' | 'live'
    selected: null,
  };

  var bySlug = {};
  D.rows.forEach(function (r) { bySlug[r.slug] = r; });

  /* ---------- filters ---------- */

  function fillSelect(el, values) {
    values.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      el.appendChild(o);
    });
  }
  var categories = Array.from(new Set(D.rows.map(function (r) { return r.category || 'Uncategorised'; }))).sort();
  var chains = Array.from(new Set(D.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
  fillSelect($('category'), categories);
  fillSelect($('chain'), chains);

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var rows = D.rows.filter(function (r) {
      if (state.category && (r.category || 'Uncategorised') !== state.category) return false;
      if (state.chain && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (q) {
        var hay = [r.name, r.category || '', (r.chains || []).join(' ')].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var key = state.sort;
    var dir = state.sortDir;
    rows.sort(function (a, b) {
      var av, bv;
      if (key === 'rank') { av = a.rank; bv = b.rank; }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? -1 : a.age_days; bv = b.age_days === null ? -1 : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av === bv) return a.rank - b.rank;
      return (av < bv ? -1 : 1) * dir;
    });
    return rows;
  }

  /* ---------- board ---------- */

  var maxImplied = D.rows.length ? D.rows[0].implied_value_usd : 1;

  function rowHtml(r) {
    var g = pct(r.change_7d);
    var barPct = Math.max(2, Math.round((r.implied_value_usd / maxImplied) * 100));
    var sel = state.selected === r.slug ? ' class="selected"' : '';
    return '<tr data-slug="' + r.slug + '"' + sel + '>' +
      '<td class="rank">' + r.rank + '</td>' +
      '<td><div class="pname">' + esc(r.name) + '</div><div class="psub">' + esc(r.category || 'Uncategorised') + ' on ' + esc(chainsText(r.chains)) + '</div></td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num"><span class="' + g.cls + '">' + g.text + '</span></td>' +
      '<td class="num">' + ageText(r.age_days) + '</td>' +
      '<td><span class="bar"><i style="width:' + barPct + '%"></i></span><span class="val">' + money(r.implied_value_usd) + '</span></td>' +
      '<td><span class="token-dot">no token</span></td>' +
      '</tr>';
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderBoard() {
    var rows = filteredRows();
    var html = rows.map(rowHtml).join('');
    if (!rows.length) html = '<tr><td class="empty" colspan="7">No protocol matches this filter.</td></tr>';
    $('rows').innerHTML = html;
    $('count').textContent = rows.length + (rows.length === 1 ? ' row' : ' rows') + ' shown';
    $('board-note').textContent = state.view === 'live'
      ? 'Live tokens, largest market cap first. These already trade: their market cap is the market\u2019s own value, never a model.'
      : 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.';
  }

  /* ---------- live view ---------- */

  function renderLive() {
    var html = D.live.map(function (p, i) {
      var g = pct(p.change_7d);
      return '<tr>' +
        '<td class="rank">' + (i + 1) + '</td>' +
        '<td><div class="pname">' + esc(p.name) + '</div><div class="psub">' + esc(p.category || 'Uncategorised') + ' on ' + esc(chainsText(p.chains)) + '</div></td>' +
        '<td class="num">' + money(p.tvl_usd) + '</td>' +
        '<td class="num"><span class="' + g.cls + '">' + g.text + '</span></td>' +
        '<td class="num">' + money(p.mcap_usd) + '</td>' +
        '<td><span class="token-dot live">trades</span></td>' +
        '</tr>';
    }).join('');
    $('liverows').innerHTML = html;
    $('count').textContent = D.live.length + ' live tokens shown';
  }

  /* ---------- detail ---------- */

  function splitStep(s) {
    var at = s.indexOf(' Cost: ');
    if (at < 0) return { action: s, cost: '' };
    return { action: s.slice(0, at), cost: s.slice(at + 1) };
  }

  function renderDetail() {
    var card = $('detail');
    var r = state.selected ? bySlug[state.selected] : null;
    if (!r) { card.hidden = true; return; }
    card.hidden = false;
    $('d-kicker').textContent = 'Rank ' + r.rank + ' of ' + D.rows.length;
    $('d-name').textContent = r.name;
    $('d-sub').textContent = (r.category || 'Uncategorised') + ' on ' + (r.chains || []).join(', ');
    var g = pct(r.change_7d);
    var base = Math.round(r.tvl_usd * r.category_multiple);
    $('d-figs').innerHTML =
      fig('TVL', money(r.tvl_usd)) +
      fig('Seven-day growth', '<span class="' + g.cls + '">' + g.text + '</span>') +
      fig('Age with no token', ageText(r.age_days)) +
      fig('Category multiple', r.category_multiple.toFixed(3) + (r.calibration_sample > 0 ? ' (category median, n=' + r.calibration_sample + ')' : ' (global median)')) +
      fig('Growth multiplier', r.growth_multiplier.toFixed(3)) +
      fig('Maturity multiplier', r.maturity_multiplier.toFixed(3)) +
      fig('Implied value', '<span class="big">' + money(r.implied_value_usd) + '</span>');
    $('d-model').innerHTML =
      '<p class="model-line">Base = TVL ' + money(r.tvl_usd) + ' × ' + r.category_multiple.toFixed(3) + ' = <b>' + money(base) + '</b></p>' +
      '<p class="model-line">Implied = base × ' + r.growth_multiplier.toFixed(3) + ' (growth) × ' + r.maturity_multiplier.toFixed(3) + ' (maturity) = <b>' + money(r.implied_value_usd) + '</b></p>' +
      '<p class="model-line">The category multiple is the median market-cap-to-TVL ratio of the live-token protocols in ' +
      esc(r.category || 'this category') + ' in this same snapshot' +
      (r.calibration_sample > 0 ? ' (' + r.calibration_sample + ' protocols).' : ', falling back to the global median because fewer than 3 live-token protocols in this category report a market cap.') + '</p>';
    $('d-plan').innerHTML = r.farm_steps.map(function (s) {
      var parts = splitStep(s);
      return '<li>' + esc(parts.action) + (parts.cost ? '<span class="cost">' + esc(parts.cost) + '</span>' : '') + '</li>';
    }).join('');
  }

  function fig(label, valueHtml) {
    return '<div class="fig"><span>' + label + '</span><span>' + valueHtml + '</span></div>';
  }

  /* ---------- view switching ---------- */

  function setView(view) {
    state.view = view;
    $('view-pre').classList.toggle('active', view === 'pre');
    $('view-live').classList.toggle('active', view === 'live');
    $('board').hidden = view !== 'pre';
    $('liveboard').hidden = view !== 'live';
    if (view === 'live') renderLive(); else renderBoard();
    renderDetail();
  }

  function renderAll() {
    renderBoard();
    renderDetail();
  }

  /* ---------- stats ---------- */

  $('stat-watch').textContent = D.watchlist_size + ' / ' + D.watchlist_size;
  $('stat-rows').textContent = String(D.rows.length);
  $('stat-top').textContent = money(D.rows.length ? D.rows[0].implied_value_usd : 0);
  $('stat-live').textContent = String(D.live.length);
  $('snap-date').textContent = 'Snapshot ' + D.as_of;
  $('global-mult').textContent = D.global_multiple.toFixed(3);

  /* ---------- events ---------- */

  $('q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
  $('category').addEventListener('change', function (e) { state.category = e.target.value; renderBoard(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
  $('sort').addEventListener('change', function (e) {
    state.sort = e.target.value;
    state.sortDir = state.sort === 'rank' ? 1 : -1;
    renderBoard();
  });
  $('view-pre').addEventListener('click', function () { setView('pre'); });
  $('view-live').addEventListener('click', function () { setView('live'); });
  $('d-close').addEventListener('click', function () {
    state.selected = null;
    if (window.history && window.history.replaceState) window.history.replaceState(null, '', '#/');
    renderDetail(); renderBoard();
  });
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest ? e.target.closest('tr[data-slug]') : null;
    if (!tr) return;
    state.selected = tr.getAttribute('data-slug');
    if (window.history && window.history.replaceState) window.history.replaceState(null, '', '#/protocol/' + state.selected);
    renderDetail(); renderBoard();
    $('detail').scrollIntoView({ block: 'nearest' });
  });
  document.querySelectorAll('th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var key = th.getAttribute('data-sort');
      if (key === 'implied') key = 'rank';
      if (state.sort === key) state.sortDir = -state.sortDir;
      else { state.sort = key; state.sortDir = key === 'rank' ? 1 : -1; }
      var sel = $('sort');
      if (sel) sel.value = state.sort === 'implied' ? 'rank' : state.sort;
      renderBoard();
    });
  });

  /* ---------- hash routing ---------- */

  function applyHash() {
    var h = window.location.hash || '';
    var m;
    if ((m = h.match(/^#\/protocol\/([A-Za-z0-9._-]+)$/))) {
      var slug = m[1];
      if (bySlug[slug]) { state.selected = slug; setView('pre'); }
    } else if ((m = h.match(/^#\/filter\/(.+)$/))) {
      var cat = decodeURIComponent(m[1]);
      if (categories.indexOf(cat) >= 0) { state.category = cat; $('category').value = cat; }
      setView('pre');
    } else if (h === '#/live') {
      setView('live');
    } else {
      setView('pre');
    }
    renderAll();
  }
  window.addEventListener('hashchange', applyHash);
  applyHash();

  window.__shotReady = true;
})();
