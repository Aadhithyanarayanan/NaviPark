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
function ensureResultsVisible() {
  const results = document.querySelector('.results');
  if (!results) return;
  if (results.style.display === 'none') {
    results.style.display = 'grid';     // match your CSS grid layout
    initMap();
    // Let Leaflet recalc once it's visible
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
    // 1) Street -> segment IDs
    const segmentIds = await fetchSegmentIds(streetName);
    if (!segmentIds.length) {
      alert(`No street-segment match for "${streetName}".`);
      clearMarkers();
      map.setView(DEFAULT_VIEW, DEFAULT_ZOOM);
      return;
    }

    // 2) Segments -> kerbside IDs
    const kerbsideIds = await fetchKerbsideIdsBySegment(segmentIds);
    if (!kerbsideIds.length) {
      alert('No parking bays on those segments.');
      clearMarkers();
      map.setView(DEFAULT_VIEW, DEFAULT_ZOOM);
      return;
    }

    // 3) Kerbside IDs -> unoccupied bay rows
    const unoccupiedRows = await fetchUnoccupiedBays(kerbsideIds);
    if (!unoccupiedRows.length) {
      alert(`No unoccupied bays right now on ${streetName}.`);
      clearMarkers();
      map.setView(DEFAULT_VIEW, DEFAULT_ZOOM);
      return;
    }

    plotRows(unoccupiedRows);
  } catch (err) {
    console.error(err);
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



// import {
//   fetchSegmentIds,
//   fetchKerbsideIdsBySegment,
//   fetchUnoccupiedBays
// } from './melbourneData.js';

// /* -------------------------------------------------------------
//    Helpers
// ------------------------------------------------------------- */
// // Parse "POINT (144.96 -37.81)"  ➜  [lat, lng]


// function wktPointToLatLng(wkt) {
//   const match = /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i.exec(wkt);
//   if (!match) return null;
//   const lng = Number(match[1]); // WKT order is lon lat
//   const lat = Number(match[2]);
//   return [lat, lng];
// }

// // Centre map on first coordinate or Melbourne CBD fallback
// function getInitialView(rows) {
//   const first = rows.find(r => r.location);
//   if (first) {
//     const latLng = wktPointToLatLng(first.location);
//     if (latLng) return latLng;
//   }
//   return [-37.814, 144.96332]; // Melbourne CBD
// }

// /* -------------------------------------------------------------
//    Main flow
// ------------------------------------------------------------- */
// async function showUnoccupiedBaysOnMap(streetName) {
//   // 1️⃣ street → segment_id[]
//   const segmentIds = await fetchSegmentIds(streetName);
//   if (segmentIds.length === 0) {
//     alert(`No street-segment match for "${streetName}".`);
//     return;
//   }

//   // 2️⃣ segment_id[] → kerbsideid[]
//   const kerbsideIds = await fetchKerbsideIdsBySegment(segmentIds);
//   if (kerbsideIds.length === 0) {
//     alert(`No parking bays on those segments.`);
//     return;
//   }
//   // console.log(unoccupiedRows)
//   // 3️⃣ kerbsideid[] → sensor rows (Unoccupied)
//   const unoccupiedRows = await fetchUnoccupiedBays(kerbsideIds);
//   if (unoccupiedRows.length === 0) {
//     alert(`No unoccupied bays right now on ${streetName}.`);
//     return;
//   }

//   /* -----------------------------------------------------------
//      Map visualisation
//   ----------------------------------------------------------- */
//   function getInitialView(rows) {
//     if (rows.length > 0) {
//       const { lat, lon } = rows[0].location;
//       return [lat, lon];
//     }
//     return [-37.814, 144.96332]; // CBD fallback
//   }
  
//   // const map = L.map('map').setView(getInitialView(unoccupiedRows), 17);

//   // L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//   //   attribution: '© OpenStreetMap contributors'
//   // }).addTo(map);

//   let map; // reuse across searches
//   if (map) map.remove(); // clear previous instance
//   map = L.map('map').setView(getInitialView(unoccupiedRows), 17);

//   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//     attribution: '© OpenStreetMap contributors'
//   }).addTo(map);


//   unoccupiedRows.forEach(
//     ({ kerbsideid, location }) => {

//       const { lat, lon } = location;
//       L.circleMarker([lat, lon], { radius: 6 })
//       .bindPopup(`Kerbside ID ${kerbsideid}`)
//       .addTo(map);
//     }
    

// );
// }

// /* -------------------------------------------------------------
//    Kick things off
// ------------------------------------------------------------- */
// // showUnoccupiedBaysOnMap('Queen Street');     // change street name as needed
// // Wire up the Search button to call showUnoccupiedBaysOnMap
// const searchBtn = document.getElementById('searchBtn');
// const locInput  = document.getElementById('loc');

// function doSearch() {
//   const street = locInput.value.trim();
//   if (!street) { alert('Please enter a street name.'); return; }
//   showUnoccupiedBaysOnMap(street);
// }

// searchBtn?.addEventListener('click', doSearch);
// locInput?.addEventListener('keydown', (e) => {
//   if (e.key === 'Enter') doSearch();
// });

