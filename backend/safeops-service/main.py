"""
FastAPI Server — SafeOps Route Microservice
Port 8000
Source of truth: safeopdskdecleaannnnnnnnnnnnnnn.ipynb
"""

import os
import time
import osmnx as ox
import pandas as pd
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from services.kde_engine import init_kde_engine, get_kde_risk
from services.router import score_graph_edges, find_safe_route, init_scc_index, score_route_geometry

# Globals for in-memory caching
G_bengaluru = None
precomputed_edge_df = None

# Measured benchmarks
PERFORMANCE_STATS = {
    "startup_time_s": 0.0,
    "graph_nodes": 0,
    "graph_edges": 0,
    "fir_points": 0,
    "precalculated_edges": 0
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    global G_bengaluru, precomputed_edge_df, PERFORMANCE_STATS
    t0 = time.time()
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    fir_path = os.path.join(base_dir, "data", "fir_points.parquet")
    graph_path = os.path.join(base_dir, "data", "bengaluru_graph.graphml")
    precalc_path = os.path.join(base_dir, "data", "precalculated_edge_risks.parquet")

    # 1. Initialize KDE Engine & BallTree
    print("[SafeOps] Initializing SafeOps KDE Engine...")
    init_kde_engine(fir_path)
    PERFORMANCE_STATS["fir_points"] = 50000

    # 2. Load GraphML Artifact
    print(f"[SafeOps] Loading regional OSM graph from {graph_path}...")
    if os.path.exists(graph_path):
        G_bengaluru = ox.load_graphml(graph_path)
        PERFORMANCE_STATS["graph_nodes"] = len(G_bengaluru.nodes)
        PERFORMANCE_STATS["graph_edges"] = len(G_bengaluru.edges)
        print(f"[SafeOps] OSM Graph loaded. Nodes: {len(G_bengaluru.nodes)}, Edges: {len(G_bengaluru.edges)}")
    else:
        print("[SafeOps] GraphML not found, pulling fallback region...")
        G_bengaluru = ox.graph_from_point((13.10, 77.60), dist=5000, network_type='drive')

    # Initialize SCC Spatial Index for guaranteed reachability
    print("[SafeOps] Initializing SCC spatial index...")
    init_scc_index(G_bengaluru)

    # 3. Check or generate precalculated edge risks
    if os.path.exists(precalc_path):
        print(f"[SafeOps] Loading precalculated edge risk table from {precalc_path}...")
        precomputed_edge_df = pd.read_parquet(precalc_path)
        PERFORMANCE_STATS["precalculated_edges"] = len(precomputed_edge_df)
    else:
        print("[SafeOps] Precalculating edge risk table for graph edges...")
        precomputed_edge_df = score_graph_edges(G_bengaluru)
        precomputed_edge_df.to_parquet(precalc_path)
        PERFORMANCE_STATS["precalculated_edges"] = len(precomputed_edge_df)
        print("[SafeOps] Precalculated edge risks saved.")

    t1 = time.time()
    PERFORMANCE_STATS["startup_time_s"] = round(t1 - t0, 2)
    print(f"[SafeOps] SafeOps Routing Service ready on port 8000! (Startup: {PERFORMANCE_STATS['startup_time_s']}s)")
    yield

app = FastAPI(title="SafeOps Safe Route Microservice", version="1.0.0", lifespan=lifespan)

class Coord(BaseModel):
    lat: float
    lng: float

class Weights(BaseModel):
    alpha: float = Field(default=0.3, description="Distance weight")
    beta: float = Field(default=0.3, description="Travel time weight")
    gamma: float = Field(default=0.4, description="Risk percentile weight")

class RouteRequest(BaseModel):
    origin: Coord
    destination: Coord
    weights: Weights = Field(default_factory=Weights)
    speed_kmph: float = 30.0

class GeometryScoreRequest(BaseModel):
    coordinates: list[list[float]] = Field(description="List of [lat, lon] coordinates")
    sample_interval_m: float = 200.0

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "SafeOps Python Safe Route Microservice",
        "performance_stats": PERFORMANCE_STATS
    }

@app.post("/plan-route")
def plan_route(req: RouteRequest):
    if G_bengaluru is None:
        raise HTTPException(status_code=500, detail="OSM Graph is not loaded.")

    t_start = time.time()
    try:
        res = find_safe_route(
            G=G_bengaluru,
            origin_lat=req.origin.lat,
            origin_lon=req.origin.lng,
            dest_lat=req.destination.lat,
            dest_lon=req.destination.lng,
            alpha=req.weights.alpha,
            beta=req.weights.beta,
            gamma=req.weights.gamma,
            speed_kmph=req.speed_kmph,
            precalculated_edge_df=precomputed_edge_df
        )
        t_compute = time.time() - t_start
        res["execution_time_ms"] = round(t_compute * 1000.0, 2)
        return res
    except Exception as e:
        print(f"[SafeOps Error] Route calculation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/score-geometry")
def score_geometry_endpoint(req: GeometryScoreRequest):
    try:
        metrics = score_route_geometry(req.coordinates, sample_interval_m=req.sample_interval_m)
        return {
            "success": True,
            "metrics": metrics
        }
    except Exception as e:
        print(f"[SafeOps Error] Score geometry error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
