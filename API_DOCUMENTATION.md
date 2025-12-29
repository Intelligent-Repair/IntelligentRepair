# Garage Repair Management API Documentation

## Overview

This API allows garages to manage customer repair requests and track repair progress.

## Base URL

```
/api/garage
```

## Authentication

All endpoints require authentication via Supabase Auth. The user must be associated with a garage (via `garages.owner_user_id`).

---

## Endpoints

### 1. List Requests

**GET** `/api/garage/requests/list`

Lists all customer requests with optional filters.

**Query Parameters:**
- `status` (optional): Filter by status (`new`, `pending`, `answered`, `accepted`, `all`)
- `search` (optional): Search in client name, car model, or license plate

**Response:**
```json
{
  "success": true,
  "requests": [
    {
      "id": 1,
      "description": "Car makes strange noise",
      "problem_description": "Squeaking sound from brakes",
      "status": "open",
      "image_urls": ["url1", "url2"],
      "ai_diagnosis": "Likely brake pad wear",
      "ai_confidence": 0.85,
      "created_at": "2024-01-01T10:00:00Z",
      "client": {
        "id": "user-123",
        "name": "John Doe",
        "first_name": "John",
        "last_name": "Doe",
        "phone": "+1234567890",
        "email": "john@example.com"
      },
      "car": {
        "id": "car-123",
        "license_plate": "ABC123",
        "manufacturer": "Toyota",
        "model": "Camry",
        "year": 2020,
        "full_name": "Toyota Camry (2020)"
      }
    }
  ],
  "total": 1
}
```

---

### 2. Get Single Request

**GET** `/api/garage/requests/[id]`

Gets detailed information about a specific request, including any associated repair.

**Response:**
```json
{
  "success": true,
  "request": {
    "id": 1,
    "description": "Car makes strange noise",
    "problem_description": "Squeaking sound from brakes",
    "status": "accepted",
    "image_urls": ["url1", "url2"],
    "ai_diagnosis": "Likely brake pad wear",
    "ai_confidence": 0.85,
    "created_at": "2024-01-01T10:00:00Z",
    "client": { /* ... */ },
    "car": { /* ... */ },
    "repair": {
      "id": 1,
      "status": "in_progress",
      "mechanic_notes": null,
      "final_issue_type": null,
      "ai_summary": "AI diagnosis...",
      "created_at": "2024-01-01T11:00:00Z",
      "updated_at": "2024-01-01T11:00:00Z"
    }
  }
}
```

---

### 3. Accept Request (Convert to Repair)

**POST** `/api/garage/repairs/accept`

Accepts a customer request and converts it to a repair record.

**Request Body:**
```json
{
  "request_id": 1,
  "ai_summary": "Optional AI diagnosis summary"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Request accepted and converted to repair",
  "repair": {
    "id": 1,
    "request_id": 1,
    "garage_id": "garage-123",
    "ai_summary": "AI diagnosis...",
    "status": "in_progress",
    "mechanic_notes": null,
    "final_issue_type": null,
    "created_at": "2024-01-01T11:00:00Z",
    "updated_at": "2024-01-01T11:00:00Z"
  }
}
```

**Error Responses:**
- `400`: Missing or invalid request_id
- `401`: Unauthorized (not logged in)
- `404`: Garage or request not found
- `409`: Request already converted to repair

---

### 4. Update Repair

**PATCH** `/api/garage/repairs/[id]`

Updates a repair with mechanic notes, status, and final issue type.

**Request Body:**
```json
{
  "mechanic_notes": "Replaced brake pads and rotors",
  "status": "completed",
  "final_issue_type": "brakes"
}
```

**Valid Status Values:**
- `in_progress`
- `completed`
- `on_hold`
- `cancelled`

**Valid Issue Types:**
- `engine`
- `brakes`
- `electrical`
- `ac`
- `starting`
- `gearbox`
- `noise`
- `suspension`
- `transmission`
- `fuel_system`
- `cooling_system`
- `exhaust`
- `tires`
- `steering`
- `other`

**Response:**
```json
{
  "success": true,
  "message": "Repair updated successfully",
  "repair": {
    "id": 1,
    "request_id": 1,
    "garage_id": "garage-123",
    "ai_summary": "AI diagnosis...",
    "status": "completed",
    "mechanic_notes": "Replaced brake pads and rotors",
    "final_issue_type": "brakes",
    "created_at": "2024-01-01T11:00:00Z",
    "updated_at": "2024-01-01T15:30:00Z"
  }
}
```

**Error Responses:**
- `400`: Invalid status or issue type
- `401`: Unauthorized
- `403`: Access denied (repair belongs to another garage)
- `404`: Repair not found

---

### 5. Get Single Repair

**GET** `/api/garage/repairs/[id]`

Gets detailed information about a specific repair.

**Response:**
```json
{
  "success": true,
  "repair": {
    "id": 1,
    "ai_summary": "AI diagnosis...",
    "mechanic_notes": "Replaced brake pads and rotors",
    "status": "completed",
    "final_issue_type": "brakes",
    "created_at": "2024-01-01T11:00:00Z",
    "updated_at": "2024-01-01T15:30:00Z",
    "request": {
      "id": 1,
      "description": "Car makes strange noise",
      "problem_description": "Squeaking sound from brakes",
      "status": "accepted",
      "image_urls": ["url1", "url2"],
      "ai_diagnosis": "Likely brake pad wear",
      "ai_confidence": 0.85,
      "created_at": "2024-01-01T10:00:00Z",
      "car": {
        "id": "car-123",
        "license_plate": "ABC123",
        "manufacturer": "Toyota",
        "model": "Camry",
        "year": 2020,
        "user": {
          "id": "user-123",
          "full_name": "John Doe",
          "first_name": "John",
          "last_name": "Doe",
          "phone": "+1234567890",
          "email": "john@example.com"
        }
      }
    },
    "garage": {
      "id": "garage-123",
      "name": "Best Auto Repair"
    }
  }
}
```

---

### 6. List Repairs

**GET** `/api/garage/repairs/list`

Lists all repairs for the garage with optional filters.

**Query Parameters:**
- `mode` (optional): `global` to see all repairs, omit for garage-specific
- `status` (optional): Filter by status (`in_progress`, `completed`, `on_hold`, `cancelled`, `all`)
- `issue_type` (optional): Filter by issue type (see valid types above)
- `manufacturer` (optional): Filter by car manufacturer
- `model` (optional): Filter by car model

**Response:**
```json
{
  "repairs": [
    {
      "id": 1,
      "ai_summary": "AI diagnosis...",
      "mechanic_notes": "Replaced brake pads and rotors",
      "status": "completed",
      "final_issue_type": "brakes",
      "created_at": "2024-01-01T11:00:00Z",
      "updated_at": "2024-01-01T15:30:00Z",
      "request": {
        "id": 1,
        "problem_description": "Squeaking sound from brakes",
        "created_at": "2024-01-01T10:00:00Z"
      },
      "car": {
        "id": "car-123",
        "license_plate": "ABC123",
        "manufacturer": "Toyota",
        "model": "Camry",
        "year": 2020
      },
      "user": {
        "id": "user-123",
        "full_name": "John Doe",
        "first_name": "John",
        "last_name": "Doe",
        "phone": "+1234567890"
      },
      "garage": {
        "id": "garage-123",
        "name": "Best Auto Repair"
      }
    }
  ],
  "total": 1
}
```

---

## Complete Workflow

### Typical garage workflow:

1. **View incoming requests**
   ```
   GET /api/garage/requests/list?status=new
   ```

2. **Review specific request**
   ```
   GET /api/garage/requests/1
   ```

3. **Accept request and start repair**
   ```
   POST /api/garage/repairs/accept
   Body: { "request_id": 1, "ai_summary": "..." }
   ```

4. **Update repair as work progresses**
   ```
   PATCH /api/garage/repairs/1
   Body: { 
     "mechanic_notes": "Replaced brake pads",
     "status": "in_progress"
   }
   ```

5. **Complete the repair**
   ```
   PATCH /api/garage/repairs/1
   Body: { 
     "status": "completed",
     "final_issue_type": "brakes",
     "mechanic_notes": "Replaced brake pads and rotors. Test drive successful."
   }
   ```

6. **View all completed repairs**
   ```
   GET /api/garage/repairs/list?status=completed
   ```

7. **Filter by issue type**
   ```
   GET /api/garage/repairs/list?issue_type=brakes
   ```

8. **Filter by car model**
   ```
   GET /api/garage/repairs/list?manufacturer=Toyota&model=Camry
   ```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "error": "Error message",
  "details": "Additional details (optional)"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (not logged in)
- `403`: Forbidden (access denied)
- `404`: Not Found
- `409`: Conflict (e.g., request already accepted)
- `500`: Server Error

---

## Database Schema

### Repairs Table
```sql
repairs (
  id: uuid (PK)
  request_id: uuid (FK -> requests)
  garage_id: uuid (FK -> garages)
  ai_summary: text
  mechanic_notes: text
  status: varchar(50) -- in_progress, completed, on_hold, cancelled
  final_issue_type: varchar(50) -- engine, brakes, etc.
  created_at: timestamp
  updated_at: timestamp -- auto-updated on change
)
```

### Related Tables
- `requests`: Customer repair requests
- `garages`: Garage information
- `people_cars`: Vehicle information
- `vehicle_catalog`: Vehicle make/model catalog
- `users`: User/customer information

---

## Testing

Run the E2E test suite:

```bash
cd /workspace/client
node test-e2e.js
```

Expected output: 24/24 tests passing after database migration.
