import logging
from pathlib import Path
from typing import Dict, Any, Tuple
from PIL import Image
from app.services.cv_service import cv_service

logger = logging.getLogger("civicai.verification_service")

class VerificationResult:
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"
    REOPENED = "REOPENED"

class VerificationService:
    """
    AI Closed-Loop Verification Engine.
    Examines field worker submitted 'AFTER' resolution photos using YOLO segmentation
    to confirm whether the reported civic hazard has been completely eradicated.
    """

    def __init__(self, confidence_threshold: float = 0.25, max_acceptable_residual_extent: float = 5.0):
        self.confidence_threshold = confidence_threshold
        self.max_acceptable_residual_extent = max_acceptable_residual_extent

    def verify_resolution(
        self,
        before_image_path: str,
        after_image_path: str,
        expected_issue_type: str = "GARBAGE_ACCUMULATION"
    ) -> Dict[str, Any]:
        """
        Runs CV segmentation on the AFTER image and assesses cleanup completeness.
        
        Returns:
            Dict containing:
            - is_verified: bool
            - verification_status: 'VERIFIED' or 'REOPENED'
            - residual_extent_percentage: float
            - residual_extent_score: int (1-5 or 0)
            - confidence: float
            - notes: str
        """
        logger.info(f"Running AI Verification on AFTER image: {after_image_path}")

        # Run CV segmentation on AFTER photo
        cv_result = cv_service.analyze_image_file(after_image_path)

        detected_issue = cv_result.get("primary_issue")
        confidence = cv_result.get("confidence", 0.0)
        residual_extent_pct = cv_result.get("extent_percentage", 0.0)
        residual_extent_score = cv_result.get("extent_score", 0)
        detected = cv_result.get("detected", False)

        # Verification Logic:
        # A site is considered VERIFIED if:
        # 1. No issue class was detected (detected is False or detected_issue is 'NONE' or confidence < threshold), OR
        # 2. Residual extent percentage is below the negligible threshold (e.g. <= 5.0%)
        is_clean = (
            not detected or
            detected_issue in (None, "NONE") or
            confidence < self.confidence_threshold or
            residual_extent_pct <= self.max_acceptable_residual_extent
        )

        if is_clean:
            status = VerificationResult.VERIFIED
            notes = (
                f"[AI VERIFICATION PASSED] Clean area confirmed. "
                f"Residual hazard extent: {residual_extent_pct:.1f}% (below tolerance limit). "
                f"Ticket eligible for final closure."
            )
            logger.info(f"[OK] Verification SUCCESS for {after_image_path}")
        else:
            status = VerificationResult.REOPENED
            notes = (
                f"[AI VERIFICATION FAILED] Residual {detected_issue.replace('_', ' ').title()} detected "
                f"with {residual_extent_pct:.1f}% visible coverage (Score: {residual_extent_score}/5, Confidence: {confidence*100:.1f}%). "
                f"Ticket automatically REOPENED for re-dispatch."
            )
            logger.warning(f"[FAIL] Verification REJECTED for {after_image_path}")

        return {
            "is_verified": is_clean,
            "verification_status": status,
            "residual_extent_percentage": round(residual_extent_pct, 2),
            "residual_extent_score": residual_extent_score,
            "confidence": round(confidence, 3),
            "annotated_after_image_url": cv_result.get("annotated_image_url"),
            "notes": notes
        }

# Global singleton
verification_service = VerificationService()
