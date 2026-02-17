"""Tests for expense_classifier.py"""
import pytest
from expense_classifier import detect_expense_type, classify_by_emoji


# ─── detect_expense_type ────────────────────────────────────────────────────

class TestDetectExpenseType:
    def test_restaurant_by_keyword(self):
        assert detect_expense_type("Pizza Hut delivery") == "restaurant"

    def test_restaurant_by_food_type(self):
        assert detect_expense_type("Sushi place downtown") == "restaurant"

    def test_grocery_supermarket(self):
        assert detect_expense_type("Mercadona", "weekly shop") == "grocery"

    def test_grocery_carrefour(self):
        assert detect_expense_type("Carrefour Express") == "grocery"

    def test_fuel_gas_station(self):
        assert detect_expense_type("Repsol gasolinera") == "fuel"

    def test_fuel_petrol_keyword(self):
        assert detect_expense_type("BP petrol station") == "fuel"

    def test_transport_uber(self):
        assert detect_expense_type("Uber trip") == "transport"

    def test_transport_metro(self):
        assert detect_expense_type("TMB metro Barcelona") == "transport"

    def test_shopping_zara(self):
        assert detect_expense_type("Zara purchase") == "shopping"

    def test_shopping_decathlon(self):
        assert detect_expense_type("Decathlon store") == "shopping"

    def test_entertainment_cinema(self):
        assert detect_expense_type("Cinema ticket", "Cine Verdi") == "entertainment"

    def test_entertainment_streaming(self):
        assert detect_expense_type("Netflix monthly") == "entertainment"

    def test_health_pharmacy(self):
        assert detect_expense_type("Farmacia Central") == "health"

    def test_health_dentist(self):
        assert detect_expense_type("Dentista appointment") == "health"

    def test_accommodation_hotel(self):
        assert detect_expense_type("Hotel Arts Barcelona") == "accommodation"

    def test_accommodation_airbnb(self):
        assert detect_expense_type("Airbnb reservation") == "accommodation"

    def test_travel_flight(self):
        assert detect_expense_type("Vueling flight BCN-MAD") == "travel"

    def test_travel_ryanair(self):
        # Note: "booking" as a standalone word also matches the accommodation
        # pattern, so avoid it in the title. Use "flight" or "Ryanair" alone.
        assert detect_expense_type("Ryanair flight BCN-DUB") == "travel"

    def test_utilities_telecom(self):
        assert detect_expense_type("Movistar factura") == "utilities"

    def test_utilities_energy(self):
        assert detect_expense_type("Endesa electricidad") == "utilities"

    def test_unknown_returns_none(self):
        assert detect_expense_type("Random thing", "no clue") is None

    def test_empty_strings_return_none(self):
        assert detect_expense_type("", "") is None

    def test_text_parameter_is_optional(self):
        result = detect_expense_type("Starbucks")
        assert result == "restaurant"

    def test_case_insensitive(self):
        assert detect_expense_type("CARREFOUR") == "grocery"

    def test_text_combined_with_title(self):
        # title alone is unknown, but text pushes it to grocery
        assert detect_expense_type("Purchase #42", "supermarket weekly") == "grocery"


# ─── classify_by_emoji ──────────────────────────────────────────────────────

class TestClassifyByEmoji:
    def test_restaurant_emoji(self):
        assert classify_by_emoji("Paid 🍽️ dinner") == "restaurant"

    def test_grocery_emoji(self):
        assert classify_by_emoji("Paid 🛒 Mercadona") == "grocery"

    def test_fuel_emoji(self):
        assert classify_by_emoji("Paid ⛽ fill-up") == "fuel"

    def test_transport_emoji(self):
        assert classify_by_emoji("Paid 🚕 Uber") == "transport"

    def test_shopping_emoji(self):
        assert classify_by_emoji("Paid 🛍️ Zara") == "shopping"

    def test_entertainment_emoji(self):
        assert classify_by_emoji("Paid 🎬 Netflix") == "entertainment"

    def test_health_emoji(self):
        assert classify_by_emoji("Paid 💊 pharmacy") == "health"

    def test_accommodation_emoji(self):
        assert classify_by_emoji("Paid 🏨 hotel") == "accommodation"

    def test_travel_emoji(self):
        assert classify_by_emoji("Paid ✈️ Ryanair") == "travel"

    def test_no_emoji_returns_none(self):
        assert classify_by_emoji("Paid 50 EUR") is None

    def test_empty_string_returns_none(self):
        assert classify_by_emoji("") is None

    def test_none_input_returns_none(self):
        assert classify_by_emoji(None) is None

    def test_unrecognized_emoji_returns_none(self):
        assert classify_by_emoji("Paid 🦄 unicorn store") is None
