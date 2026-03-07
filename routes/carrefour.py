from datetime import datetime
from fastapi import HTTPException
from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_
from sqlalchemy.orm import Session

from models import Product
from models.carrefour_client import CarrefourClient
from models.open_food_facts import OpenFoodFacts
from models.purchase import Purchase
from database import get_db

router = APIRouter(prefix="/carrefour", tags=["carrefour"])



@router.get("/purchases")
def get_purchases(
    from_date: str = Query(default="2024-01-01T00:00:00.000Z", alias="from"),
    to_date: str = Query(default="2026-12-31T23:59:59.000Z", alias="to"),
    count: int = Query(default=10),
    db: Session = Depends(get_db),
):
    """Get purchases from the database filtered by date range."""
    from_dt = datetime.fromisoformat(from_date.replace("Z", ""))
    to_dt = datetime.fromisoformat(to_date.replace("Z", ""))

    purchases = (
        db.query(Purchase)
        .filter(Purchase.date >= from_dt, Purchase.date <= to_dt)
        .order_by(Purchase.date.desc())
        .limit(count)
        .all()
    )

    return {
        "count": len(purchases),
        "data": [p.to_dict() for p in purchases]
    }

@router.get("/products")
def get_products(
    db: Session = Depends(get_db),
):
    products = db.query(Product).all()
    return {
        "count": len(products),
        "data": [p.to_dict() for p in products]
    }

@router.get("/last")
def get_last_purchases(
    db: Session = Depends(get_db),
):
    purchase = db.query(Purchase).limit(1).first()
    return purchase.to_dict()

@router.get("/purchase/{purchase_id}")
def get_purchase(purchase_id: str, db: Session = Depends(get_db)):
    """Fetch a specific ticket by ID."""
    purchase = db.query(Purchase).filter(and_(Purchase.ticket_id == purchase_id)).first()
    if not purchase:
        raise HTTPException(status_code=404, detail=f"Purchase with ID {purchase_id} not found")
    return purchase.to_dict()

@router.post("/purchase/{purchase_id}/save")
def save_purchase(purchase_id: str, db: Session = Depends(get_db)):
    cc = CarrefourClient()
    purchase = cc.get_purchase(purchase_id)
    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    return purchase.to_dict()



# Carrefour website

def get_client() -> CarrefourClient:
    return CarrefourClient()

@router.get("/web/purchases")
def get_web_purchases(
    from_date: str = Query(default="2024-01-01T00:00:00.000Z", alias="from"),
    to_date: str = Query(default="2026-12-31T23:59:59.000Z", alias="to"),
    count: int = Query(default=10),
):
    """Fetch purchase history."""
    return get_client().get_purchases(from_date, to_date, count)


@router.get("/web/last")
def get_last_web_purchase():
    """Fetch the most recent ticket."""
    purchase = get_client().get_last_purchase()
    return purchase.to_dict()


@router.get("/web/purchase/{purchase_id}")
def get_web_purchase(purchase_id: str):
    """Fetch a specific ticket by ID."""
    purchase = get_client().get_purchase(purchase_id)
    return purchase.to_dict()


@router.get("/web/search")
def search_product(
    query: str = Query(..., description="Product ID or search term"),
    store: str = Query(default="004015"),
    page: int = Query(default=1),
):
    """Search products by ID or name."""
    results = CarrefourClient().search_product(query, store, page)
    return {"query": query, "count": len(results), "results": results}

@router.get("/purchase/score/{ticket_id}")
def purchase_mean_health_score(
    ticket_id: str,
    db: Session = Depends(get_db)
):
    purchase = db.query(Purchase).where(and_(Purchase.ticket_id == ticket_id)).first()
    score = 0
    count = 0
    for p in purchase.products:
        off_item = OpenFoodFacts().get_product(p.code)
        if off_item:
            score += off_item.total_score
            count += 1
    purchase.health_score = score / count
    db.merge(purchase)
    db.commit()
    return purchase
    return {"query": query, "count": len(results), "results": results}