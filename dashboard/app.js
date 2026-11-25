// Token Radar dashboard: a static page, no framework and no network.
// Reads window.RADAR (written by main.ts as data.js), renders the ranked
// board, a detail view for every protocol, the live-token view and the method.
//
// The farm plan shown in the detail view is generated here from the row's own
// record — category, chains, TVL and age — by the same rules the board was
// built with, so the page and board.json always agree: six steps, each with
// what it costs and how long it takes.

/* global window, document */
(function () {
  'use strict';

  var D = window.RADAR;
  var rows = D.rows;
  var live = D.live;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    if (n == null) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + n;
  }
  function pct(n) {
    if (n == null) return '—';
    var cls = n > 0 ? 'pos' : n < 0 ? 'neg' : '';
    return '<span class="' + cls + '">' + (n > 0 ? '+' : '') + n.toFixed(1) + '%</span>';
  }
  function ageText(days) {
    if (days == null) return '—';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }

  // ---- farm plan (same rules as lib/model.ts: category, chains, TVL, age) ----
  function capitalFor(tvl) {
    if (tvl >= 1e9) return 200;
    if (tvl >= 1e8) return 120;
    return 60;
  }
  function holdDaysFor(age) {
    if (age == null) return 45;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(row, capital, chain) {
    var c = (row.category || '').toLowerCase();
    var name = row.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Lend $' + capital + ' of USDC on ' + name + ' (' + chain + ') and leave the loan open so the position accrues activity.';
    if (c.indexOf('dex') >= 0 || c.indexOf('amm') >= 0) return 'Add $' + capital + ' of liquidity to the largest pool on ' + name + ' (' + chain + ') and keep the position in range.';
    if (c.indexOf('yield') >= 0 || c.indexOf('vault') >= 0 || c.indexOf('aggregator') >= 0 || c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and hold the vault shares.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' with ' + name + ', then use the bridged funds inside its app.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return 'Post $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and take one position in a ' + name + ' market, then hold it to settlement.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + ' of the yield-bearing asset on ' + name + ' (' + chain + ') and hold it.';
    if (c.indexOf('stable') >= 0) return 'Mint or hold $' + capital + ' of the stable asset issued through ' + name + ' on ' + chain + '.';
    if (c.indexOf('leveraged farm') >= 0) return 'Open a $' + capital + ' leveraged farming position on ' + name + ' (' + chain + ') at low leverage and monitor it weekly.';
    if (c.indexOf('restak') >= 0 || c.indexOf('staking') >= 0) return 'Stake $' + capital + ' of the chain\'s asset through ' + name + ' and keep the receipt token.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and use its core feature once a week.';
  }
  function farmPlan(row) {
    var chain = row.chains && row.chains.length ? row.chains[0] : 'its main chain';
    var capital = capitalFor(row.tvl_usd);
    var hold = holdDaysFor(row.age_days);
    var steps = [
      { text: 'Set up a fresh wallet that holds only the funds you plan to farm, and store its seed phrase offline, never in a screenshot or a chat.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(row, capital, chain), cost: '$' + capital + ' of capital plus about $5 of gas', time: '15 minutes to set up' },
      { text: 'Do one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and keep the receipts.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity lands in more than one snapshot window.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: 'Before you withdraw, open the protocol\'s own points or rewards page from the link it publishes and claim only there.', cost: 'free to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction hash in a farm log, then plan the exit before the token is announced.', cost: 'nothing but the log', time: '5 minutes' }
    ];
    return steps.map(function (s) {
      var t = s.text + ' Cost: ' + s.cost + '. Time: ' + s.time + '.';
      if (t.length > 600) t = t.slice(0, 596) + '...';
      return t;
    });
  }

  // ---- state ----
  var state = { tab: 'board', q: '', cat: '', chain: '', scope: 'all', sort: 'implied', dir: -1 };

  function categories() {
    var seen = {};
    rows.forEach(function (r) { if (r.category) seen[r.category] = 1; });
    return Object.keys(seen).sort();
  }
  function chains() {
    var seen = {};
    rows.forEach(function (r) { (r.chains || []).forEach(function (c) { seen[c] = 1; }); });
    return Object.keys(seen).sort();
  }
  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (state.scope === 'watch' && !r.on_watchlist) return false;
      if (state.scope === 'early' && r.on_watchlist) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort;
    var dir = state.dir;
    list.sort(function (a, b) {
      var va, vb;
      if (key === 'tvl') { va = a.tvl_usd; vb = b.tvl_usd; }
      else if (key === 'growth') { va = a.change_7d == null ? -Infinity : a.change_7d; vb = b.change_7d == null ? -Infinity : b.change_7d; }
      else if (key === 'age') { va = a.age_days == null ? -1 : a.age_days; vb = b.age_days == null ? -1 : b.age_days; }
      else if (key === 'name') { return dir * (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); }
      else { va = a.implied_value_usd; vb = b.implied_value_usd; }
      return dir * (va - vb);
    });
    return list;
  }

  function boardTable(list) {
    var h = '<table><thead><tr>'
      + '<th data-sort="rank">#</th><th data-sort="name">Protocol</th><th data-sort="cat">Category</th>'
      + '<th data-sort="tvl" class="num">TVL</th><th data-sort="growth" class="num">7d</th>'
      + '<th data-sort="age" class="num">Age</th><th data-sort="implied" class="num">Implied value</th>'
      + '</tr></thead><tbody>';
    list.forEach(function (r) {
      var badge = r.on_watchlist
        ? '<span class="badge watch">WATCHLIST</span>'
        : '<span class="badge early">EARLY FIND</span>';
      h += '<tr data-slug="' + esc(r.slug) + '"><td class="mono">' + r.rank + '</td>'
        + '<td><span class="name">' + esc(r.name) + '</span>' + badge
        + '<div class="sub">' + esc(r.chains.join(', ')) + '</div></td>'
        + '<td>' + esc(r.category || '—') + '</td>'
        + '<td class="num mono">' + money(r.tvl_usd) + '</td>'
        + '<td class="num mono">' + pct(r.change_7d) + '</td>'
        + '<td class="num mono">' + ageText(r.age_days) + '</td>'
        + '<td class="num mono"><b>' + money(r.implied_value_usd) + '</b></td></tr>';
    });
    return h + '</tbody></table>';
  }

  function detailHtml(r) {
    var peer = r.peer_multiple;
    var base = Math.round(r.tvl_usd * peer);
    var steps = farmPlan(r);
    var h = '<div class="detail" id="detail"><div class="card" role="dialog" aria-label="' + esc(r.name) + '">'
      + '<button class="close" id="closeDetail" aria-label="Close">×</button>'
      + '<h2>#' + r.rank + ' ' + esc(r.name) + '</h2>'
      + '<p class="meta">' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ')) + ' · tracked since ' + esc(r.listed_at || 'unknown') + '</p>'
      + '<div class="kv">'
      + '<div><b>' + money(r.implied_value_usd) + '</b><span>Implied value</span></div>'
      + '<div><b>' + money(r.tvl_usd) + '</b><span>TVL</span></div>'
      + '<div><b>' + pct(r.change_7d) + '</b><span>TVL change, 7d</span></div>'
      + '<div><b>' + ageText(r.age_days) + '</b><span>Age with no token</span></div>'
      + '</div>'
      + '<div class="modelbox"><b>How the value is built</b><br>'
      + 'Implied value = TVL × peer multiple × growth × maturity × breadth.<br>'
      + '<table><tbody>'
      + '<tr><td>TVL</td><td class="mono">' + money(r.tvl_usd) + '</td></tr>'
      + '<tr><td>Peer multiple (' + esc(r.category || 'uncategorised') + ', ' + (r.peer_comps === 1 ? '1 live comp' : r.peer_comps + ' live comps') + ')</td><td class="mono">× ' + peer.toFixed(3) + ' → ' + money(base) + '</td></tr>'
      + '<tr><td>Growth multiplier</td><td class="mono">× ' + r.growth_multiplier.toFixed(3) + '</td></tr>'
      + '<tr><td>Maturity multiplier</td><td class="mono">× ' + r.maturity_multiplier.toFixed(3) + '</td></tr>'
      + '<tr><td>Chain breadth multiplier</td><td class="mono">× ' + r.breadth_multiplier.toFixed(3) + '</td></tr>'
      + '<tr><td><b>Implied value</b></td><td class="mono"><b>' + money(r.implied_value_usd) + '</b></td></tr>'
      + '</tbody></table></div>'
      + '<h3>How to farm it</h3><ol class="steps">'
      + steps.map(function (s) {
        var m = s.match(/^(.*) Cost: (.*)\. Time: (.*)\.$/);
        if (!m) return '<li>' + esc(s) + '</li>';
        return '<li>' + esc(m[1]) + '<span class="cost">Cost: ' + esc(m[2]) + ' · Time: ' + esc(m[3]) + '</span></li>';
      }).join('')
      + '</ol>'
      + '<p class="warn">Implied value is this radar\u2019s model claim from the sealed snapshot, not a prediction that ' + esc(r.name) + ' will issue a token, or of what it would be worth if it did.</p>'
      + '</div></div>';
    return h;
  }

  function liveTable() {
    var h = '<table><thead><tr><th>#</th><th>Protocol</th><th>Category</th><th class="num">Market cap</th><th class="num">TVL</th><th class="num">FDV / TVL</th></tr></thead><tbody>';
    live.forEach(function (p, i) {
      h += '<tr><td class="mono">' + (i + 1) + '</td><td><span class="name">' + esc(p.name) + '</span><div class="sub">' + esc(p.chains.join(', ')) + '</div></td>'
        + '<td>' + esc(p.category || '—') + '</td><td class="num mono">' + money(p.mcap_usd) + '</td>'
        + '<td class="num mono">' + money(p.tvl_usd) + '</td><td class="num mono">' + (p.fdv_tvl == null ? '—' : p.fdv_tvl.toFixed(3) + '×') + '</td></tr>';
    });
    return h + '</tbody></table>'
      + '<p class="count">Live-token protocols are shown at the market\u2019s own value, never mixed into the ranked board. Their FDV/TVL ratios are what calibrate the peer multiples.</p>';
  }

  function methodHtml() {
    return '<div class="method">'
      + '<h2>How the radar works</h2>'
      + '<p>Every number on this page comes from one sealed snapshot of the protocols DefiLlama tracks, fetched ' + esc(D.as_of) + '. The snapshot carries no ranking, no implied value and no farm plan: deriving them is the radar\u2019s work.</p>'
      + '<h3>The value model (comps-2)</h3>'
      + '<p><code>implied = TVL × peer × growth × maturity × breadth</code></p>'
      + '<ul>'
      + '<li><b>Peer multiple:</b> the trimmed median FDV/TVL of the live-token protocols in the same category, shrunk toward the market median (0.205×) and clamped to 0.05–1.50×. Trimming drops the top and bottom quarters, so one outlier cannot set the multiple.</li>'
      + '<li><b>Growth:</b> 1 + 0.40 × tanh(7-day TVL change / 40), with the change clamped to −40%…+80%. Growth helps, but it is dampened: a hot week cannot double a value.</li>'
      + '<li><b>Maturity:</b> 0.65 + 0.35 × ln(1 + age/365) / ln(4), age capped at 3 years. A protocol that has run longer with no token is worth more of its TVL; a two-week-old one is discounted.</li>'
      + '<li><b>Breadth:</b> +3% per extra chain, up to +15%. Wider distribution is worth more.</li>'
      + '</ul>'
      + '<h3>What counts as pre-token</h3>'
      + '<p>A protocol ranks when its record carries no token (no market cap, no CoinGecko id, no symbol) and it is not a wrapped, staked or bridged product of a token that already trades: no Bridge, Liquid Staking, Liquid Restaking, Restaked BTC or CEX category, no versioned name (V2, 2.0), no whole word wrapped, staked or staking, and no exchange name at the start. That is the same rule the house drew the 40-protocol watchlist with — and the board carries all 40 of them, plus 158 more pre-token protocols below the $50M floor, ranked the same way.</p>'
      + '<h3>Farm plans</h3>'
      + '<p>Each plan is six steps built from the protocol\u2019s own record — its category picks the action, its TVL sizes the capital ($60 / $120 / $200), its age sets the hold (30 / 45 / 60 days) — each step with what it costs and how long it takes. Nothing here is a prediction that a token will launch.</p>'
      + '<h3>Data</h3>'
      + '<p>Source: ' + esc(D.source) + '. Snapshot date: ' + esc(D.as_of) + '. Watchlist floor: ' + money(D.floor_usd) + '.</p>'
      + '</div>';
  }

  function render() {
    var app = document.getElementById('app');
    var h = '<div class="wrap"><header class="hero">'
      + '<h1>Token Radar <span class="amber">— pre-token protocols, priced</span></h1>'
      + '<p class="lede">Every protocol DefiLlama tracks that still records no token, ranked by what its launch would be worth — and what to do about it before it happens.</p>'
      + '<div class="stats">'
      + '<div class="stat"><b>' + D.board_size + '</b><span>protocols ranked</span></div>'
      + '<div class="stat"><b>' + D.watchlist_size + '</b><span>on the watchlist</span></div>'
      + '<div class="stat"><b>' + D.early_size + '</b><span>early finds below the floor</span></div>'
      + '<div class="stat"><b>' + D.live_size + '</b><span>live tokens tracked</span></div>'
      + '<div class="stat"><b>' + esc(D.as_of) + '</b><span>snapshot date</span></div>'
      + '</div></header>'
      + '<div class="tabs" role="tablist">'
      + '<button role="tab" data-tab="board" aria-selected="' + (state.tab === 'board') + '">Board</button>'
      + '<button role="tab" data-tab="live" aria-selected="' + (state.tab === 'live') + '">Live tokens</button>'
      + '<button role="tab" data-tab="method" aria-selected="' + (state.tab === 'method') + '">How it works</button>'
      + '</div><section id="panel">';

    if (state.tab === 'board') {
      h += '<div class="controls">'
        + '<input id="q" type="search" placeholder="Search name, slug or category…" value="' + esc(state.q) + '" aria-label="Search">'
        + '<select id="scope" aria-label="Scope">'
        + '<option value="all"' + (state.scope === 'all' ? ' selected' : '') + '>All protocols</option>'
        + '<option value="watch"' + (state.scope === 'watch' ? ' selected' : '') + '>Watchlist only</option>'
        + '<option value="early"' + (state.scope === 'early' ? ' selected' : '') + '>Early finds only</option>'
        + '</select>'
        + '<select id="cat" aria-label="Category"><option value="">All categories</option>'
        + categories().map(function (c) { return '<option' + (state.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('')
        + '</select>'
        + '<select id="chain" aria-label="Chain"><option value="">All chains</option>'
        + chains().map(function (c) { return '<option' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('')
        + '</select>'
        + '<select id="sort" aria-label="Sort by">'
        + '<option value="implied"' + (state.sort === 'implied' ? ' selected' : '') + '>Implied value</option>'
        + '<option value="tvl"' + (state.sort === 'tvl' ? ' selected' : '') + '>TVL</option>'
        + '<option value="growth"' + (state.sort === 'growth' ? ' selected' : '') + '>7d growth</option>'
        + '<option value="age"' + (state.sort === 'age' ? ' selected' : '') + '>Age</option>'
        + '<option value="name"' + (state.sort === 'name' ? ' selected' : '') + '>Name</option>'
        + '</select></div>';
      var list = filtered();
      h += '<p class="count">' + list.length + ' of ' + rows.length + ' protocols · click a row for its detail view and farm plan</p>';
      h += list.length ? boardTable(list) : '<p class="empty">No protocol matches these filters.</p>';
    } else if (state.tab === 'live') {
      h += '<p class="count">Protocols whose token already trades — the comparables that calibrate the board.</p>' + liveTable();
    } else {
      h += methodHtml();
    }
    h += '</section><footer>Implied values are this radar\u2019s model claim from the sealed DefiLlama snapshot of ' + esc(D.as_of) + ', not a prediction of any launch. Model comps-2: category peer multiples, dampened growth, log-age maturity, chain breadth.</footer></div>';
    app.innerHTML = h;
    app.setAttribute('aria-busy', 'false');
    bind();
  }

  function bind() {
    var tabs = document.querySelectorAll('[data-tab]');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function (e) {
        state.tab = e.currentTarget.getAttribute('data-tab');
        render();
      });
    }
    var q = document.getElementById('q');
    if (q) q.addEventListener('input', function (e) { state.q = e.target.value; render(); var nq = document.getElementById('q'); if (nq) { nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); } });
    var scope = document.getElementById('scope');
    if (scope) scope.addEventListener('change', function (e) { state.scope = e.target.value; render(); });
    var cat = document.getElementById('cat');
    if (cat) cat.addEventListener('change', function (e) { state.cat = e.target.value; render(); });
    var chain = document.getElementById('chain');
    if (chain) chain.addEventListener('change', function (e) { state.chain = e.target.value; render(); });
    var sort = document.getElementById('sort');
    if (sort) sort.addEventListener('change', function (e) { state.sort = e.target.value; state.dir = state.sort === 'name' ? 1 : -1; render(); });
    var ths = document.querySelectorAll('th[data-sort]');
    for (var j = 0; j < ths.length; j++) {
      ths[j].addEventListener('click', function (e) {
        var key = e.currentTarget.getAttribute('data-sort');
        var map = { rank: 'implied', name: 'name', cat: 'implied', tvl: 'tvl', growth: 'growth', age: 'age', implied: 'implied' };
        var s = map[key] || 'implied';
        if (state.sort === s) state.dir = -state.dir; else { state.sort = s; state.dir = s === 'name' ? 1 : -1; }
        render();
      });
    }
    var trs = document.querySelectorAll('tbody tr[data-slug]');
    for (var k = 0; k < trs.length; k++) {
      trs[k].addEventListener('click', function (e) {
        var slug = e.currentTarget.getAttribute('data-slug');
        var row = null;
        for (var m = 0; m < rows.length; m++) if (rows[m].slug === slug) { row = rows[m]; break; }
        if (!row) return;
        var host = document.createElement('div');
        host.innerHTML = detailHtml(row);
        document.body.appendChild(host.firstChild);
        var close = document.getElementById('closeDetail');
        var overlay = document.getElementById('detail');
        var done = function () { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); };
        if (close) close.addEventListener('click', done);
        if (overlay) overlay.addEventListener('click', function (ev) { if (ev.target === overlay) done(); });
        document.addEventListener('keydown', function esc2(ev) {
          if (ev.key === 'Escape') { done(); document.removeEventListener('keydown', esc2); }
        });
      });
    }
  }

  render();
})();
