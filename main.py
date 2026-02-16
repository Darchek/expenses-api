from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
from psycopg2.extras import Json
import os
import logging
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
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

# Database configuration
PORT = int(os.getenv("PORT", "8000"))
DB_CONFIG = {
    "host": os.getenv("DB_HOST", ""),
    "port": os.getenv("DB_PORT", "5432"),
    "database": os.getenv("DB_NAME", "mydb"),
    "user": os.getenv("DB_USER", ""),
    "password": os.getenv("DB_PASSWORD", "")
}



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
    
    # Log incoming notification package name for debugging
    logger.info(f"Received notification from: {notification.packageName} - Title: {notification.title}")
    
    # Filter out Home Assistant notifications (check exact match and partial)
    if "paid" not in notification.text.lower():
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
        
        # Convert messages and mediaInfo to JSON
        messages_json = None
        if notification.messages:
            messages_json = Json([msg.model_dump() for msg in notification.messages])
        
        media_info_json = None
        if notification.mediaInfo:
            media_info_json = Json(notification.mediaInfo.model_dump())
        
        # Auto-detect expense type if not provided
        expense_type = notification.expenseType
        if not expense_type:
            # Try emoji detection first (faster and more reliable for known patterns)
            expense_type = classify_by_emoji(notification.text or "")
            
            # If emoji detection fails, use pattern matching
            if not expense_type:
                expense_type = detect_expense_type(
                    notification.title or "",
                    notification.text or ""
                )
            
            if expense_type:
                logger.info(f"AUTO-DETECTED expense type: {expense_type} for '{notification.title}'")
            else:
                logger.warning(f"Could not detect expense type for: {notification.title}")
        
        # Insert query - always create new notification
        insert_query = """
            INSERT INTO notifications
            (id, package_name, key, tag, post_time, is_clearable, category, 
             title, text, icon, messages, media_info, latitude, longitude, expense_type, amount, currency)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING serial_id, package_name, created_at;
        """


        notification.get_amount()
        cursor.execute(insert_query, (
            notification.id,
            notification.packageName,
            notification.key,
            notification.tag,
            notification.postTime,
            notification.isClearable,
            notification.category,
            notification.title,
            notification.text,
            notification.icon,
            messages_json,
            media_info_json,
            notification.latitude,
            notification.longitude,
            expense_type,
            notification.amount,
            notification.currency
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
                "package_name": result[1],
                "created_at": result[2].isoformat() if result[2] else None
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
            SELECT serial_id, id, package_name, key, tag, post_time, is_clearable, 
                   category, title, text, messages, media_info, 
                   latitude, longitude, created_at, expense_type, amount, currency
            FROM notifications
            ORDER BY post_time DESC
            LIMIT %s OFFSET %s;
        """
        
        cursor.execute(query, (limit, offset))
        rows = cursor.fetchall()
        
        notifications = []
        for row in rows:
            notifications.append({
                "id": row[0],  # serial_id - unique auto-generated ID
                "notificationId": row[1],  # original Android notification ID
                "packageName": row[2],
                "key": row[3],
                "tag": row[4],
                "postTime": row[5],
                "isClearable": row[6],
                "category": row[7],
                "title": row[8],
                "text": row[9],
                "messages": row[10],
                "mediaInfo": row[11],
                "latitude": row[12],
                "longitude": row[13],
                "createdAt": row[14].isoformat() if row[14] else None,
                "expenseType": row[15],
                "amount": row[16],
                "currency": row[17]
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
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
                SELECT serial_id, \
                       id, \
                       package_name, key, tag, post_time, is_clearable, category, title, text, messages, media_info, latitude, longitude, created_at, expense_type, amount, currency
                FROM notifications
                ORDER BY post_time DESC
                    LIMIT %s \
                OFFSET %s; \
                """

        cursor.execute(query, (limit, offset))
        rows = cursor.fetchall()

        updated = []
        for row in rows:
            serial_id = row[0]
            text = row[9] or ""
            notification = NotificationRequest(
                packageName=row[2], id=row[1], key=row[3],
                tag=row[4], postTime=row[5], isClearable=row[6],
                category=row[7], title=row[8], text=text
            )
            notification.get_amount()
            if notification.amount is not None and notification.amount > 0:
                cursor.execute(
                    "UPDATE notifications SET amount = %s, currency = %s WHERE serial_id = %s",
                    (notification.amount, notification.currency, serial_id)
                )
                updated.append({"serial_id": serial_id, "amount": notification.amount, "currency": notification.currency})

        conn.commit()
        cursor.close()

        return {
            "status": "success",
            "updated_count": len(updated),
            "data": updated
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch notifications: {str(e)}")
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
