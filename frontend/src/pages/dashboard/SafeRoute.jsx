import { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  Clock3,
  Crosshair,
  MapPin,
  Navigation,
  Route,
  Shield,
  Star,
  Users,
  Loader2,
  ArrowUpDown,
  Sparkles,
  Info,
  CheckCircle2,
  X,
  Search,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import api from "../../api/axios";

import Header from "../../components/layout/Header";
import Sidebar from "../../components/layout/Sidebar";
import Card from "../../components/common/Card";

// Fix default marker icon issue with Leaflet in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const DEFAULT_CENTER = [13.1362, 77.5971];

// Helper component to auto-fit Leaflet map bounds to active route
function MapController({ bounds, originCoord, destCoord }) {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
    } else if (originCoord) {
      map.setView([originCoord.lat, originCoord.lng], 14);
    }
  }, [bounds, originCoord, destCoord, map]);

  return null;
}

export default function SafeRoute() {
  const [originQuery, setOriginQuery] = useState("Sir MVIT College");
  const [destQuery, setDestQuery] = useState("Hunasamaranahalli Bus Stop");

  const [originPlace, setOriginPlace] = useState(null);
  const [destPlace, setDestPlace] = useState(null);

  const [originCandidates, setOriginCandidates] = useState([]);
  const [destCandidates, setDestCandidates] = useState([]);

  const [searchingOrigin, setSearchingOrigin] = useState(false);
  const [searchingDest, setSearchingDest] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);

  const [originNoResults, setOriginNoResults] = useState(false);
  const [destNoResults, setDestNoResults] = useState(false);

  const [loadingRoute, setLoadingRoute] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Debounce timers and request counters to avoid stale async overwrites
  const originTimerRef = useRef(null);
  const destTimerRef = useRef(null);
  const originReqIdRef = useRef(0);
  const destReqIdRef = useRef(0);

  // Route Priority Preset: "balanced" (alpha=0.3, beta=0.3, gamma=0.4), "safest" (gamma=0.8), "fastest" (gamma=0.0)
  const [routePriority, setRoutePriority] = useState("balanced");
  
  // Real API response state
  const [routeData, setRouteData] = useState(null);
  const [selectedRouteType, setSelectedRouteType] = useState("safest"); // "safest" | "shortest"

  // Initial geocode lookup on mount
  useEffect(() => {
    autoInitializeDefaultLocations();
    return () => {
      if (originTimerRef.current) clearTimeout(originTimerRef.current);
      if (destTimerRef.current) clearTimeout(destTimerRef.current);
    };
  }, []);

  const autoInitializeDefaultLocations = async () => {
    try {
      const origRes = await api.get("/routes/geocode?q=Sir MVIT College");
      if (origRes.data?.results?.[0]) {
        setOriginPlace(origRes.data.results[0]);
      }

      const destRes = await api.get("/routes/geocode?q=Hunasamaranahalli Bus Stop");
      if (destRes.data?.results?.[0]) {
        setDestPlace(destRes.data.results[0]);
      }
    } catch (err) {
      console.warn("Auto geocode lookup fallback:", err);
    }
  };

  // 1. Swap Origin & Destination
  const handleSwapLocations = () => {
    const tempQuery = originQuery;
    const tempPlace = originPlace;

    setOriginQuery(destQuery);
    setOriginPlace(destPlace);
    setOriginCandidates([]);
    setOriginNoResults(false);

    setDestQuery(tempQuery);
    setDestPlace(tempPlace);
    setDestCandidates([]);
    setDestNoResults(false);

    setRouteData(null);
    setErrorMsg("");
  };

  // 2. Use Current Browser Location for Origin
  const handleUseCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      setErrorMsg("Geolocation is not supported by your browser.");
      return;
    }

    setLocatingUser(true);
    setErrorMsg("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        const currentLocPlace = {
          place_id: 99999,
          display_name: `Current GPS Location, Karnataka, India`,
          short_name: "Current Location",
          type: "current_location",
          category: "user",
          lat: userLat,
          lng: userLng,
        };

        setOriginPlace(currentLocPlace);
        setOriginQuery("Current Location");
        setOriginCandidates([]);
        setOriginNoResults(false);
        setLocatingUser(false);
        setRouteData(null);
      },
      (err) => {
        setLocatingUser(false);
        setErrorMsg("Unable to retrieve GPS location. Please check browser permissions.");
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  };

  // Search Origin Candidates with Debounce (300ms) and Stale Request Guard
  const handleSearchOrigin = (queryText) => {
    setOriginQuery(queryText);
    setOriginPlace(null);
    setOriginNoResults(false);
    setErrorMsg("");

    if (originTimerRef.current) {
      clearTimeout(originTimerRef.current);
    }

    const trimmed = queryText.trim();
    if (!trimmed) {
      setOriginCandidates([]);
      setSearchingOrigin(false);
      return;
    }

    const currentReqId = ++originReqIdRef.current;
    setSearchingOrigin(true);

    originTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/routes/geocode?q=${encodeURIComponent(trimmed)}`);
        if (originReqIdRef.current === currentReqId) {
          const results = res.data?.results || [];
          setOriginCandidates(results);
          setOriginNoResults(results.length === 0);
        }
      } catch (err) {
        if (originReqIdRef.current === currentReqId) {
          console.error("Origin geocode search error:", err);
          setOriginCandidates([]);
          setOriginNoResults(true);
        }
      } finally {
        if (originReqIdRef.current === currentReqId) {
          setSearchingOrigin(false);
        }
      }
    }, 280);
  };

  // Search Destination Candidates with Debounce (300ms) and Stale Request Guard
  const handleSearchDest = (queryText) => {
    setDestQuery(queryText);
    setDestPlace(null);
    setDestNoResults(false);
    setErrorMsg("");

    if (destTimerRef.current) {
      clearTimeout(destTimerRef.current);
    }

    const trimmed = queryText.trim();
    if (!trimmed) {
      setDestCandidates([]);
      setSearchingDest(false);
      return;
    }

    const currentReqId = ++destReqIdRef.current;
    setSearchingDest(true);

    destTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/routes/geocode?q=${encodeURIComponent(trimmed)}`);
        if (destReqIdRef.current === currentReqId) {
          const results = res.data?.results || [];
          setDestCandidates(results);
          setDestNoResults(results.length === 0);
        }
      } catch (err) {
        if (destReqIdRef.current === currentReqId) {
          console.error("Dest geocode search error:", err);
          setDestCandidates([]);
          setDestNoResults(true);
        }
      } finally {
        if (destReqIdRef.current === currentReqId) {
          setSearchingDest(false);
        }
      }
    }, 280);
  };

  // Calculate Route with EXACT resolved coordinates & Selected Weight Preset
  const handleCalculateRoute = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg("");

    let currentOrigin = originPlace;
    let currentDest = destPlace;

    // Direct fallback if user typed an exact query but hasn't clicked candidate
    if (!currentOrigin && originQuery.trim()) {
      try {
        const origRes = await api.get(`/routes/geocode?q=${encodeURIComponent(originQuery.trim())}`);
        if (origRes.data?.results?.[0]) {
          currentOrigin = origRes.data.results[0];
          setOriginPlace(currentOrigin);
        }
      } catch (err) {
        console.warn("Origin fallback geocode failed", err);
      }
    }

    if (!currentDest && destQuery.trim()) {
      try {
        const destRes = await api.get(`/routes/geocode?q=${encodeURIComponent(destQuery.trim())}`);
        if (destRes.data?.results?.[0]) {
          currentDest = destRes.data.results[0];
          setDestPlace(currentDest);
        }
      } catch (err) {
        console.warn("Destination fallback geocode failed", err);
      }
    }

    if (!currentOrigin || !currentDest) {
      setErrorMsg("Please select both starting location and destination from the search results.");
      return;
    }

    setLoadingRoute(true);

    // Map Priority Presets to Notebook Weights
    let weights = { alpha: 0.3, beta: 0.3, gamma: 0.4 }; // Default Balanced
    if (routePriority === "safest") {
      weights = { alpha: 0.1, beta: 0.1, gamma: 0.8 };
    } else if (routePriority === "fastest") {
      weights = { alpha: 0.5, beta: 0.5, gamma: 0.0 };
    }

    try {
      const response = await api.post("/routes/plan", {
        origin: { lat: currentOrigin.lat, lng: currentOrigin.lng },
        destination: { lat: currentDest.lat, lng: currentDest.lng },
        weights
      });

      if (response.data && response.data.success) {
        setRouteData(response.data);
      } else {
        setErrorMsg("Unable to calculate route for the given coordinates. Please select an alternate location on the road network.");
      }
    } catch (err) {
      console.error("Route calculation error:", err);
      setErrorMsg(err.response?.data?.message || "Failed to calculate safe route from SafeOps routing engine.");
    } finally {
      setLoadingRoute(false);
    }
  };

  const safestRoute = routeData?.safest_route;
  const shortestRoute = routeData?.shortest_route;
  const metrics = routeData?.metrics;
  const snappedOrigin = routeData?.snapped_origin;
  const snappedDest = routeData?.snapped_destination;

  const activeRoute = selectedRouteType === "safest" ? safestRoute : shortestRoute;
  const mapBounds = activeRoute?.coordinates?.length > 0 ? activeRoute.coordinates : null;

  const isCalculateDisabled =
    loadingRoute ||
    searchingOrigin ||
    searchingDest ||
    (!originPlace && !originQuery.trim()) ||
    (!destPlace && !destQuery.trim());

  return (
    <div className="dashboard-layout">
      <Header />
      <Sidebar />

      <main className="dashboard-main">
        <div className="dashboard-content">
          <div className="page-title-row" style={{ marginBottom: "16px" }}>
            <div>
              <span className="eyebrow">GEOSPATIAL SAFETY INTELLIGENCE</span>
              <h1 style={{ fontSize: "28px", margin: "4px 0" }}>Safe Route Planner</h1>
              <p style={{ color: "var(--text-soft)", fontSize: "14px" }}>
                Precise landmark geocoding → real OSM roads → KDE crime-risk analysis → SafeOps route optimization.
              </p>
            </div>

            <div className="route-protected glass-panel" style={{ padding: "8px 14px", borderRadius: "20px", display: "flex", alignItems: "center", gap: "8px", color: "var(--teal)", fontSize: "13px" }}>
              <Shield size={16} />
              <span>Karnataka Safety Resolution Active</span>
            </div>
          </div>

          {/* Search Card & Controls */}
          <Card className="route-search-card" style={{ position: "relative", padding: "18px 20px", marginBottom: "20px" }}>
            <form className="route-search" onSubmit={handleCalculateRoute}>
              
              {/* Dual Location Input Strip */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "12px", alignItems: "center" }}>
                
                {/* ================= FROM INPUT ================= */}
                <div style={{ position: "relative", minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "0.8px", color: "var(--primary)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <MapPin size={13} /> FROM
                    </label>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Starting Point</span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      background: "rgba(255, 255, 255, 0.04)",
                      padding: "10px 14px",
                      borderRadius: "12px",
                      border: originPlace ? "1.5px solid rgba(59, 130, 246, 0.6)" : "1px solid var(--border)",
                      boxShadow: originPlace ? "0 0 12px rgba(59, 130, 246, 0.15)" : "none",
                      transition: "border-color 0.2s, box-shadow 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "8px", background: "rgba(59, 130, 246, 0.15)", color: "var(--primary)", flexShrink: 0 }}>
                      <MapPin size={16} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {originPlace ? (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: "700", fontSize: "14px", color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {originPlace.short_name}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--text-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {originPlace.display_name}
                          </span>
                        </div>
                      ) : (
                        <input
                          value={originQuery}
                          onChange={(e) => handleSearchOrigin(e.target.value)}
                          placeholder="Search starting location (e.g. Sir MVIT, Hebbal, Mysuru)..."
                          style={{
                            background: "transparent",
                            border: 0,
                            color: "white",
                            width: "100%",
                            outline: "none",
                            fontSize: "14px"
                          }}
                        />
                      )}
                    </div>

                    {searchingOrigin && <Loader2 className="animate-spin" size={16} color="var(--primary)" style={{ flexShrink: 0 }} />}

                    {originPlace && (
                      <button
                        type="button"
                        onClick={() => {
                          setOriginPlace(null);
                          setOriginQuery("");
                          setOriginCandidates([]);
                        }}
                        title="Clear starting location"
                        style={{
                          background: "rgba(255,255,255,0.08)",
                          border: 0,
                          borderRadius: "50%",
                          width: "22px",
                          height: "22px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          flexShrink: 0
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Origin Candidates Dropdown */}
                  {originCandidates.length > 0 && !originPlace && (
                    <div
                      className="glass-panel"
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 100,
                        marginTop: "8px",
                        borderRadius: "12px",
                        overflow: "hidden",
                        maxHeight: "260px",
                        overflowY: "auto",
                        border: "1px solid rgba(59, 130, 246, 0.3)",
                        boxShadow: "0 14px 35px rgba(0, 0, 0, 0.6)",
                        isolation: "isolate"
                      }}
                    >
                      <div style={{ padding: "8px 14px", fontSize: "11px", fontWeight: "600", color: "var(--primary)", background: "rgba(10, 15, 26, 0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between" }}>
                        <span>SELECT STARTING LOCATION:</span>
                        <span style={{ color: "var(--text-muted)" }}>{originCandidates.length} results</span>
                      </div>
                      {originCandidates.slice(0, 6).map((cand) => (
                        <div
                          key={cand.place_id}
                          style={{
                            padding: "10px 14px",
                            cursor: "pointer",
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            transition: "background 0.15s",
                            background: "rgba(15, 22, 38, 0.95)"
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(59, 130, 246, 0.15)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(15, 22, 38, 0.95)")}
                          onClick={() => {
                            setOriginPlace(cand);
                            setOriginQuery(cand.short_name);
                            setOriginCandidates([]);
                            setOriginNoResults(false);
                            setRouteData(null);
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <MapPin size={13} color="var(--primary)" style={{ flexShrink: 0 }} />
                            <strong style={{ color: "white", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {cand.short_name}
                            </strong>
                          </div>
                          <span style={{ fontSize: "11px", color: "var(--text-soft)", display: "block", marginTop: "2px", paddingLeft: "19px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {cand.display_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {originNoResults && !searchingOrigin && !originPlace && (
                    <div
                      className="glass-panel"
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 100,
                        marginTop: "8px",
                        borderRadius: "10px",
                        padding: "10px 14px",
                        fontSize: "12px",
                        color: "var(--text-soft)",
                        background: "rgba(15, 22, 38, 0.95)"
                      }}
                    >
                      No matching locations found. Try a landmark, street, town, or address.
                    </div>
                  )}
                </div>

                {/* ================= SWAP BUTTON ================= */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "18px" }}>
                  <button
                    type="button"
                    onClick={handleSwapLocations}
                    title="Swap Starting Location and Destination"
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "50%",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid var(--border)",
                      color: "var(--text-soft)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "transform 0.2s, background 0.2s, color 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(59, 130, 246, 0.2)";
                      e.currentTarget.style.color = "white";
                      e.currentTarget.style.transform = "rotate(180deg)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                      e.currentTarget.style.color = "var(--text-soft)";
                      e.currentTarget.style.transform = "rotate(0deg)";
                    }}
                  >
                    <ArrowUpDown size={15} />
                  </button>
                </div>

                {/* ================= TO INPUT ================= */}
                <div style={{ position: "relative", minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "0.8px", color: "var(--teal)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Navigation size={13} /> TO
                    </label>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Destination</span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      background: "rgba(255, 255, 255, 0.04)",
                      padding: "10px 14px",
                      borderRadius: "12px",
                      border: destPlace ? "1.5px solid rgba(6, 182, 212, 0.6)" : "1px solid var(--border)",
                      boxShadow: destPlace ? "0 0 12px rgba(6, 182, 212, 0.15)" : "none",
                      transition: "border-color 0.2s, box-shadow 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "8px", background: "rgba(6, 182, 212, 0.15)", color: "var(--teal)", flexShrink: 0 }}>
                      <Navigation size={16} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {destPlace ? (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: "700", fontSize: "14px", color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {destPlace.short_name}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--text-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {destPlace.display_name}
                          </span>
                        </div>
                      ) : (
                        <input
                          value={destQuery}
                          onChange={(e) => handleSearchDest(e.target.value)}
                          placeholder="Search destination (e.g. Nandi Hills, Mangaluru, Airport)..."
                          style={{
                            background: "transparent",
                            border: 0,
                            color: "white",
                            width: "100%",
                            outline: "none",
                            fontSize: "14px"
                          }}
                        />
                      )}
                    </div>

                    {searchingDest && <Loader2 className="animate-spin" size={16} color="var(--teal)" style={{ flexShrink: 0 }} />}

                    {destPlace && (
                      <button
                        type="button"
                        onClick={() => {
                          setDestPlace(null);
                          setDestQuery("");
                          setDestCandidates([]);
                        }}
                        title="Clear destination"
                        style={{
                          background: "rgba(255,255,255,0.08)",
                          border: 0,
                          borderRadius: "50%",
                          width: "22px",
                          height: "22px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          flexShrink: 0
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Destination Candidates Dropdown */}
                  {destCandidates.length > 0 && !destPlace && (
                    <div
                      className="glass-panel"
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 100,
                        marginTop: "8px",
                        borderRadius: "12px",
                        overflow: "hidden",
                        maxHeight: "260px",
                        overflowY: "auto",
                        border: "1px solid rgba(6, 182, 212, 0.3)",
                        boxShadow: "0 14px 35px rgba(0, 0, 0, 0.6)",
                        isolation: "isolate"
                      }}
                    >
                      <div style={{ padding: "8px 14px", fontSize: "11px", fontWeight: "600", color: "var(--teal)", background: "rgba(10, 15, 26, 0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between" }}>
                        <span>SELECT DESTINATION:</span>
                        <span style={{ color: "var(--text-muted)" }}>{destCandidates.length} results</span>
                      </div>
                      {destCandidates.slice(0, 6).map((cand) => (
                        <div
                          key={cand.place_id}
                          style={{
                            padding: "10px 14px",
                            cursor: "pointer",
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            transition: "background 0.15s",
                            background: "rgba(15, 22, 38, 0.95)"
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(6, 182, 212, 0.15)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(15, 22, 38, 0.95)")}
                          onClick={() => {
                            setDestPlace(cand);
                            setDestQuery(cand.short_name);
                            setDestCandidates([]);
                            setDestNoResults(false);
                            setRouteData(null);
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Navigation size={13} color="var(--teal)" style={{ flexShrink: 0 }} />
                            <strong style={{ color: "white", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {cand.short_name}
                            </strong>
                          </div>
                          <span style={{ fontSize: "11px", color: "var(--text-soft)", display: "block", marginTop: "2px", paddingLeft: "19px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {cand.display_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {destNoResults && !searchingDest && !destPlace && (
                    <div
                      className="glass-panel"
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 100,
                        marginTop: "8px",
                        borderRadius: "10px",
                        padding: "10px 14px",
                        fontSize: "12px",
                        color: "var(--text-soft)",
                        background: "rgba(15, 22, 38, 0.95)"
                      }}
                    >
                      No matching locations found. Try a landmark, street, town, or address.
                    </div>
                  )}
                </div>

              </div>

              {/* Bottom Action Bar: Priority Presets, Current Location, and Compact Calculate CTA */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "14px",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  marginTop: "16px",
                  paddingTop: "14px"
                }}
              >
                
                {/* Route Priority Selector & Geolocation */}
                <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-soft)" }}>
                    <span style={{ fontWeight: "600", fontSize: "11px", letterSpacing: "0.5px" }}>PRIORITY:</span>
                    {["fastest", "balanced", "safest"].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setRoutePriority(mode)}
                        style={{
                          padding: "5px 12px",
                          borderRadius: "16px",
                          fontSize: "12px",
                          fontWeight: routePriority === mode ? "600" : "400",
                          textTransform: "capitalize",
                          border: routePriority === mode ? "1px solid var(--primary)" : "1px solid var(--border)",
                          background: routePriority === mode ? "rgba(59, 130, 246, 0.2)" : "rgba(255,255,255,0.02)",
                          color: routePriority === mode ? "#60a5fa" : "var(--text-soft)",
                          cursor: "pointer",
                          transition: "all 0.15s ease"
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  {/* Browser Geolocation Button */}
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={locatingUser}
                    style={{
                      background: "rgba(6, 182, 212, 0.08)",
                      border: "1px solid rgba(6, 182, 212, 0.25)",
                      borderRadius: "16px",
                      padding: "5px 12px",
                      color: "var(--teal)",
                      fontSize: "12px",
                      fontWeight: "500",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      cursor: locatingUser ? "wait" : "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    {locatingUser ? <Loader2 className="animate-spin" size={13} /> : <Crosshair size={13} />}
                    <span>Use Current Location</span>
                  </button>
                </div>

                {/* Proportional, Non-Dominating Calculate Safe Route Button (~52-54px height, balanced width) */}
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={isCalculateDisabled}
                  style={{
                    minHeight: "48px",
                    height: "50px",
                    padding: "0 28px",
                    borderRadius: "12px",
                    fontSize: "14px",
                    fontWeight: "700",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    boxShadow: isCalculateDisabled ? "none" : "0 6px 20px rgba(40, 100, 237, 0.35)",
                    transition: "all 0.2s ease"
                  }}
                >
                  {loadingRoute ? <Loader2 className="animate-spin" size={17} /> : <Navigation size={17} />}
                  <span>{loadingRoute ? "Computing Safe Route..." : "Calculate Safe Route"}</span>
                </button>

              </div>
            </form>

            {/* Error Message (Only displayed when real failure occurs) */}
            {errorMsg && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(244, 63, 94, 0.12)",
                  border: "1px solid rgba(244, 63, 94, 0.3)",
                  color: "#fecdd3",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <AlertTriangle size={16} color="var(--danger)" style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}
          </Card>

          {/* Main Geospatial Split Grid */}
          <div className="route-layout" style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "20px", minHeight: "520px" }}>
            
            {/* Real Leaflet Map */}
            <Card className="route-map-card" style={{ position: "relative", minHeight: "540px", padding: 0, overflow: "hidden" }}>
              <MapContainer
                center={originPlace ? [originPlace.lat, originPlace.lng] : DEFAULT_CENTER}
                zoom={13}
                scrollWheelZoom={true}
                className="leaflet-container"
              >
                <MapController bounds={mapBounds} originCoord={originPlace} destCoord={destPlace} />

                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* 🔵 Selected Location Marker (Origin) */}
                {originPlace && (
                  <Marker position={[originPlace.lat, originPlace.lng]}>
                    <Popup>
                      <strong style={{ color: "#3b82f6" }}>🔵 Selected Origin Location</strong><br />
                      <strong>{originPlace.short_name}</strong><br />
                      <span style={{ fontSize: "11px" }}>{originPlace.display_name}</span><br />
                      <small style={{ color: "#888" }}>GPS: {originPlace.lat.toFixed(5)}°, {originPlace.lng.toFixed(5)}°</small>
                    </Popup>
                  </Marker>
                )}

                {/* 🔴 Selected Location Marker (Destination) */}
                {destPlace && (
                  <Marker position={[destPlace.lat, destPlace.lng]}>
                    <Popup>
                      <strong style={{ color: "#06b6d4" }}>🔵 Selected Destination Location</strong><br />
                      <strong>{destPlace.short_name}</strong><br />
                      <span style={{ fontSize: "11px" }}>{destPlace.display_name}</span><br />
                      <small style={{ color: "#888" }}>GPS: {destPlace.lat.toFixed(5)}°, {destPlace.lng.toFixed(5)}°</small>
                    </Popup>
                  </Marker>
                )}

                {/* ⚪ Routing Snap Marker (Origin Entry Node) */}
                {snappedOrigin && (
                  <CircleMarker center={snappedOrigin} radius={6} pathOptions={{ color: "#ffffff", fillColor: "#3b82f6", fillOpacity: 0.9 }}>
                    <Popup>
                      <strong>⚪ OSM Road Snap (Origin Entry Node)</strong><br />
                      <small style={{ color: "#888" }}>Nearest network road coordinate</small>
                    </Popup>
                  </CircleMarker>
                )}

                {/* ⚪ Routing Snap Marker (Destination Exit Node) */}
                {snappedDest && (
                  <CircleMarker center={snappedDest} radius={6} pathOptions={{ color: "#ffffff", fillColor: "#06b6d4", fillOpacity: 0.9 }}>
                    <Popup>
                      <strong>⚪ OSM Road Snap (Destination Exit Node)</strong><br />
                      <small style={{ color: "#888" }}>Nearest network road coordinate</small>
                    </Popup>
                  </CircleMarker>
                )}

                {/* Shortest Route Polyline (Amber/Orange) */}
                {shortestRoute?.coordinates?.length > 0 && (selectedRouteType === "shortest" || selectedRouteType === "both") && (
                  <Polyline
                    positions={shortestRoute.coordinates}
                    pathOptions={{
                      color: "#fb923c",
                      weight: selectedRouteType === "shortest" ? 6 : 3,
                      opacity: selectedRouteType === "shortest" ? 0.9 : 0.4,
                      dashArray: selectedRouteType === "shortest" ? null : "6, 6",
                    }}
                  />
                )}

                {/* Safest Route Polyline (Teal) */}
                {safestRoute?.coordinates?.length > 0 && (selectedRouteType === "safest" || selectedRouteType === "both") && (
                  <Polyline
                    positions={safestRoute.coordinates}
                    pathOptions={{
                      color: "#06b6d4",
                      weight: selectedRouteType === "safest" ? 6 : 4,
                      opacity: selectedRouteType === "safest" ? 0.95 : 0.5,
                    }}
                  />
                )}
              </MapContainer>

              <div style={{ position: "absolute", bottom: "16px", left: "16px", zIndex: 10, background: "rgba(11,15,26,0.85)", backdropFilter: "blur(10px)", padding: "8px 14px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "12px", display: "flex", gap: "12px", alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ width: "10px", height: "4px", background: "var(--teal)" }}></span> Safest Route (OSM Geometry)</span>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ width: "10px", height: "4px", background: "var(--warning)" }}></span> Shortest Route</span>
                {routeData && <span style={{ color: "var(--text-muted)", marginLeft: "8px" }}>Calculated in {routeData.execution_time_ms}ms</span>}
              </div>
            </Card>

            {/* Route Selector & Metrics Cards */}
            <div className="route-results" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="route-results-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="eyebrow">MODEL RESULTS</span>
                  <h2 style={{ fontSize: "18px", marginTop: "2px" }}>
                    Route Comparison
                  </h2>
                </div>

                {/* Toggle Both Routes Visibility */}
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: "11px", padding: "4px 8px" }}
                  onClick={() => setSelectedRouteType(selectedRouteType === "both" ? "safest" : "both")}
                >
                  {selectedRouteType === "both" ? "Show Single" : "Show Both Routes"}
                </button>
              </div>

              {/* Safest Route Card */}
              {safestRoute && (
                <div
                  className={`glass-card ${selectedRouteType === "safest" ? "selected" : ""}`}
                  style={{
                    padding: "16px",
                    cursor: "pointer",
                    border: selectedRouteType === "safest" ? "2px solid var(--teal)" : "1px solid var(--border)",
                    background: selectedRouteType === "safest" ? "rgba(6, 182, 212, 0.1)" : "rgba(19, 24, 39, 0.6)",
                    transition: "all 200ms ease",
                  }}
                  onClick={() => setSelectedRouteType("safest")}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(6, 182, 212, 0.15)", color: "var(--teal)" }}>
                        <Shield size={18} />
                      </div>
                      <div>
                        <strong style={{ display: "block", fontSize: "15px" }}>Safest Route (KDE Optimized)</strong>
                        <span style={{ fontSize: "11px", color: "var(--teal)" }}>
                          {safestRoute.overall_risk_level} • SafeOps Risk Model
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "18px", fontWeight: "700", color: "var(--teal)" }}>
                        {safestRoute.safety_score} / 100
                      </span>
                      <span style={{ display: "block", fontSize: "10px", color: "var(--text-muted)" }}>Safety Score</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "14px", fontSize: "13px", color: "var(--text-soft)", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "10px", marginTop: "8px" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Navigation size={13} /> {(safestRoute.distance_m / 1000).toFixed(2)} km
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Clock3 size={13} /> {safestRoute.time_min} min (Est.)
                    </span>
                  </div>
                </div>
              )}

              {/* Shortest Route Card */}
              {shortestRoute && (
                <div
                  className={`glass-card ${selectedRouteType === "shortest" ? "selected" : ""}`}
                  style={{
                    padding: "16px",
                    cursor: "pointer",
                    border: selectedRouteType === "shortest" ? "2px solid var(--warning)" : "1px solid var(--border)",
                    background: selectedRouteType === "shortest" ? "rgba(251, 146, 60, 0.1)" : "rgba(19, 24, 39, 0.6)",
                    transition: "all 200ms ease",
                  }}
                  onClick={() => setSelectedRouteType("shortest")}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(251, 146, 60, 0.15)", color: "var(--warning)" }}>
                        <Route size={18} />
                      </div>
                      <div>
                        <strong style={{ display: "block", fontSize: "15px" }}>Shortest Route (Distance)</strong>
                        <span style={{ fontSize: "11px", color: "var(--warning)" }}>{shortestRoute.overall_risk_level} • Direct road path</span>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "18px", fontWeight: "700", color: "var(--warning)" }}>
                        {shortestRoute.safety_score} / 100
                      </span>
                      <span style={{ display: "block", fontSize: "10px", color: "var(--text-muted)" }}>Safety Score</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "14px", fontSize: "13px", color: "var(--text-soft)", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "10px", marginTop: "8px" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Navigation size={13} /> {(shortestRoute.distance_m / 1000).toFixed(2)} km
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Clock3 size={13} /> {shortestRoute.time_min} min (Est.)
                    </span>
                  </div>
                </div>
              )}

              {/* Explainability Section */}
              {metrics && (
                <Card className="route-recommendation" style={{ padding: "16px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <Sparkles size={18} color="var(--teal)" style={{ marginTop: "2px" }} />
                    <div>
                      <strong style={{ fontSize: "13px", color: "var(--teal)" }}>WHY THIS ROUTE?</strong>
                      <p style={{ fontSize: "12px", color: "var(--text-soft)", marginTop: "4px", lineHeight: "1.4" }}>
                        {metrics.explanation}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px", marginTop: "12px" }}>
                    <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px", borderRadius: "6px" }}>
                      <span style={{ color: "var(--text-muted)", display: "block" }}>Risk Reduction</span>
                      <strong style={{ fontSize: "15px", color: "var(--success)" }}>{metrics.risk_reduction_pts} pts</strong>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px", borderRadius: "6px" }}>
                      <span style={{ color: "var(--text-muted)", display: "block" }}>Distance Detour</span>
                      <strong style={{ fontSize: "15px", color: "var(--text-soft)" }}>+{metrics.distance_increase_pct}%</strong>
                    </div>
                  </div>
                </Card>
              )}

              {/* Segment-by-Segment Risk Breakdown */}
              {safestRoute?.risk_segments && safestRoute.risk_segments.length > 0 && (
                <Card style={{ padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <strong style={{ fontSize: "13px", display: "block" }}>Route Risk Segment Profile</strong>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {safestRoute.risk_segments.length} segments analyzed
                    </span>
                  </div>
                  
                  <div style={{ display: "flex", gap: "5px", overflowX: "auto", paddingBottom: "6px" }}>
                    {safestRoute.risk_segments.slice(0, 10).map((seg) => {
                      const isHigh = seg.risk_level === "HIGH";
                      const isMod = seg.risk_level === "MODERATE";
                      const bg = isHigh ? "rgba(239, 68, 68, 0.25)" : isMod ? "rgba(245, 158, 11, 0.25)" : "rgba(16, 185, 129, 0.25)";
                      const border = isHigh ? "1px solid #ef4444" : isMod ? "1px solid #f59e0b" : "1px solid #10b981";
                      const textCol = isHigh ? "#fca5a5" : isMod ? "#fcd34d" : "#6ee7b7";
                      return (
                        <div
                          key={seg.segment_index}
                          style={{
                            flex: 1,
                            minWidth: "34px",
                            padding: "6px 2px",
                            borderRadius: "6px",
                            background: bg,
                            border: border,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "2px"
                          }}
                          title={`Segment ${seg.segment_index}: ${seg.risk_percentile || 0}% risk percentile (${seg.risk_level || 'LOW'})`}
                        >
                          <span style={{ fontSize: "10px", fontWeight: "700", color: "#f8fafc" }}>
                            S{seg.segment_index}
                          </span>
                          <span style={{ fontSize: "9px", fontWeight: "600", color: textCol }}>
                            {seg.risk_percentile ?? 0}%
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", fontSize: "11px", color: "var(--text-muted)" }}>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }}></span> Low
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }}></span> Moderate
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }}></span> High
                      </span>
                    </div>
                    <span>Dijkstra KDE path</span>
                  </div>
                </Card>
              )}

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}