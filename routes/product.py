from fastapi import APIRouter, Depends
from sqlalchemy import and_
from sqlalchemy.orm import Session
from database import get_db
from models import Product


router = APIRouter(prefix="/product", tags=["product"])



@router.get("/{code}")
def get_off_by_code(code: str, db: Session = Depends(get_db)):
    item = db.query(Product).where(and_(Product.code == code)).first()
    return item.to_dict()


@router.get("/category/list")
def get_category_by_list(db: Session = Depends(get_db)):
    products = db.query(Product).where(and_(Product.category.is_(None))).all()
    for idx, p in enumerate(products):
        p.get_category()
    return "OK"

@router.get("/category/{code}")
def get_category_by_code(code: str, db: Session = Depends(get_db)):
    item = db.query(Product).where(and_(Product.code == code)).first()
    if item.category:
        return item
    return item.get_category()