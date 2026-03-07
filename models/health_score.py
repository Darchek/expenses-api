import dataclasses
from dataclasses import dataclass
from typing import Optional
from sqlalchemy import Boolean, Column, Float, Integer, JSON, String, ForeignKey
from database import Base


# ─────────────────────────────────────────────────────────────────────────────
# Additive risk database  (EFSA · ANSES · IARC · independent studies)
# ─────────────────────────────────────────────────────────────────────────────

ADDITIVE_RISK: dict[str, str] = {
    # ── High-risk ─────────────────────────────────────────────────────────────
    "en:e102":  "high",   # Tartrazine
    "en:e104":  "high",   # Quinoline Yellow
    "en:e110":  "high",   # Sunset Yellow FCF
    "en:e122":  "high",   # Azorubine / Carmoisine
    "en:e123":  "high",   # Amaranth
    "en:e124":  "high",   # Ponceau 4R
    "en:e129":  "high",   # Allura Red AC
    "en:e131":  "high",   # Patent Blue V
    "en:e133":  "high",   # Brilliant Blue FCF
    "en:e150d": "high",   # Caramel IV (sulfite-ammonia process)
    "en:e211":  "high",   # Sodium benzoate
    "en:e212":  "high",   # Potassium benzoate
    "en:e213":  "high",   # Calcium benzoate
    "en:e216":  "high",   # Propyl p-hydroxybenzoate
    "en:e220":  "high",   # Sulphur dioxide
    "en:e221":  "high",   # Sodium sulphite
    "en:e222":  "high",   # Sodium bisulphite
    "en:e223":  "high",   # Sodium metabisulphite
    "en:e224":  "high",   # Potassium metabisulphite
    "en:e171":  "high",   # Titanium dioxide
    "en:e173":  "high",   # Aluminium
    "en:e621":  "high",   # Monosodium glutamate (MSG)
    "en:e951":  "high",   # Aspartame
    "en:e950":  "high",   # Acesulfame K
    "en:e955":  "high",   # Sucralose
    "en:e961":  "high",   # Neotame
    "en:e962":  "high",   # Aspartame-acesulfame salt
    # ── Moderate-risk ─────────────────────────────────────────────────────────
    "en:e249":  "moderate",  # Potassium nitrite
    "en:e250":  "moderate",  # Sodium nitrite
    "en:e251":  "moderate",  # Sodium nitrate
    "en:e252":  "moderate",  # Potassium nitrate
    "en:e310":  "moderate",  # Propyl gallate
    "en:e311":  "moderate",  # Octyl gallate
    "en:e312":  "moderate",  # Dodecyl gallate
    "en:e320":  "moderate",  # BHA
    "en:e321":  "moderate",  # BHT
    "en:e338":  "moderate",  # Phosphoric acid
    "en:e407":  "moderate",  # Carrageenan
    "en:e412":  "moderate",  # Guar gum
    "en:e415":  "moderate",  # Xanthan gum
    "en:e421":  "moderate",  # Mannitol
    "en:e450":  "moderate",  # Diphosphates
    "en:e451":  "moderate",  # Triphosphates
    "en:e452":  "moderate",  # Polyphosphates
    "en:e471":  "moderate",  # Mono/diglycerides of fatty acids
    "en:e472e": "moderate",  # DATEM
    "en:e481":  "moderate",  # Sodium stearoyl-2-lactylate
    "en:e482":  "moderate",  # Calcium stearoyl-2-lactylate
    "en:e500":  "moderate",  # Sodium carbonates
    "en:e635":  "moderate",  # Disodium ribonucleotides
    # ── Limited-risk ──────────────────────────────────────────────────────────
    "en:e100":  "limited",   # Curcumin
    "en:e160a": "limited",   # Beta-carotene
    "en:e160b": "limited",   # Annatto
    "en:e200":  "limited",   # Sorbic acid
    "en:e202":  "limited",   # Potassium sorbate
    "en:e270":  "limited",   # Lactic acid
    "en:e296":  "limited",   # Malic acid
    "en:e322":  "limited",   # Lecithins
    "en:e322i": "limited",   # Sunflower lecithin
    "en:e330":  "limited",   # Citric acid
    "en:e331":  "limited",   # Sodium citrates
    "en:e332":  "limited",   # Potassium citrates
    "en:e333":  "limited",   # Calcium citrates
    "en:e422":  "limited",   # Glycerol
    "en:e440":  "limited",   # Pectins
    "en:e460":  "limited",   # Cellulose
    "en:e461":  "limited",   # Methyl cellulose
    "en:e466":  "limited",   # Carboxymethyl cellulose
    "en:e492":  "limited",   # Sorbitan tristearate
    "en:e570":  "limited",   # Fatty acids
    "en:e627":  "limited",   # Disodium guanylate
    "en:e631":  "limited",   # Disodium inosinate
}

RISK_PENALTY: dict[str, float] = {
    "high":      25,
    "moderate":  10,
    "limited":    3,
    "risk-free":  0,
}

RISK_LABEL: dict[str, str] = {
    "high":      "🔴 High-risk",
    "moderate":  "🟠 Moderate risk",
    "limited":   "🟡 Limited risk",
    "risk-free": "🟢 Risk-free",
}

# NOVA ultra-processing cap on the additives sub-score
NOVA_ADD_CAP: dict[int, float] = {1: 100, 2: 100, 3: 70, 4: 40}

_BEVERAGE_KEYWORDS = {
    "beverages", "drinks", "juices", "sodas", "waters", "smoothies",
    "milks", "plant-based-milk", "energy-drinks", "sports-drinks",
    "nectars", "fruit-juices", "vegetable-juices",
    "en:beverages", "en:juices", "en:fruit-juices", "es:te"
}

_DRY_INFUSION_KEYWORDS = {
    "teas", "herbal-teas", "infusions", "green-teas", "black-teas",
    "white-teas", "oolong-teas", "rooibos", "mate", "chamomile",
    "instant-teas", "tea-bags", "loose-leaf-teas",
    "en:teas", "en:herbal-teas", "en:green-teas", "en:black-teas",
    "en:infusions", "es:te"
}

_BREW_DILUTION = 2 / 200  # = 0.01


# ─────────────────────────────────────────────────────────────────────────────
# Data classes
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class AdditiveResult:
    code: str
    name: str
    risk: str


@dataclass
class NutrientDetail:
    name: str
    value: str        # formatted string
    unit: str
    score: float      # 0-100 component score
    label: str        # human-readable quality label
    is_positive: bool # True → Positives section, False → Negatives section


# ─────────────────────────────────────────────────────────────────────────────
# ORM model
# ─────────────────────────────────────────────────────────────────────────────

class HealthScore(Base):
    __tablename__ = "health_scores"

    barcode           = Column(String, ForeignKey("carrefour_item.code"), primary_key=True, index=True)
    product_name      = Column(String)
    brand             = Column(String)
    is_beverage       = Column(Boolean, default=False)
    nova_group        = Column(Integer, nullable=True)
    nutriscore_grade  = Column(String, nullable=True)
    nutriscore_points = Column(Float, default=0.0)
    nutrient_details  = Column(JSON, default=list)   # list[dict] — see NutrientDetail
    additives         = Column(JSON, default=list)   # list[dict] — see AdditiveResult
    additives_points  = Column(Float, default=0.0)
    is_organic        = Column(Boolean, default=False)
    organic_points    = Column(Float, default=0.0)
    total_score       = Column(Float, default=0.0)
    rating            = Column(String, default="")
    image_url         = Column(String, default="")

    def to_dict(self) -> dict:
        return {
            "barcode": self.barcode,
            "product_name": self.product_name,
            "brand": self.brand,
            "is_beverage": self.is_beverage,
            "nova_group": self.nova_group,
            "nutriscore_grade": self.nutriscore_grade,
            "nutriscore_points": self.nutriscore_points,
            "nutrient_details": self.nutrient_details,
            "additives": self.additives,
            "additives_points": self.additives_points,
            "is_organic": self.is_organic,
            "organic_points": self.organic_points,
            "total_score": self.total_score,
            "rating": self.rating,
            "image_url": self.image_url
        }


# ─────────────────────────────────────────────────────────────────────────────
# Per-nutrient scoring functions
# ─────────────────────────────────────────────────────────────────────────────

def _score_energy(kcal: float, is_beverage: bool) -> float:
    """Lower is better. Beverages use stricter thresholds."""
    if is_beverage:
        if kcal <= 20: return 100
        if kcal <= 35: return 65
        if kcal <= 50: return 35
        if kcal <= 70: return 15
        return 0
    else:
        if kcal <= 80:  return 100
        if kcal <= 160: return 75
        if kcal <= 270: return 50
        if kcal <= 400: return 25
        return 0


def _score_sugar(g: float, is_beverage: bool, fruit_pct: float = 0) -> float:
    """
    Lower is better.
    For beverages, natural sugars from declared fruit content receive
    a 50 % discount before applying the threshold scale.
    """
    if is_beverage:
        discount  = min(fruit_pct / 100.0, 1.0) * 0.50
        effective = g * (1.0 - discount)
        if effective <= 1: return 100
        if effective <= 3: return 70
        if effective <= 5: return 45
        if effective <= 8: return 20
        return 0
    else:
        if g <= 5:    return 100
        if g <= 12:   return 70
        if g <= 22.5: return 35
        if g <= 30:   return 15
        if g <= 45:   return 5
        return 0


def _score_satfat(g: float) -> float:
    """Lower is better."""
    if g <= 1:   return 100
    if g <= 2.5: return 75
    if g <= 5:   return 50
    if g <= 10:  return 20
    return 0


def _score_salt(g: float) -> float:
    """Lower is better."""
    if g <= 0.3:  return 100
    if g <= 0.75: return 75
    if g <= 1.5:  return 50
    if g <= 2.3:  return 20
    return 0


def _score_fibre(g: float) -> float:
    """Higher is better."""
    if g >= 5:   return 100
    if g >= 3:   return 75
    if g >= 1.5: return 50
    if g >= 0.5: return 25
    return 0


def _score_protein(g: float) -> float:
    """Higher is better."""
    if g >= 8:   return 100
    if g >= 5:   return 75
    if g >= 2.5: return 50
    if g >= 1:   return 25
    return 0


def _score_fruits(pct: float, is_beverage: bool) -> float:
    """Higher is better. Beverages are capped at 80 (no whole-fruit fibre bonus)."""
    cap = 80 if is_beverage else 100
    if pct >= 80: return cap
    if pct >= 60: return int(cap * 0.75)
    if pct >= 40: return int(cap * 0.50)
    if pct >= 20: return int(cap * 0.25)
    return 0


def _nutrient_label(score: float, is_positive: bool) -> str:
    if is_positive:
        if score >= 80: return "Excellent"
        if score >= 50: return "Good"
        if score >= 25: return "Moderate"
        return "Low"
    else:
        if score >= 80: return "None / very low"
        if score >= 50: return "Moderate"
        if score >= 20: return "High"
        return "Very high"


# ─────────────────────────────────────────────────────────────────────────────
# Composite nutrition sub-score  (0-100)
# ─────────────────────────────────────────────────────────────────────────────

def _nutrition_score(
    energy_kcal: Optional[float],
    sugar:       Optional[float],
    sat_fat:     Optional[float],
    salt:        Optional[float],
    fibre:       Optional[float],
    protein:     Optional[float],
    fruits_pct:  Optional[float],
    is_beverage: bool,
    is_dry_infusion: bool = False
) -> tuple[float, list[NutrientDetail]]:
    """
    Returns (nutrition_score_0-100, nutrient_details).

    Negative component (bad things → lower score):
      Beverages : sugar 50% · energy 30% · sat_fat 12% · salt 8%
      Solid food: sugar 30% · energy 25% · sat_fat 25% · salt 20%

    Positive component (good things → raise score):
      protein 50% · fruits/veg/nuts 35% · fibre 15%

    Final: neg×60% + pos×40%
    """
    fp   = fruits_pct or 0.0
    e_s  = _score_energy(energy_kcal or 0, is_beverage)
    su_s = _score_sugar(sugar or 0,        is_beverage, fp)
    sf_s = _score_satfat(sat_fat or 0)
    sa_s = _score_salt(salt or 0)
    fi_s = _score_fibre(fibre or 0)
    pr_s = _score_protein(protein or 0)
    fr_s = _score_fruits(fp, is_beverage)

    if is_beverage:
        neg = su_s * 0.50 + e_s * 0.30 + sf_s * 0.12 + sa_s * 0.08
    else:
        neg = su_s * 0.30 + e_s * 0.25 + sf_s * 0.25 + sa_s * 0.20

    pos = pr_s * 0.50 + fr_s * 0.35 + fi_s * 0.15
    nutrition = round(neg * 0.60 + pos * 0.40, 1)

    details: list[NutrientDetail] = []

    def _add(name, value, unit, score, is_pos):
        details.append(NutrientDetail(
            name=name,
            value=f"{value:.1f}" if value is not None else "?",
            unit=unit,
            score=score,
            label=_nutrient_label(score, is_pos),
            is_positive=is_pos,
        ))

    _add("Energy",        energy_kcal, "kcal", e_s,  e_s  >= 50)
    _add("Sugar",         sugar,       "g",    su_s, su_s >= 50)
    _add("Saturated fat", sat_fat,     "g",    sf_s, sf_s >= 80)
    _add("Salt",          salt,        "g",    sa_s, sa_s >= 80)
    _add("Protein",       protein,     "g",    pr_s, True)
    _add("Fibre",         fibre,       "g",    fi_s, True)
    if fp > 0:
        _add("Fruits / veg / nuts", fp, "%", fr_s, True)

    if is_dry_infusion:
        return 100.0, details

    return nutrition, details


# ─────────────────────────────────────────────────────────────────────────────
# Additives helpers
# ─────────────────────────────────────────────────────────────────────────────

def _raw_additives_score(additives: list[AdditiveResult]) -> float:
    """Start at 100, subtract penalty for each additive found."""
    penalty = sum(RISK_PENALTY.get(a.risk, 0) for a in additives)
    return max(0.0, 100.0 - penalty)


def _parse_additives(product: dict) -> list[AdditiveResult]:
    results, seen = [], set()
    for tag in product.get("additives_tags", []):
        tag = tag.lower()
        if tag in seen:
            continue
        seen.add(tag)
        risk     = ADDITIVE_RISK.get(tag, "risk-free")
        readable = tag.replace("en:", "").upper()
        results.append(AdditiveResult(code=tag, name=readable, risk=risk))
    order = {"high": 0, "moderate": 1, "limited": 2, "risk-free": 3}
    results.sort(key=lambda a: order.get(a.risk, 4))
    return results


# ─────────────────────────────────────────────────────────────────────────────
# Product detection helpers
# ─────────────────────────────────────────────────────────────────────────────

def _detect_dry_infusion(product: dict) -> bool:
    tags = product.get("categories_tags", [])
    tags.extend([f"es:{k}" for k in product.get('_keywords', [])])
    categories = " ".join(tags).lower()
    return any(k in categories for k in _DRY_INFUSION_KEYWORDS)


def _detect_beverage(product: dict) -> bool:
    if _detect_dry_infusion(product):
        return False
    tags = product.get("categories_tags", [])
    tags.extend([f"es:{k}" for k in product.get('_keywords', [])])
    categories = " ".join(tags).lower()
    if any(k in categories for k in _BEVERAGE_KEYWORDS):
        return True
    return product.get("nutrition_data_per", "100g") == "100ml"


def _is_organic(product: dict) -> bool:
    labels = " ".join(product.get("labels_tags", [])).lower()
    return any(k in labels for k in ("organic", "en:organic", "bio",
                                      "ecologic", "ecológico", "ab-agriculture-biologique"))


def _get_float(product: dict, *keys: str) -> Optional[float]:
    nutriments = product.get("nutriments", {})
    for key in keys:
        v = nutriments.get(key)
        if v is not None:
            try:
                return float(v)
            except (TypeError, ValueError):
                pass
    return None


def _fruits_pct(product: dict) -> Optional[float]:
    nutriments = product.get("nutriments", {})
    for key in (
        "fruits-vegetables-nuts_100g",
        "fruits-vegetables-nuts-estimate_100g",
        "fruits-vegetables-nuts-estimate-from-ingredients_100g",
    ):
        v = nutriments.get(key)
        if v is not None:
            try:
                return float(v)
            except (TypeError, ValueError):
                pass
    return None


def _rating(score: float) -> str:
    if score >= 75: return "Excellent"
    if score >= 50: return "Good"
    if score >= 25: return "Poor"
    return "Bad"


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def score_product(product: dict) -> HealthScore:
    """Score a product dict (from Open Food Facts) and return a HealthScore ORM instance."""
    is_dry_infusion = _detect_dry_infusion(product)
    is_beverage     = _detect_beverage(product)
    nova_group      = product.get("nova_group")
    try:
        nova_group = int(nova_group) if nova_group is not None else None
    except (TypeError, ValueError):
        nova_group = None

    energy = _get_float(product, "energy-kcal_100g")
    if energy is None:
        kj = _get_float(product, "energy_100g")
        energy = round(kj / 4.184, 1) if kj else None

    sugar   = _get_float(product, "sugars_100g")
    sat_fat = _get_float(product, "saturated-fat_100g")
    salt    = _get_float(product, "salt_100g")
    if salt is None:
        sodium = _get_float(product, "sodium_100g")
        salt   = round(sodium * 2.5, 3) if sodium is not None else None
    fibre   = _get_float(product, "fiber_100g", "fibers_100g")
    protein = _get_float(product, "proteins_100g", "protein_100g")
    fruits  = _fruits_pct(product)
    nutriscore_grade = (product.get("nutriscore_grade") or product.get("nutrition_grade_fr"))

    score_as_beverage = is_beverage
    if is_dry_infusion:
        d = _BREW_DILUTION
        energy  = round((energy  or 0) * d, 2)
        sugar   = round((sugar   or 0) * d, 4)
        sat_fat = round((sat_fat or 0) * d, 4)
        salt    = round((salt    or 0) * d, 4)
        fibre   = None
        protein = None
        fruits  = None
        score_as_beverage = True
        nutriscore_grade = 'a' if nutriscore_grade == 'unknown' else nutriscore_grade

    ns_pts, nutrient_details = _nutrition_score(
        energy, sugar, sat_fat, salt, fibre, protein, fruits, score_as_beverage, is_dry_infusion
    )

    additives    = _parse_additives(product)
    raw_add_pts  = _raw_additives_score(additives)
    nova_cap     = NOVA_ADD_CAP.get(nova_group, 100) if nova_group else 100
    add_pts      = raw_add_pts if is_dry_infusion else min(raw_add_pts, nova_cap)

    is_organic = _is_organic(product)
    org_pts    = 100.0 if is_organic else 0.0

    total = round(ns_pts * 0.60 + add_pts * 0.30 + org_pts * 0.10, 1)

    return HealthScore(
        barcode           = product.get("_id"),
        product_name      = product.get("product_name", "Unknown"),
        brand             = product.get("brands", "Unknown"),
        is_beverage       = is_beverage or is_dry_infusion,
        nova_group        = nova_group,
        nutriscore_grade  = nutriscore_grade,
        nutriscore_points = ns_pts,
        nutrient_details  = [dataclasses.asdict(d) for d in nutrient_details],
        additives         = [dataclasses.asdict(a) for a in additives],
        additives_points  = add_pts,
        is_organic        = is_organic,
        organic_points    = org_pts,
        total_score       = total,
        rating            = _rating(total),
        image_url         = product.get("image_front_url", ""),
    )