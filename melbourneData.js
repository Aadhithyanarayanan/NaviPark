// ----------------------------------------
//  Datasets
// ----------------------------------------
const SEGMENT_DATASET = 'parking-zones-linked-to-street-segments';
const SEGMENT_URL  = `https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/${SEGMENT_DATASET}/records`;

const BAY_DATASET  = 'on-street-parking-bays';
const BAY_URL      = `https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/${BAY_DATASET}/records`;

const SENSOR_DATASET = 'on-street-parking-bay-sensors';
const SENSOR_URL     = `https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/${SENSOR_DATASET}/records`;

/* ------------------------------------------------------------------
   1️⃣  Street-name  ➜  segment_id[]
------------------------------------------------------------------ */
export async function fetchSegmentIds(streetName, limit = 100) {
  console.log('fetching segment_id from street-segment dataset…');

  const where  = `lower(onstreet) = "${streetName.toLowerCase()}"`;           // exact match
  const params = new URLSearchParams({ select: 'segment_id', where, limit });

  const res  = await fetch(`${SEGMENT_URL}?${params}`);
  if (!res.ok) throw new Error(`segment API ${res.status}`);

  const data  = await res.json();
  const rows  = Array.isArray(data) ? data : data.results ?? [];
  return rows.map(r => Number(r.segment_id));            // [20176, 21630, …]
}

/* ------------------------------------------------------------------
   2️⃣  segment_id[]  ➜  kerbsideid[]
------------------------------------------------------------------ */
export async function fetchKerbsideIdsBySegment(segmentIds, limit = 100) {
  console.log('fetching kerbsideid from parking-bays dataset…');
  const where  = `roadsegmentid IN (${segmentIds.join(',')}) AND kerbsideid IS NOT NULL`;
  
  // const params = new URLSearchParams({ select: 'kerbsideid', where, limit });

  // const res  = await fetch(`${BAY_URL}?${params}`);
  // --- build query string ---
  const params = new URLSearchParams({
  select: 'kerbsideid',
  where, limit });
  const query = params.toString().replace(/\+/g, '%20');
  const res   = await fetch(`${BAY_URL}?${query}`);


  if (!res.ok) throw new Error(`bays API ${res.status}`);

  const data  = await res.json();
  const rows  = Array.isArray(data) ? data : data.results ?? [];
  return rows.map(r => Number(r.kerbsideid));            // [65479, 65447, …]
}

/* ------------------------------------------------------------------
   3️⃣  kerbsideid[]  ➜  unoccupied sensor rows   (unchanged)
------------------------------------------------------------------ */
export async function fetchUnoccupiedBays(kerbsideIds, limit = kerbsideIds.length) {
  const where  = `kerbsideid IN (${kerbsideIds.join(',')}) AND status_description = 'Unoccupied'`;
  const params = new URLSearchParams({ select: 'kerbsideid, location', where, limit });

  console.log('fetching unoccupied bays from sensor dataset…');
  const res = await fetch(`${SENSOR_URL}?${params}`);
  if (!res.ok) throw new Error(`sensor API ${res.status}`);

  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

