import { Router, Request, Response } from "express";
import axios from "axios";
import { authenticate } from "@/middleware/auth.middleware";

const router = Router();
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

// Interface for Geocoded Candidates with rich metadata & confidence scoring
export interface GeocodeCandidate {
  place_id: number;
  display_name: string;
  short_name: string;
  type: string;
  category: string;
  osm_type: string;
  osm_id: number;
  lat: number;
  lng: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  relevance_score: number;
  is_poi: boolean;
  intent_match: boolean;
  address: any;
}

// Memory Cache for User-Selected Geocoded Places (Avoid duplicate hits to Nominatim)
const GEOCODE_CACHE = new Map<string, GeocodeCandidate[]>();

// =========================================================
// =========================================================
// CURATED PINPOINT LANDMARK & KARNATAKA DISTRICT TABLE
// Exact GPS coordinates for well-known Karnataka POIs, cities, and landmarks
// Resolves instantly (<1ms) without external API overhead.
// =========================================================
const LANDMARK_PINPOINTS: Array<{
  patterns: RegExp[];
  result: Omit<GeocodeCandidate, "place_id" | "osm_type" | "osm_id" | "address">;
}> = [
  // --- North Bengaluru Core POIs ---
  {
    patterns: [/sir\s*(m\s*)?vis?v?es?v?araya|sir\s*mvit|mvit/i],
    result: {
      display_name: "Sir M Visvesvaraya Institute of Technology, Hunasamaranahalli, Bengaluru North, Karnataka, India",
      short_name: "Sir M Visvesvaraya Institute of Technology",
      type: "university",
      category: "amenity",
      lat: 13.13630,
      lng: 77.59710,
      confidence: "HIGH",
      relevance_score: 100,
      is_poi: true,
      intent_match: true,
    },
  },
  {
    patterns: [/hunasamaranahalli.*bus\s*stop|hunsmaranahalli.*bus|huna.*bus\s*stop/i],
    result: {
      display_name: "Hunasamaranahalli Bus Stop, Hunasamaranahalli, Bengaluru North, Karnataka, India",
      short_name: "Hunasamaranahalli Bus Stop",
      type: "bus_stop",
      category: "highway",
      lat: 13.12890,
      lng: 77.62410,
      confidence: "HIGH",
      relevance_score: 100,
      is_poi: true,
      intent_match: true,
    },
  },
  {
    patterns: [/hunasamaranahalli|hunsmaranahalli/i],
    result: {
      display_name: "Hunasamaranahalli, Bengaluru North, Karnataka, India",
      short_name: "Hunasamaranahalli",
      type: "suburb",
      category: "place",
      lat: 13.12890,
      lng: 77.62410,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/nandi\s*hills?\s*(view\s*)?point|nandi\s*hills?|^nandi$/i],
    result: {
      display_name: "Nandi Hills, Chikkaballapura, Karnataka, India",
      short_name: "Nandi Hills",
      type: "peak",
      category: "natural",
      lat: 13.37088,
      lng: 77.68396,
      confidence: "HIGH",
      relevance_score: 100,
      is_poi: true,
      intent_match: true,
    },
  },
  {
    patterns: [/kempegowda.*airport|bangalore\s*airport|bengaluru\s*airport|^kia$|^bial$/i],
    result: {
      display_name: "Kempegowda International Airport (BLR), Devanahalli, Bengaluru, Karnataka, India",
      short_name: "Kempegowda International Airport",
      type: "aerodrome",
      category: "aeroway",
      lat: 13.19864,
      lng: 77.70659,
      confidence: "HIGH",
      relevance_score: 100,
      is_poi: true,
      intent_match: true,
    },
  },
  // --- Bengaluru Key Suburbs & Hubs ---
  {
    patterns: [/^btm(\s*layout)?$/i, /btm\s*layout/i],
    result: {
      display_name: "BTM Layout, Bengaluru South, Karnataka, India",
      short_name: "BTM Layout",
      type: "suburb",
      category: "place",
      lat: 12.91598,
      lng: 77.60946,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/indiranagar/i],
    result: {
      display_name: "Indiranagar, Bengaluru East, Karnataka, India",
      short_name: "Indiranagar",
      type: "suburb",
      category: "place",
      lat: 12.97194,
      lng: 77.64073,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/hebbal/i],
    result: {
      display_name: "Hebbal, Bengaluru North, Karnataka, India",
      short_name: "Hebbal",
      type: "suburb",
      category: "place",
      lat: 13.03527,
      lng: 77.59400,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/yeshwanthpur|yeshvanthpur/i],
    result: {
      display_name: "Yeshwanthpur, Bengaluru West, Karnataka, India",
      short_name: "Yeshwanthpur",
      type: "suburb",
      category: "place",
      lat: 13.02255,
      lng: 77.55356,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/koramangala/i],
    result: {
      display_name: "Koramangala, Bengaluru South, Karnataka, India",
      short_name: "Koramangala",
      type: "suburb",
      category: "place",
      lat: 12.93452,
      lng: 77.62051,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/lalbagh(\s*botanical)?(\s*garden)?/i],
    result: {
      display_name: "Lalbagh Botanical Garden, Mavalli, Bengaluru, Karnataka, India",
      short_name: "Lalbagh Botanical Garden",
      type: "park",
      category: "leisure",
      lat: 12.95074,
      lng: 77.58478,
      confidence: "HIGH",
      relevance_score: 100,
      is_poi: true,
      intent_match: true,
    },
  },
  {
    patterns: [/cubbon\s*park/i],
    result: {
      display_name: "Cubbon Park, Kasturba Road, Bengaluru, Karnataka, India",
      short_name: "Cubbon Park",
      type: "park",
      category: "leisure",
      lat: 12.97635,
      lng: 77.59292,
      confidence: "HIGH",
      relevance_score: 100,
      is_poi: true,
      intent_match: true,
    },
  },
  {
    patterns: [/whitefield/i],
    result: {
      display_name: "Whitefield, Bengaluru East, Karnataka, India",
      short_name: "Whitefield",
      type: "suburb",
      category: "place",
      lat: 12.96981,
      lng: 77.74995,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/electronic\s*city/i],
    result: {
      display_name: "Electronic City, Bengaluru South, Karnataka, India",
      short_name: "Electronic City",
      type: "suburb",
      category: "place",
      lat: 12.84521,
      lng: 77.66016,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/yelahanka/i],
    result: {
      display_name: "Yelahanka, Bengaluru North, Karnataka, India",
      short_name: "Yelahanka",
      type: "suburb",
      category: "place",
      lat: 13.10069,
      lng: 77.59632,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/bengaluru|bangalore/i],
    result: {
      display_name: "Bengaluru, Bengaluru Urban, Karnataka, India",
      short_name: "Bengaluru",
      type: "city",
      category: "place",
      lat: 12.97159,
      lng: 77.59456,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  // --- Karnataka Cities, Districts, and Heritage POIs ---
  {
    patterns: [/mysore\s*palace|amba\s*vilas/i],
    result: {
      display_name: "Mysore Palace, Sayyaji Rao Rd, Mysuru, Karnataka, India",
      short_name: "Mysore Palace",
      type: "attraction",
      category: "tourism",
      lat: 12.30518,
      lng: 76.65516,
      confidence: "HIGH",
      relevance_score: 100,
      is_poi: true,
      intent_match: true,
    },
  },
  {
    patterns: [/mysuru|mysore/i],
    result: {
      display_name: "Mysuru, Mysuru District, Karnataka, India",
      short_name: "Mysuru",
      type: "city",
      category: "place",
      lat: 12.29581,
      lng: 76.63938,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/mangaluru|mangalore/i],
    result: {
      display_name: "Mangaluru, Dakshina Kannada, Karnataka, India",
      short_name: "Mangaluru",
      type: "city",
      category: "place",
      lat: 12.91414,
      lng: 74.85596,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/hubballi|hubli/i],
    result: {
      display_name: "Hubballi, Dharwad District, Karnataka, India",
      short_name: "Hubballi",
      type: "city",
      category: "place",
      lat: 15.36471,
      lng: 75.12395,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/belagavi|belgaum/i],
    result: {
      display_name: "Belagavi, Belagavi District, Karnataka, India",
      short_name: "Belagavi",
      type: "city",
      category: "place",
      lat: 15.84969,
      lng: 74.49767,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/tumakuru|tumkur/i],
    result: {
      display_name: "Tumakuru, Tumakuru District, Karnataka, India",
      short_name: "Tumakuru",
      type: "city",
      category: "place",
      lat: 13.34088,
      lng: 77.10057,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/shivamogga|shimoga/i],
    result: {
      display_name: "Shivamogga, Shivamogga District, Karnataka, India",
      short_name: "Shivamogga",
      type: "city",
      category: "place",
      lat: 13.92993,
      lng: 75.56810,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/chikkaballapur|chikballapur/i],
    result: {
      display_name: "Chikkaballapur, Chikkaballapura District, Karnataka, India",
      short_name: "Chikkaballapur",
      type: "town",
      category: "place",
      lat: 13.43549,
      lng: 77.72750,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/davanagere|davangere/i],
    result: {
      display_name: "Davanagere, Davanagere District, Karnataka, India",
      short_name: "Davanagere",
      type: "city",
      category: "place",
      lat: 14.46444,
      lng: 75.92180,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/ballari|bellary/i],
    result: {
      display_name: "Ballari, Ballari District, Karnataka, India",
      short_name: "Ballari",
      type: "city",
      category: "place",
      lat: 15.13939,
      lng: 76.92144,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/hampi/i],
    result: {
      display_name: "Hampi, Vijayanagara District, Karnataka, India",
      short_name: "Hampi",
      type: "historic",
      category: "tourism",
      lat: 15.33501,
      lng: 76.46002,
      confidence: "HIGH",
      relevance_score: 100,
      is_poi: true,
      intent_match: true,
    },
  },
  {
    patterns: [/udupi/i],
    result: {
      display_name: "Udupi, Udupi District, Karnataka, India",
      short_name: "Udupi",
      type: "city",
      category: "place",
      lat: 13.34088,
      lng: 74.74214,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/hassan/i],
    result: {
      display_name: "Hassan, Hassan District, Karnataka, India",
      short_name: "Hassan",
      type: "city",
      category: "place",
      lat: 13.00326,
      lng: 76.10040,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/mandya/i],
    result: {
      display_name: "Mandya, Mandya District, Karnataka, India",
      short_name: "Mandya",
      type: "town",
      category: "place",
      lat: 12.52298,
      lng: 76.89886,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/kolar/i],
    result: {
      display_name: "Kolar, Kolar District, Karnataka, India",
      short_name: "Kolar",
      type: "town",
      category: "place",
      lat: 13.13621,
      lng: 78.12906,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/ramanagara/i],
    result: {
      display_name: "Ramanagara, Ramanagara District, Karnataka, India",
      short_name: "Ramanagara",
      type: "town",
      category: "place",
      lat: 12.71503,
      lng: 77.28131,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/chitradurga/i],
    result: {
      display_name: "Chitradurga, Chitradurga District, Karnataka, India",
      short_name: "Chitradurga",
      type: "city",
      category: "place",
      lat: 14.22513,
      lng: 76.39801,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
  {
    patterns: [/coorg|madikeri/i],
    result: {
      display_name: "Madikeri (Coorg), Kodagu District, Karnataka, India",
      short_name: "Madikeri (Coorg)",
      type: "town",
      category: "place",
      lat: 12.42442,
      lng: 75.73819,
      confidence: "HIGH",
      relevance_score: 95,
      is_poi: false,
      intent_match: true,
    },
  },
];

// =========================================================
// GET /api/routes/geocode?q=...
// Multi-Stage Intent-Aware Geocoding Engine with Pinpoint Landmark DB
// =========================================================
router.get("/geocode", async (req: Request, res: Response) => {
  try {
    const rawQuery = (req.query.q as string || "").trim();
    if (!rawQuery) {
      return res.status(400).json({ success: false, results: [] });
    }

    const cacheKey = rawQuery.toLowerCase();
    if (GEOCODE_CACHE.has(cacheKey)) {
      console.log(`[SafeOps Geocoder] Cache Hit for query: "${rawQuery}"`);
      return res.status(200).json({ success: true, results: GEOCODE_CACHE.get(cacheKey) });
    }

    console.log("\n==================================================");
    console.log(`[SafeOps Geocoder] USER QUERY: "${rawQuery}"`);

    // STAGE 0: Check Pinpoint Landmark Table first (exact GPS for known POIs)
    // Supports both exact full pattern matches and substring/partial matches
    const pinpointMatches = LANDMARK_PINPOINTS.filter(lm =>
      lm.patterns.some(pattern => pattern.test(rawQuery))
    );

    if (pinpointMatches.length > 0) {
      const candidates: GeocodeCandidate[] = pinpointMatches.map((pm, idx) => ({
        ...pm.result,
        place_id: 900000 + idx,
        osm_type: "way",
        osm_id: 0,
        address: {},
      }));
      console.log(`[SafeOps Geocoder] PINPOINT MATCHES: ${candidates.length} found for "${rawQuery}"`);
      candidates.forEach(c => console.log(`  → ${c.short_name} (${c.lat}, ${c.lng})`));
      console.log("==================================================\n");
      GEOCODE_CACHE.set(cacheKey, candidates);
      return res.status(200).json({ success: true, query: rawQuery, detected_intent: "PINPOINT", results: candidates });
    }

    // 1. Query Type & Intent Detection
    const intent = detectQueryIntent(rawQuery);
    console.log(`[SafeOps Geocoder] DETECTED INTENT: ${intent.primaryType} (Keywords: ${intent.keywords.join(", ")})`);

    // 2. Fetch Raw Candidates via Multi-Stage Strategy (Nominatim + Photon OSM fallback)
    let rawItems = await fetchNominatimMultiStage(rawQuery, intent);
    
    // If Nominatim returned empty (e.g. rate-limited), fallback to Photon OpenStreetMap API
    if (rawItems.length === 0) {
      console.log(`[SafeOps Geocoder] Trying Photon OSM API for "${rawQuery}"...`);
      rawItems = await queryPhotonOSM(rawQuery);
    }

    console.log(`[SafeOps Geocoder] RAW CANDIDATES RETURNED: ${rawItems.length}`);

    if (rawItems.length === 0) {
      console.log(`[SafeOps Geocoder] No results found for query "${rawQuery}"`);
      return res.status(200).json({ success: true, results: [], message: "Couldn't confidently identify this exact location." });
    }

    // 3. Process, Score, and Rank Candidates
    const candidates = processAndRankCandidates(rawQuery, intent, rawItems);

    // 4. Filter out obviously irrelevant results (e.g. 'food court' for a college search)
    const filtered = filterIrrelevantResults(rawQuery, intent, candidates);
    const finalCandidates = filtered.length > 0 ? filtered : candidates.slice(0, 3);

    // Debug Log Top Candidates
    finalCandidates.forEach((c, i) => {
      console.log(`  [Candidate #${i + 1}] Score: ${c.relevance_score} | Confidence: ${c.confidence}`);
      console.log(`     Name: "${c.short_name}" | Type: ${c.type} (${c.category}) | POI: ${c.is_poi}`);
      console.log(`     Display: ${c.display_name}`);
      console.log(`     GPS: ${c.lat}, ${c.lng} | OSM: ${c.osm_type}/${c.osm_id}`);
    });
    console.log("==================================================\n");

    GEOCODE_CACHE.set(cacheKey, finalCandidates);

    return res.status(200).json({
      success: true,
      query: rawQuery,
      detected_intent: intent.primaryType,
      results: finalCandidates,
    });
  } catch (err: any) {
    console.error("Geocode API Error:", err?.message);
    return res.status(500).json({ success: false, results: [] });
  }
});

// =========================================================
// OSRM Client Configuration (Free & Open Source Road Routing)
// =========================================================
const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";

interface OSRMRouteResult {
  coordinates: [number, number][]; // [lat, lng] array
  distance_m: number;
  duration_s: number;
}

async function fetchOSRMRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<OSRMRouteResult | null> {
  try {
    const url = `${OSRM_BASE_URL}/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const resp = await axios.get(url, {
      headers: { "User-Agent": "SafeOps-Geospatial-Routing/2.0" },
      timeout: 10000,
    });

    if (resp.data && resp.data.code === "Ok" && resp.data.routes && resp.data.routes.length > 0) {
      const route = resp.data.routes[0];
      // OSRM returns GeoJSON [lng, lat] -> convert to Leaflet [lat, lng]
      const coordinates: [number, number][] = route.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]]
      );

      return {
        coordinates,
        distance_m: route.distance,
        duration_s: route.duration,
      };
    }
    return null;
  } catch (err: any) {
    console.warn(`[OSRM Warning] Failed to fetch road route: ${err.message}`);
    return null;
  }
}

// POST /api/routes/plan
// Full-Route Integration: Exact Endpoints + Real Road Connectors + Python KDE Core
// =========================================================
router.post("/plan", async (req: Request, res: Response) => {
  try {
    let { origin, destination, weights } = req.body;

    let originCoords = parseCoord(origin);
    let destCoords = parseCoord(destination);

    if (!originCoords || !destCoords) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing origin/destination coordinates. Please select valid places from search.",
      });
    }

    const tStart = Date.now();

    // 1. Fetch Normal Route (Complete X -> Y via real roads from OSRM)
    const osrmNormal = await fetchOSRMRoute(
      originCoords.lat,
      originCoords.lng,
      destCoords.lat,
      destCoords.lng
    );

    // 2. Call Python Safe Route microservice for core Dijkstra routing
    const pythonResponse = await axios.post(
      `${PYTHON_SERVICE_URL}/plan-route`,
      {
        origin: originCoords,
        destination: destCoords,
        weights: weights || { alpha: 0.3, beta: 0.3, gamma: 0.4 },
      },
      { timeout: 25000 }
    );

    const pyData = pythonResponse.data;
    if (!pyData || !pyData.success) {
      return res.status(500).json({
        success: false,
        message: pyData?.message || "Failed to calculate core safe route.",
      });
    }

    const snappedOrigin = pyData.snapped_origin; // [lat, lng]
    const snappedDest = pyData.snapped_destination; // [lat, lng]

    // 3. Fetch Real-Road Connector Legs for the SafeOps Route
    // Connector 1: Exact origin X -> Snapped Graph Entry Node
    let connector1Coords: [number, number][] = [];
    let connector1Dist = 0;
    let connector1Duration = 0;

    const osrmConn1 = await fetchOSRMRoute(
      originCoords.lat,
      originCoords.lng,
      snappedOrigin[0],
      snappedOrigin[1]
    );

    if (osrmConn1 && osrmConn1.coordinates.length > 0) {
      connector1Coords = osrmConn1.coordinates;
      connector1Dist = osrmConn1.distance_m;
      connector1Duration = osrmConn1.duration_s;
    } else {
      connector1Coords = [[originCoords.lat, originCoords.lng], snappedOrigin];
    }

    // Connector 2: Snapped Graph Exit Node -> Exact destination Y
    let connector2Coords: [number, number][] = [];
    let connector2Dist = 0;
    let connector2Duration = 0;

    const osrmConn2 = await fetchOSRMRoute(
      snappedDest[0],
      snappedDest[1],
      destCoords.lat,
      destCoords.lng
    );

    if (osrmConn2 && osrmConn2.coordinates.length > 0) {
      connector2Coords = osrmConn2.coordinates;
      connector2Dist = osrmConn2.distance_m;
      connector2Duration = osrmConn2.duration_s;
    } else {
      connector2Coords = [snappedDest, [destCoords.lat, destCoords.lng]];
    }

    // 4. Assemble Complete Continuous Real-Road SafeOps Route
    // [Exact Origin X] -> [Connector 1 roads] -> [Core Dijkstra roads] -> [Connector 2 roads] -> [Exact Destination Y]
    const coreCoords: [number, number][] = pyData.safest_route.coordinates;
    const fullSafeCoords: [number, number][] = [];

    // Add Connector 1
    connector1Coords.forEach((pt) => fullSafeCoords.push(pt));

    // Add Core Route (avoiding duplicate vertex)
    if (coreCoords.length > 0) {
      if (fullSafeCoords.length === 0) {
        coreCoords.forEach((pt) => fullSafeCoords.push(pt));
      } else {
        coreCoords.slice(1).forEach((pt) => fullSafeCoords.push(pt));
      }
    }

    // Add Connector 2 (avoiding duplicate vertex)
    if (connector2Coords.length > 0) {
      if (fullSafeCoords.length === 0) {
        connector2Coords.forEach((pt) => fullSafeCoords.push(pt));
      } else {
        connector2Coords.slice(1).forEach((pt) => fullSafeCoords.push(pt));
      }
    }

    // Guarantee exact start and endpoints
    fullSafeCoords[0] = [originCoords.lat, originCoords.lng];
    fullSafeCoords[fullSafeCoords.length - 1] = [destCoords.lat, destCoords.lng];

    const totalSafeDist = connector1Dist + pyData.safest_route.distance_m + connector2Dist;
    const totalSafeTimeMin = (connector1Duration + (pyData.safest_route.time_min * 60) + connector2Duration) / 60.0;

    // 5. Score Both Routes using the exact same SafeOps KDE Model
    let normalKdeMetrics = { total_risk: 0, avg_risk_per_km: 0, n_risk_samples: 0 };
    let safeKdeMetrics = { total_risk: 0, avg_risk_per_km: 0, n_risk_samples: 0 };

    const normalCoords: [number, number][] = osrmNormal && osrmNormal.coordinates.length > 0
      ? osrmNormal.coordinates
      : pyData.shortest_route.coordinates;

    // Score Normal Route geometry via Python /score-geometry endpoint
    try {
      const scoreNormResp = await axios.post(`${PYTHON_SERVICE_URL}/score-geometry`, {
        coordinates: normalCoords,
      });
      if (scoreNormResp.data?.success) {
        normalKdeMetrics = scoreNormResp.data.metrics;
      }
    } catch (e: any) {
      console.warn("[KDE Scoring Warning] Failed to score normal route:", e.message);
    }

    // Score Full SafeOps Route geometry via Python /score-geometry endpoint
    try {
      const scoreSafeResp = await axios.post(`${PYTHON_SERVICE_URL}/score-geometry`, {
        coordinates: fullSafeCoords,
      });
      if (scoreSafeResp.data?.success) {
        safeKdeMetrics = scoreSafeResp.data.metrics;
      }
    } catch (e: any) {
      console.warn("[KDE Scoring Warning] Failed to score safe route:", e.message);
    }

    // 6. Compute Comprehensive Comparison Metrics
    const normalDistance = osrmNormal ? osrmNormal.distance_m : pyData.shortest_route.distance_m;
    const normalTimeMin = osrmNormal ? osrmNormal.duration_s / 60.0 : pyData.shortest_route.time_min;

    const distDiff = totalSafeDist - normalDistance;
    const distIncPct = normalDistance > 0 ? (distDiff / normalDistance) * 100.0 : 0.0;

    const riskDiff = normalKdeMetrics.avg_risk_per_km - safeKdeMetrics.avg_risk_per_km;
    const riskRedPct = normalKdeMetrics.avg_risk_per_km > 0
      ? (riskDiff / normalKdeMetrics.avg_risk_per_km) * 100.0
      : 0.0;

    const timeDiffMin = totalSafeTimeMin - normalTimeMin;

    const safestRouteResult = {
      coordinates: fullSafeCoords,
      distance_m: Math.round(totalSafeDist),
      time_min: Math.round(totalSafeTimeMin * 10) / 10,
      safety_score: Math.max(0, Math.min(100, Math.round(100 - (safeKdeMetrics.avg_risk_per_km / 500)))),
      overall_risk_level: safeKdeMetrics.avg_risk_per_km >= 30000 ? "HIGH RISK" : (safeKdeMetrics.avg_risk_per_km >= 15000 ? "MODERATE RISK" : "LOW RISK"),
      n_nodes: fullSafeCoords.length,
      kde_metrics: safeKdeMetrics,
      risk_segments: pyData.safest_route.risk_segments || [],
    };

    const shortestRouteResult = {
      coordinates: normalCoords,
      distance_m: Math.round(normalDistance),
      time_min: Math.round(normalTimeMin * 10) / 10,
      safety_score: Math.max(0, Math.min(100, Math.round(100 - (normalKdeMetrics.avg_risk_per_km / 500)))),
      overall_risk_level: normalKdeMetrics.avg_risk_per_km >= 30000 ? "HIGH RISK" : (normalKdeMetrics.avg_risk_per_km >= 15000 ? "MODERATE RISK" : "LOW RISK"),
      n_nodes: normalCoords.length,
      kde_metrics: normalKdeMetrics,
      risk_segments: pyData.shortest_route.risk_segments || [],
    };

    const explanation = distDiff !== 0
      ? `SafeOps route navigates via verified arterial roads with ${safeKdeMetrics.avg_risk_per_km.toLocaleString()} avg risk/km compared to ${normalKdeMetrics.avg_risk_per_km.toLocaleString()} on conventional routes.`
      : "The conventional direct route is already aligned with the lowest risk exposure paths.";

    return res.status(200).json({
      success: true,
      snapped_origin: snappedOrigin,
      snapped_destination: snappedDest,
      safest_route: safestRouteResult,
      shortest_route: shortestRouteResult,
      metrics: {
        distance_increase_pct: Math.round(distIncPct * 10) / 10,
        risk_reduction_pts: Math.round(riskRedPct * 10) / 10,
        time_difference_min: Math.round(timeDiffMin * 10) / 10,
        is_different_route: fullSafeCoords.length !== normalCoords.length,
        explanation,
      },
      execution_time_ms: Date.now() - tStart,
    });
  } catch (error: any) {
    console.error("❌ Safe Route Proxy Error:", error?.message);

    if (error.code === "ECONNREFUSED") {
      return res.status(503).json({
        success: false,
        message: "Safe Route calculation service is currently offline. Please ensure Python backend is running on port 8000.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error?.response?.data?.detail || error?.message || "Failed to calculate safe route.",
    });
  }
});

// Helper: Query Type & Intent Detection
function detectQueryIntent(q: string) {
  const lower = q.toLowerCase();

  if (/bus stop|bus station|bus stand|transit/i.test(lower)) {
    return { primaryType: "TRANSIT", keywords: ["bus_stop", "bus_station", "platform", "station"] };
  }
  if (/institute|college|university|school|campus|technology|mvit|bms/i.test(lower)) {
    return { primaryType: "EDUCATION", keywords: ["college", "university", "school", "building", "kindergarten"] };
  }
  if (/hospital|clinic|medical|health/i.test(lower)) {
    return { primaryType: "HEALTHCARE", keywords: ["hospital", "clinic", "doctors"] };
  }
  if (/view point|viewpoint|hills|hill|peak|lookout|attraction/i.test(lower)) {
    return { primaryType: "ATTRACTION", keywords: ["viewpoint", "attraction", "wood", "natural", "peak", "park"] };
  }
  if (/road|street|marg|avenue|layout|cross|main/i.test(lower)) {
    return { primaryType: "ROAD", keywords: ["primary", "secondary", "tertiary", "residential", "living_street"] };
  }
  return { primaryType: "GENERAL", keywords: [] };
}

// Helper: Multi-Stage Nominatim Fetch
// Always includes Bengaluru/Karnataka context to avoid wrong city matches.
async function fetchNominatimMultiStage(rawQuery: string, intent: any): Promise<any[]> {
  // Stage 1: Query with Bengaluru context (primary — avoids false city matches)
  if (!/bengaluru|bangalore|karnataka|india/i.test(rawQuery)) {
    const items = await queryNominatim(`${rawQuery}, Bengaluru, Karnataka, India`);
    if (items.length > 0) return items;
  }

  // Stage 2: Exact raw query (for queries that already have location context)
  let items = await queryNominatim(rawQuery);
  if (items.length > 0) return items;

  // Stage 3: Normalized Synonym Expansion
  let normalized = rawQuery
    .replace(/view\s*point/gi, "Viewpoint")
    .replace(/hunsmaranahalli/gi, "Hunasamaranahalli")
    .replace(/sir\s*mvit/gi, "Sir M Visvesvaraya Institute of Technology")
    .replace(/\bkgf\b/gi, "Kolar Gold Fields")
    .replace(/\bmg road\b/gi, "Mahatma Gandhi Road");

  if (normalized !== rawQuery) {
    items = await queryNominatim(`${normalized}, Bengaluru, Karnataka, India`);
    if (items.length > 0) return items;
  }

  // Stage 4: Broader Karnataka search (for rural/outskirt locations)
  if (!/karnataka|india/i.test(rawQuery)) {
    items = await queryNominatim(`${rawQuery}, Karnataka, India`);
    if (items.length > 0) return items;
  }

  // Stage 5: Nandi Hills specific fallback
  if (/nandi/i.test(rawQuery)) {
    items = await queryNominatim("Nandi Hills, Chikkaballapura, Karnataka, India");
    if (items.length > 0) return items;
  }

  return [];
}

// Helper: Filter out obviously irrelevant results
function filterIrrelevantResults(query: string, intent: any, candidates: GeocodeCandidate[]): GeocodeCandidate[] {
  const queryLower = query.toLowerCase();

  return candidates.filter((c) => {
    const nameLower = c.short_name.toLowerCase();
    const displayLower = c.display_name.toLowerCase();

    // For EDUCATION intent: reject food courts, restaurants, malls
    if (intent.primaryType === "EDUCATION") {
      if (/food court|restaurant|cafe|mall|market|shop|store/i.test(nameLower)) return false;
      if (!c.is_poi && c.confidence === "LOW") return false;
    }

    // For TRANSIT intent: prefer bus_stop results, reject residential localities
    if (intent.primaryType === "TRANSIT") {
      if (c.type === "suburb" || c.type === "village" || c.type === "hamlet") {
        // Keep locality only if it's the ONLY result or query exactly matches name
        return candidates.length <= 1;
      }
    }

    // General quality filter: reject if display_name contains very different city
    if (/mumbai|delhi|hyderabad|chennai|kolkata|pune|ahmedabad/i.test(displayLower) &&
        !/bengaluru|bangalore|karnataka/i.test(displayLower)) {
      return false;
    }

    return true;
  });
}

async function queryNominatim(q: string): Promise<any[]> {
  try {
    const res = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: {
        q: q,
        format: "json",
        addressdetails: 1,
        extratags: 1,
        limit: 10,
        countrycodes: "in",
      },
      headers: {
        "User-Agent": "SafeOps-Safety-Intelligence/2.0 (contact@safeops.internal)",
      },
      timeout: 6000,
    });
    return res.data || [];
  } catch (err: any) {
    console.warn(`[SafeOps Geocoder Warning] Nominatim query failed for "${q}":`, err?.message);
    return [];
  }
}

async function queryPhotonOSM(q: string): Promise<any[]> {
  try {
    const res = await axios.get("https://photon.komoot.io/api/", {
      params: {
        q: q,
        limit: 8,
        lat: 12.9716, // Biased towards Karnataka / Bengaluru
        lon: 77.5946,
      },
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SafeOps/2.0",
      },
      timeout: 5000,
    });

    if (!res.data || !res.data.features) return [];

    // Map Photon GeoJSON features to Nominatim-compatible candidate structures
    return res.data.features.map((f: any, idx: number) => {
      const p = f.properties || {};
      const coords = f.geometry?.coordinates || [0, 0]; // [lon, lat]
      const name = p.name || q;
      const locality = p.city || p.town || p.village || p.district || p.county || "";
      const state = p.state || "Karnataka";
      const country = p.country || "India";

      const displayParts = [name, locality, state, country].filter(Boolean);

      return {
        place_id: 800000 + idx,
        display_name: displayParts.join(", "),
        short_name: name,
        lat: String(coords[1]),
        lon: String(coords[0]),
        type: p.osm_value || p.type || "place",
        class: p.osm_key || "place",
        osm_type: p.osm_type || "N",
        osm_id: p.osm_id || 0,
        importance: 0.5,
        address: {
          city: locality,
          state: state,
          country: country,
        },
      };
    });
  } catch (err: any) {
    console.warn(`[SafeOps Geocoder Warning] Photon query failed for "${q}":`, err?.message);
    return [];
  }
}

// Helper: Process, Score, Rank Candidates
function processAndRankCandidates(userQuery: string, intent: any, rawItems: any[]): GeocodeCandidate[] {
  const queryTerms = userQuery.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);

  const candidates: GeocodeCandidate[] = rawItems.map((item: any) => {
    const parts = item.display_name.split(",");
    const shortName = parts[0]?.trim() || item.name || userQuery;
    const type = item.type || "place";
    const category = item.class || "amenity";
    const displayName = item.display_name;

    // POI vs Locality Classification
    const isPoi = ["amenity", "building", "leisure", "tourism", "shop", "office"].includes(category) ||
                  ["college", "university", "hospital", "bus_stop", "viewpoint", "school", "station"].includes(type);

    // Exact Name Similarity Score (0-40 pts)
    const normalizedShortName = shortName.toLowerCase().replace(/[^a-z0-9\s]/g, "");
    let nameScore = 0;
    const matchingTermsCount = queryTerms.filter((term) => normalizedShortName.includes(term) || displayName.toLowerCase().includes(term)).length;
    nameScore = (matchingTermsCount / queryTerms.length) * 40.0;

    // Intent Keyword Match Score (0-30 pts)
    let intentScore = 0;
    if (intent.keywords.length > 0) {
      if (intent.keywords.includes(type) || intent.keywords.includes(category)) {
        intentScore = 30.0;
      }
    } else {
      intentScore = 15.0; // General query
    }

    // Specificity Bonus: Prefer specific POIs over roads/locality bounds (0-20 pts)
    let poiBonus = 0;
    if (intent.primaryType !== "ROAD" && intent.primaryType !== "GENERAL") {
      if (isPoi) poiBonus = 20.0;
      else if (category === "highway" && type !== "bus_stop") poiBonus = 5.0; // Penalty for roads when searching for landmark
      else poiBonus = 10.0;
    } else {
      poiBonus = 15.0;
    }

    // Nominatim Importance Score (0-10 pts)
    const importanceScore = (parseFloat(item.importance) || 0.1) * 10.0;

    const totalRelevance = Math.round(nameScore + intentScore + poiBonus + importanceScore);

    // Confidence Level Assignment
    let confidence: "HIGH" | "MEDIUM" | "LOW" = "LOW";
    if (totalRelevance >= 75 && matchingTermsCount === queryTerms.length) {
      confidence = "HIGH";
    } else if (totalRelevance >= 50) {
      confidence = "MEDIUM";
    }

    return {
      place_id: item.place_id,
      display_name: displayName,
      short_name: shortName,
      type: type,
      category: category,
      osm_type: item.osm_type,
      osm_id: item.osm_id,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      confidence,
      relevance_score: totalRelevance,
      is_poi: isPoi,
      intent_match: intentScore > 0,
      address: item.address || {},
    };
  });

  // Sort descending by relevance score
  return candidates.sort((a, b) => b.relevance_score - a.relevance_score);
}

function parseCoord(input: any): { lat: number; lng: number } | null {
  if (!input) return null;
  if (typeof input === "object" && typeof input.lat === "number" && typeof input.lng === "number") {
    return { lat: input.lat, lng: input.lng };
  }
  return null;
}

export default router;
