import {
  fetchSegmentIds,
  fetchKerbsideIdsBySegment,
  fetchUnoccupiedBays
} from './melbourneData.js';

/* -------------------------------------------------------------
   Helpers
------------------------------------------------------------- */
// Parse "POINT (144.96 -37.81)"  ➜  [lat, lng]
function wktPointToLatLng(wkt) {
  const match = /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i.exec(wkt);
  if (!match) return null;
  const lng = Number(match[1]); // WKT order is lon lat
  const lat = Number(match[2]);
  return [lat, lng];
}

// Centre map on first coordinate or Melbourne CBD fallback
function getInitialView(rows) {
  const first = rows.find(r => r.location);
  if (first) {
    const latLng = wktPointToLatLng(first.location);
    if (latLng) return latLng;
  }
  return [-37.814, 144.96332]; // Melbourne CBD
}

/* -------------------------------------------------------------
   Main flow
------------------------------------------------------------- */
async function showUnoccupiedBaysOnMap(streetName) {
  // 1️⃣ street → segment_id[]
  const segmentIds = await fetchSegmentIds(streetName);
  if (segmentIds.length === 0) {
    alert(`No street-segment match for "${streetName}".`);
    return;
  }

  // 2️⃣ segment_id[] → kerbsideid[]
  const kerbsideIds = await fetchKerbsideIdsBySegment(segmentIds);
  if (kerbsideIds.length === 0) {
    alert(`No parking bays on those segments.`);
    return;
  }
  // console.log(unoccupiedRows)
  // 3️⃣ kerbsideid[] → sensor rows (Unoccupied)
  const unoccupiedRows = await fetchUnoccupiedBays(kerbsideIds);
  if (unoccupiedRows.length === 0) {
    alert(`No unoccupied bays right now on ${streetName}.`);
    return;
  }

  /* -----------------------------------------------------------
     Map visualisation
  ----------------------------------------------------------- */
  function getInitialView(rows) {
    if (rows.length > 0) {
      const { lat, lon } = rows[0].location;
      return [lat, lon];
    }
    return [-37.814, 144.96332]; // CBD fallback
  }
  
  const map = L.map('map').setView(getInitialView(unoccupiedRows), 17);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  unoccupiedRows.forEach(
    ({ kerbsideid, location }) => {

      const { lat, lon } = location;
      L.circleMarker([lat, lon], { radius: 6 })
      .bindPopup(`Kerbside ID ${kerbsideid}`)
      .addTo(map);
    }
    

);
}

/* -------------------------------------------------------------
   Kick things off
------------------------------------------------------------- */
showUnoccupiedBaysOnMap('Queen Street');     // change street name as needed
