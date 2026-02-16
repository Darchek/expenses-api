from pydantic import BaseModel
from typing import Optional, List
import re

class MessageData(BaseModel):
    """Model for notification message data"""
    sender: Optional[str] = None
    text: Optional[str] = None
    timestamp: Optional[int] = None


class MediaInfo(BaseModel):
    """Model for media information"""
    type: Optional[str] = None
    uri: Optional[str] = None
    thumbnail: Optional[str] = None


class NotificationRequest(BaseModel):
    """Model for notification insertion request"""
    packageName: str
    id: int
    key: str
    tag: Optional[str] = None
    postTime: int
    isClearable: bool = True
    category: Optional[str] = None
    title: Optional[str] = None
    text: Optional[str] = None
    icon: Optional[bytes] = None
    messages: Optional[List[MessageData]] = None
    mediaInfo: Optional[MediaInfo] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    expenseType: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None

    def get_amount(self) -> float:
        symbols = r"€|\$|£|¥|₹|元|₽|₪|₩|฿|₫|₱|₭|₮|₦|₼|G|kf|S/|R\$|CHF|kr"
        regex = rf"Paid\s+(?P<symbol>{symbols})\s?(?P<amount>\d{{1,3}}(?:[.,]\d{{3}})*(?:[.,]\d{{2}})?)"
        match = re.search(regex, self.text)
        if match:
            raw = match.group('amount').replace(',', '.')
            self.amount = float(raw)
            self.currency = match.group('symbol')
            return self.amount
        return 0.0