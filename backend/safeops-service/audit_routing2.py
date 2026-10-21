"""
SafeOps Routing Audit - Part 2 (Routing benchmark only)
Unicode-safe version for Windows console
"""
import os
import sys
import time
import json
import traceback

# Force UTF-8 output
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FIR_PATH = os.path.join(BASE_DIR, "data", "fir_points.parquet")
GRAPH_PATH = os.path.join(BASE_DIR, "data", "bengaluru_graph.graphml")
PRECALC_PATH = os.path.join(BASE_DIR, "data", "precalculated_edge_risks.parquet")

# Load FIR
fir_df = pd.read_parquet(FIR_PATH)
print(f"FIR records: {len(fir_df):,}")

# Load precalc
precalc_df = pd.read_parquet(PRECALC_PATH) if os.path.exists(PRECALC_PATH) else None
print(f"Precalc edges: {len(precalc_df):,}" if precalc_df is not None else "No precalc")

# Init KDE
sys.path.insert(0, BASE_DIR)
from services.kde_engine import init_kde_engine
init_kde_engine(FIR_PATH)

# Load Graph
import osmnx as ox
import networkx as nx
print("Loading graph...")
t0 = time.time()
G = ox.load_graphml(GRAPH_PATH)
print(f"Graph loaded in {time.time()-t0:.2f}s | Nodes={len(G.nodes):,} | Edges={len(G.edges):,}")

# Init router
from services.router import init_scc_index, find_safe_route
init_scc_index(G)

# ============================================================
# TEST CASES - ASCII labels only
# ============================================================
TEST_CASES = [
    ("TC-01", "MVIT to Hebbal",               13.13630, 77.59710, 13.03527, 77.59400),
    ("TC-02", "Koramangala to Indiranagar",    12.93452, 77.62051, 12.97194, 77.64073),
    ("TC-03", "Yelahanka to MVIT",             13.10069, 77.59632, 13.13630, 77.59710),
    ("TC-04", "BTM Layout to Lalbagh",         12.91598, 77.60946, 12.95074, 77.58478),
    ("TC-05", "Hebbal to Yeshwanthpur",        13.03527, 77.59400, 13.02255, 77.55356),
    ("TC-06", "Indiranagar to Koramangala",    12.97194, 77.64073, 12.93452, 77.62051),
    ("TC-07", "Whitefield to Indiranagar",     12.96981, 77.74995, 12.97194, 77.64073),
    ("TC-08", "Electronic City to BTM",        12.84521, 77.66016, 12.91598, 77.60946),
    ("TC-09", "MVIT to Yelahanka",             13.13630, 77.59710, 13.10069, 77.59632),
    ("TC-10", "Hebbal to Koramangala",         13.03527, 77.59400, 12.93452, 77.62051),
]

print("\n" + "="*70)
print("ROUTING BENCHMARK (10 O-D pairs)")
print("="*70)

route_results = []

for tc_id, label, orig_lat, orig_lon, dest_lat, dest_lon in TEST_CASES:
    print(f"\n  {tc_id}: {label}")
    t_start = time.perf_counter()
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
        compute_ms = round((time.perf_counter() - t_start) * 1000, 1)

        sd = res['shortest_route']['distance_m']
        st = res['shortest_route']['time_min']
        sr = res['shortest_route']['avg_risk_percentile']
        fd = res['safest_route']['distance_m']
        ft = res['safest_route']['time_min']
        fr = res['safest_route']['avg_risk_percentile']
        di = res['metrics']['distance_increase_pct']
        rr = res['metrics']['risk_reduction_pts']
        diff = res['metrics']['is_different_route']

        print(f"    Baseline:  dist={sd:.1f}m  time={st:.2f}min  risk_pct={sr:.1f}")
        print(f"    SafeOps:   dist={fd:.1f}m  time={ft:.2f}min  risk_pct={fr:.1f}")
        print(f"    dist_inc={di:.2f}%  risk_red={rr:.2f}pts  different={diff}  compute={compute_ms:.1f}ms")

        route_results.append({
            'tc_id': tc_id, 'label': label, 'status': 'SUCCESS',
            'baseline_dist_m': round(sd, 1),
            'baseline_time_min': round(st, 2),
            'baseline_avg_risk_pct': round(sr, 1),
            'saferoute_dist_m': round(fd, 1),
            'saferoute_time_min': round(ft, 2),
            'saferoute_avg_risk_pct': round(fr, 1),
            'dist_increase_pct': round(di, 2),
            'risk_reduction_pts': round(rr, 2),
            'is_different_route': diff,
            'compute_time_ms': compute_ms,
        })
    except Exception as e:
        compute_ms = round((time.perf_counter() - t_start) * 1000, 1)
        print(f"    FAIL: {e}")
        route_results.append({'tc_id': tc_id, 'label': label, 'status': f'FAIL: {str(e)[:120]}', 'compute_time_ms': compute_ms})

# ============================================================
# AGGREGATE
# ============================================================
print("\n" + "="*70)
print("AGGREGATE RESULTS")
print("="*70)

successes = [r for r in route_results if r['status'] == 'SUCCESS']
n_s = len(successes)
n_f = len(route_results) - n_s

print(f"  Successful: {n_s}/{len(route_results)}")
print(f"  Failed:     {n_f}/{len(route_results)}")

if n_s > 0:
    di_pcts  = [r['dist_increase_pct']    for r in successes]
    rr_pts   = [r['risk_reduction_pts']   for r in successes]
    ct_ms    = [r['compute_time_ms']      for r in successes]
    b_dist   = [r['baseline_dist_m']      for r in successes]
    s_dist   = [r['saferoute_dist_m']     for r in successes]
    b_risk   = [r['baseline_avg_risk_pct'] for r in successes]
    s_risk   = [r['saferoute_avg_risk_pct'] for r in successes]
    n_diff   = sum(1 for r in successes if r.get('is_different_route'))

    print(f"\n  DISTANCE:")
    print(f"    Avg baseline dist:    {np.mean(b_dist):.1f} m")
    print(f"    Avg SafeOps dist:     {np.mean(s_dist):.1f} m")
    print(f"    Avg dist increase:    {np.mean(di_pcts):.2f}%  (median {np.median(di_pcts):.2f}%)")
    print(f"    Range:                [{min(di_pcts):.2f}%, {max(di_pcts):.2f}%]")

    print(f"\n  RISK REDUCTION (avg_risk_percentile points):")
    print(f"    Avg baseline risk:    {np.mean(b_risk):.1f} pct")
    print(f"    Avg SafeOps risk:     {np.mean(s_risk):.1f} pct")
    print(f"    Avg reduction:        {np.mean(rr_pts):.2f} pts  (median {np.median(rr_pts):.2f} pts)")
    print(f"    Range:                [{min(rr_pts):.2f}, {max(rr_pts):.2f}] pts")

    print(f"\n  COMPUTATION TIME (local, pre-loaded graph):")
    print(f"    Avg:    {np.mean(ct_ms):.1f} ms")
    print(f"    Median: {np.median(ct_ms):.1f} ms")
    print(f"    Min:    {min(ct_ms):.1f} ms  |  Max: {max(ct_ms):.1f} ms")

    print(f"\n  ROUTE DIFFERENTIATION:")
    print(f"    Different from shortest:  {n_diff}/{n_s}  ({100.0*n_diff/n_s:.1f}%)")

    agg = {
        'n_success': n_s, 'n_fail': n_f,
        'avg_baseline_dist_m': round(float(np.mean(b_dist)), 1),
        'avg_saferoute_dist_m': round(float(np.mean(s_dist)), 1),
        'avg_dist_increase_pct': round(float(np.mean(di_pcts)), 2),
        'med_dist_increase_pct': round(float(np.median(di_pcts)), 2),
        'min_dist_increase_pct': round(float(min(di_pcts)), 2),
        'max_dist_increase_pct': round(float(max(di_pcts)), 2),
        'avg_baseline_risk_pct': round(float(np.mean(b_risk)), 2),
        'avg_saferoute_risk_pct': round(float(np.mean(s_risk)), 2),
        'avg_risk_reduction_pts': round(float(np.mean(rr_pts)), 2),
        'med_risk_reduction_pts': round(float(np.median(rr_pts)), 2),
        'min_risk_reduction_pts': round(float(min(rr_pts)), 2),
        'max_risk_reduction_pts': round(float(max(rr_pts)), 2),
        'avg_compute_ms': round(float(np.mean(ct_ms)), 1),
        'med_compute_ms': round(float(np.median(ct_ms)), 1),
        'min_compute_ms': float(min(ct_ms)),
        'max_compute_ms': float(max(ct_ms)),
        'n_different': n_diff,
        'differentiation_rate_pct': round(100.0*n_diff/n_s, 1),
    }

    out = {
        'dataset': {
            'n_fir_records': len(fir_df),
            'fir_size_mb': round(os.path.getsize(FIR_PATH)/1e6, 2),
            'graph_nodes': len(G.nodes),
            'graph_edges': len(G.edges),
            'n_precalc_edges': len(precalc_df) if precalc_df is not None else 0,
        },
        'aggregate': agg,
        'route_results': route_results,
    }

    with open(os.path.join(BASE_DIR, "audit_results_final.json"), "w", encoding='utf-8') as f:
        json.dump(out, f, indent=2)
    print("\n  Saved: audit_results_final.json")

print("\nDONE.")
