from sqlalchemy import Column, Integer, String, Float, JSON
from database import Base


class HealthScore(Base):
    __tablename__ = "health_scores"

    barcode = Column(String, index=True, primary_key=True)
    product_name = Column(String)
    brand = Column(String)
    category = Column(String)
    score = Column(Integer)
    label = Column(String)

    # Nutriscore / NOVA
    nutriscore_grade = Column(String, default="?")
    nutriscore_points = Column(Integer, default=0)
    nova_group = Column(Integer, default=0)
    nova_label = Column(String, default="?")
    nova_points = Column(Integer, default=0)

    # Nutrients
    proteins_g = Column(Float, default=0.0)
    proteins_points = Column(Integer, default=0)
    fiber_g = Column(Float, default=0.0)
    fiber_points = Column(Integer, default=0)
    sugars_g = Column(Float, default=0.0)
    saturated_fat_g = Column(Float, default=0.0)
    salt_g = Column(Float, default=0.0)

    # Additives & penalties
    additives_n = Column(Integer, default=0)
    penalty_sugars = Column(Float, default=0.0)
    penalty_sat_fat = Column(Float, default=0.0)
    penalty_salt = Column(Float, default=0.0)
    penalty_additives = Column(Float, default=0.0)
    total_penalty = Column(Float, default=0.0)

    # Micronutrients
    vitamins = Column(JSON, default=list)
    minerals = Column(JSON, default=list)
    micronutrient_points = Column(Integer, default=0)