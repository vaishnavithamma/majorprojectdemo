"""
SafeOps - Graph Setup Utility (One-Time Offline)

Downloads the full regional Bengaluru Metropolitan driving graph from
OpenStreetMap via OSMnx and saves it as data/bengaluru_graph.graphml.

Bounding box (approved V2 architecture):
  North = 13.40, South = 12.75, West = 77.35, East = 77.85

This script is run ONCE during setup/preprocessing.
It is NOT called during normal service operation.
"""

import os
import sys
import math
import time

import osmnx as ox
import networkx as nx

# -- Approved bounding box ------------------------------------------
NORTH = 13.40
SOUTH = 12.75
WEST  = 77.35
EAST  = 77.85

# -- Paths ----------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
GRAPH_PATH = os.path.join(DATA_DIR, "bengaluru_graph.graphml")
GRAPH_TEMP_PATH = os.path.join(DATA_DIR, "bengaluru_graph_NEW.graphml")
PRECALC_PATH = os.path.join(DATA_DIR, "precalculated_edge_risks.parquet")

# -- Test points for snap-distance verification ---------------------
TEST_POINTS = [
    ("Sir MVIT",                13.13630, 77.59710),
    ("Hunasamaranahalli BS",    13.12890, 77.62410),
    ("Nandi Hills",             13.37020, 77.68350),
    ("BTM Layout",              12.91660, 77.61010),
    ("Indiranagar",             12.97840, 77.64080),
    ("Hebbal",                  13.03590, 77.59700),
    ("Yeshwanthpur",            13.02850, 77.54550),
]


def haversine_m(lat1, lon1, lat2, lon2):
    """Great-circle distance in metres between two GPS points."""
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def main():
    print("=" * 70)
    print("  SafeOps - Full Regional Graph Download")
    print("=" * 70)
    print(f"  Bounding box: N={NORTH}, S={SOUTH}, W={WEST}, E={EAST}")
    print(f"  Network type: drive")
    print(f"  Output: {GRAPH_PATH}")
    print("=" * 70)

    os.makedirs(DATA_DIR, exist_ok=True)

    # -- Step 1: Download graph -------------------------------------
    print("\n[1/5] Downloading driving graph from OpenStreetMap via OSMnx...")
    print("       (This may take 5-15 minutes depending on network speed)")
    t0 = time.time()
    # OSMnx 2.x expects bbox as (left, bottom, right, top) = (WEST, SOUTH, EAST, NORTH)
    ox.settings.requests_timeout = 600
    ox.settings.overpass_memory = 1073741824  # 1GB memory allocation for Overpass
    try:
        G = ox.graph_from_bbox(
            bbox=(WEST, SOUTH, EAST, NORTH),
            network_type="drive",
            simplify=True,
            retain_all=True,
        )
    except Exception as e:
        print(f"\n- GRAPH DOWNLOAD FAILED: {e}")
        sys.exit(1)
    t1 = time.time()
    download_time = t1 - t0
    print(f"       [OK] Download complete in {download_time:.1f}s")

    # -- Step 2: Report graph properties ----------------------------
    print("\n[2/5] Graph properties (actual, not hardcoded):")
    n_nodes = len(G.nodes)
    n_edges = len(G.edges)
    print(f"       Nodes: {n_nodes:,}")
    print(f"       Edges: {n_edges:,}")

    lats = [G.nodes[n]["y"] for n in G.nodes]
    lons = [G.nodes[n]["x"] for n in G.nodes]
    lat_min, lat_max = min(lats), max(lats)
    lon_min, lon_max = min(lons), max(lons)
    print(f"       Latitude range:  {lat_min:.5f} to {lat_max:.5f}")
    print(f"       Longitude range: {lon_min:.5f} to {lon_max:.5f}")

    # -- Step 3: Connectivity ---------------------------------------
    print("\n[3/5] Connectivity analysis:")
    strongly = nx.is_strongly_connected(G)
    if strongly:
        print("       [OK] Graph is STRONGLY CONNECTED")
        n_components = 1
        largest_pct = 100.0
    else:
        components = list(nx.strongly_connected_components(G))
        n_components = len(components)
        largest = max(components, key=len)
        largest_pct = 100.0 * len(largest) / n_nodes
        print(f"       Graph has {n_components} strongly-connected components")
        print(f"       Largest component: {len(largest):,} nodes ({largest_pct:.1f}%)")

    # -- Step 4: Snap-distance verification -------------------------
    print("\n[4/5] Snap-distance verification for test points:")
    snap_results = []
    for name, lat, lon in TEST_POINTS:
        node = ox.distance.nearest_nodes(G, lon, lat)
        n_lat = G.nodes[node]["y"]
        n_lon = G.nodes[node]["x"]
        dist = haversine_m(lat, lon, n_lat, n_lon)
        status = "[OK]  " if dist < 500 else ("[WARN]" if dist < 2000 else "[FAIL]")
        print(f"       {status} {name:25s} -> snap dist = {dist:8.1f}m  (node {node}: {n_lat:.5f}, {n_lon:.5f})")
        snap_results.append((name, lat, lon, node, n_lat, n_lon, dist))

    # -- Step 5: Save to temp file, validate, then replace ----------
    print("\n[5/5] Saving graph to temporary file for validation...")
    try:
        ox.save_graphml(G, filepath=GRAPH_TEMP_PATH)
    except Exception as e:
        print(f"\n[FAIL] GRAPH SAVE FAILED: {e}")
        sys.exit(1)

    temp_size = os.path.getsize(GRAPH_TEMP_PATH)
    print(f"       Temp file saved: {temp_size / 1e6:.1f} MB")

    # Basic validation: file exists and is non-trivially sized
    if temp_size < 1_000_000:  # < 1 MB is suspiciously small
        print(f"\n[FAIL] VALIDATION FAILED: File too small ({temp_size} bytes). Keeping old graph.")
        os.remove(GRAPH_TEMP_PATH)
        sys.exit(1)

    # Reload and verify node/edge counts match
    print("       Reloading temp file to verify integrity...")
    G_check = ox.load_graphml(GRAPH_TEMP_PATH)
    if len(G_check.nodes) != n_nodes or len(G_check.edges) != n_edges:
        print(f"\n[FAIL] INTEGRITY CHECK FAILED: Reloaded graph has {len(G_check.nodes)} nodes / {len(G_check.edges)} edges (expected {n_nodes} / {n_edges})")
        os.remove(GRAPH_TEMP_PATH)
        sys.exit(1)
    print(f"       [OK] Integrity verified: {len(G_check.nodes):,} nodes, {len(G_check.edges):,} edges")
    del G_check

    # Replace the old graph
    if os.path.exists(GRAPH_PATH):
        old_size = os.path.getsize(GRAPH_PATH)
        print(f"       Removing old graph ({old_size / 1e6:.1f} MB)...")
        os.remove(GRAPH_PATH)

    os.rename(GRAPH_TEMP_PATH, GRAPH_PATH)
    final_size = os.path.getsize(GRAPH_PATH)
    print(f"       [OK] New graph installed: {GRAPH_PATH}")
    print(f"       [OK] Final file size: {final_size / 1e6:.1f} MB")

    # Remove stale precalculated edge risks
    if os.path.exists(PRECALC_PATH):
        os.remove(PRECALC_PATH)
        print(f"       [OK] Removed stale precalculated_edge_risks.parquet (must regenerate for new graph)")
    else:
        print(f"       (No precalculated_edge_risks.parquet to remove)")

    # -- Final Summary ----------------------------------------------
    print("\n" + "=" * 70)
    print("  STAGE A COMPLETE - Graph Setup Summary")
    print("=" * 70)
    print(f"  Download time:    {download_time:.1f}s")
    print(f"  Source:           OpenStreetMap via OSMnx/Overpass API")
    print(f"  Nodes:            {n_nodes:,}")
    print(f"  Edges:            {n_edges:,}")
    print(f"  File size:        {final_size / 1e6:.1f} MB")
    print(f"  Lat range:        {lat_min:.5f} -> {lat_max:.5f}")
    print(f"  Lon range:        {lon_min:.5f} -> {lon_max:.5f}")
    print(f"  Connected:        {'STRONGLY CONNECTED' if strongly else f'{n_components} components (largest: {largest_pct:.1f}%)'}")
    print(f"  Precalc removed:  Yes (must regenerate)")
    print("=" * 70)


if __name__ == "__main__":
    main()
