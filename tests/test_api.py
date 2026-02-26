"""Tests for FastAPI endpoints in main.py"""
from datetime import datetime
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from main import app
from database import get_db

client = TestClient(app)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _override_db(db):
    """Return a FastAPI dependency override that yields the given mock session."""
    def _override():
        yield db
    return _override


# ─── Fixtures ───────────────────────────────────────────────────────────────

VALID_NOTIFICATION = {
    "packageName": "com.bank.app",
    "id": 1,
    "key": "key-1",
    "postTime": 1700000000000,
    "isClearable": True,
    "title": "Payment confirmed",
    "text": "Paid €25.00 at Mercadona 🛒",
}


# ─── GET / ───────────────────────────────────────────────────────────────────

class TestRoot:
    def test_root_returns_ok(self):
        response = client.get("/")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_root_message_present(self):
        response = client.get("/")
        assert "message" in response.json()


# ─── GET /health ─────────────────────────────────────────────────────────────

class TestHealth:
    def test_health_connected(self):
        mock_db = MagicMock()
        app.dependency_overrides[get_db] = _override_db(mock_db)
        try:
            response = client.get("/health")
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"

    def test_health_disconnected(self):
        mock_db = MagicMock()
        mock_db.execute.side_effect = Exception("connection refused")
        app.dependency_overrides[get_db] = _override_db(mock_db)
        try:
            response = client.get("/health")
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "unhealthy"
        assert "disconnected" in data["database"]


# ─── POST /expenses ──────────────────────────────────────────────────────

class TestPostNotification:
    def _make_insert_db(self, expense_id=42):
        """Return a mock session that simulates a successful insert."""
        mock_db = MagicMock()

        def _refresh(obj):
            obj.id = expense_id
            obj.created_at = datetime(2024, 1, 1)

        mock_db.refresh.side_effect = _refresh
        return mock_db

    def test_filtered_when_not_paid(self):
        """Notifications without 'paid' in text should be filtered."""
        payload = {**VALID_NOTIFICATION, "text": "New message from John"}
        response = client.post("/expenses", json=payload)
        assert response.status_code == 200
        assert response.json()["status"] == "filtered"

    def test_filtered_wallet_package(self):
        """Wallet package expenses should be filtered even if text contains 'paid'."""
        payload = {
            **VALID_NOTIFICATION,
            "packageName": "com.wallet.app",
            "text": "Paid €10.00 something",
        }
        response = client.post("/expenses", json=payload)
        assert response.status_code == 200
        assert response.json()["status"] == "filtered"

    def test_successful_insert(self):
        """Valid paid expenses should be inserted and return success."""
        mock_db = self._make_insert_db(42)
        app.dependency_overrides[get_db] = _override_db(mock_db)
        try:
            response = client.post("/expenses", json=VALID_NOTIFICATION)
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["data"]["id"] == 42

    def test_db_error_returns_500(self):
        """DB failure during insert should return 500."""
        mock_db = MagicMock()
        mock_db.add.side_effect = Exception("db down")
        app.dependency_overrides[get_db] = _override_db(mock_db)
        try:
            response = client.post("/expenses", json=VALID_NOTIFICATION)
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 500

    def test_missing_required_field_returns_422(self):
        """Omitting required fields should return validation error."""
        response = client.post("/expenses", json={"packageName": "com.test"})
        assert response.status_code == 422

    def test_auto_detects_expense_type(self):
        """Expense type should be auto-detected when not provided."""
        mock_db = self._make_insert_db(1)
        app.dependency_overrides[get_db] = _override_db(mock_db)
        payload = {**VALID_NOTIFICATION, "text": "Paid €12.00 at Mercadona 🛒"}
        try:
            response = client.post("/expenses", json=payload)
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 200
        assert mock_db.add.called

    def test_case_insensitive_paid_filter(self):
        """'PAID' in uppercase should also pass the filter."""
        mock_db = self._make_insert_db(2)
        app.dependency_overrides[get_db] = _override_db(mock_db)
        payload = {**VALID_NOTIFICATION, "text": "PAID €5.00 coffee"}
        try:
            response = client.post("/expenses", json=payload)
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 200
        assert response.json()["status"] == "success"


# ─── GET /expenses ────────────────────────────────────────────────────

class TestGetNotifications:
    def _make_expense(self, id=1):
        e = MagicMock()
        e.id = id
        e.text = "Paid €10.00 at Shop"
        e.latitude = 41.38
        e.longitude = 2.17
        e.post_time = datetime(2024, 1, 1)
        e.category = "grocery"
        e.amount = 10.0
        e.currency = "€"
        e.shop_name = "Shop"
        e.created_at = datetime(2024, 1, 1)
        return e

    def _make_query_db(self, expenses):
        mock_db = MagicMock()
        (
            mock_db.query.return_value
            .order_by.return_value
            .offset.return_value
            .limit.return_value
            .all.return_value
        ) = expenses
        return mock_db

    def test_get_notifications_success(self):
        expenses = [self._make_expense(1), self._make_expense(2)]
        mock_db = self._make_query_db(expenses)
        app.dependency_overrides[get_db] = _override_db(mock_db)
        try:
            response = client.get("/expenses")
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["count"] == 2
        assert len(data["data"]) == 2

    def test_get_notifications_empty(self):
        mock_db = self._make_query_db([])
        app.dependency_overrides[get_db] = _override_db(mock_db)
        try:
            response = client.get("/expenses")
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 200
        assert response.json()["count"] == 0

    def test_get_notifications_pagination_params(self):
        mock_db = self._make_query_db([])
        app.dependency_overrides[get_db] = _override_db(mock_db)
        try:
            response = client.get("/expenses?limit=10&offset=5")
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 200
        mock_db.query.return_value.order_by.return_value.offset.assert_called_once_with(5)
        mock_db.query.return_value.order_by.return_value.offset.return_value.limit.assert_called_once_with(10)

    def test_get_notifications_db_error(self):
        mock_db = MagicMock()
        mock_db.query.side_effect = Exception("db down")
        app.dependency_overrides[get_db] = _override_db(mock_db)
        try:
            response = client.get("/expenses")
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 500