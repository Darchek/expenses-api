import json
import os

from google.genai import types
from google.genai.errors import ClientError
from sqlalchemy import Column, Integer, String, Numeric, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from database import Base
from google import genai
from prompts import product_categories
import logging

logger = logging.getLogger(__name__)


class Product(Base):
    __tablename__ = "carrefour_item"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticket_id = Column("ticketId", String(50), ForeignKey("carrefour_purchase.ticketId"), nullable=False)
    code = Column(String(50))
    number_units = Column("numberUnits", Integer)
    vat = Column(Numeric(5, 2))
    net_amount = Column("netAmount", Numeric(10, 2))
    sub_family = Column("subFamily", String(20))
    description = Column(Text)
    auxiliary_data = Column("auxiliaryData", JSONB)
    category = Column(String(50))
    health_score = relationship("HealthScore", lazy="joined", uselist=False)

    purchase = relationship("Purchase", back_populates="products")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "ticketId": self.ticket_id,
            "code": self.code,
            "numberUnits": self.number_units,
            "vat": float(str(self.vat)) if self.vat is not None else None,
            "netAmount": float(str(self.net_amount)) if self.net_amount is not None else None,
            "subFamily": self.sub_family,
            "description": self.description,
            "auxiliaryData": self.auxiliary_data,
            "healthScore": self.health_score.to_dict() if self.health_score else None,
            "category": self.category
        }

    def get_category(self):
        if self.category:
            return True
        try:
            client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
            response = client.models.generate_content(
                model="gemini-3.1-flash-lite-preview",
                config=types.GenerateContentConfig(
                    system_instruction=product_categories.SYSTEM_PROMPT,
                    response_mime_type="application/json"  # forces JSON output
                ),
                contents=product_categories.USER_PROMPT.format(PRODUCT_JSON=self.to_dict())
            )
            result = json.loads(response.text)
            self.category = result["category"]
            self.update()
            return True
        except ClientError as cex:
            logger.error(f"Client error when fetching gemini API: {cex}")
            return False

    def update(self):
        from database import SessionLocal
        try:
            db = SessionLocal()
            try:
                db.merge(self)
                db.commit()
            except Exception:
                db.rollback()
                raise
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Product update failed: {e}")