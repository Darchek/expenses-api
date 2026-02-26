from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
import re
import os
import logging
from datetime import datetime
from dotenv import load_dotenv
from expense_classifier import detect_expense_type, classify_by_emoji
from models import NotificationRequest

load_dotenv(".env.local")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Notifications API", version="1.0.0")

# Configure CORS to allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database configuration
PORT = int(os.getenv("PORT", "8000"))
DB_CONFIG = {
    "host": os.getenv("DB_HOST", ""),
    "port": os.getenv("DB_PORT", "5432"),
    "database": os.getenv("DB_NAME", "expenses"),
    "user": os.getenv("DB_USER", ""),
    "password": os.getenv("DB_PASSWORD", "")
}

# Amount/currency extraction regex (shared)
AMOUNT_SYMBOLS = r"€|\$|£|¥|₹|元|₽|₪|₩|฿|₫|₱|₭|₮|₦|₼|G|kf|S/|R\$|CHF|kr"
AMOUNT_REGEX = rf"Paid\s+(?P<symbol>{AMOUNT_SYMBOLS})\s?(?P<amount>\d{{1,3}}(?:[.,]\d{{3}})*(?:[.,]\d{{2}})?)"


def extract_amount(text: str):
    """Extract (amount, currency) from notification text. Returns (None, None) if not found."""
    match = re.search(AMOUNT_REGEX, text)
    if match:
        raw = match.group('amount').replace(',', '.')
        return float(raw), match.group('symbol')
    return None, None


def extract_shop_name(text: str):
    """Extract shop name from notification text."""
    if not text:
        return None
    match = re.search(r' at (.+?)[\n\r]', text)
    return match.group(1).strip() if match else None


def get_db_connection():
    """Create a database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "Notifications API is running"}


@app.get("/health")
async def health():
    """Health check with database connectivity"""
    try:
        conn = get_db_connection()
        conn.close()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": f"disconnected: {str(e)}"}


@app.post("/notifications")
async def insert_notification(notification: NotificationRequest):
    """Insert a new notification into the database"""

    logger.info(f"Received notification from: {notification.packageName} - Title: {notification.title}")

    # Filter: only process payment notifications
    if "paid" not in (notification.text or "").lower():
        logger.warning(f"FILTERED: Not Paid notification blocked - {notification.packageName} - {notification.title}")
        return {
            "status": "filtered",
            "message": "Notification not about paying ignored (filtered)",
            "package_name": notification.packageName
        }

    if "wallet" in notification.packageName.lower():
        logger.warning(f"FILTERED: Wallet notification blocked - {notification.packageName} - {notification.title}")
        return {
            "status": "filtered",
            "message": "Notification with wallet package ignored (filtered)",
            "package_name": notification.packageName
        }

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Detect category (expense type)
        category = notification.expenseType
        if not category:
            category = classify_by_emoji(notification.text or "")
            if not category:
                category = detect_expense_type(
                    notification.title or "",
                    notification.text or ""
                )
            if category:
                logger.info(f"AUTO-DETECTED category: {category} for '{notification.title}'")
            else:
                logger.warning(f"Could not detect category for: {notification.title}")

        # Extract amount and currency
        amount, currency = extract_amount(notification.text or "")
        if amount is None and notification.amount:
            amount, currency = notification.amount, notification.currency

        # Extract shop name from text
        shop_name = extract_shop_name(notification.text)

        # Convert postTime (ms epoch) to datetime
        post_time = datetime.fromtimestamp(notification.postTime / 1000)

        insert_query = """
            INSERT INTO expenses (text, latitude, longitude, post_time, category, amount, currency, shop_name)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, created_at;
        """

        cursor.execute(insert_query, (
            notification.text,
            notification.latitude,
            notification.longitude,
            post_time,
            category,
            amount,
            currency,
            shop_name
        ))

        result = cursor.fetchone()
        conn.commit()
        cursor.close()

        logger.info(f"INSERTED: Notification saved - {notification.packageName} - {notification.title} - ID: {result[0]}")

        return {
            "status": "success",
            "message": "Notification inserted successfully",
            "data": {
                "id": result[0],
                "created_at": result[1].isoformat() if result[1] else None
            }
        }

    except psycopg2.IntegrityError as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=409, detail=f"Duplicate notification: {str(e)}")
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to insert notification: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.get("/notifications")
async def get_notifications(limit: int = 100, offset: int = 0):
    """Get all notifications with pagination"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
            SELECT id, text, latitude, longitude, post_time, category, amount, currency, shop_name, created_at
            FROM expenses
            ORDER BY post_time DESC
            LIMIT %s OFFSET %s;
        """

        cursor.execute(query, (limit, offset))
        rows = cursor.fetchall()

        notifications = []
        for row in rows:
            notifications.append({
                "id": row[0],
                "text": row[1],
                "latitude": row[2],
                "longitude": row[3],
                "postTime": row[4].isoformat() if row[4] else None,
                "category": row[5],
                "amount": row[6],
                "currency": row[7],
                "shopName": row[8],
                "createdAt": row[9].isoformat() if row[9] else None,
            })

        cursor.close()

        return {
            "status": "success",
            "count": len(notifications),
            "data": notifications
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch notifications: {str(e)}")
    finally:
        if conn:
            conn.close()


@app.put("/notifications")
async def update_notifications(limit: int = 100, offset: int = 0):
    """Re-calculate and update amount/currency for existing rows"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
            SELECT id, text
            FROM expenses
            ORDER BY post_time DESC
            LIMIT %s OFFSET %s;
        """

        cursor.execute(query, (limit, offset))
        rows = cursor.fetchall()

        updated = []
        for row in rows:
            row_id = row[0]
            text = row[1] or ""
            amount, currency = extract_amount(text)
            if amount is not None and amount > 0:
                cursor.execute(
                    "UPDATE expenses SET amount = %s, currency = %s WHERE id = %s",
                    (amount, currency, row_id)
                )
                updated.append({"id": row_id, "amount": amount, "currency": currency})

        conn.commit()
        cursor.close()

        return {
            "status": "success",
            "updated_count": len(updated),
            "data": updated
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update expenses: {str(e)}")
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
