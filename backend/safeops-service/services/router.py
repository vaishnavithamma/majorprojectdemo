"""
Router Service — SafeOps
Source of truth: safeopdskdecleaannnnnnnnnnnnnnn.ipynb (Stage 9, 10, 16)

Road segment scoring, percentile normalization, multi-objective edge cost calculation,
and NetworkX shortest vs. safety-weighted Dijkstra routing.
"""

import pandas as pd
import numpy as np
import networkx as nx
import osmnx as ox
from scipy.stats import rankdata
from sklearn.neighbors import BallTree
from services.kde_engine import get_kde_risk, EARTH_RADIUS_KM

# Module-level spatial index for strongly connected component (SCC) nodes
_scc_tree = None
_scc_node_ids = None

def init_scc_index(G):
    """
    Build a spatial index over the largest strongly connected component (SCC)
    nodes of the driving graph. Ensures that snaps always resolve to reachable,
    connected arterial driving roads.
    """
    global _scc_tree, _scc_node_ids
    if _scc_tree is not None:
        return
    largest_cc = max(nx.strongly_connected_components(G), key=len)
    _scc_node_ids = list(largest_cc)
    coords_rad = np.radians([[G.nodes[n]['y'], G.nodes[n]['x']] for n in _scc_node_ids])
    _scc_tree = BallTree(coords_rad, metric='haversine')
    print(f"[SafeOps Router] SCC BallTree built over {len(_scc_node_ids)} strongly connected nodes.")

def snap_to_scc_node(G, lat: float, lon: float):
    """
    Snap coordinates (lat, lon) to the nearest road node inside the
    largest strongly connected component.
    """
    global _scc_tree, _scc_node_ids
    if _scc_tree is None:
        init_scc_index(G)
    query_rad = np.radians([[lat, lon]])
    dist_rad, idx = _scc_tree.query(query_rad, k=1)
    node_id = _scc_node_ids[idx[0][0]]
    dist_m = float(dist_rad[0][0] * EARTH_RADIUS_KM * 1000.0)
    return node_id, dist_m

def score_route_geometry(coords: list, sample_interval_m: float = 200.0):
    """
    Score a route polyline geometry by sampling points along the path
    and evaluating them against the exact same KDE model.
    coords: list of [lat, lon] or [[lat, lon], ...]
    """
    if not coords or len(coords) == 0:
        return {
            "total_risk": 0.0,
            "avg_risk_per_km": 0.0,
            "n_risk_samples": 0
        }

    total_risk = 0.0
    n_samples = 0
    total_dist_m = 0.0

    # Evaluate KDE at intermediate polyline vertices / sampled points
    prev_pt = None
    accum_dist = 0.0

    for pt in coords:
        lat, lon = pt[0], pt[1]
        if prev_pt is None:
            r = get_kde_risk(lat, lon)
            total_risk += r
            n_samples += 1
            prev_pt = (lat, lon)
            continue

        # Haversine distance from previous point
        phi1, phi2 = np.radians(prev_pt[0]), np.radians(lat)
        dphi = np.radians(lat - prev_pt[0])
        dlam = np.radians(lon - prev_pt[1])
        a = np.sin(dphi / 2.0)**2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlam / 2.0)**2
        seg_dist = 2.0 * EARTH_RADIUS_KM * 1000.0 * np.arcsin(np.sqrt(a))
        total_dist_m += seg_dist
        accum_dist += seg_dist

        if accum_dist >= sample_interval_m:
            r = get_kde_risk(lat, lon)
            total_risk += r
            n_samples += 1
            accum_dist = 0.0

        prev_pt = (lat, lon)

    # Ensure at least the destination vertex was sampled
    if n_samples == 1 and len(coords) > 1:
        last_pt = coords[-1]
        total_risk += get_kde_risk(last_pt[0], last_pt[1])
        n_samples += 1

    dist_km = max(total_dist_m / 1000.0, 0.001)
    avg_risk_per_km = total_risk / dist_km

    return {
        "total_risk": round(total_risk, 2),
        "avg_risk_per_km": round(avg_risk_per_km, 2),
        "n_risk_samples": n_samples
    }

def score_graph_edges(G, earth_radius_km=EARTH_RADIUS_KM):
    """
    Score every edge in road graph G by its midpoint KDE risk.
    Matches notebook Cell 80 (score_graph_edges).
    """
    edge_records = []
    for u, v, key, data in G.edges(keys=True, data=True):
        u_lat, u_lon = G.nodes[u]['y'], G.nodes[u]['x']
        v_lat, v_lon = G.nodes[v]['y'], G.nodes[v]['x']
        mid_lat = (u_lat + v_lat) / 2.0
        mid_lon = (u_lon + v_lon) / 2.0

        risk = get_kde_risk(mid_lat, mid_lon)
        length_m = data.get('length', None)

        edge_records.append({
            'u': u, 'v': v, 'key': key,
            'mid_lat': mid_lat, 'mid_lon': mid_lon,
            'length_m': length_m,
            'risk': risk
        })
    return pd.DataFrame(edge_records)

def build_edge_cost(edge_df, alpha=0.3, beta=0.3, gamma=0.4, speed_kmph=30.0):
    """
    Percentile-normalize risk, estimate travel time, min-max normalize,
    and compute weighted edge_cost. Matches notebook Cell 80 (build_edge_cost).
    """
    df = edge_df.copy()
    df['length_m'] = df['length_m'].fillna(df['length_m'].median())

    # Percentile rank: 0-100, robust to outliers
    df['risk_percentile'] = rankdata(df['risk'], method='average') / len(df) * 100.0

    speed_m_per_min = (speed_kmph * 1000.0) / 60.0
    df['travel_time_min'] = df['length_m'] / speed_m_per_min

    def _minmax_0_100(s):
        lo, hi = s.min(), s.max()
        return (s - lo) / (hi - lo) * 100.0 if hi > lo else s * 0.0

    df['distance_norm'] = _minmax_0_100(df['length_m'])
    df['time_norm'] = _minmax_0_100(df['travel_time_min'])

    df['edge_cost'] = (
        alpha * df['distance_norm'] +
        beta * df['time_norm'] +
        gamma * df['risk_percentile']
    )
    return df

def find_safe_route(G, origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float,
                    alpha: float = 0.3, beta: float = 0.3, gamma: float = 0.4, speed_kmph: float = 30.0,
                    precalculated_edge_df: pd.DataFrame = None):
    """
    Find shortest vs. safest-cost route using Dijkstra.
    Matches notebook Stage 16 find_safe_route().
    """
    if precalculated_edge_df is not None:
        cost_df = build_edge_cost(precalculated_edge_df, alpha=alpha, beta=beta, gamma=gamma, speed_kmph=speed_kmph)
    else:
        edge_df = score_graph_edges(G)
        cost_df = build_edge_cost(edge_df, alpha=alpha, beta=beta, gamma=gamma, speed_kmph=speed_kmph)

    # Attach computed edge costs onto NetworkX graph G
    for row in cost_df.itertuples():
        G[row.u][row.v][row.key]['edge_cost'] = row.edge_cost
        G[row.u][row.v][row.key]['risk_percentile'] = row.risk_percentile

    # Snap lat/lng to nearest graph nodes
    origin_node = ox.distance.nearest_nodes(G, origin_lon, origin_lat)
    dest_node = ox.distance.nearest_nodes(G, dest_lon, dest_lat)

    # Dijkstra routes via NetworkX
    safest_route = nx.shortest_path(G, origin_node, dest_node, weight='edge_cost')
    shortest_route = nx.shortest_path(G, origin_node, dest_node, weight='length')

def _extract_route_geometry_and_metrics(G, route_nodes, weight_attribute: str, speed_kmph: float = 30.0):
    """
    Extract actual OSM road geometry curves (Shapely LineString), sum exact edge lengths,
    compute average risk percentile, and extract segment-by-segment risk profiles.
    """
    coords = []
    total_len = 0.0
    total_risk = 0.0
    risk_segments = []

    for i in range(len(route_nodes) - 1):
        u = route_nodes[i]
        v = route_nodes[i+1]

        # Select the specific MultiDiGraph edge key that minimizes weight_attribute
        edges = G[u][v]
        best_key = min(edges.keys(), key=lambda k: edges[k].get(weight_attribute, edges[k].get('length', float('inf'))))
        edge_data = edges[best_key]

        edge_len = edge_data.get('length', 0.0)
        edge_risk_pct = edge_data.get('risk_percentile', 50.0)

        total_len += edge_len
        total_risk += edge_risk_pct

        # Segment Risk Classification
        if edge_risk_pct >= 70.0:
            level = "HIGH"
        elif edge_risk_pct >= 40.0:
            level = "MODERATE"
        else:
            level = "LOW"

        risk_segments.append({
            "segment_index": i + 1,
            "u_node": int(u),
            "v_node": int(v),
            "distance_m": round(edge_len, 1),
            "risk_percentile": round(edge_risk_pct, 1),
            "risk_level": level
        })

        # Extract actual Shapely road geometry curve if available
        if 'geometry' in edge_data:
            line_coords = list(edge_data['geometry'].coords)
            # Shapely stores (lon, lat) -> convert to Leaflet [lat, lon]
            formatted_coords = [[lat, lon] for lon, lat in line_coords]
            
            # Avoid duplicate vertex at edge junctions
            if coords and formatted_coords:
                coords.extend(formatted_coords[1:])
            else:
                coords.extend(formatted_coords)
        else:
            # Fallback to endpoint node coordinates if no geometry attribute
            u_lat, u_lon = G.nodes[u]['y'], G.nodes[u]['x']
            v_lat, v_lon = G.nodes[v]['y'], G.nodes[v]['x']
            if not coords:
                coords.append([u_lat, u_lon])
            coords.append([v_lat, v_lon])

    n_segments = max(len(route_nodes) - 1, 1)
    avg_risk_pct = total_risk / n_segments
    speed_m_per_min = (speed_kmph * 1000.0) / 60.0
    time_min = total_len / speed_m_per_min

    # Derived Safety Score: 100 - avg_risk_percentile
    safety_score = round(max(0.0, min(100.0, 100.0 - avg_risk_pct)), 1)

    # Global Risk Classification
    if avg_risk_pct >= 65.0:
        overall_risk_level = "HIGH RISK"
    elif avg_risk_pct >= 35.0:
        overall_risk_level = "MODERATE RISK"
    else:
        overall_risk_level = "LOW RISK"

    return {
        "coordinates": coords,
        "distance_m": round(total_len, 1),
        "time_min": round(time_min, 1),
        "avg_risk_percentile": round(avg_risk_pct, 1),
        "safety_score": safety_score,
        "overall_risk_level": overall_risk_level,
        "n_nodes": len(route_nodes),
        "risk_segments": risk_segments
    }

def find_safe_route(G, origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float,
                    alpha: float = 0.3, beta: float = 0.3, gamma: float = 0.4, speed_kmph: float = 30.0,
                    precalculated_edge_df: pd.DataFrame = None):
    """
    Find shortest vs. safest-cost route using Dijkstra with exact OSM road geometries.
    Matches notebook Stage 16 find_safe_route().
    """
    if precalculated_edge_df is not None:
        cost_df = build_edge_cost(precalculated_edge_df, alpha=alpha, beta=beta, gamma=gamma, speed_kmph=speed_kmph)
    else:
        edge_df = score_graph_edges(G)
        cost_df = build_edge_cost(edge_df, alpha=alpha, beta=beta, gamma=gamma, speed_kmph=speed_kmph)

    # Attach computed edge costs onto NetworkX graph G
    for row in cost_df.itertuples():
        G[row.u][row.v][row.key]['edge_cost'] = row.edge_cost
        G[row.u][row.v][row.key]['risk_percentile'] = row.risk_percentile

    # Snap origin and destination coordinates to nearest nodes in the Strongly Connected Component (SCC)
    # This guarantees that a traversable road path always exists across the driving network
    origin_node, origin_snap_dist = snap_to_scc_node(G, origin_lat, origin_lon)
    dest_node, dest_snap_dist = snap_to_scc_node(G, dest_lat, dest_lon)

    # Coordinates of snapped road nodes
    origin_snapped_coord = [G.nodes[origin_node]['y'], G.nodes[origin_node]['x']]
    dest_snapped_coord = [G.nodes[dest_node]['y'], G.nodes[dest_node]['x']]

    # Dijkstra routes via NetworkX
    safest_route = nx.shortest_path(G, origin_node, dest_node, weight='edge_cost')
    shortest_route = nx.shortest_path(G, origin_node, dest_node, weight='length')

    safest_info = _extract_route_geometry_and_metrics(G, safest_route, weight_attribute='edge_cost', speed_kmph=speed_kmph)
    shortest_info = _extract_route_geometry_and_metrics(G, shortest_route, weight_attribute='length', speed_kmph=speed_kmph)

    dist_diff = safest_info['distance_m'] - shortest_info['distance_m']
    dist_inc_pct = (dist_diff / shortest_info['distance_m'] * 100.0) if shortest_info['distance_m'] > 0 else 0.0
    risk_red_pts = shortest_info['avg_risk_percentile'] - safest_info['avg_risk_percentile']

    # Explainability text
    if safest_route != shortest_route:
        explanation = f"SafeOps selected this route to bypass higher crime-risk road segments. It reduces exposure by {round(max(0, risk_red_pts), 1)} risk percentile points with an additional {round(max(0, dist_inc_pct), 1)}% detour."
    else:
        explanation = "The shortest physical path currently matches the lowest risk density path in this area."

    return {
        "success": True,
        "snapped_origin": origin_snapped_coord,
        "snapped_destination": dest_snapped_coord,
        "safest_route": safest_info,
        "shortest_route": shortest_info,
        "metrics": {
            "distance_increase_pct": round(dist_inc_pct, 1),
            "risk_reduction_pts": round(risk_red_pts, 1),
            "is_different_route": safest_route != shortest_route,
            "explanation": explanation
        }
    }
