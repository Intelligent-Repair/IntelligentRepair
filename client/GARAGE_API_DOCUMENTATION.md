# Garage Repair Management API Documentation

## Overview
This document describes the complete API system for garage repair management. The system allows garages to receive customer requests, accept them as repairs, update repair status, and track all repairs with advanced filtering.

## Business Flow

1. **User Submits Request**: Users create repair requests through the consultation system
2. **Garage Views Requests**: Garage views all incoming requests in `/garage/requests`
3. **Garage Accepts Request**: Garage accepts a request, converting it to a repair
4. **Mechanic Works on Repair**: Mechanic fixes the issue
5. **Mechanic Updates Repair**: After fixing, mechanic adds notes, updates status, and categorizes the issue
6. **Repair History**: All repairs are viewable with advanced filters in `/garage/repairs`

## API Endpoints

### 1. Garage Requests APIs

#### GET `/api/garage/requests/list`
Lists all customer requests for the garage.

**Query Parameters:**
- `status` (optional): Filter by status (`all`, `new`, `pending`, `answered`, `accepted`)
- `search` (optional): Search by client name or car information

**Response:**
```json
{
  "success": true,
  "requests": [
    {
      "id": 123,
      "description": "Engine making strange noise",
      "problem_description": "Detailed description...",
      "status": "open",
      "image_urls": ["url1", "url2"],
      "ai_diagnosis": {...},
      "ai_confidence": 0.85,
      "created_at": "2025-12-26T10:00:00Z",
      "client": {
        "id": "user-123",
        "name": "John Doe",
        "phone": "052-1234567",
        "email": "john@example.com"
      },
      "car": {
        "id": "car-123",
        "license_plate": "12-345-67",
        "manufacturer": "Toyota",
        "model": "Corolla",
        "year": "2020",
        "full_name": "Toyota Corolla (2020)"
      }
    }
  ],
  "total": 15
}
```

#### GET `/api/garage/requests/[id]`
Gets a single request by ID with all details.

**Response:**
```json
{
  "success": true,
  "request": {
    "id": 123,
    "description": "Engine making strange noise",
    "problem_description": "Detailed description...",
    "status": "open",
    "image_urls": ["url1", "url2"],
    "ai_diagnosis": {...},
    "ai_confidence": 0.85,
    "created_at": "2025-12-26T10:00:00Z",
    "client": {...},
    "car": {...},
    "repair": {
      "id": 456,
      "status": "in_progress",
      "mechanic_notes": "Replaced spark plugs",
      "final_issue_type": "engine",
      "ai_summary": "AI diagnosis summary",
      "created_at": "2025-12-26T11:00:00Z",
      "updated_at": "2025-12-26T12:00:00Z"
    }
  }
}
```

### 2. Garage Repairs APIs

#### POST `/api/garage/repairs/accept`
Accepts a customer request and converts it to a repair.

**Request Body:**
```json
{
  "request_id": 123,
  "ai_summary": "Optional AI diagnosis summary"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Request accepted and converted to repair",
  "repair": {
    "id": 456,
    "request_id": 123,
    "garage_id": 789,
    "ai_summary": "AI diagnosis summary",
    "status": "in_progress",
    "mechanic_notes": null,
    "final_issue_type": null,
    "created_at": "2025-12-26T11:00:00Z"
  }
}
```

**Error Responses:**
- `409 Conflict`: Request already converted to repair
- `404 Not Found`: Request not found or garage not found
- `400 Bad Request`: Invalid request_id

#### GET `/api/garage/repairs/[id]`
Gets a single repair by ID with all related information.

**Response:**
```json
{
  "success": true,
  "repair": {
    "id": 456,
    "ai_summary": "AI diagnosis summary",
    "mechanic_notes": "Replaced spark plugs and cleaned fuel injectors",
    "status": "completed",
    "final_issue_type": "engine",
    "created_at": "2025-12-26T11:00:00Z",
    "updated_at": "2025-12-26T14:00:00Z",
    "request": {
      "id": 123,
      "description": "Engine making strange noise",
      "problem_description": "Detailed description...",
      "status": "accepted",
      "image_urls": ["url1", "url2"],
      "ai_diagnosis": {...},
      "ai_confidence": 0.85,
      "created_at": "2025-12-26T10:00:00Z",
      "car": {
        "id": "car-123",
        "license_plate": "12-345-67",
        "manufacturer": "Toyota",
        "model": "Corolla",
        "year": "2020",
        "user": {
          "id": "user-123",
          "full_name": "John Doe",
          "phone": "052-1234567",
          "email": "john@example.com"
        }
      }
    },
    "garage": {
      "id": 789,
      "name": "Best Garage"
    }
  }
}
```

#### PATCH `/api/garage/repairs/[id]`
Updates a repair with mechanic notes, status, and final issue type.

**Request Body:**
```json
{
  "mechanic_notes": "Replaced spark plugs and cleaned fuel injectors",
  "status": "completed",
  "final_issue_type": "engine"
}
```

**Valid Status Values:**
- `in_progress`: Repair is being worked on
- `completed`: Repair is finished
- `on_hold`: Repair is paused (waiting for parts, etc.)
- `cancelled`: Repair was cancelled

**Valid Issue Type Values:**
- `engine`: Engine-related issues
- `brakes`: Brake system issues
- `electrical`: Electrical system issues
- `ac`: Air conditioning issues
- `starting`: Starting system issues
- `gearbox`: Gearbox/transmission issues
- `noise`: Noise and vibration issues
- `suspension`: Suspension system issues
- `transmission`: Transmission issues
- `fuel_system`: Fuel system issues
- `cooling_system`: Cooling system issues
- `exhaust`: Exhaust system issues
- `tires`: Tire issues
- `steering`: Steering system issues
- `other`: Other issues

**Response:**
```json
{
  "success": true,
  "message": "Repair updated successfully",
  "repair": {
    "id": 456,
    "mechanic_notes": "Replaced spark plugs and cleaned fuel injectors",
    "status": "completed",
    "final_issue_type": "engine",
    "updated_at": "2025-12-26T14:00:00Z"
  }
}
```

#### GET `/api/garage/repairs/list`
Lists all repairs for the garage with advanced filtering.

**Query Parameters:**
- `mode` (optional): `local` (default) or `global` (admin view)
- `status` (optional): Filter by repair status (`in_progress`, `completed`, `on_hold`, `cancelled`, `all`)
- `issue_type` (optional): Filter by final issue type (see valid values above)
- `manufacturer` (optional): Filter by car manufacturer
- `model` (optional): Filter by car model

**Response:**
```json
{
  "repairs": [
    {
      "id": 456,
      "ai_summary": "AI diagnosis summary",
      "mechanic_notes": "Replaced spark plugs",
      "status": "completed",
      "final_issue_type": "engine",
      "created_at": "2025-12-26T11:00:00Z",
      "updated_at": "2025-12-26T14:00:00Z",
      "request": {
        "id": 123,
        "problem_description": "Engine making strange noise",
        "created_at": "2025-12-26T10:00:00Z"
      },
      "car": {
        "id": "car-123",
        "plate_number": "12-345-67",
        "manufacturer": "Toyota",
        "model": "Corolla"
      },
      "user": {
        "id": "user-123",
        "full_name": "John Doe",
        "phone": "052-1234567"
      },
      "garage": {
        "id": 789,
        "name": "Best Garage"
      }
    }
  ],
  "total": 25
}
```

## Frontend Pages

### 1. Garage Requests Page (`/garage/requests`)
- Lists all customer requests
- Filters: All, New, Pending, Answered
- Search by client name or car info
- Click on request to view details

### 2. Garage Request Details Page (`/garage/requests/[id]`)
- Shows full request details
- Displays client and car information
- Shows AI diagnosis if available
- Actions:
  - Accept request and convert to repair
  - Download PDF report
  - Go to chat with customer

### 3. Garage Repairs Page (`/garage/repairs`)
- Lists all repairs for the garage
- Advanced filters:
  - Status (in_progress, completed, on_hold, cancelled)
  - Issue type (engine, brakes, electrical, etc.)
  - Manufacturer
  - Model
- Edit repair modal:
  - Update status
  - Set final issue type
  - Add mechanic notes

## Database Schema Changes

The following columns should exist in the `repairs` table:

```sql
CREATE TABLE repairs (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES requests(id),
  garage_id INTEGER REFERENCES garages(id),
  ai_summary TEXT,
  mechanic_notes TEXT,
  status VARCHAR(50) DEFAULT 'in_progress',
  final_issue_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Authentication & Authorization

All endpoints require authentication:
- User must be logged in
- For garage operations, user must be associated with a garage (via `owner_user_id` or `user_id` in `garages` table)
- Repairs can only be updated by the garage that owns them

## Error Handling

Standard error responses:
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

Common status codes:
- `200 OK`: Success
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `404 Not Found`: Resource not found
- `409 Conflict`: Conflict (e.g., duplicate)
- `500 Internal Server Error`: Server error

## Testing Checklist

- [ ] User can view all requests in `/garage/requests`
- [ ] User can filter requests by status
- [ ] User can search requests
- [ ] User can view request details
- [ ] User can accept a request and convert to repair
- [ ] User can view all repairs in `/garage/repairs`
- [ ] User can filter repairs by status, issue type, manufacturer, model
- [ ] User can edit a repair (add notes, update status, set issue type)
- [ ] Dashboard integrates with new repair data
- [ ] All API endpoints return proper errors for invalid inputs

## Next Steps

1. Verify database schema includes all required columns
2. Test API endpoints with real data
3. Ensure proper error handling on frontend
4. Add unit tests for API endpoints
5. Add integration tests for complete flow
6. Consider adding notifications when repairs are updated
7. Consider adding email notifications to customers
