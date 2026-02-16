# Notifications API

FastAPI application to store and retrieve Android notifications in PostgreSQL.

## 🚀 Deployed

**Production URL:** https://expenses.martibusquets.cat

## 📋 Endpoints

### Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

### Insert Notification
```bash
POST /notifications
Content-Type: application/json
```

Request body:
```json
{
  "packageName": "com.example.app",
  "id": 12345,
  "key": "notification_key_123",
  "tag": "optional_tag",
  "postTime": 1707233456000,
  "isClearable": true,
  "category": "message",
  "title": "New Message",
  "text": "You have a new notification",
  "messages": [
    {
      "sender": "John Doe",
      "text": "Hello!",
      "timestamp": 1707233456000
    }
  ],
  "mediaInfo": {
    "type": "image",
    "uri": "content://media/123",
    "thumbnail": "base64..."
  },
  "latitude": 41.3851,
  "longitude": 2.1734
}
```

Response:
```json
{
  "status": "success",
  "message": "Notification inserted successfully",
  "data": {
    "id": 12345,
    "package_name": "com.example.app",
    "created_at": "2026-02-06T13:50:00"
  }
}
```

### Get Notifications
```bash
GET /notifications?limit=100&offset=0
```

Response:
```json
{
  "status": "success",
  "count": 2,
  "data": [...]
}
```

## 🛠️ Development

### Local Setup

1. **Create virtual environment:**
```bash
python3.13 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

2. **Install dependencies:**
```bash
pip install -r requirements.txt
```

3. **Configure environment:**
Edit `.env` file with your database credentials.

4. **Run locally:**
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Visit: http://localhost:8000

## 🐳 Docker

### Build Image
```bash
docker build -t notifications-api:latest .
```

### Run Container
```bash
docker run -d \
  --name notifications-api \
  -p 8555:8000 \
  --add-host host.docker.internal:host-gateway \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=5432 \
  -e DB_NAME=mydb \
  -e DB_USER=postgres \
  -e DB_PASSWORD=your_password \
  notifications-api:latest
```

## 📊 Database Schema

```sql
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY,
    package_name VARCHAR(255) NOT NULL,
    key VARCHAR(255) NOT NULL,
    tag VARCHAR(255),
    post_time BIGINT NOT NULL,
    is_clearable BOOLEAN NOT NULL DEFAULT TRUE,
    category VARCHAR(100),
    title TEXT,
    text TEXT,
    icon BYTEA,
    messages JSONB,
    media_info JSONB,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(package_name, id)
);
```

## 📝 API Documentation

Interactive API docs available at:
- **Swagger UI:** https://expenses.martibusquets.cat/docs
- **ReDoc:** https://expenses.martibusquets.cat/redoc

## 🔒 Security

- HTTPS enabled with Let's Encrypt certificate
- HTTP → HTTPS redirect forced
- HSTS enabled
- Block exploits enabled
- Caching enabled

## 🌐 Nginx Proxy Manager

Domain: `expenses.martibusquets.cat`
- Forward to: `host.docker.internal:8555`
- SSL: Let's Encrypt (expires 2026-05-06)
- HTTP/2: Enabled
- WebSocket: Enabled

## 📦 Tech Stack

- **Framework:** FastAPI 0.115.6
- **Server:** Uvicorn 0.34.0
- **Database:** PostgreSQL 16
- **DB Driver:** psycopg2-binary 2.9.10
- **Validation:** Pydantic 2.10.6
- **Python:** 3.13.12
- **Reverse Proxy:** Nginx Proxy Manager

## 👤 Author

Marti Busquets
