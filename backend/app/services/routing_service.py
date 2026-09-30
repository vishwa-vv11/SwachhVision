import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models.department import Department
from app.models.incident import Incident

logger = logging.getLogger("civicai.routing_service")

class DepartmentRoutingService:
    """
    Intelligent municipal routing engine that assigns civic issues to the appropriate authority
    based on AI issue classification and spatial jurisdiction.
    """

    ROUTING_MAP = {
        "GARBAGE_ACCUMULATION": "GARBAGE",
        "SEWAGE_OVERFLOW": "SEWAGE",
    }

    def determine_department(
        self,
        db: Session,
        issue_type: str,
        latitude: float,
        longitude: float
    ) -> Optional[Department]:
        """
        Determine responsible department for an incident.
        """
        category = self.ROUTING_MAP.get(issue_type, "GENERAL")
        
        # Primary lookup: Department matching the issue category
        dept = db.query(Department).filter(Department.category == category).first()
        
        # Fallback to general municipal authority if specific category not found
        if not dept:
            dept = db.query(Department).filter(Department.category == "GENERAL").first()
            
        return dept

routing_service = DepartmentRoutingService()
