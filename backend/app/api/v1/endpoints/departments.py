from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.department import Department
from app.schemas.department import DepartmentOut, DepartmentCreate

router = APIRouter()

@router.get("/", response_model=List[DepartmentOut])
def get_departments(db: Session = Depends(get_db)):
    return db.query(Department).all()

@router.post("/", response_model=DepartmentOut, status_code=201)
def create_department(dept_in: DepartmentCreate, db: Session = Depends(get_db)):
    existing = db.query(Department).filter(Department.name == dept_in.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Department already exists.")
    dept = Department(**dept_in.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept
