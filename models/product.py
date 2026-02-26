from sqlalchemy import Column, Integer, String, Numeric, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from database import Base


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
        }