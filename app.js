// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  locations: [],      // loaded from locations.json
  activeLocation: null, // { id, label, flag, file }
  fish: [],           // loaded from the location-specific json
  activeTag: 'alle',
  showFilter: 'alle',  // 'all' | 'inseason'
  query: '',
};

const today = new Date();

// ─── Date helpers ─────────────────────────────────────────────────────────────

function parseDate(mmdd) {
  const [m, d] = mmdd.split('-').map(Number);
  return new Date(today.getFullYear(), m - 1, d);
}

function hasNoRestriction(fish) {
  return !fish.protected
    && fish.season.open === "01-01"
    && fish.season.close === "12-31"
    && fish.minSize_cm === 0;
}

function isInSeason(fish) {
  if (fish.protected) return false;   // ganzjährig geschützt
  const open = parseDate(fish.season.open);
  const close = parseDate(fish.season.close);
  if (open <= close) {
    return today >= open && today <= close;
  } else {
    // Wrapping season e.g. Oct 1 – Jan 31
    return today >= open || today <= close;
  }
}

function formatDate(mmdd) {
  return parseDate(mmdd).toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
}

function dayFraction(mmdd) {
  const d = parseDate(mmdd);
  const start = new Date(today.getFullYear(), 0, 1);
  const end = new Date(today.getFullYear(), 11, 31);
  return (d - start) / (end - start);
}

const todayFraction = dayFraction(
  `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
);

function allKategorien(fish) {
  const tags = new Set();
  fish.forEach(f => f.tags.forEach(t => tags.add(t)));
  return ['alle', ...tags];
}

// ─── Location picker ──────────────────────────────────────────────────────────

function renderLocationPicker() {
  const container = document.getElementById('locationPicker');
  container.innerHTML = state.locations.map(loc => `
    <button
      class="loc-btn ${state.activeLocation?.id === loc.id ? 'active' : ''}"
      data-id="${loc.id}"
    >
      <span class="loc-flag">${loc.flag}</span>
      <span class="loc-name">${loc.label}</span>
    </button>
  `).join('');

  container.querySelectorAll('.loc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const loc = state.locations.find(l => l.id === btn.dataset.id);
      selectLocation(loc);
    });
  });
}

async function selectLocation(loc) {
  if (state.activeLocation?.id === loc.id) return;

  state.activeLocation = loc;
  state.activeTag = 'alle';
  state.showFilter = 'alle';
  state.query = '';

  // Reset search input visually
  const searchEl = document.getElementById('searchInput');
  if (searchEl) searchEl.value = '';

  // Reset season toggle visually
  document.querySelectorAll('.toggle').forEach(b => b.classList.remove('active'));
  document.querySelector('.toggle[data-filter="alle"]')?.classList.add('active');

  // Show loading state
  document.getElementById('placeholder').classList.add('hidden');
  document.getElementById('appContent').classList.remove('hidden');
  document.getElementById('fishGrid').innerHTML = `
    <p class="loading-msg">Lade Daten für ${loc.label}…</p>
  `;

  // Update location button highlights
  renderLocationPicker();

  try {
    const res = await fetch(`./data/fish/${loc.file}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} — could not load ${loc.file}`);
    state.fish = await res.json();

    // Sort: in-season first, then alphabetical
    state.fish.sort((a, b) => {
      const ai = isInSeason(a) ? 0 : 1;
      const bi = isInSeason(b) ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return a.name.localeCompare(b.name);
    });

    renderAll();
  } catch (err) {
    document.getElementById('fishGrid').innerHTML = `
      <p class="error-msg">⚠ Daten für ${loc.label} konnten nicht geladen werden: ${err.message}</p>
    `;
    console.error(err);
  }
}

// ─── Card rendering ───────────────────────────────────────────────────────────

function buildSeasonBar(fish) {
  const open = dayFraction(fish.season.open);
  const close = dayFraction(fish.season.close);
  const todayLeft = todayFraction * 100;

  let fills;
  if (open <= close) {
    // Normal season: single continuous segment
    const left = (open * 100).toFixed(1);
    const width = ((close - open) * 100).toFixed(1);
    fills = `<div class="season-fill" style="left:${left}%;width:${width}%;"></div>`;
  } else {
    // Wrap-around (e.g. Oct-Jan): two segments so nothing overflows the bar
    const seg1Left = (open * 100).toFixed(1);
    const seg1Width = ((1 - open) * 100).toFixed(1);
    const seg2Width = (close * 100).toFixed(1);
    fills = `<div class="season-fill" style="left:${seg1Left}%;width:${seg1Width}%;"></div>` +
      `<div class="season-fill" style="left:0%;width:${seg2Width}%;"></div>`;
  }

  return `
    <div class="season-bar-inner">
      <div class="season-bar">${fills}</div>
      <div class="season-today" style="left:${todayLeft.toFixed(1)}%;"></div>
    </div>
  `;
}

function buildCard(fish) {
  const inSeason = isInSeason(fish);
  const badge = fish.protected
    ? '<span class="badge protected">Ganzjährig geschützt</span>'
    : hasNoRestriction(fish)
      ? '<span class="badge open">Keine Schonzeit</span>'
      : inSeason
        ? '<span class="badge in">In Saison</span>'
        : '<span class="badge out">Schonzeit</span>';

  const tags = fish.tags.map(t => `<span class="card-tag">${t}</span>`).join('');

  return `
    <div class="card" style="animation-delay:${Math.random() * 0.15}s">
      <div class="card-header">
        <div>
          <div class="card-name">${fish.name}</div>
          <div class="card-latin">${fish.latinName}</div>
        </div>
        ${badge}
      </div>

      <p class="card-description">${fish.description}</p>

      <div class="card-meta">
        ${(fish.protected || hasNoRestriction(fish)) ? '' : `
        <div class="meta-item">
          <span class="meta-label">Saison ab</span>
          <span class="meta-value">${formatDate(fish.season.open)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Saison bis</span>
          <span class="meta-value">${formatDate(fish.season.close)}</span>
        </div>`}
        ${fish.minSize_cm ? `
        <div class="meta-item">
          <span class="meta-label">Mindestmaß</span>
          <span class="meta-value"><span class="num">${fish.minSize_cm}</span> cm</span>
        </div>` : ''}
        <div class="meta-item">
          <span class="meta-label">Kategorien</span>
          <span class="meta-value">
            <div class="card-tags">${tags}</div>
          </span>
        </div>
        ${(fish.protected || hasNoRestriction(fish)) ? '' : `
        <div class="season-bar-wrap">
          <span class="meta-label">Saisonfenster (Jan → Dez)</span>
          ${buildSeasonBar(fish)}
        </div>`}
      </div>
    </div>
  `;
}

// ─── Filter & render ──────────────────────────────────────────────────────────

function renderTagFilters() {
  const container = document.getElementById('tagFilters');
  const tags = allKategorien(state.fish);
  container.innerHTML = tags.map(tag => `
    <button class="tag-btn ${state.activeTag === tag ? 'active' : ''}" data-tag="${tag}">
      ${tag}
    </button>
  `).join('');

  container.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeTag = btn.dataset.tag;
      renderAll();
    });
  });
}

function renderCards() {
  const q = state.query.toLowerCase().trim();

  const filtered = state.fish.filter(f => {
    const matchTag = state.activeTag === 'alle' || f.tags.includes(state.activeTag);
    const matchSeason = state.showFilter === 'alle' || isInSeason(f);
    const matchQuery = !q || f.name.toLowerCase().includes(q) || f.latinName.toLowerCase().includes(q);
    return matchTag && matchSeason && matchQuery;
  });

  const grid = document.getElementById('fishGrid');
  const empty = document.getElementById('emptyState');

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    grid.innerHTML = filtered.map(buildCard).join('');
  }

  // Summary strip
  const inCount = state.fish.filter(isInSeason).length;
  const outCount = state.fish.length - inCount;
  const locLabel = state.activeLocation ? `in ${state.activeLocation.label}` : '';
  document.getElementById('seasonSummary').innerHTML = `
    <span class="summary-chip in">✦ ${inCount} in Saison ${locLabel}</span>
    <span class="summary-chip out">○ ${outCount} Schonzeit</span>
  `;
}

function renderAll() {
  renderTagFilters();
  renderCards();
}

// ─── Controls wiring ──────────────────────────────────────────────────────────

function wireControls() {
  document.querySelectorAll('.toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.showFilter = btn.dataset.filter;
      renderCards();
    });
  });

  document.getElementById('searchInput').addEventListener('input', e => {
    state.query = e.target.value;
    renderCards();
  });
}

// ─── Header date ──────────────────────────────────────────────────────────────

function renderDate() {
  document.getElementById('currentDate').textContent = today.toLocaleDateString('de-AT', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
  });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function init() {
  renderDate();
  wireControls();

  try {
    const res = await fetch('./data/locations.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.locations = await res.json();
    renderLocationPicker();

    // Restore last-used location from sessionStorage
    const savedId = sessionStorage.getItem('selectedLocation');
    if (savedId) {
      const saved = state.locations.find(l => l.id === savedId);
      if (saved) {
        selectLocation(saved);
        return;
      }
    }

    // No saved location — show placeholder
    document.getElementById('placeholder').classList.remove('hidden');

  } catch (err) {
    document.getElementById('locationPicker').innerHTML =
      `<p class="error-msg">⚠ Regionen konnten nicht geladen werden: ${err.message}</p>`;
    console.error(err);
  }
}

// Persist chosen location across page reloads (same tab session)
document.addEventListener('click', e => {
  const btn = e.target.closest('.loc-btn');
  if (btn) sessionStorage.setItem('selectedLocation', btn.dataset.id);
});

init();
