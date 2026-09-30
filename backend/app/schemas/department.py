from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DepartmentBase(BaseModel):
    name: str
    category: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentOut(DepartmentBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
