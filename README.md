# Garage Repair Management API

Complete API for garages to manage customer repair requests from start to finish.

**Branch:** `cursor/garage-repair-management-api-8320`

---

## 🚀 Quick Start

### 1. Database Migration (Required)

Go to: https://rdrlxmpwkkeryfcszltc.supabase.co/project/_/sql/new

Run this SQL:

```sql
-- Add required columns
ALTER TABLE repairs 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'in_progress',
ADD COLUMN IF NOT EXISTS final_issue_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add validation constraints (recommended)
ALTER TABLE repairs 
ADD CONSTRAINT valid_status 
CHECK (status IN ('in_progress', 'completed', 'on_hold', 'cancelled'));

ALTER TABLE repairs 
ADD CONSTRAINT valid_issue_type 
CHECK (final_issue_type IS NULL OR final_issue_type IN (
  'engine', 'brakes', 'electrical', 'ac', 'starting', 
  'gearbox', 'noise', 'suspension', 'transmission',
  'fuel_system', 'cooling_system', 'exhaust', 'tires', 
  'steering', 'other'
));

-- Optional: Add indexes for performance (add later if queries get slow)
-- CREATE INDEX IF NOT EXISTS idx_repairs_status ON repairs(status);
-- CREATE INDEX IF NOT EXISTS idx_repairs_final_issue_type ON repairs(final_issue_type);
```

### 2. Install & Test

```bash
cd client
npm install
node test-e2e.js  # Should show 24/24 tests passing
```

### 3. Run Development Server

```bash
npm run dev
```

API available at: `http://localhost:3000/api/garage/*`

---

## 📊 How It Works

### The Flow

```
User Request → Garage Reviews → Accept → Create Repair → 
Mechanic Updates → Set Status/Notes → Complete → Track History
```

### Example Workflow

1. **Customer** sends request (car problem + photos)
2. **Garage** sees request: `GET /api/garage/requests/list?status=new`
3. **Garage** accepts: `POST /api/garage/repairs/accept` → Creates repair
4. **Mechanic** updates: `PATCH /api/garage/repairs/[id]` → Add notes, change status
5. **Complete**: Set `status: "completed"` and `final_issue_type: "brakes"`
6. **Track**: Filter repairs by status, issue type, car model

---

## 🔧 API Endpoints

### Requests (Incoming customer requests)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/garage/requests/list` | List all requests. Filters: `?status=new&search=Toyota` |
| GET | `/api/garage/requests/[id]` | Get single request details |

### Repairs (Active repair jobs)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/garage/repairs/accept` | Accept request → create repair. Body: `{request_id: 123}` |
| GET | `/api/garage/repairs/[id]` | Get single repair details |
| PATCH | `/api/garage/repairs/[id]` | Update repair. Body: `{mechanic_notes, status, final_issue_type}` |
| GET | `/api/garage/repairs/list` | List all repairs. Filters: `?status=completed&issue_type=brakes` |

### Valid Values

**Status:** `in_progress`, `completed`, `on_hold`, `cancelled`

**Issue Types:** `engine`, `brakes`, `electrical`, `ac`, `starting`, `gearbox`, `noise`, `suspension`, `transmission`, `fuel_system`, `cooling_system`, `exhaust`, `tires`, `steering`, `other`

---

## 💻 Code Examples

### List New Requests
```javascript
const res = await fetch('/api/garage/requests/list?status=new', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
});
const { requests } = await res.json();
```

### Accept Request
```javascript
const res = await fetch('/api/garage/repairs/accept', {
  method: 'POST',
  headers: { 
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ request_id: 123 })
});
const { repair } = await res.json();
```

### Update Repair
```javascript
const res = await fetch('/api/garage/repairs/456', {
  method: 'PATCH',
  headers: { 
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    mechanic_notes: "Replaced brake pads and rotors",
    status: "completed",
    final_issue_type: "brakes"
  })
});
```

### Filter Repairs
```javascript
// Completed brake jobs
const res = await fetch('/api/garage/repairs/list?status=completed&issue_type=brakes');

// All Toyota repairs
const res = await fetch('/api/garage/repairs/list?manufacturer=Toyota');
```

---

## 🗄️ Database Schema

```
requests
  ├── user_id          → who sent request
  ├── car_id           → which car
  ├── description      → problem description
  ├── ai_diagnosis     → AI analysis
  └── status           → new/pending/accepted

repairs
  ├── request_id       → FK to requests
  ├── garage_id        → which garage
  ├── status           → in_progress/completed/on_hold/cancelled
  ├── mechanic_notes   → mechanic's notes (optional)
  ├── final_issue_type → categorized issue type
  └── updated_at       → last update timestamp

people_cars
  ├── user_id
  ├── vehicle_catalog_id → FK to vehicle_catalog
  └── license_plate

vehicle_catalog
  ├── manufacturer     → Toyota
  ├── model            → Camry
  └── year             → 2020
```

---

## 🔐 Security

- ✅ Authentication required on all endpoints (Supabase)
- ✅ User must be linked to garage (`garages.owner_user_id`)
- ✅ Garages can only see their own repairs
- ✅ Input validation (status, issue types)
- ✅ Database-level constraints (if you ran the CHECK constraints)
- ✅ SQL injection prevention (Supabase client)

---

## 🧪 Testing

### Run E2E Tests
```bash
cd client
node test-e2e.js
```

**Expected:** 24/24 tests passing

**Test Coverage:**
- Database schema validation
- API endpoints functionality
- Business logic (accept, update, complete)
- Filtering (status, issue type, model)
- Data validation

---

## 📦 Project Structure

```
client/app/api/garage/
├── requests/
│   ├── list/route.ts          # List all requests
│   └── [id]/route.ts           # Get single request
└── repairs/
    ├── accept/route.ts         # Accept request → create repair
    ├── list/route.ts           # List repairs with filters
    └── [id]/route.ts           # Get/Update single repair
```

---

## 🎯 Common Use Cases

### Daily Dashboard
```javascript
// Morning: Check new requests
GET /api/garage/requests/list?status=new

// Afternoon: Active repairs
GET /api/garage/repairs/list?status=in_progress
```

### Customer Inquiry
```javascript
// "Where's my repair?"
GET /api/garage/repairs/list?search=ABC123  // by license plate
```

### Monthly Reports
```javascript
// All completed repairs this month
GET /api/garage/repairs/list?status=completed

// All brake repairs
GET /api/garage/repairs/list?issue_type=brakes

// Toyota-specific stats
GET /api/garage/repairs/list?manufacturer=Toyota
```

---

## ❓ FAQ

**Q: Can garages see each other's repairs?**  
A: No. Each garage only sees their own repairs.

**Q: What if two garages accept the same request?**  
A: First garage wins. Second gets error: "Request already converted to repair"

**Q: Are mechanic notes required?**  
A: No, they're optional. You can add them anytime.

**Q: Can I change status after completion?**  
A: Yes. Use PATCH to update any time.

**Q: Do I need indexes?**  
A: Not until you have 10,000+ repairs. Add them when filtering gets slow (>1 second).

**Q: Why use CHECK constraints in SQL?**  
A: Prevents invalid data even if someone bypasses your API. Database enforces rules.

---

## 🐛 Troubleshooting

**Tests fail with "column does not exist"**  
→ Run the database migration SQL

**"Unauthorized" error**  
→ User must be authenticated and linked to a garage

**"Garage not found"**  
→ User's ID must exist in `garages.owner_user_id`

**Queries are slow**  
→ Add indexes (see migration SQL commented section)

---

## 📝 Implementation Details

**Files Modified:** 4 API route files  
**Files Created:** 1 test file  
**Tests:** 24 automated tests  
**Code Quality:** 100% TypeScript, full validation, comprehensive error handling

**Status:** ✅ Complete - Ready after migration

---

**Built for:** Intelligent Repair Platform  
**Version:** 1.0  
**Last Updated:** December 29, 2025
