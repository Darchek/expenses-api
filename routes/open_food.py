from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Product
from models.open_food_facts import OpenFoodFacts


router = APIRouter(prefix="/open-food", tags=["open-food"])



@router.get("/product/{code}")
def get_off_by_code(code: str):
    data = OpenFoodFacts().get_product(code)
    return data


@router.get("/list")
def get_off_list(db: Session = Depends(get_db)):
    hs_list = []
    try:
        products = db.query(Product).all()
        for p in products:
            data = OpenFoodFacts().get_product(p.code)
            hs_list.append(data)
        return hs_list
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update expenses: {str(e)}")
