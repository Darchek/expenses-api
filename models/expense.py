from sqlalchemy import Column, Integer, String, Float, DateTime, Numeric
from sqlalchemy.sql import func
from database import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    text = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    post_time = Column(DateTime)
    category = Column(String)
    amount = Column(Numeric(10, 2))
    currency = Column(String)
    shop_name = Column(String)
    created_at = Column(DateTime, server_default=func.now())