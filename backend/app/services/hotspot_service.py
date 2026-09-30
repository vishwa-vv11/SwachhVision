import logging
from typing import List, Dict, Any, Tuple
from collections import defaultdict
from sqlalchemy.orm import Session
from app.models.incident import Incident
from app.models.hotspot import Hotspot
from app.services.geo_service import haversine_distance_meters

logger = logging.getLogger("civicai.hotspot_service")

class SpatialHotspotService:
    """
    Spatial Clustering & Hotspot Engine for recurring garbage and sewage accumulation zones.
    Uses DBSCAN distance clustering over geographic coordinates (lat/lon).
    """

    DEFAULT_RADIUS_METERS = 120.0  # ~120m cluster proximity
    MIN_INCIDENTS_FOR_HOTSPOT = 2

    @staticmethod
    def calculate_risk_level(incident_count: int) -> str:
        """
        Evaluate risk level based on recurring incident volume:
        - 2-3 reports -> LOW
        - 4-6 reports -> MODERATE
        - 7-10 reports -> HIGH
        - > 10 reports -> SEVERE
        """
        if incident_count <= 3:
            return "LOW"
        elif incident_count <= 6:
            return "MODERATE"
        elif incident_count <= 10:
            return "HIGH"
        else:
            return "SEVERE"

    def cluster_incidents(
        self,
        incidents: List[Incident],
        eps_meters: float = DEFAULT_RADIUS_METERS
    ) -> List[List[Incident]]:
        """
        DBSCAN-style spatial clustering based on haversine distance.
        """
        if not incidents:
            return []

        visited = set()
        clusters = []

        for i, inc in enumerate(incidents):
            if inc.id in visited:
                continue

            visited.add(inc.id)
            neighbors = self._get_neighbors(inc, incidents, eps_meters)

            if len(neighbors) < self.MIN_INCIDENTS_FOR_HOTSPOT:
                continue

            cluster = [inc]
            queue = list(neighbors)

            for neighbor in queue:
                if neighbor.id not in visited:
                    visited.add(neighbor.id)
                    neighbor_neighbors = self._get_neighbors(neighbor, incidents, eps_meters)
                    if len(neighbor_neighbors) >= self.MIN_INCIDENTS_FOR_HOTSPOT:
                        for nn in neighbor_neighbors:
                            if nn not in queue:
                                queue.append(nn)

                if neighbor not in cluster:
                    cluster.append(neighbor)

            clusters.append(cluster)

        return clusters

    def _get_neighbors(
        self,
        target: Incident,
        incidents: List[Incident],
        eps_meters: float
    ) -> List[Incident]:
        neighbors = []
        for inc in incidents:
            if inc.id != target.id:
                # Group by matching issue type (Garbage clusters separate from Sewage)
                if inc.issue_type == target.issue_type:
                    dist = haversine_distance_meters(target.latitude, target.longitude, inc.latitude, inc.longitude)
                    if dist <= eps_meters:
                        neighbors.append(inc)
        return neighbors

    def refresh_hotspots(self, db: Session, eps_meters: float = DEFAULT_RADIUS_METERS) -> List[Hotspot]:
        """
        Scan all unresolved and historical incidents in DB, cluster into hotspot zones,
        and update the hotspots database table.
        """
        incidents = db.query(Incident).all()
        if not incidents:
            return []

        # Group incidents by issue type
        grouped_by_type = defaultdict(list)
        for inc in incidents:
            grouped_by_type[inc.issue_type].append(inc)

        active_hotspots = []
        cluster_index = 1

        # Clear old active hotspots
        db.query(Hotspot).delete()

        for issue_type, type_incidents in grouped_by_type.items():
            clusters = self.cluster_incidents(type_incidents, eps_meters=eps_meters)

            for cluster in clusters:
                count = len(cluster)
                avg_lat = sum(inc.latitude for inc in cluster) / count
                avg_lon = sum(inc.longitude for inc in cluster) / count
                risk = self.calculate_risk_level(count)
                cluster_code = f"HOTSPOT-{issue_type[:3]}-{cluster_index:03d}"

                hotspot = Hotspot(
                    cluster_code=cluster_code,
                    issue_type=issue_type,
                    centroid=f"POINT({avg_lon} {avg_lat})",
                    latitude=avg_lat,
                    longitude=avg_lon,
                    radius_meters=eps_meters,
                    incident_count=count,
                    risk_level=risk,
                    is_active=True
                )
                db.add(hotspot)
                active_hotspots.append(hotspot)
                cluster_index += 1

        db.commit()
        for h in active_hotspots:
            db.refresh(h)

        logger.info(f"[OK] Generated {len(active_hotspots)} spatial hotspot zones.")
        return active_hotspots

hotspot_service = SpatialHotspotService()
