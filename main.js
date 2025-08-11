// main.js
import {
  fetchSegmentIds,
  fetchKerbsideIdsBySegment,
  fetchUnoccupiedBays
} from './melbourneData.js';

/* -------------------------------------------------------------
   Map/state
------------------------------------------------------------- */
const DEFAULT_VIEW = [-37.814, 144.96332]; // Melbourne CBD
const DEFAULT_ZOOM = 15;

let map = null;
let markersLayer = null;
let mapReady = false;

function initMap() {
  if (mapReady) return;
  map = L.map('map').setView(DEFAULT_VIEW, DEFAULT_ZOOM);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  mapReady = true;
}

/* Show results area (map + cards) only when searching */
// function ensureResultsVisible() {
//   const results = document.querySelector('.results');
//   if (!results) return;
//   if (results.style.display === 'none') {
//     results.style.display = 'grid';     // match your CSS grid layout
//     initMap();
//     // Let Leaflet recalc once it's visible
//     setTimeout(() => map.invalidateSize(), 0);
//   } else if (!mapReady) {
//     initMap();
//   }
// }
function ensureResultsVisible() {
  const results = document.querySelector('.results');
  if (!results) return;
  results.classList.remove('is-hidden'); // ← add this line

  if (results.style.display === 'none') {
    results.style.display = 'grid';
    initMap();
    setTimeout(() => map.invalidateSize(), 0);
  } else if (!mapReady) {
    initMap();
  }
}

/* Utilities */
function clearMarkers() {
  if (markersLayer) markersLayer.clearLayers();
}

function plotRows(rows) {
  clearMarkers();
  if (!rows || rows.length === 0) return;

  const latLngs = [];
  rows.forEach(({ kerbsideid, location }) => {
    if (!location) return;
    const { lat, lon } = location;
    latLngs.push([lat, lon]);
    L.circleMarker([lat, lon], { radius: 6 })
      .bindPopup(`Kerbside ID ${kerbsideid}`)
      .addTo(markersLayer);
  });

  if (latLngs.length) {
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds.pad(0.2));
  } else {
    map.setView(DEFAULT_VIEW, DEFAULT_ZOOM);
  }
}

/* -------------------------------------------------------------
   Main search flow
------------------------------------------------------------- */

async function showUnoccupiedBaysOnMap(streetName) {
  ensureResultsVisible();

  try {
    const segmentIds = await fetchSegmentIds(streetName);
    if (!segmentIds.length) {
      resetTotalCard(`No street-segment match for "${streetName}".`);
      resetCongestionCard('No matching street segments.');
      alert(`No street-segment match for "${streetName}".`);
      clearMarkers();
      map.setView(DEFAULT_VIEW, DEFAULT_ZOOM);
      return;
    }
    

    const kerbsideIds = await fetchKerbsideIdsBySegment(segmentIds);
    if (!kerbsideIds.length) {
      resetTotalCard('No parking bays on those segments.');
      resetCongestionCard('No bays on those segments.');
      alert('No parking bays on those segments.');
      clearMarkers();
      map.setView(DEFAULT_VIEW, DEFAULT_ZOOM);
      return;
    }
    console.log("total kerbside id")
    console.log(kerbsideIds.length)

    const unoccupiedRows = await fetchUnoccupiedBays(kerbsideIds);
    console.log("total available")
    console.log(unoccupiedRows.length)

    // Update KPI cards
    updateTotalCard(unoccupiedRows.length, streetName);
    updateCongestionCard(unoccupiedRows.length, kerbsideIds.length, streetName);

    if (!unoccupiedRows.length) {
      alert(`No unoccupied bays right now on ${streetName}.`);
      clearMarkers();
      map.setView(DEFAULT_VIEW, DEFAULT_ZOOM);
      return;
    }

    plotRows(unoccupiedRows);
  } catch (err) {
    console.error(err);
    resetTotalCard('Search failed. Please try again.');
    resetCongestionCard('Search failed. Please try again.');
    alert('Something went wrong while searching. Please try again.');
  }
}



/* -------------------------------------------------------------
   Wire UI
------------------------------------------------------------- */
const searchBtn = document.getElementById('searchBtn');
const locInput  = document.getElementById('loc');
const resultsEl = document.querySelector('.results');

// Hide the results (map + cards) on first load
if (resultsEl) resultsEl.style.display = 'none';

function doSearch() {
  const street = locInput?.value.trim();
  if (!street) { alert('Please enter a street name.'); return; }
  showUnoccupiedBaysOnMap(street);
}

searchBtn?.addEventListener('click', doSearch);
locInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});

function updateTotalCard(count, streetName) {
  const totalEl = document.getElementById('totalCount');
  const labelEl = document.getElementById('summaryLabel');
  if (!totalEl || !labelEl) return;

  totalEl.textContent = Number(count).toLocaleString();
  const now = new Date();
  labelEl.textContent = `on ${streetName} • updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function resetTotalCard(message = 'Run a search to see live availability.') {
  const totalEl = document.getElementById('totalCount');
  const labelEl = document.getElementById('summaryLabel');
  if (!totalEl || !labelEl) return;

  totalEl.textContent = '—';
  labelEl.textContent = message;
}

function updateCongestionCard(unoccupiedCount, totalKerbside, streetName) {
  const pctEl = document.getElementById('congestionPct');
  const labelEl = document.getElementById('congestionLabel');
  if (!pctEl || !labelEl) return;

  if (!totalKerbside) {
    pctEl.textContent = '—';
    labelEl.textContent = 'No bays on these segments.';
    pctEl.className = 'big-number';
    return;
  }

  const rate = unoccupiedCount / totalKerbside;    // your definition
  const pct  = 100 - Math.round(rate * 100);
  const now = new Date();
  pctEl.textContent = `${pct}%`;
  labelEl.textContent = `on ${streetName} • updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  // simple coloring (optional)
  pctEl.className = 'big-number';
  if (rate >= 0.40) pctEl.classList.add('good');
  else if (rate >= 0.15) pctEl.classList.add('ok');
  else pctEl.classList.add('bad');
}

function resetCongestionCard(message = 'Waiting for a search…') {
  const pctEl = document.getElementById('congestionPct');
  const labelEl = document.getElementById('congestionLabel');
  if (!pctEl || !labelEl) return;
  pctEl.textContent = '—';
  pctEl.className = 'big-number';
  labelEl.textContent = message;
}
