from fastapi import APIRouter
from models.open_food_facts import OpenFoodFacts


router = APIRouter(prefix="/open-food", tags=["open-food"])



@router.get("/product/{code}")
def get_purchases(code: str):

    data = OpenFoodFacts().get_product(code)
    return data