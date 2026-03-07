from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Numeric
from sqlalchemy.orm import relationship
from database import Base


class Purchase(Base):
    __tablename__ = "carrefour_purchase"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticket_id = Column("ticketId", String(50), unique=True, nullable=False)
    date = Column(DateTime, nullable=False)
    name = Column(String(255), nullable=False)
    net_amount = Column("netAmount", Numeric(10, 2))
    number_items = Column("numberItems", Integer)
    health_score = Column("healthScore", Numeric(10, 2))

    products = relationship("Product", back_populates="purchase", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "ticketId": self.ticket_id,
            "date": self.date.isoformat() if self.date else None,
            "name": self.name,
            "netAmount": float(str(self.net_amount)) if self.net_amount is not None else None,
            "numberItems": self.number_items,
            "products": [p.to_dict() for p in self.products],
        }

    @classmethod
    def from_api_data(cls, data: dict) -> "Purchase":
        from models.product import Product

        ticket_id = data["ticketId"]
        purchase = cls(
            ticket_id=ticket_id,
            date=datetime.fromisoformat(data["date"]),
            name=data["mall"]["name"],
            net_amount=data["header"]["netAmount"],
            number_items=data["header"]["numberItems"],
        )
        purchase.products = [
            Product(
                ticket_id=ticket_id,
                code=item.get("code"),
                number_units=item.get("numberUnits"),
                vat=item.get("vat"),
                net_amount=item.get("netAmount"),
                sub_family=item.get("subFamily"),
                description=item.get("description"),
                auxiliary_data=item.get("auxiliaryData") or None,
            )
            for item in data.get("items", [])
        ]
        return purchase


