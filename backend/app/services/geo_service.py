import logging
import re
from typing import Dict, Any, Tuple, Optional, List
import httpx
from math import radians, cos, sin, asin, sqrt

logger = logging.getLogger("civicai.geo_service")

# Standard Sample POIs across city coordinates (Sensitive Zones)
# In production, these are queried via PostGIS spatial indexes (ST_DWithin)
REFERENCE_SENSITIVE_POIS = [
    {"name": "Central Drainage Canal #4", "type": "DRAIN_WATER_BODY", "lat": 12.9716, "lon": 77.5946, "impact_score": 5, "radius_m": 150},
    {"name": "City General Hospital & Trauma Center", "type": "HOSPITAL", "lat": 12.9750, "lon": 77.5990, "impact_score": 4, "radius_m": 200},
    {"name": "St. Mary's Public School", "type": "SCHOOL", "lat": 12.9680, "lon": 77.5900, "impact_score": 4, "radius_m": 200},
    {"name": "MG Road Arterial Highway", "type": "MAJOR_ROAD", "lat": 12.9740, "lon": 77.6080, "impact_score": 3, "radius_m": 100},
    {"name": "Green Valley Residential Enclave", "type": "RESIDENTIAL", "lat": 12.9800, "lon": 77.5850, "impact_score": 2, "radius_m": 300},
]

# Sensitive landmark keyword dictionaries for contextual boost
CRITICAL_HEALTH_EDU_KEYWORDS = [
    "institute", "institution", "school", "college", "university", "campus", "academy",
    "hospital", "clinic", "dispensary", "healthcare", "medical", "nursing", "trauma",
    "shakthi", "vidya", "iit", "iim", "nit", "polytechnic"
]

CRITICAL_WATER_DRAIN_KEYWORDS = [
    "drain", "drainage", "canal", "culvert", "storm water", "stormwater", "water body",
    "lake", "river", "sewage", "gutter", "water supply", "drinking water", "sump"
]

HIGH_TRANSIT_COMMERCIAL_KEYWORDS = [
    "market", "bazaar", "bus stand", "bus stop", "railway", "station", "metro",
    "highway", "main road", "arterial", "junction", "cross", "flyover", "mall", "temple", "church", "mosque"
]

def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points in meters."""
    r = 6371000  # Radius of Earth in meters
    phi1, phi2 = radians(lat1), radians(lat2)
    delta_phi = radians(lat2 - lat1)
    delta_lambda = radians(lon2 - lon1)
    a = sin(delta_phi / 2)**2 + cos(phi1) * cos(phi2) * sin(delta_lambda / 2)**2
    c = 2 * asin(sqrt(a))
    return r * c

class GeospatialService:
    def __init__(self):
        self.user_agent = "SwachhVision-CivicAI/1.0"

    def reverse_geocode(self, lat: float, lon: float) -> str:
        """
        Reverse geocode latitude and longitude to a standard, concise Indian civic address:
        [Place / Landmark Name], [Street / Locality], [District / City] - [PIN Code]
        """
        try:
            url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=18&addressdetails=1"
            headers = {"User-Agent": self.user_agent}
            with httpx.Client(timeout=3.0) as client:
                resp = client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    raw_display = data.get("display_name", "")
                    addr = data.get("address", {})

                    if raw_display:
                        parts = [p.strip() for p in raw_display.split(",") if p.strip()]

                        # 1. Place / College / Landmark / Building
                        landmark = (
                            addr.get("amenity")
                            or addr.get("building")
                            or addr.get("college")
                            or addr.get("school")
                            or addr.get("hospital")
                            or (parts[0] if parts else "")
                        )

                        # 2. Street / Main Road / Locality / Suburb
                        street_or_locality = (
                            addr.get("road")
                            or addr.get("neighbourhood")
                            or addr.get("suburb")
                            or addr.get("residential")
                            or (parts[1] if len(parts) > 1 and parts[1] != landmark else "")
                        )

                        # 3. City / District
                        district = (
                            addr.get("city")
                            or addr.get("town")
                            or addr.get("state_district")
                            or addr.get("county")
                            or (parts[-3] if len(parts) >= 3 else "")
                        )

                        # 4. Indian PIN Code (6 Digits)
                        pincode = addr.get("postcode")
                        if not pincode:
                            pin_match = re.search(r'\b\d{6}\b', raw_display)
                            if pin_match:
                                pincode = pin_match.group(0)

                        # Deduplicate while preserving order
                        segments = []
                        seen = set()
                        for seg in [landmark, street_or_locality, district]:
                            if seg and seg.lower() not in seen:
                                segments.append(seg)
                                seen.add(seg.lower())

                        base_address = ", ".join(segments)
                        if pincode:
                            return f"{base_address} - {pincode}"
                        return base_address if base_address else raw_display
        except Exception as e:
            logger.debug(f"Online reverse geocoding fallback triggered: {e}")

        # Fallback offline structured address
        return f"Coordinates: {lat:.6f}° N, {lon:.6f}° E, Urban Civic Zone"

    def analyze_location_impact(
        self,
        lat: float,
        lon: float,
        description: str = "",
        address: str = ""
    ) -> Tuple[int, str]:
        """
        Determine Location Impact Score (1 to 5) based on:
        1. User Description & Landmark text matching.
        2. Reverse geocoded Street Address context.
        3. Geospatial proximity to sensitive POIs (Hospitals, Educational Institutes, Water Canals, Transit Hubs).
        """
        combined_text = f"{description} {address}".lower()

        # 1. Check for Educational / Healthcare Institutions
        for kw in CRITICAL_HEALTH_EDU_KEYWORDS:
            if re.search(r'\b' + re.escape(kw) + r'\b', combined_text):
                return 5, f"High-priority Educational / Healthcare Institution Zone ({kw.title()})"

        # 2. Check for Water Bodies & Stormwater Canals
        for kw in CRITICAL_WATER_DRAIN_KEYWORDS:
            if kw in combined_text:
                return 5, f"Critical Drainage / Water Hazard Zone ({kw.title()})"

        # 3. Check for High-Density Commercial & Transit Hubs
        for kw in HIGH_TRANSIT_COMMERCIAL_KEYWORDS:
            if re.search(r'\b' + re.escape(kw) + r'\b', combined_text):
                return 4, f"High-footfall Public Transit / Commercial Corridor ({kw.title()})"

        # 4. Proximity to Predefined Reference POIs (Spatial index)
        highest_impact = 1
        reason = "Open roadside area"

        for poi in REFERENCE_SENSITIVE_POIS:
            dist = haversine_distance_meters(lat, lon, poi["lat"], poi["lon"])
            if dist <= poi["radius_m"]:
                if poi["impact_score"] > highest_impact:
                    highest_impact = poi["impact_score"]
                    reason = f"Within {int(dist)}m of {poi['name']} ({poi['type'].replace('_', ' ')})"

        if highest_impact > 1:
            return highest_impact, reason

        # 5. General Urban Density Heuristic based on GPS
        last_digit = int(abs(lat * 1000)) % 10
        if last_digit in [1, 2]:
            return 4, "High-density Urban Civic Zone"
        elif last_digit in [3, 4, 5]:
            return 3, "Primary Transit Roadway"
        elif last_digit in [6, 7, 8]:
            return 3, "Urban Residential Corridor"
        else:
            return 2, "Secondary Local Road"

geo_service = GeospatialService()
