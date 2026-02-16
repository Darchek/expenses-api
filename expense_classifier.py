"""
Expense Type Classifier
Automatically detects expense type based on merchant name, text, and patterns
"""

import re
from typing import Optional

# Keywords for each expense type
EXPENSE_PATTERNS = {
    "restaurant": [
        # General restaurant terms
        r"\b(restaurant|cafe|bar|pub|bistro|grill|diner|tavern|eatery)\b",
        # Types of food establishments
        r"\b(pizz|burger|sushi|ramen|kebab|taco|noodle|wok|thai|indian|chinese|italian)\b",
        r"\b(mcdonald|burger king|kfc|subway|starbucks|domino|pizza hut)\b",
        # Food emojis
        r"🍽️|🍕|🍔|🍜|🍱|🍝|🍣|🥘|🥗|🌮|🌯|🥙|🍞|🥐|🧀|🍖|🍗|🥩",
    ],
    
    "grocery": [
        # Supermarket terms
        r"\b(supermarket|grocery|supermercado|mercado|market|mini market)\b",
        r"\b(carrefour|mercadona|lidl|aldi|dia|bonarea|bon area|eroski|consum)\b",
        r"\b(alimentacion|alimentació)\b",
        # Grocery emoji
        r"🛒",
    ],
    
    "fuel": [
        # Gas station terms
        r"\b(gas station|gasolinera|benzinera|petrol|fuel|diesel|gasolina)\b",
        r"\b(repsol|cepsa|bp|shell|galp|esso)\b",
        r"\b(charging|supercharger|tesla)\b",
        # Fuel emojis
        r"⛽|🚗|🚙",
    ],
    
    "transport": [
        # Transport services
        r"\b(uber|cabify|taxi|bolt|lyft|metro|bus|train|tren|renfe|tmb)\b",
        r"\b(parking|aparcament|aparcamiento|toll|peaje|autopista)\b",
        r"\b(bicing|scooter|lime|voi)\b",
        # Transport emojis
        r"🚕|🚌|🚇|🚂|🚎|🚃|🚋|🛴",
    ],
    
    "shopping": [
        # Retail stores
        r"\b(shop|store|tienda|botiga|mall|centro comercial)\b",
        r"\b(zara|h&m|mango|pull&bear|nike|adidas|decathlon)\b",
        r"\b(fnac|media markt|pcbox|el corte ingles)\b",
        r"\b(ikea|leroy merlin|bricomart)\b",
        # Shopping emojis
        r"🛍️|👕|👗|👟|📱|💻",
    ],
    
    "entertainment": [
        # Entertainment venues
        r"\b(cinema|cine|theater|teatre|concert|festival|discoteca|club)\b",
        r"\b(spotify|netflix|hbo|disney|amazon prime|youtube premium)\b",
        r"\b(gym|gimnasio|fitness|sport)\b",
        # Entertainment emojis
        r"🎬|🎭|🎪|🎨|🎮|🎵|🎸|🎤|🏋️",
    ],
    
    "health": [
        # Medical and health
        r"\b(farmacia|pharmacy|hospital|clinica|doctor|dentist|dentista)\b",
        r"\b(optica|optician|parafarmacia)\b",
        # Health emojis
        r"💊|💉|🏥|⚕️|🩺",
    ],
    
    "accommodation": [
        # Hotels and lodging
        r"\b(hotel|hostel|airbnb|booking|hostal|motel|resort)\b",
        r"\b(inn|lodge|aparthotel)\b",
        # Accommodation emojis
        r"🏨|🏩|🛏️|🏠",
    ],
    
    "travel": [
        # Travel bookings
        r"\b(vueling|ryanair|iberia|easyjet|flight|vuelo)\b",
        r"\b(blablacar|ouibus|flixbus)\b",
        r"\b(booking\.com|expedia|trivago|lastminute)\b",
        # Travel emojis
        r"✈️|🛫|🛬|🌍|🗺️|🧳",
    ],
    
    "services": [
        # Professional services
        r"\b(lawyer|abogado|notary|notario|gestor|accountant)\b",
        r"\b(repair|reparacion|taller|mechanic|peluqueria|hairdresser)\b",
        r"\b(cleaning|limpieza|lavanderia|laundry)\b",
        # Service emojis
        r"🔧|🔨|✂️|💇",
    ],
    
    "utilities": [
        # Bills and utilities
        r"\b(vodafone|movistar|orange|yoigo|telef[oó]nica|tim)\b",
        r"\b(internet|wifi|electric|electricidad|agua|water|gas)\b",
        r"\b(endesa|iberdrola|naturgy)\b",
        # Utility emojis
        r"📱|📞|💡|💧",
    ],
    
    "subscription": [
        # Recurring subscriptions
        r"\b(subscription|suscripci[oó]n|monthly|mensual|premium)\b",
        r"\b(patreon|onlyfans|twitch)\b",
        # Already covered by entertainment for streaming
    ],
}


def detect_expense_type(title: str, text: str = None) -> Optional[str]:
    """
    Detect expense type based on merchant name and transaction text
    
    Args:
        title: Merchant/transaction title
        text: Transaction description text
        
    Returns:
        expense_type string or None if cannot be determined
    """
    # Combine title and text for analysis
    content = (title or "").lower()
    if text:
        content += " " + text.lower()
    
    # Track matches per category
    matches = {}
    
    for expense_type, patterns in EXPENSE_PATTERNS.items():
        match_count = 0
        for pattern in patterns:
            if re.search(pattern, content, re.IGNORECASE):
                match_count += 1
        
        if match_count > 0:
            matches[expense_type] = match_count
    
    # Return the category with most matches
    if matches:
        return max(matches, key=matches.get)
    
    # Default to None if no clear match
    return None


def classify_by_emoji(text: str) -> Optional[str]:
    """
    Quick classification based on emoji presence
    
    Args:
        text: Transaction text
        
    Returns:
        expense_type or None
    """
    if not text:
        return None
    
    # Direct emoji mapping
    emoji_map = {
        "🍽️": "restaurant",
        "🛒": "grocery",
        "⛽": "fuel",
        "🚕": "transport",
        "🛍️": "shopping",
        "🎬": "entertainment",
        "💊": "health",
        "🏨": "accommodation",
        "✈️": "travel",
    }
    
    for emoji, expense_type in emoji_map.items():
        if emoji in text:
            return expense_type
    
    return None
