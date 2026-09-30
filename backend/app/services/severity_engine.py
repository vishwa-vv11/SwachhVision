from typing import Dict, Any, Tuple

class SeverityScoringEngine:
    """
    Deterministic, transparent mathematical scoring engine for CivicAI / SwachhVision.
    Combines:
    1. Problem Extent Score (60% weight -> max 60 points)
    2. Location Context Impact Score (40% weight -> max 40 points)
    """

    EXTENT_WEIGHT = 0.60
    LOCATION_WEIGHT = 0.40

    @staticmethod
    def get_severity_tier(score: float) -> Tuple[str, str]:
        """
        Classify 0–100 severity score into standard municipal priority tiers:
        - 0–25:   LOW (Green)
        - 26–50:  MEDIUM (Yellow)
        - 51–75:  HIGH (Orange)
        - 76–100: CRITICAL (Red)
        """
        if score <= 25.0:
            return "LOW", "🟢"
        elif score <= 50.0:
            return "MEDIUM", "🟡"
        elif score <= 75.0:
            return "HIGH", "🟠"
        else:
            return "CRITICAL", "🔴"

    def compute_severity(
        self,
        extent_score: int,
        location_impact_score: int,
        location_reason: str = ""
    ) -> Dict[str, Any]:
        """
        Compute severity score and full transparent formula breakdown.
        """
        # Clamp inputs to 1–5 range (or 0 if clean)
        e_score = max(0, min(5, extent_score))
        l_score = max(1, min(5, location_impact_score))

        # Calculate weighted contributions
        extent_contribution = (e_score / 5.0) * (self.EXTENT_WEIGHT * 100.0)      # max 60.0
        location_contribution = (l_score / 5.0) * (self.LOCATION_WEIGHT * 100.0)  # max 40.0

        total_severity = round(extent_contribution + location_contribution, 1)
        tier, badge = self.get_severity_tier(total_severity)

        return {
            "severity_score": total_severity,
            "severity_tier": tier,
            "badge": badge,
            "extent_score": e_score,
            "extent_contribution": round(extent_contribution, 1),
            "location_impact_score": l_score,
            "location_contribution": round(location_contribution, 1),
            "location_reason": location_reason,
            "formula": f"({e_score}/5 × 60) + ({l_score}/5 × 40) = {extent_contribution:.1f} + {location_contribution:.1f} = {total_severity}"
        }

severity_engine = SeverityScoringEngine()
