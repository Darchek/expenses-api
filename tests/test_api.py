"""Tests for FastAPI endpoints in main.py"""
import sys
import types
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Stub psycopg2 before importing the app (it's not installable in the local venv)
class _FakeIntegrityError(Exception):
    """Distinct stub so it doesn't swallow generic exceptions."""


_psycopg2_stub = types.ModuleType("psycopg2")
_psycopg2_stub.connect = MagicMock()
_psycopg2_stub.extras = types.ModuleType("psycopg2.extras")
_psycopg2_stub.extras.Json = lambda x: x  # simple passthrough
_psycopg2_stub.IntegrityError = _FakeIntegrityError
sys.modules.setdefault("psycopg2", _psycopg2_stub)
sys.modules.setdefault("psycopg2.extras", _psycopg2_stub.extras)

from main import app  # noqa: E402

client = TestClient(app)


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
        mock_conn = MagicMock()
        with patch("psycopg2.connect", return_value=mock_conn):
            response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"

    def test_health_disconnected(self):
        with patch("psycopg2.connect", side_effect=Exception("connection refused")):
            response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "unhealthy"
        assert "disconnected" in data["database"]


# ─── POST /notifications ──────────────────────────────────────────────────────

class TestPostNotification:
    def test_filtered_when_not_paid(self):
        """Notifications without 'paid' in text should be filtered."""
        payload = {**VALID_NOTIFICATION, "text": "New message from John"}
        response = client.post("/notifications", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "filtered"

    def test_filtered_wallet_package(self):
        """Wallet package notifications should be filtered even if text contains 'paid'."""
        payload = {
            **VALID_NOTIFICATION,
            "packageName": "com.wallet.app",
            "text": "Paid €10.00 something",
        }
        response = client.post("/notifications", json=payload)
        assert response.status_code == 200
        assert response.json()["status"] == "filtered"

    def test_successful_insert(self):
        """Valid paid notification should be inserted and return success."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = (42, "com.bank.app", None)

        with patch("psycopg2.connect", return_value=mock_conn):
            response = client.post("/notifications", json=VALID_NOTIFICATION)

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["data"]["id"] == 42

    def test_db_error_returns_500(self):
        """DB failure during insert should return 500."""
        with patch("main.get_db_connection", side_effect=Exception("db down")):
            response = client.post("/notifications", json=VALID_NOTIFICATION)
        assert response.status_code == 500

    def test_missing_required_field_returns_422(self):
        """Omitting required fields should return validation error."""
        response = client.post("/notifications", json={"packageName": "com.test"})
        assert response.status_code == 422

    def test_auto_detects_expense_type(self):
        """Expense type should be auto-detected when not provided."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = (1, "com.bank.app", None)

        payload = {**VALID_NOTIFICATION, "text": "Paid €12.00 at Mercadona 🛒"}
        with patch("psycopg2.connect", return_value=mock_conn):
            response = client.post("/notifications", json=payload)

        assert response.status_code == 200
        # Verify cursor.execute was called (i.e., the insert happened)
        assert mock_cursor.execute.called

    def test_case_insensitive_paid_filter(self):
        """'PAID' in uppercase should also pass the filter."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = (2, "com.bank.app", None)

        payload = {**VALID_NOTIFICATION, "text": "PAID €5.00 coffee"}
        with patch("psycopg2.connect", return_value=mock_conn):
            response = client.post("/notifications", json=payload)

        assert response.status_code == 200
        assert response.json()["status"] == "success"


# ─── GET /notifications ────────────────────────────────────────────────────

class TestGetNotifications:
    def _make_row(self, serial_id=1):
        from datetime import datetime
        return (
            serial_id, "notif-id-1", "com.bank.app", "key", "tag",
            1700000000000, True, "payment", "Payment", "Paid €10.00",
            None, None, 41.38, 2.17, datetime(2024, 1, 1), "grocery", 10.0, "€"
        )

    def test_get_notifications_success(self):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchall.return_value = [self._make_row(1), self._make_row(2)]

        with patch("psycopg2.connect", return_value=mock_conn):
            response = client.get("/notifications")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["count"] == 2
        assert len(data["data"]) == 2

    def test_get_notifications_empty(self):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchall.return_value = []

        with patch("psycopg2.connect", return_value=mock_conn):
            response = client.get("/notifications")

        assert response.status_code == 200
        assert response.json()["count"] == 0

    def test_get_notifications_pagination_params(self):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchall.return_value = []

        with patch("psycopg2.connect", return_value=mock_conn):
            response = client.get("/notifications?limit=10&offset=5")

        assert response.status_code == 200
        # Check the query was called with the right params
        call_args = mock_cursor.execute.call_args
        assert call_args[0][1] == (10, 5)

    def test_get_notifications_db_error(self):
        with patch("psycopg2.connect", side_effect=Exception("db down")):
            response = client.get("/notifications")
        assert response.status_code == 500
