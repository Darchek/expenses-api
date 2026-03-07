import re
from datetime import datetime

from sqlalchemy import and_

from expense_classifier import detect_expense_type, classify_by_emoji
from models import NotificationRequest, Expense
from models.carrefour_client import CarrefourClient
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/expenses", tags=["expenses"])

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


@router.post("")
async def insert_expenses(
    notification: NotificationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Insert a new notification into the database"""

    logger.info(f"Received notification from: {notification.packageName} - Title: {notification.title}")

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

    try:
        category = notification.expenseType
        if not category:
            category = classify_by_emoji(notification.text or "")
            if not category:
                category = detect_expense_type(notification.title or "", notification.text or "")
            if category:
                logger.info(f"AUTO-DETECTED category: {category} for '{notification.title}'")
            else:
                logger.warning(f"Could not detect category for: {notification.title}")

        amount, currency = extract_amount(notification.text or "")
        if amount is None and notification.amount:
            amount, currency = notification.amount, notification.currency

        post_time = datetime.fromtimestamp(notification.postTime / 1000)
        same_item = db.query(Expense).where(and_(Expense.post_time == post_time, Expense.amount == amount)).first()
        if same_item:
            return {
                "status": "success",
                "message": "Notification with same post time and amount already exist",
                "data": {
                    "id": same_item.id,
                    "created_at": same_item.created_at.isoformat() if same_item.created_at else None,
                },
            }

        expense = Expense(
            text=notification.text,
            latitude=notification.latitude,
            longitude=notification.longitude,
            post_time=post_time,
            category=category,
            amount=amount,
            currency=currency,
            shop_name=extract_shop_name(notification.text),
        )

        db.add(expense)
        db.commit()
        db.refresh(expense)

        logger.info(f"INSERTED: Notification saved - {notification.packageName} - {notification.title} - ID: {expense.id}")

        if "carrefour" in (notification.title or "").lower():
            background_tasks.add_task(CarrefourClient.save_last_ticket)

        return {
            "status": "success",
            "message": "Notification inserted successfully",
            "data": {
                "id": expense.id,
                "created_at": expense.created_at.isoformat() if expense.created_at else None,
            },
        }

    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Duplicate notification")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to insert notification: {str(e)}")


@router.get("")
async def get_notifications(limit: int = 100, offset: int = 0, db: Session = Depends(get_db)):
    """Get all notifications with pagination"""
    try:
        expenses = (
            db.query(Expense)
            .order_by(Expense.post_time.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        return {
            "status": "success",
            "count": len(expenses),
            "data": [
                {
                    "id": e.id,
                    "text": e.text,
                    "latitude": e.latitude,
                    "longitude": e.longitude,
                    "postTime": e.post_time.isoformat() if e.post_time else None,
                    "category": e.category,
                    "amount": float(e.amount) if e.amount is not None else None,
                    "currency": e.currency,
                    "shopName": e.shop_name,
                    "createdAt": e.created_at.isoformat() if e.created_at else None,
                }
                for e in expenses
            ],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch notifications: {str(e)}")


@router.put("")
async def update_notifications(limit: int = 100, offset: int = 0, db: Session = Depends(get_db)):
    """Re-calculate and update amount/currency for existing rows"""
    try:
        expenses = (
            db.query(Expense)
            .order_by(Expense.post_time.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        updated = []
        for expense in expenses:
            amount, currency = extract_amount(expense.text or "")
            if amount is not None and amount > 0:
                expense.amount = amount
                expense.currency = currency
                updated.append({"id": expense.id, "amount": amount, "currency": currency})

        db.commit()

        return {
            "status": "success",
            "updated_count": len(updated),
            "data": updated,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update expenses: {str(e)}")


@router.post("/test/insert")
async def test_insert_carrefour_ticket(
    background_tasks: BackgroundTasks,
):
    background_tasks.add_task(CarrefourClient.save_last_ticket)
    return "OK"