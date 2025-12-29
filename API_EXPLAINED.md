# Garage Repair Management API - Simple Explanation

## 🎯 What Does This API Do?

This API helps garages manage car repairs from start to finish. Think of it as a digital workflow system that tracks every repair job.

---

## 📖 The Story: How It Works

### Step 1: Customer Sends Request
A customer has a car problem and sends a request through your app. The request includes:
- Description of the problem ("My car makes a strange noise")
- Photos of the car/issue
- AI diagnosis (your AI already analyzed it)

### Step 2: Garage Sees The Request
The garage mechanic opens their dashboard and sees all pending requests.

**API Call:** `GET /api/garage/requests/list`

This shows:
- Customer name and phone
- Car details (Toyota Camry 2020, License: ABC123)
- Problem description
- AI's guess about what's wrong
- Photos uploaded by customer

### Step 3: Garage Accepts The Request
Mechanic decides to take the job and clicks "Accept"

**API Call:** `POST /api/garage/repairs/accept`

This creates a **repair record** with:
- Status: "in_progress"
- Links to the customer's request
- AI diagnosis saved as reference

### Step 4: Mechanic Works On The Car
While fixing the car, the mechanic updates the repair with notes:

**API Call:** `PATCH /api/garage/repairs/[id]`

```json
{
  "mechanic_notes": "Found worn brake pads, replacing them now",
  "status": "in_progress"
}
```

### Step 5: Repair Complete
Job is done! Mechanic marks it complete:

**API Call:** `PATCH /api/garage/repairs/[id]`

```json
{
  "status": "completed",
  "final_issue_type": "brakes",
  "mechanic_notes": "Replaced front brake pads and rotors. Test drive successful."
}
```

### Step 6: Track Everything
Garage can now see:
- All completed repairs
- Filter by issue type (all brake jobs)
- Filter by car model (all Toyota repairs)
- Search history

**API Call:** `GET /api/garage/repairs/list?status=completed`

---

## 🔧 All 6 API Endpoints Explained

### 1️⃣ List All Requests

**What it does:** Shows all customer requests waiting for the garage

**Endpoint:** `GET /api/garage/requests/list`

**Filters you can use:**
- `?status=new` - Only new requests
- `?status=accepted` - Already accepted
- `?search=Toyota` - Search by car or customer name

**Returns:**
```json
{
  "requests": [
    {
      "id": 1,
      "description": "Car makes strange noise",
      "client": {
        "name": "John Doe",
        "phone": "+1234567890"
      },
      "car": {
        "manufacturer": "Toyota",
        "model": "Camry",
        "license_plate": "ABC123"
      },
      "ai_diagnosis": "Likely brake pad wear",
      "image_urls": ["photo1.jpg", "photo2.jpg"]
    }
  ]
}
```

**Use case:** Garage dashboard showing pending work

---

### 2️⃣ View Single Request Details

**What it does:** Shows everything about one specific request

**Endpoint:** `GET /api/garage/requests/[id]`

Example: `GET /api/garage/requests/123`

**Returns:** Same as above but for ONE request, plus:
- If it's already accepted, shows the repair status
- Full customer contact info
- All images uploaded

**Use case:** When mechanic clicks on a request to see full details

---

### 3️⃣ Accept Request (Start Repair)

**What it does:** Converts a customer request into a repair job

**Endpoint:** `POST /api/garage/repairs/accept`

**Send:**
```json
{
  "request_id": 123,
  "ai_summary": "AI detected brake issue" // optional
}
```

**Returns:**
```json
{
  "success": true,
  "repair": {
    "id": 456,
    "status": "in_progress",
    "request_id": 123,
    "garage_id": "your-garage-id",
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

**What happens:**
1. Creates new repair record
2. Links it to the request
3. Sets status to "in_progress"
4. Updates request status to "accepted"

**Use case:** "Accept Job" button in garage dashboard

---

### 4️⃣ View Single Repair

**What it does:** Shows complete repair details

**Endpoint:** `GET /api/garage/repairs/[id]`

Example: `GET /api/garage/repairs/456`

**Returns:**
```json
{
  "repair": {
    "id": 456,
    "status": "in_progress",
    "mechanic_notes": "Replacing brake pads",
    "final_issue_type": "brakes",
    "request": {
      "description": "Car makes noise when braking",
      "car": {
        "manufacturer": "Toyota",
        "model": "Camry",
        "license_plate": "ABC123"
      },
      "client": {
        "name": "John Doe",
        "phone": "+1234567890"
      }
    }
  }
}
```

**Use case:** Repair details page showing full history

---

### 5️⃣ Update Repair

**What it does:** Updates repair progress, notes, or status

**Endpoint:** `PATCH /api/garage/repairs/[id]`

Example: `PATCH /api/garage/repairs/456`

**You can update:**
```json
{
  "mechanic_notes": "Replaced front brake pads and rotors",
  "status": "completed",
  "final_issue_type": "brakes"
}
```

**Valid statuses:**
- `in_progress` - Still working on it
- `completed` - Job done
- `on_hold` - Waiting for parts
- `cancelled` - Customer cancelled

**Valid issue types:**
- `engine`, `brakes`, `electrical`, `ac`, `starting`
- `gearbox`, `noise`, `suspension`, `transmission`
- `fuel_system`, `cooling_system`, `exhaust`
- `tires`, `steering`, `other`

**Use case:** Mechanic updates progress or marks job complete

---

### 6️⃣ List All Repairs

**What it does:** Shows all repairs with powerful filtering

**Endpoint:** `GET /api/garage/repairs/list`

**Filters you can use:**
- `?status=completed` - Only completed repairs
- `?status=in_progress` - Current jobs
- `?issue_type=brakes` - All brake repairs
- `?manufacturer=Toyota` - All Toyota repairs
- `?model=Camry` - All Camry repairs
- Combine them: `?status=completed&issue_type=brakes&manufacturer=Toyota`

**Returns:**
```json
{
  "repairs": [
    {
      "id": 456,
      "status": "completed",
      "final_issue_type": "brakes",
      "mechanic_notes": "Replaced brake pads",
      "car": {
        "manufacturer": "Toyota",
        "model": "Camry"
      },
      "user": {
        "full_name": "John Doe"
      },
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-15T14:45:00Z"
    }
  ],
  "total": 1
}
```

**Use case:** 
- Garage repairs history page
- Filtering completed jobs
- Finding all brake repairs
- Tracking Toyota repairs

---

## 🎨 Real-World Example Flow

Let's say John has a Toyota Camry with brake problems:

### Day 1 - Morning
1. **John** uses your app, describes problem, uploads photos
2. **AI** analyzes: "80% confident it's brake pads"
3. Request saved in database

### Day 1 - Afternoon
4. **Garage mechanic** opens dashboard
   ```
   GET /api/garage/requests/list?status=new
   ```
   Sees John's request

5. **Mechanic** clicks on John's request
   ```
   GET /api/garage/requests/123
   ```
   Sees full details: photos, AI diagnosis, John's contact

6. **Mechanic** accepts the job
   ```
   POST /api/garage/repairs/accept
   Body: { "request_id": 123 }
   ```
   Repair created, John notified

### Day 2 - Working
7. **Mechanic** starts inspection
   ```
   PATCH /api/garage/repairs/456
   Body: { 
     "mechanic_notes": "Confirmed: brake pads worn. Ordering parts.",
     "status": "on_hold"
   }
   ```

8. **Parts arrive**, mechanic resumes
   ```
   PATCH /api/garage/repairs/456
   Body: { "status": "in_progress" }
   ```

### Day 2 - Complete
9. **Job finished**
   ```
   PATCH /api/garage/repairs/456
   Body: {
     "status": "completed",
     "final_issue_type": "brakes",
     "mechanic_notes": "Replaced front brake pads and rotors. Test drive OK."
   }
   ```

10. **John gets notified** car is ready

### Later - Analytics
11. **Garage owner** checks brake repair stats
    ```
    GET /api/garage/repairs/list?issue_type=brakes&status=completed
    ```
    Sees all brake jobs this month

---

## 🔐 Security

**All endpoints require:**
- User must be logged in (Supabase auth)
- User must be linked to a garage (in `garages` table)
- Can only see/edit their own garage's repairs

**Protection against:**
- ✅ Unauthorized access (must be logged in)
- ✅ SQL injection (Supabase handles it)
- ✅ Cross-garage access (garage ID checked)
- ✅ Invalid data (validation on all inputs)

---

## 📊 Database Structure (Simplified)

```
requests (customer requests)
  ├── user_id (who sent it)
  ├── car_id (which car)
  ├── description (problem description)
  ├── ai_diagnosis (what AI thinks)
  └── status (new/pending/accepted)

repairs (actual repair jobs)
  ├── request_id (linked to request above)
  ├── garage_id (which garage)
  ├── status (in_progress/completed/on_hold/cancelled)
  ├── mechanic_notes (mechanic's comments)
  ├── final_issue_type (brakes/engine/electrical...)
  └── updated_at (last update time)

people_cars
  ├── user_id (owner)
  ├── vehicle_catalog_id (car details)
  └── license_plate

vehicle_catalog
  ├── manufacturer (Toyota)
  ├── model (Camry)
  └── year (2020)

garages
  ├── owner_user_id (who owns the garage)
  ├── garage_name
  └── contact info
```

---

## 💡 Common Use Cases

### Use Case 1: Daily Dashboard
```javascript
// Morning: See new requests
GET /api/garage/requests/list?status=new

// Afternoon: Check ongoing repairs
GET /api/garage/repairs/list?status=in_progress
```

### Use Case 2: Customer Calls
```javascript
// "Where's my repair?"
// Search by license plate ABC123
GET /api/garage/repairs/list?search=ABC123
```

### Use Case 3: Monthly Reports
```javascript
// All completed brake jobs this month
GET /api/garage/repairs/list?status=completed&issue_type=brakes

// All Toyota repairs
GET /api/garage/repairs/list?manufacturer=Toyota
```

### Use Case 4: Update Progress
```javascript
// Quick note while working
PATCH /api/garage/repairs/456
Body: {
  "mechanic_notes": "Waiting for customer approval on additional work"
}
```

---

## 🎓 Key Concepts

### Request vs Repair
- **Request** = Customer says "help, my car is broken"
- **Repair** = Garage says "ok, we're fixing it"
- One request → becomes → one repair (when accepted)

### Status Flow
```
Request: new → pending → accepted
                    ↓
Repair:     in_progress → completed
                    ↓
            (or on_hold or cancelled)
```

### Issue Types
Categories help with:
- Statistics (how many brake jobs vs engine jobs)
- Pricing (different rates for different issues)
- Mechanic assignment (specialist for electrical issues)

---

## 🚀 Quick Start Code Examples

### JavaScript/Fetch Example
```javascript
// List new requests
const response = await fetch('/api/garage/requests/list?status=new', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});
const data = await response.json();
console.log(data.requests); // Array of requests
```

### Accept a request
```javascript
const response = await fetch('/api/garage/repairs/accept', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    request_id: 123,
    ai_summary: "Brake issue detected"
  })
});
const data = await response.json();
console.log(data.repair.id); // New repair ID
```

### Update repair
```javascript
const response = await fetch('/api/garage/repairs/456', {
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    mechanic_notes: "Replaced brake pads",
    status: "completed",
    final_issue_type: "brakes"
  })
});
```

---

## ❓ FAQ

**Q: Can one garage see another garage's repairs?**
A: No. Each garage only sees their own repairs.

**Q: What if I forget to set the issue type?**
A: It's optional. You can update it later with PATCH.

**Q: Can I change a repair back to "in_progress" after completing it?**
A: Yes! Use PATCH with `status: "in_progress"`

**Q: Do I need to accept ALL requests?**
A: No. You can ignore requests you don't want to handle.

**Q: Can I see requests from other garages?**
A: No, requests aren't assigned to specific garages. Any garage can accept any request (first come, first served).

**Q: What happens if two garages try to accept the same request?**
A: The API prevents duplicates. Second garage gets error: "Request already converted to repair"

---

## 📞 Support

- Full API docs: `API_DOCUMENTATION.md`
- Database migration: `MIGRATION_INSTRUCTIONS.md`
- Test suite: Run `node client/test-e2e.js`

---

**Built for:** Intelligent Repair Platform  
**Version:** 1.0  
**Branch:** cursor/garage-repair-management-api-8320
