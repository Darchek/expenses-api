# Expense Types Reference

## Available Expense Types

These are the suggested values for the `expense_type` field in notifications:

### Primary Categories

- **restaurant** - Restaurants, cafes, bars, fast food
- **grocery** - Supermarkets, convenience stores, food markets
- **fuel** - Gas stations, EV charging
- **transport** - Public transport, taxis, rideshares, parking
- **shopping** - Retail stores, clothing, electronics, general shopping
- **entertainment** - Movies, concerts, events, games
- **health** - Pharmacies, medical services, fitness
- **accommodation** - Hotels, hostels, vacation rentals
- **travel** - Flights, trains, buses, travel bookings
- **services** - Professional services, repairs, maintenance
- **utilities** - Phone bills, internet, utilities payments
- **subscription** - Recurring subscriptions (streaming, software, etc.)
- **other** - Uncategorized or mixed expenses

## Usage

When creating or updating a notification, set the `expenseType` field to one of these values:

```json
{
  "packageName": "com.revolut.revolut",
  "title": "McDonald's",
  "expenseType": "restaurant",
  "city": "Barcelona",
  "latitude": 41.3851,
  "longitude": 2.1734,
  ...
}
```

Both `expenseType` and `city` are optional fields (can be null).

## Auto-Detection

Future versions may include automatic expense type detection based on:
- Merchant name (title field)
- Transaction category from banking apps
- Location data (e.g., gas stations, restaurants near coordinates)

## Reverse Geocoding

The `city` field can be populated using reverse geocoding services:
- OpenStreetMap Nominatim API
- Google Maps Geocoding API
- MapBox Geocoding API

Example workflow:
1. Notification arrives with latitude/longitude
2. API calls reverse geocoding service
3. Extract city name from response
4. Store in `city` field
