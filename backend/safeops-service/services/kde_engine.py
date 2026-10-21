"""
KDE Engine Service — SafeOps
Source of truth: safeopdskdecleaannnnnnnnnnnnnnn.ipynb (Stage 6 & 8)

Weighted Kernel Density Estimation (KDE) over historical crime points.
Bandwidth selection note: 2.0 km is the selected practical/engineering bandwidth
within the predefined tested range (0.1 to 10.0 km).
"""

import os
import numpy as np
import pandas as pd
from sklearn.neighbors import BallTree

EARTH_RADIUS_KM = 6371.0
DEFAULT_BANDWIDTH_KM = 2.0  # Selected practical/engineering bandwidth from tested range
DEFAULT_RADIUS_MULTIPLIER = 3  # 3 bandwidths ~ 99.7% Gaussian coverage

_fir_points_df = None
_ball_tree = None

def init_kde_engine(data_path: str):
    """
    Loads fir_points dataset and constructs BallTree spatial index in memory once.
    """
    global _fir_points_df, _ball_tree
    
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"FIR dataset not found at {data_path}")

    if data_path.endswith('.parquet'):
        _fir_points_df = pd.read_parquet(data_path)
    else:
        _fir_points_df = pd.read_csv(data_path)

    # BallTree with haversine metric requires radians
    coords_rad = np.radians(_fir_points_df[['Latitude', 'Longitude']].values)
    _ball_tree = BallTree(coords_rad, metric='haversine')
    print(f"[SafeOps] KDE Engine initialized: BallTree built over {len(_fir_points_df)} points.")

def get_kde_risk(lat: float, lon: float, bandwidth_km: float = DEFAULT_BANDWIDTH_KM, radius_multiplier: int = DEFAULT_RADIUS_MULTIPLIER) -> float:
    """
    Estimate spatial risk at a single coordinate using weighted Gaussian KDE.
    Unnormalized weighted Gaussian sum matching notebook cell 24/80.
    """
    if _ball_tree is None or _fir_points_df is None:
        raise RuntimeError("KDE Engine not initialized. Call init_kde_engine first.")

    query_rad = np.radians([[lat, lon]])
    search_radius_rad = (bandwidth_km * radius_multiplier) / EARTH_RADIUS_KM

    idx, dist_rad = _ball_tree.query_radius(query_rad, r=search_radius_rad, return_distance=True)
    idx, dist_rad = idx[0], dist_rad[0]

    if len(idx) == 0:
        return 0.0

    dist_km = dist_rad * EARTH_RADIUS_KM
    weights = _fir_points_df.iloc[idx]['Risk_Contribution'].values
    kernel_vals = np.exp(-0.5 * (dist_km / bandwidth_km) ** 2)

    return float(np.sum(weights * kernel_vals))
