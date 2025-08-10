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


export async function fetchKerbsideIdsBySegment(segmentIds, pageSize = 100) {
  const where = `roadsegmentid IN (${segmentIds.join(',')}) AND kerbsideid IS NOT NULL`;
  const ids = new Set();
  let offset = 0;
  const MAX_PAGE = 100;        // API max
  const MAX_TOTAL = 1000;     // offset+limit cap for records

  while (offset < MAX_TOTAL) {
    const limitThisCall = Math.min(pageSize, MAX_PAGE, MAX_TOTAL - offset);
    if (limitThisCall <= 0) break;

    const params = new URLSearchParams({
      select: 'kerbsideid',
      where,
      limit: String(limitThisCall),
      offset: String(offset),
    });
    const res = await fetch(`${BAY_URL}?${params.toString().replace(/\+/g, '%20')}`);
    if (!res.ok) throw new Error(`bays API ${res.status}`);

    const data = await res.json();
    const rows = Array.isArray(data) ? data : data.results ?? [];
    rows.forEach(r => r.kerbsideid != null && ids.add(Number(r.kerbsideid)));

    if (rows.length < limitThisCall) break;   // no more pages
    offset += rows.length;
  }
  return [...ids];
}

/* ------------------------------------------------------------------
   3️⃣  kerbsideid[]  ➜  unoccupied sensor rows   (unchanged)
------------------------------------------------------------------ */

export async function fetchUnoccupiedBays(kerbsideIds) {
  const MAX_LIMIT   = 100;   // API max per call
  const CHUNK_SIZE  = 200;   // ids per IN(...) to keep URLs sane
  const allRows = [];

  // Split kerbsideIds into manageable chunks
  for (let i = 0; i < kerbsideIds.length; i += CHUNK_SIZE) {
    const chunk = kerbsideIds.slice(i, i + CHUNK_SIZE);

    // Paginate each chunk until we’ve fetched everything
    let offset = 0;
    while (true) {
      const where = `kerbsideid IN (${chunk.join(',')}) AND status_description = 'Unoccupied'`;
      const params = new URLSearchParams({
        select: 'kerbsideid, location',
        where,
        limit: String(MAX_LIMIT),
        offset: String(offset),
      });

      const url = `${SENSOR_URL}?${params.toString().replace(/\+/g, '%20')}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`sensor API ${res.status}`);

      const data = await res.json();
      const rows = Array.isArray(data) ? data : data.results ?? [];
      allRows.push(...rows);

      if (rows.length < MAX_LIMIT) break; // no more pages for this chunk
      offset += rows.length;
    }
  }
  return allRows;
}


