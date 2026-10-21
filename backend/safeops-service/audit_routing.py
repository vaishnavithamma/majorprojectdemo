"""
SafeOps Routing Audit Script
Runs the existing routing implementation and measures real results.
NO fabrication — only measured values are reported.
"""
import os
import sys
import time
import json
import traceback

import pandas as pd
import numpy as np

# ============================================================
# PATHS
# ============================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FIR_PATH = os.path.join(BASE_DIR, "data", "fir_points.parquet")
GRAPH_PATH = os.path.join(BASE_DIR, "data", "bengaluru_graph.graphml")
PRECALC_PATH = os.path.join(BASE_DIR, "data", "precalculated_edge_risks.parquet")

results = {}

# ============================================================
# SECTION 1 — DATASET VERIFICATION
# ============================================================
print("\n" + "="*70)
print("SECTION 1: DATASET VERIFICATION")
print("="*70)

# FIR Dataset
if os.path.exists(FIR_PATH):
    fir_size_mb = os.path.getsize(FIR_PATH) / 1e6
    print(f"  [OK] fir_points.parquet exists: {fir_size_mb:.2f} MB")
    fir_df = pd.read_parquet(FIR_PATH)
    n_fir = len(fir_df)
    print(f"  FIR records loaded: {n_fir:,}")
    print(f"  Columns: {list(fir_df.columns)}")
    print(f"  Latitude range: {fir_df['Latitude'].min():.5f} to {fir_df['Latitude'].max():.5f}")
    print(f"  Longitude range: {fir_df['Longitude'].min():.5f} to {fir_df['Longitude'].max():.5f}")
    if 'Risk_Contribution' in fir_df.columns:
        print(f"  Risk_Contribution: min={fir_df['Risk_Contribution'].min():.4f}, max={fir_df['Risk_Contribution'].max():.4f}, mean={fir_df['Risk_Contribution'].mean():.4f}")
    results['n_fir_records'] = n_fir
    results['fir_size_mb'] = round(fir_size_mb, 2)
    results['fir_columns'] = list(fir_df.columns)
else:
    print(f"  [FAIL] fir_points.parquet NOT FOUND at {FIR_PATH}")
    sys.exit(1)

# GraphML Dataset
if os.path.exists(GRAPH_PATH):
    graph_size_mb = os.path.getsize(GRAPH_PATH) / 1e6
    print(f"\n  [OK] bengaluru_graph.graphml exists: {graph_size_mb:.1f} MB")
    results['graph_size_mb'] = round(graph_size_mb, 1)
else:
    print(f"  [FAIL] bengaluru_graph.graphml NOT FOUND at {GRAPH_PATH}")
    sys.exit(1)

# Precalculated edge risks
if os.path.exists(PRECALC_PATH):
    precalc_size_mb = os.path.getsize(PRECALC_PATH) / 1e6
    print(f"  [OK] precalculated_edge_risks.parquet exists: {precalc_size_mb:.2f} MB")
    precalc_df = pd.read_parquet(PRECALC_PATH)
    n_edges_precalc = len(precalc_df)
    print(f"  Precalculated edge count: {n_edges_precalc:,}")
    print(f"  Edge columns: {list(precalc_df.columns)}")
    results['n_precalc_edges'] = n_edges_precalc
    results['precalc_size_mb'] = round(precalc_size_mb, 2)
else:
    print(f"  [WARN] precalculated_edge_risks.parquet NOT FOUND")
    precalc_df = None
    n_edges_precalc = 0

# ============================================================
# SECTION 2 — KDE ENGINE INITIALIZATION
# ============================================================
print("\n" + "="*70)
print("SECTION 2: KDE ENGINE INITIALIZATION")
print("="*70)

sys.path.insert(0, BASE_DIR)
from services.kde_engine import init_kde_engine, get_kde_risk

t_kde_start = time.time()
init_kde_engine(FIR_PATH)
t_kde_end = time.time()
kde_init_time_s = round(t_kde_end - t_kde_start, 3)
print(f"  KDE Engine init time: {kde_init_time_s:.3f}s")
results['kde_init_time_s'] = kde_init_time_s

# Spot KDE risk queries (measured latency)
test_coords = [
    ("Koramangala", 12.93452, 77.62051),
    ("MVIT Hunasamaranahalli", 13.13630, 77.59710),
    ("Indiranagar", 12.97194, 77.64073),
    ("Hebbal", 13.03527, 77.59400),
    ("Nandi Hills", 13.37088, 77.68396),
]
print("\n  KDE risk spot queries (h=2.0 km):")
kde_latencies = []
for name, lat, lon in test_coords:
    t0 = time.perf_counter()
    risk = get_kde_risk(lat, lon)
    t1 = time.perf_counter()
    latency_ms = round((t1-t0)*1000, 3)
    kde_latencies.append(latency_ms)
    print(f"    {name:30s}  risk={risk:.4f}  latency={latency_ms:.3f}ms")

results['kde_query_latency_ms'] = {
    'min': round(min(kde_latencies), 3),
    'max': round(max(kde_latencies), 3),
    'mean': round(sum(kde_latencies)/len(kde_latencies), 3),
    'n': len(kde_latencies)
}
print(f"\n  KDE query latency: min={min(kde_latencies):.3f}ms, max={max(kde_latencies):.3f}ms, mean={sum(kde_latencies)/len(kde_latencies):.3f}ms")

# ============================================================
# SECTION 3 — GRAPH LOADING
# ============================================================
print("\n" + "="*70)
print("SECTION 3: GRAPH LOADING (OSMnx GraphML)")
print("="*70)

import osmnx as ox
import networkx as nx

t_graph_start = time.time()
G = ox.load_graphml(GRAPH_PATH)
t_graph_end = time.time()
graph_load_time_s = round(t_graph_end - t_graph_start, 2)

n_nodes = len(G.nodes)
n_edges = len(G.edges)
print(f"  Graph load time: {graph_load_time_s:.2f}s")
print(f"  Nodes: {n_nodes:,}")
print(f"  Edges: {n_edges:,}")

# Coordinate range verification
lats = [G.nodes[n]['y'] for n in G.nodes]
lons = [G.nodes[n]['x'] for n in G.nodes]
print(f"  Lat range: {min(lats):.5f} to {max(lats):.5f}")
print(f"  Lon range: {min(lons):.5f} to {max(lons):.5f}")

# SCC Analysis
scc_components = list(nx.strongly_connected_components(G))
largest_scc = max(scc_components, key=len)
n_scc_components = len(scc_components)
scc_largest_pct = 100.0 * len(largest_scc) / n_nodes
print(f"  SCC components: {n_scc_components}")
print(f"  Largest SCC: {len(largest_scc):,} nodes ({scc_largest_pct:.1f}%)")

results['graph_nodes'] = n_nodes
results['graph_edges'] = n_edges
results['graph_load_time_s'] = graph_load_time_s
results['scc_components'] = n_scc_components
results['scc_largest_pct'] = round(scc_largest_pct, 1)
results['lat_range'] = [round(min(lats),5), round(max(lats),5)]
results['lon_range'] = [round(min(lons),5), round(max(lons),5)]

# ============================================================
# SECTION 4 — ROUTER INITIALIZATION
# ============================================================
print("\n" + "="*70)
print("SECTION 4: ROUTER & SCC INDEX INIT")
print("="*70)

from services.router import init_scc_index, find_safe_route, build_edge_cost

t_scc_start = time.time()
init_scc_index(G)
t_scc_end = time.time()
scc_init_time_s = round(t_scc_end - t_scc_start, 3)
print(f"  SCC index build time: {scc_init_time_s:.3f}s")
results['scc_init_time_s'] = scc_init_time_s

# ============================================================
# SECTION 5 — SAFE ROUTING TEST CASES
# ============================================================
print("\n" + "="*70)
print("SECTION 5: SAFE ROUTING BENCHMARK (10 O-D TEST CASES)")
print("="*70)

# 10 diverse origin-destination pairs across Bengaluru
TEST_CASES = [
    ("TC-01", "MVIT → Hebbal",               13.13630, 77.59710, 13.03527, 77.59400),
    ("TC-02", "Koramangala → Indiranagar",    12.93452, 77.62051, 12.97194, 77.64073),
    ("TC-03", "Yelahanka → MVIT",             13.10069, 77.59632, 13.13630, 77.59710),
    ("TC-04", "BTM Layout → Lalbagh",         12.91598, 77.60946, 12.95074, 77.58478),
    ("TC-05", "Hebbal → Yeshwanthpur",        13.03527, 77.59400, 13.02255, 77.55356),
    ("TC-06", "Indiranagar → Koramangala",    12.97194, 77.64073, 12.93452, 77.62051),
    ("TC-07", "Whitefield → Indiranagar",     12.96981, 77.74995, 12.97194, 77.64073),
    ("TC-08", "Electronic City → BTM Layout", 12.84521, 77.66016, 12.91598, 77.60946),
    ("TC-09", "MVIT → Yelahanka",             13.13630, 77.59710, 13.10069, 77.59632),
    ("TC-10", "Hebbal → Koramangala",         13.03527, 77.59400, 12.93452, 77.62051),
]

route_results = []

for tc_id, label, orig_lat, orig_lon, dest_lat, dest_lon in TEST_CASES:
    print(f"\n  {tc_id}: {label}")
    t_route_start = time.perf_counter()
    try:
        res = find_safe_route(
            G=G,
            origin_lat=orig_lat,
            origin_lon=orig_lon,
            dest_lat=dest_lat,
            dest_lon=dest_lon,
            alpha=0.3,
            beta=0.3,
            gamma=0.4,
            speed_kmph=30.0,
            precalculated_edge_df=precalc_df
        )
        t_route_end = time.perf_counter()
        compute_time_ms = round((t_route_end - t_route_start) * 1000, 1)

        safe_dist = res['safest_route']['distance_m']
        safe_time = res['safest_route']['time_min']
        safe_risk = res['safest_route']['avg_risk_percentile']
        short_dist = res['shortest_route']['distance_m']
        short_time = res['shortest_route']['time_min']
        short_risk = res['shortest_route']['avg_risk_percentile']
        dist_inc_pct = res['metrics']['distance_increase_pct']
        risk_red_pts = res['metrics']['risk_reduction_pts']
        is_different = res['metrics']['is_different_route']

        print(f"    Baseline (shortest):  dist={short_dist:.1f}m  time={short_time:.1f}min  avg_risk_pct={short_risk:.1f}")
        print(f"    SafeOps (risk-aware): dist={safe_dist:.1f}m   time={safe_time:.1f}min  avg_risk_pct={safe_risk:.1f}")
        print(f"    Distance increase: {dist_inc_pct:.1f}%  |  Risk reduction: {risk_red_pts:.1f} pts  |  Different route: {is_different}")
        print(f"    Computation time: {compute_time_ms:.1f}ms")

        route_results.append({
            'tc_id': tc_id,
            'label': label,
            'status': 'SUCCESS',
            'baseline_dist_m': round(short_dist, 1),
            'baseline_time_min': round(short_time, 2),
            'baseline_avg_risk_pct': round(short_risk, 1),
            'saferoute_dist_m': round(safe_dist, 1),
            'saferoute_time_min': round(safe_time, 2),
            'saferoute_avg_risk_pct': round(safe_risk, 1),
            'dist_increase_pct': round(dist_inc_pct, 2),
            'risk_reduction_pts': round(risk_red_pts, 2),
            'is_different_route': is_different,
            'compute_time_ms': compute_time_ms,
        })

    except Exception as e:
        t_route_end = time.perf_counter()
        compute_time_ms = round((t_route_end - t_route_start) * 1000, 1)
        print(f"    [FAIL] {e}")
        traceback.print_exc()
        route_results.append({
            'tc_id': tc_id,
            'label': label,
            'status': f'FAIL: {str(e)[:120]}',
            'compute_time_ms': compute_time_ms,
        })

# ============================================================
# SECTION 6 — AGGREGATE RESULTS
# ============================================================
print("\n" + "="*70)
print("SECTION 6: AGGREGATE RESULTS")
print("="*70)

successes = [r for r in route_results if r['status'] == 'SUCCESS']
failures  = [r for r in route_results if r['status'] != 'SUCCESS']
n_success = len(successes)
n_fail = len(failures)
print(f"  Total test cases:  {len(route_results)}")
print(f"  Successful routes: {n_success}")
print(f"  Failed routes:     {n_fail}")

if n_success > 0:
    dists_baseline = [r['baseline_dist_m'] for r in successes]
    dists_safe     = [r['saferoute_dist_m'] for r in successes]
    dist_inc_pcts  = [r['dist_increase_pct'] for r in successes]
    risk_red_pts   = [r['risk_reduction_pts'] for r in successes]
    compute_times  = [r['compute_time_ms'] for r in successes]
    n_different    = sum(1 for r in successes if r.get('is_different_route'))

    avg_dist_baseline = round(np.mean(dists_baseline), 1)
    avg_dist_safe     = round(np.mean(dists_safe), 1)
    avg_dist_inc_pct  = round(np.mean(dist_inc_pcts), 2)
    med_dist_inc_pct  = round(np.median(dist_inc_pcts), 2)
    avg_risk_red      = round(np.mean(risk_red_pts), 2)
    med_risk_red      = round(np.median(risk_red_pts), 2)
    avg_compute_ms    = round(np.mean(compute_times), 1)
    med_compute_ms    = round(np.median(compute_times), 1)

    print(f"\n  -- Distance --")
    print(f"  Avg baseline distance:   {avg_dist_baseline:.1f} m")
    print(f"  Avg SafeOps distance:    {avg_dist_safe:.1f} m")
    print(f"  Avg distance increase:   {avg_dist_inc_pct:.2f}%")
    print(f"  Median distance increase:{med_dist_inc_pct:.2f}%")
    print(f"  Min distance increase:   {min(dist_inc_pcts):.2f}%")
    print(f"  Max distance increase:   {max(dist_inc_pcts):.2f}%")

    print(f"\n  -- Risk Reduction --")
    print(f"  Avg risk reduction:      {avg_risk_red:.2f} percentile pts")
    print(f"  Median risk reduction:   {med_risk_red:.2f} percentile pts")
    print(f"  Min risk reduction:      {min(risk_red_pts):.2f} pts")
    print(f"  Max risk reduction:      {max(risk_red_pts):.2f} pts")

    print(f"\n  -- Computation Time --")
    print(f"  Avg compute time:        {avg_compute_ms:.1f} ms")
    print(f"  Median compute time:     {med_compute_ms:.1f} ms")
    print(f"  Min compute time:        {min(compute_times):.1f} ms")
    print(f"  Max compute time:        {max(compute_times):.1f} ms")

    print(f"\n  -- Route Differentiation --")
    print(f"  Routes that differ from shortest:  {n_different}/{n_success}")
    print(f"  Route differentiation rate:        {100.0*n_different/n_success:.1f}%")

    results['aggregate'] = {
        'n_success': n_success,
        'n_fail': n_fail,
        'avg_baseline_dist_m': avg_dist_baseline,
        'avg_saferoute_dist_m': avg_dist_safe,
        'avg_dist_increase_pct': avg_dist_inc_pct,
        'med_dist_increase_pct': med_dist_inc_pct,
        'min_dist_increase_pct': round(min(dist_inc_pcts), 2),
        'max_dist_increase_pct': round(max(dist_inc_pcts), 2),
        'avg_risk_reduction_pts': avg_risk_red,
        'med_risk_reduction_pts': med_risk_red,
        'min_risk_reduction_pts': round(min(risk_red_pts), 2),
        'max_risk_reduction_pts': round(max(risk_red_pts), 2),
        'avg_compute_time_ms': avg_compute_ms,
        'med_compute_time_ms': med_compute_ms,
        'min_compute_time_ms': min(compute_times),
        'max_compute_time_ms': max(compute_times),
        'n_routes_different': n_different,
        'differentiation_rate_pct': round(100.0*n_different/n_success, 1),
    }

# ============================================================
# SECTION 7 — EDGE RISK STATISTICS (from precalculated data)
# ============================================================
print("\n" + "="*70)
print("SECTION 7: EDGE RISK STATISTICS")
print("="*70)

if precalc_df is not None and 'risk' in precalc_df.columns:
    print(f"  Edge risk distribution:")
    print(f"    min:    {precalc_df['risk'].min():.4f}")
    print(f"    max:    {precalc_df['risk'].max():.4f}")
    print(f"    mean:   {precalc_df['risk'].mean():.4f}")
    print(f"    median: {precalc_df['risk'].median():.4f}")
    print(f"    std:    {precalc_df['risk'].std():.4f}")
    print(f"    edges with risk > 0:  {(precalc_df['risk'] > 0).sum():,}  ({100*(precalc_df['risk'] > 0).mean():.1f}%)")
    if 'length_m' in precalc_df.columns:
        print(f"  Edge length (m):")
        print(f"    min:    {precalc_df['length_m'].min():.1f}")
        print(f"    max:    {precalc_df['length_m'].max():.1f}")
        print(f"    mean:   {precalc_df['length_m'].mean():.1f}")
        print(f"    median: {precalc_df['length_m'].median():.1f}")
    results['edge_risk_stats'] = {
        'min': round(float(precalc_df['risk'].min()), 4),
        'max': round(float(precalc_df['risk'].max()), 4),
        'mean': round(float(precalc_df['risk'].mean()), 4),
        'median': round(float(precalc_df['risk'].median()), 4),
        'std': round(float(precalc_df['risk'].std()), 4),
        'edges_with_risk_gt0_pct': round(100*(precalc_df['risk'] > 0).mean(), 1),
    }
else:
    print("  [SKIP] No precalculated edge data available.")

# ============================================================
# SECTION 8 — STARTUP TIME SIMULATION
# ============================================================
print("\n" + "="*70)
print("SECTION 8: COMPONENT STARTUP TIMING SUMMARY")
print("="*70)
total_init = kde_init_time_s + graph_load_time_s + scc_init_time_s
print(f"  KDE engine init (BallTree build):  {kde_init_time_s:.3f}s")
print(f"  GraphML load (OSMnx):              {graph_load_time_s:.2f}s")
print(f"  SCC index build:                   {scc_init_time_s:.3f}s")
print(f"  Total (KDE + graph + SCC):         {total_init:.2f}s")
print(f"  (precalculated edges load skipped in this timing — they're pre-loaded)")
results['total_init_time_s'] = round(total_init, 2)

# ============================================================
# SAVE RAW RESULTS
# ============================================================
results['route_results'] = route_results
out_path = os.path.join(BASE_DIR, "audit_raw_results.json")
with open(out_path, "w") as f:
    json.dump(results, f, indent=2)
print(f"\n  [SAVED] Raw audit results: {out_path}")

print("\n" + "="*70)
print("AUDIT COMPLETE")
print("="*70)
