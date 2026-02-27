import requests
import logging

from sqlalchemy import select, and_
from sqlalchemy.exc import IntegrityError
from database import SessionLocal
from models.health_score import HealthScore

logger = logging.getLogger(__name__)

class OpenFoodFacts:
    URL = "https://world.openfoodfacts.net/api/v2/product"
    NUTRISCORE_POINTS = {"a": 25, "b": 20, "c": 12, "d": 5, "e": 0}
    NOVA_POINTS = {1: 20, 2: 14, 3: 7, 4: 0}

    NOVA_LABELS = {
        1: "Unprocessed / minimally processed",
        2: "Processed culinary ingredients",
        3: "Processed foods",
        4: "Ultra-processed foods",
    }

    SCORE_LABELS = [
        (80, "Excellent"),
        (65, "Good"),
        (45, "Acceptable"),
        (25, "Not recommended"),
        (0, "Avoid"),
    ]

    def fetch_product(
        self,
        product_code
    ) -> dict:
        response = requests.get(
            f"{self.URL}/{product_code}"
        )
        response.raise_for_status()
        return response.json()

    def get_product(self, code) -> HealthScore | None:
        try:
            health_score = self.get(code)
            if health_score:
                return health_score
            data = self.fetch_product(code)
            hs = self.get_product_health_score(data, code)
            if hs:
                self.save(hs)
            return hs
        except requests.RequestException as e:
            return None

    def _get_best_product_name(self, p: dict) -> str:
        """Return the most complete product name available."""
        candidates = [
            p.get("product_name_en"),
            p.get("product_name_fr"),
            p.get("product_name_es"),
            p.get("product_name"),
            p.get("abbreviated_product_name"),
            p.get("generic_name_en"),
            p.get("generic_name"),
        ]
        name = next((c for c in candidates if c and c.strip()), "Unknown product")

        # Append quantity if available (e.g. "Bocados Originales 200g")
        quantity = p.get("quantity", "").strip()
        if quantity and quantity not in name:
            name = f"{name} ({quantity})"

        return name

    def _get_category(self, p: dict) -> str:
        """Return the most human-readable category available."""
        # Prefer English PNNS groups (standardised food groups)
        pnns2 = p.get("pnns_groups_2", "")
        if pnns2 and pnns2 != "unknown":
            return pnns2.replace("-", " ").title()

        pnns1 = p.get("pnns_groups_1", "")
        if pnns1 and pnns1 != "unknown":
            return pnns1.replace("-", " ").title()

        # Fall back to categories string
        cats = p.get("categories", "")
        if cats:
            # Take the last (most specific) category, strip language prefix
            parts = [c.strip() for c in cats.split(",")]
            last = parts[-1]
            if ":" in last:
                last = last.split(":", 1)[1]
            return last.replace("-", " ").title()

        return "Uncategorised"

    def _score_label(self, score: float) -> str:
        for threshold, label in self.SCORE_LABELS:
            if score >= threshold:
                return label
        return "Avoid"

    def _calculate_score(self, p: dict) -> HealthScore | None:
        hs = HealthScore()
        nutriments = p.get("nutriments", {})
        hs.score = 0.0

        # ── Block 1: Nutriscore (0–25 pts) ──────────
        grade = p.get("nutriscore_grade", "").lower()
        hs.nutriscore_grade = grade.upper() if grade else "?"
        hs.nutriscore_points = self.NUTRISCORE_POINTS.get(grade, 12)
        hs.score += hs.nutriscore_points

        # ── Block 2: NOVA group / processing (0–20 pts) ──
        nova = p.get("nova_group")
        if isinstance(nova, (int, float)):
            nova = int(nova)
        hs.nova_group = nova or 0
        hs.nova_label = self.NOVA_LABELS.get(nova, "Unknown")
        hs.nova_points = self.NOVA_POINTS.get(nova, 10)
        hs.score += hs.nova_points

        # ── Block 3: Protein (0–20 pts) ─────────────
        proteins = float(nutriments.get("proteins_100g") or 0)
        hs.proteins_g = proteins
        if proteins >= 20:
            hs.proteins_points = 20
        elif proteins >= 15:
            hs.proteins_points = 16
        elif proteins >= 10:
            hs.proteins_points = 12
        elif proteins >= 5:
            hs.proteins_points = 7
        elif proteins >= 2:
            hs.proteins_points = 3
        else:
            hs.proteins_points = 0
        hs.score += hs.proteins_points

        # ── Block 4: Fiber (0–10 pts) ────────────────
        fiber = float(
            nutriments.get("fiber_100g")
            or nutriments.get("fibers_100g")
            or 0
        )
        hs.fiber_g = fiber
        if fiber >= 6:
            hs.fiber_points = 10
        elif fiber >= 4:
            hs.fiber_points = 8
        elif fiber >= 2:
            hs.fiber_points = 5
        elif fiber >= 1:
            hs.fiber_points = 2
        else:
            hs.fiber_points = 0
        hs.score += hs.fiber_points

        # ── Block 5: Penalties (max −25 pts) ─────────
        sugars = float(nutriments.get("sugars_100g") or 0)
        sat_fat = float(nutriments.get("saturated-fat_100g") or 0)
        salt = float(nutriments.get("salt_100g") or 0)
        additives = int(p.get("additives_n") or 0)

        hs.sugars_g = sugars
        hs.saturated_fat_g = sat_fat
        hs.salt_g = salt
        hs.additives_n = additives

        if sugars >= 20:
            hs.penalty_sugars = 12
        elif sugars >= 12:
            hs.penalty_sugars = 8
        elif sugars >= 6:
            hs.penalty_sugars = 4
        elif sugars >= 3:
            hs.penalty_sugars = 2
        else:
            hs.penalty_sugars = 0

        if sat_fat >= 10:
            hs.penalty_sat_fat = 8
        elif sat_fat >= 5:
            hs.penalty_sat_fat = 5
        elif sat_fat >= 2:
            hs.penalty_sat_fat = 2
        else:
            hs.penalty_sat_fat = 0

        if salt >= 2.5:
            hs.penalty_salt = 5
        elif salt >= 1.5:
            hs.penalty_salt = 3
        elif salt >= 1.0:
            hs.penalty_salt = 1
        else:
            hs.penalty_salt = 0

        hs.penalty_additives = min(additives * 1.5, 8)

        raw_penalty = (
                hs.penalty_sugars
                + hs.penalty_sat_fat
                + hs.penalty_salt
                + hs.penalty_additives
        )
        hs.total_penalty = min(raw_penalty, 25)
        hs.score -= hs.total_penalty

        # ── Block 6: Micronutrients bonus (0–5 pts) ──
        vitamins = p.get("vitamins_tags", [])
        minerals = p.get("minerals_tags", [])
        hs.vitamins = [v.replace("en:", "") for v in vitamins]
        hs.minerals = [m.replace("en:", "") for m in minerals]
        hs.micronutrient_points = min(len(vitamins) + len(minerals), 5)
        hs.score += hs.micronutrient_points
        hs.label = self._score_label(hs.score)
        return hs

    def get_product_health_score(self, data: dict, code: str) -> HealthScore | None:
        if data.get("status") != 1:
            return None

        p = data["product"]
        hs = self._calculate_score(p)
        hs.barcode = code
        hs.product_name = self._get_best_product_name(p)
        hs.brand = p.get("brands", "Unknown brand")
        hs.category = self._get_category(p)
        return hs

    def get(self, code):
        db = SessionLocal()
        try:
            stmt = select(HealthScore).where(and_(HealthScore.barcode == code))
            return db.execute(stmt).scalars().first()
        except Exception as e:
            logger.error(f"Failed to get health score for barcode {code}. Error: {e}")
            return None
        finally:
            db.close()

    def save(self, hs):
        db = SessionLocal()
        try:
            db.add(hs)
            db.commit()
            logger.info(f"Saved health score of {hs.score} for product {hs.product_name}")
        except IntegrityError as e:
            db.rollback()
            if "duplicate key" in str(e.orig):
                logger.debug(f"Health score for product {hs.product_name} already exists, skipping.")
            else:
                logger.error(f"Integrity error for product {hs.product_name}. Error: {e}")
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save health score of product {hs.product_name}. Error: {e}")
        finally:
            db.close()
        return hs