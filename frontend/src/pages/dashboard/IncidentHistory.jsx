import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  MapPin,
  Search,
  Shield,
  XCircle,
} from "lucide-react";

import Header from "../../components/layout/Header";
import Sidebar from "../../components/layout/Sidebar";
import Card from "../../components/common/Card";


// =========================================================
// DEMO INCIDENTS
// =========================================================

const incidents = [
  {
    id: "INC-2026-0812",
    type: "SOS Test",
    status: "Resolved",
    date: "Aug 8, 2026",
    time: "10:42 AM",
    duration: "00:03:21",
    location: "Bengaluru, Karnataka",
    description:
      "Emergency response test completed successfully.",
  },

  {
    id: "INC-2026-0809",
    type: "Safety Alert",
    status: "Resolved",
    date: "Aug 7, 2026",
    time: "08:16 PM",
    duration: "00:01:14",
    location: "Bengaluru, Karnataka",
    description:
      "Safety alert triggered and automatically resolved.",
  },

  {
    id: "INC-2026-0802",
    type: "SOS Test",
    status: "Cancelled",
    date: "Aug 4, 2026",
    time: "07:35 PM",
    duration: "00:00:18",
    location: "Bengaluru, Karnataka",
    description:
      "SOS activation cancelled by user.",
  },

  {
    id: "INC-2026-0727",
    type: "Emergency",
    status: "Resolved",
    date: "Jul 29, 2026",
    time: "09:20 PM",
    duration: "00:04:42",
    location: "Bengaluru, Karnataka",
    description:
      "Emergency contact network notified.",
  },
];


// =========================================================
// LOCATION CACHE
// =========================================================

// Keeps already-resolved locations in memory so that
// the same coordinates are not requested repeatedly.

const locationCache = new Map();


// =========================================================
// REVERSE GEOCODING
// =========================================================

async function getPlaceName(
  latitude,
  longitude
) {
  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined
  ) {
    return "Location unavailable";
  }

  const lat =
    Number(latitude);

  const lon =
    Number(longitude);

  if (
    Number.isNaN(lat) ||
    Number.isNaN(lon)
  ) {
    return "Location unavailable";
  }

  // Round the cache key slightly.
  const cacheKey =
    `${lat.toFixed(5)},${lon.toFixed(5)}`;

  // Return cached value if available.
  if (
    locationCache.has(cacheKey)
  ) {
    return locationCache.get(
      cacheKey
    );
  }

  try {
    console.log(
      "📍 Finding place name for:",
      lat,
      lon
    );

    const url =
  `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=en&lat=${encodeURIComponent(
    lat
  )}&lon=${encodeURIComponent(
    lon
  )}&zoom=18&addressdetails=1`;

    const response =
      await fetch(url, {
        method: "GET",

        headers: {
          Accept:
            "application/json",
        },
      });

    if (!response.ok) {
      throw new Error(
        `Reverse geocoding failed: ${response.status}`
      );
    }

    const data =
      await response.json();

    console.log(
      "📍 Reverse geocoding response:",
      data
    );

    const address =
      data.address || {};

    // -----------------------------------------------------
    // Try to find the most useful place name.
    // -----------------------------------------------------

    const place =
      address.suburb ||
      address.neighbourhood ||
      address.city_district ||
      address.town ||
      address.city ||
      address.municipality ||
      address.village ||
      address.county;

    const state =
      address.state ||
      address.state_district;

    let placeName =
      "Location unavailable";

    if (
      place &&
      state
    ) {
      placeName =
        `${place}, ${state}`;
    } else if (place) {
      placeName =
        place;
    } else if (state) {
      placeName =
        state;
    } else if (
      data.display_name
    ) {
      // Use a shortened display name
      // if no structured fields exist.
      placeName =
        data.display_name
          .split(",")
          .slice(0, 2)
          .join(",");
    }

    locationCache.set(
      cacheKey,
      placeName
    );

    return placeName;

  } catch (error) {
    console.error(
      "❌ Reverse geocoding error:",
      error
    );

    return "Location unavailable";
  }
}


// =========================================================
// INCIDENT HISTORY
// =========================================================

export default function IncidentHistory() {
  const [query, setQuery] =
    useState("");

  const [status, setStatus] =
    useState("All");

  const [selected, setSelected] =
    useState(null);

  const [
    evidenceIncidents,
    setEvidenceIncidents,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    locationLoading,
    setLocationLoading,
  ] = useState(false);


  // =======================================================
  // LOAD REAL SOS EVIDENCE
  // =======================================================

  useEffect(() => {
    const loadEvidence = async () => {
      try {
        const token =
          localStorage.getItem(
            "safeops_token"
          );

        if (!token) {
          console.warn(
            "⚠️ No authentication token found."
          );

          setLoading(false);
          return;
        }

        console.log(
          "📥 Loading evidence history..."
        );

        const response =
          await fetch(
            "http://localhost:5000/api/evidence",
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        if (!response.ok) {
          throw new Error(
            `Failed to load evidence. Status: ${response.status}`
          );
        }

        const data =
          await response.json();

        console.log(
          "📥 Evidence history response:",
          data
        );

        const evidence =
          Array.isArray(
            data.evidence
          )
            ? data.evidence
            : [];


        // ===============================================
        // CONVERT EVIDENCE → INCIDENT
        // ===============================================

        const converted =
          evidence.map((item) => {
            const createdAt =
              item.createdAt
                ? new Date(
                    item.createdAt
                  )
                : new Date();

            const hasLocation =
              item.latitude !== null &&
              item.latitude !== undefined &&
              item.longitude !== null &&
              item.longitude !== undefined;

            return {
              id:
                `EVD-${String(
                  item.id || ""
                )
                  .slice(-8)
                  .toUpperCase()}`,

              type:
                "Emergency SOS",

              status:
                "Resolved",

              date:
                createdAt.toLocaleDateString(
                  "en-US",
                  {
                    month:
                      "short",

                    day:
                      "numeric",

                    year:
                      "numeric",
                  }
                ),

              time:
                createdAt.toLocaleTimeString(
                  "en-US",
                  {
                    hour:
                      "2-digit",

                    minute:
                      "2-digit",
                  }
                ),

              duration:
                item.description
                  ?.match(
                    /for\s+(.+?)\./i
                  )?.[1] ||
                "Recording saved",

              // Initial location.
              location:
                hasLocation
                  ? `${Number(
                      item.latitude
                    ).toFixed(
                      6
                    )}, ${Number(
                      item.longitude
                    ).toFixed(
                      6
                    )}`
                  : "Location unavailable",

              placeName:
                hasLocation
                  ? "Finding location..."
                  : "Location unavailable",

              latitude:
                hasLocation
                  ? Number(
                      item.latitude
                    )
                  : null,

              longitude:
                hasLocation
                  ? Number(
                      item.longitude
                    )
                  : null,

              hasLocation,

              description:
                item.description ||
                "Emergency SOS recording saved successfully.",

              evidenceId:
                item.id,

              fileUrl:
                item.fileUrl ||
                "",

              createdAt:
                item.createdAt,
            };
          });


        console.log(
          "📍 Converted incidents:",
          converted
        );

        setEvidenceIncidents(
          converted
        );


        // ===============================================
        // GET PLACE NAMES
        // ===============================================

        const incidentsWithPlaces =
          [...converted];


        const locationIndexes =
          incidentsWithPlaces
            .map(
              (incident, index) =>
                incident.hasLocation
                  ? index
                  : null
            )
            .filter(
              (index) =>
                index !== null
            );


        if (
          locationIndexes.length >
          0
        ) {
          setLocationLoading(
            true
          );

          // Process one request at a time
          // to respect the public Nominatim
          // service's request limit.
          for (
            let i = 0;
            i <
            locationIndexes.length;
            i++
          ) {
            const index =
              locationIndexes[i];

            const incident =
              incidentsWithPlaces[
                index
              ];

            const placeName =
              await getPlaceName(
                incident.latitude,
                incident.longitude
              );

            incidentsWithPlaces[
              index
            ] = {
              ...incident,
              placeName,
            };

            // Update UI after each result.
            setEvidenceIncidents(
              [...incidentsWithPlaces]
            );

            // Small delay between
            // requests.
            if (
              i <
              locationIndexes.length -
                1
            ) {
              await new Promise(
                (resolve) =>
                  setTimeout(
                    resolve,
                    1100
                  )
              );
            }
          }

          setLocationLoading(
            false
          );
        }

      } catch (error) {
        console.error(
          "❌ Failed to load incident history:",
          error
        );

        setEvidenceIncidents([]);

      } finally {
        setLoading(false);
      }
    };

    loadEvidence();
  }, []);


  // =======================================================
  // COMBINE + FILTER + SORT
  // =======================================================

  const filteredIncidents =
    useMemo(() => {
      const allIncidents = [
        ...evidenceIncidents,
        ...incidents,
      ];

      const sortedIncidents =
        [...allIncidents].sort(
          (a, b) => {
            const dateA =
              a.createdAt
                ? new Date(
                    a.createdAt
                  ).getTime()
                : 0;

            const dateB =
              b.createdAt
                ? new Date(
                    b.createdAt
                  ).getTime()
                : 0;

            return (
              dateB - dateA
            );
          }
        );

      return sortedIncidents.filter(
        (incident) => {
          const searchText =
            query
              .toLowerCase()
              .trim();

          const matchesQuery =
            !searchText ||
            incident.id
              .toLowerCase()
              .includes(
                searchText
              ) ||
            incident.type
              .toLowerCase()
              .includes(
                searchText
              ) ||
            incident.location
              .toLowerCase()
              .includes(
                searchText
              ) ||
            incident.placeName
              ?.toLowerCase()
              .includes(
                searchText
              ) ||
            incident.description
              .toLowerCase()
              .includes(
                searchText
              );

          const matchesStatus =
            status === "All" ||
            incident.status ===
              status;

          return (
            matchesQuery &&
            matchesStatus
          );
        }
      );
    }, [
      query,
      status,
      evidenceIncidents,
    ]);


  // =======================================================
  // TOTAL COUNT
  // =======================================================

  const totalIncidents =
    incidents.length +
    evidenceIncidents.length;


  // =======================================================
  // RENDER
  // =======================================================

  return (
    <div className="dashboard-layout">

      {/* HEADER */}

      <Header />

      {/* SIDEBAR */}

      <Sidebar />


      {/* MAIN */}

      <main className="dashboard-main">

        <div className="dashboard-content">


          {/* =================================================
              PAGE TITLE
              ================================================= */}

          <div className="page-title-row">

            <div>

              <span className="eyebrow">
                SECURITY RECORDS
              </span>

              <h1>
                Incident History
              </h1>

              <p>
                Review previous emergency
                and safety events.
              </p>

            </div>


            <div className="history-count">

              <strong>
                {totalIncidents}
              </strong>

              <span>
                Total incidents
              </span>

            </div>

          </div>


          {/* =================================================
              FILTERS
              ================================================= */}

          <Card className="history-filter-card">

            <div className="history-search">

              <Search size={17} />

              <input
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target.value
                  )
                }
                placeholder="Search incidents..."
              />

            </div>


            <div className="history-filter">

              <select
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value
                  )
                }
              >

                <option value="All">
                  All Status
                </option>

                <option value="Resolved">
                  Resolved
                </option>

                <option value="Cancelled">
                  Cancelled
                </option>

              </select>

              <ChevronDown
                size={15}
              />

            </div>

          </Card>


          {/* =================================================
              LOCATION STATUS
              ================================================= */}

          {locationLoading && (
            <div
              style={{
                fontSize:
                  "12px",

                marginBottom:
                  "12px",

                color:
                  "#8396b3",
              }}
            >
              📍 Finding saved
              locations...
            </div>
          )}


          {/* =================================================
              LOADING
              ================================================= */}

          {loading && (
            <Card className="empty-history">

              <FileText size={30} />

              <strong>
                Loading incident history...
              </strong>

              <span>
                Fetching your latest
                emergency records.
              </span>

            </Card>
          )}


          {/* =================================================
              INCIDENT LIST
              ================================================= */}

          {!loading && (
            <div className="incident-list">

              {filteredIncidents.length ===
                0 && (

                <Card className="empty-history">

                  <FileText size={30} />

                  <strong>
                    No incidents found
                  </strong>

                  <span>
                    Try changing your
                    search or filter.
                  </span>

                </Card>
              )}


              {filteredIncidents.map(
                (incident) => {

                  const isSelected =
                    selected?.id ===
                    incident.id;


                  return (
                    <Card
                      className={`incident-card ${
                        isSelected
                          ? "incident-selected"
                          : ""
                      }`}
                      key={
                        incident.id
                      }
                    >

                      {/* =====================================
                          STATUS ICON
                          ===================================== */}

                      <div className="incident-status-icon">

                        {incident.status ===
                        "Resolved" ? (
                          <CheckCircle2
                            size={21}
                          />
                        ) : (
                          <XCircle
                            size={21}
                          />
                        )}

                      </div>


                      {/* =====================================
                          MAIN CONTENT
                          ===================================== */}

                      <div className="incident-main">


                        {/* TITLE */}

                        <div className="incident-title">

                          <div>

                            <strong>
                              {incident.type}
                            </strong>

                            <span>
                              {incident.id}
                            </span>

                          </div>


                          <span
                            className={`incident-badge ${
                              incident.status ===
                              "Resolved"
                                ? "resolved"
                                : "cancelled"
                            }`}
                          >
                            {incident.status}
                          </span>

                        </div>


                        {/* DESCRIPTION */}

                        <p>
                          {incident.description}
                        </p>


                        {/* META */}

                        <div className="incident-meta">

                          <span>

                            <Clock3
                              size={13}
                            />

                            {incident.date}
                            {" • "}
                            {incident.time}

                          </span>


                          {/* LOCATION */}

                          <span
                            title={
                              incident.hasLocation
                                ? `${incident.latitude}, ${incident.longitude}`
                                : "Location unavailable"
                            }
                            style={{
                              display:
                                "flex",

                              alignItems:
                                "center",

                              gap:
                                "6px",
                            }}
                          >

                            <MapPin
                              size={13}
                            />

                            <span>
                              {incident.hasLocation
                                ? incident.placeName
                                : "Location unavailable"}
                            </span>

                          </span>


                          <span>

                            <Shield
                              size={13}
                            />

                            {incident.duration}

                          </span>

                        </div>


                        {/* GPS COORDINATES */}

                        {incident.hasLocation && (
                          <div
                            style={{
                              marginTop:
                                "7px",

                              paddingLeft:
                                "19px",

                              fontSize:
                                "11px",

                              color:
                                "#8396b3",
                            }}
                          >
                            {Number(
                              incident.latitude
                            ).toFixed(
                              6
                            )}
                            {", "}
                            {Number(
                              incident.longitude
                            ).toFixed(
                              6
                            )}
                          </div>
                        )}


                        {/* GPS CAPTURED */}

                        {incident.evidenceId &&
                          incident.hasLocation && (
                            <div
                              style={{
                                marginTop:
                                  "8px",

                                fontSize:
                                  "12px",

                                color:
                                  "#67d99a",
                              }}
                            >
                              ● GPS location
                              captured
                            </div>
                          )}


                        {/* RECORDING SAVED */}

                        {incident.evidenceId && (
                          <div
                            style={{
                              marginTop:
                                "6px",

                              fontSize:
                                "12px",

                              color:
                                "#67d99a",
                            }}
                          >
                            ● Emergency
                            recording
                            saved
                          </div>
                        )}


                        {/* =================================
                            EXPANDED INFORMATION
                            ================================= */}

                        {isSelected && (
                          <div className="incident-expanded">

                            <div>

                              <span>
                                Incident ID
                              </span>

                              <strong>
                                {incident.id}
                              </strong>

                            </div>


                            <div>

                              <span>
                                Start time
                              </span>

                              <strong>
                                {incident.date}{" "}
                                {incident.time}
                              </strong>

                            </div>


                            <div>

                              <span>
                                Duration
                              </span>

                              <strong>
                                {incident.duration}
                              </strong>

                            </div>


                            <div>

                              <span>
                                Location
                              </span>

                              <strong>
                                {incident.placeName}
                              </strong>

                            </div>


                            {incident.hasLocation && (
                              <div>

                                <span>
                                  GPS coordinates
                                </span>

                                <strong>
                                  {Number(
                                    incident.latitude
                                  ).toFixed(
                                    6
                                  )}
                                  {", "}
                                  {Number(
                                    incident.longitude
                                  ).toFixed(
                                    6
                                  )}
                                </strong>

                              </div>
                            )}


                            {incident.evidenceId && (
                              <div>

                                <span>
                                  Evidence
                                </span>

                                <strong>
                                  Recording
                                  saved
                                </strong>

                              </div>
                            )}

                          </div>
                        )}

                      </div>


                      {/* =====================================
                          VIEW BUTTON
                          ===================================== */}

                      <button
                        className="incident-view"
                        onClick={() =>
                          setSelected(
                            isSelected
                              ? null
                              : incident
                          )
                        }
                      >
                        {isSelected
                          ? "Hide"
                          : "View"}
                      </button>

                    </Card>
                  );
                }
              )}

            </div>
          )}


          {/* =================================================
              SECURITY NOTE
              ================================================= */}

          <div className="history-security">

            <Shield size={17} />

            <span>
              Incident records are securely
              stored and protected from
              unauthorized access.
            </span>

          </div>


          {/* =================================================
              OPENSTREETMAP ATTRIBUTION
              ================================================= */}

          <div
            style={{
              marginTop:
                "12px",

              textAlign:
                "right",

              fontSize:
                "10px",

              color:
                "#657894",
            }}
          >
            Location names © OpenStreetMap
            contributors
          </div>


        </div>

      </main>

    </div>
  );
}