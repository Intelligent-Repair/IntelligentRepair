# DRAFT TO REQUEST AUDIT REPORT

**Date:** 2025-01-XX  
**Scope:** Read-only analysis of draft-related logic, request creation, image persistence, and gaps  
**Status:** Analysis Complete - No Code Changes

---

## SECTION 1 – Existing Draft Mechanisms

### 1.1 Draft ID Concept
**File:** `app/user/consult/new/page.tsx`  
**Description:** 
- Generates a new `draft_id` using `crypto.randomUUID()` on mount
- Stores in `sessionStorage` under key `"draft_id"`
- Clears all draft-related sessionStorage keys before creating new draft
- **Lifespan:** Session-only (cleared on tab close or new consultation)

**File:** `app/user/consult/form/page.tsx`  
**Description:**
- Also generates new `draft_id` on mount (fallback: `draft-${Date.now()}-${random}`)
- Stores in `sessionStorage` as `"draft_id"`
- **Lifespan:** Session-only

**File:** `app/user/consult/questions/page.tsx`  
**Description:**
- Reads `draft_id` from `sessionStorage`
- Watches for `draft_id` changes via interval (500ms) and storage events
- Clears all session state when `draft_id` changes
- Uses `draft_id` in `finalizeDraftAndCreateRequest()` function (line 928)
- **Lifespan:** Session-only

**File:** `app/user/consult/questions/hooks/useAIStateMachine.ts`  
**Description:**
- Watches `draft_id` changes and resets AI state machine when it changes
- Prevents stale state across different consultations
- **Lifespan:** Session-only

### 1.2 Draft Images Storage
**File:** `app/user/consult/form/page.tsx`  
**Description:**
- Stores image URLs array in `sessionStorage` under key `"draft_images"`
- Updates whenever `imageUrls` state changes
- Cleared on form mount (fresh start)

**File:** `app/user/consult/questions/page.tsx`  
**Description:**
- Loads `draft_images` from `sessionStorage` on mount
- Stores in `draftImagesRef.current` (React ref)
- Used throughout questions flow to send images to AI endpoints
- Cleared when `draft_id` changes
- **Lifespan:** Session-only
- **Data Format:** Array of image URL strings (max 3)

### 1.3 Draft Description Storage
**File:** `app/user/consult/form/page.tsx`  
**Description:**
- Description stored in component state only (not persisted)
- `sessionStorage.removeItem("draft_description")` called on mount (cleanup)
- **Lifespan:** Component state only (lost on unmount)

### 1.4 Draft Messages/Conversation State
**File:** `app/user/consult/questions/page.tsx`  
**Description:**
- Conversation state saved to `sessionStorage` under key `"consult_questions_state"`
- Contains: `vehicle`, `description`, `research`, `answers`, `timestamp`
- Used for restoring conversation after page refresh
- Expires after 1 hour (checked on load)
- Cleared on new consultation or `draft_id` change
- **Lifespan:** Session-only, 1-hour expiry

**File:** `app/user/consult/questions/page.tsx` (line 253)  
**Description:**
- Diagnosis data stored in `sessionStorage` under key `"consult_diagnosis"`
- Used by summary page to display final diagnosis
- **Lifespan:** Session-only

### 1.5 Draft Image Upload Endpoint
**File:** `app/api/drafts/upload-image/route.ts`  
**Description:**
- Accepts `draft_id` and image file via FormData
- Uploads to Supabase Storage bucket: `"drafts"`
- File path format: `{draftId}/{uuid}.{ext}`
- Returns public URL of uploaded image
- **Storage:** Supabase Storage (persistent, but in drafts bucket)
- **Association:** Images stored under `drafts/{draftId}/` path structure

### 1.6 Draft-to-Request Conversion Attempt
**File:** `app/user/consult/questions/page.tsx` (line 924-957)  
**Description:**
- Function `finalizeDraftAndCreateRequest()` attempts to call `/api/requests/from-draft`
- **CRITICAL:** This endpoint does NOT exist (no file found)
- Function collects: `draft_id`, `user_id`, `car_id`, `description`, `image_urls`, `ai_diagnosis`, `ai_recommendations`, `ai_confidence`
- **Status:** Dead code - endpoint missing

---

## SECTION 2 – Existing Request Creation Endpoints

### 2.1 `/api/requests/create`
**File:** `app/api/requests/create/route.ts`  
**Writes Fields:**
- `user_id` (required)
- `vehicle_id` (required)
- `title` (required)
- `description` (optional)
- **Missing:** `image_urls`, `ai_diagnosis`, `ai_confidence`, `status`
- **Status:** Not used by any frontend page (orphaned endpoint)
- **Expects:** Fully completed consult data (but missing AI fields)

### 2.2 `/api/requests/start`
**File:** `app/api/requests/start/route.ts`  
**Writes Fields:**
- `user_id` (required)
- `car_id` (from `vehicle.id`, nullable)
- `description` (required)
- `status` (hardcoded to `"open"`)
- `image_urls` (array, max 3, normalized from various formats)
- `ai_diagnosis` (nullable, accepts any JSON)
- `ai_confidence` (nullable, number 0-1)
- **Returns:** `request_id` only
- **Status:** Used by `/user/consult/new/page.tsx` (line 68)
- **Expects:** Can accept partial consult (description + images + optional AI data)
- **Note:** Creates request BEFORE questions flow starts

### 2.3 `/api/requests/from-draft`
**File:** Does NOT exist  
**Status:** Referenced in `app/user/consult/questions/page.tsx` line 931, but endpoint missing  
**Expected Purpose:** Convert draft consultation into persisted request  
**Impact:** Critical gap - no way to save completed consult as request

### 2.4 Request Image Upload Endpoint
**File:** `app/api/requests/upload-image/route.ts`  
**Description:**
- Accepts `draft_id` (confusing naming - should be `request_id`)
- Uploads to Supabase Storage bucket: `"request-media"`
- File path format: `drafts/{draftId}/{timestamp}-{random}.{ext}`
- **Note:** Path structure uses `drafts/` prefix even though bucket is `request-media`
- **Status:** Functional but naming is inconsistent

---

## SECTION 3 – Image Handling

### 3.1 Image Storage Locations

**Draft Images:**
- **Bucket:** `drafts` (Supabase Storage)
- **Path Pattern:** `{draftId}/{uuid}.{ext}`
- **Endpoint:** `/api/drafts/upload-image`
- **Lifespan:** Persistent in storage, but URLs only in sessionStorage
- **Association:** Linked to `draft_id` via path structure

**Request Images:**
- **Bucket:** `request-media` (Supabase Storage)
- **Path Pattern:** `drafts/{draftId}/{timestamp}-{random}.{ext}` (confusing - uses drafts prefix)
- **Endpoint:** `/api/requests/upload-image`
- **Lifespan:** Persistent
- **Association:** Uses `draft_id` parameter (should be `request_id`)

### 3.2 Image URL Flow

**During Consult:**
1. Images uploaded via `/api/drafts/upload-image` → stored in `drafts` bucket
2. Public URLs returned and stored in `sessionStorage["draft_images"]`
3. URLs sent to AI endpoints (`/api/ai/questions`, `/api/ai/diagnose`) for analysis
4. URLs kept in memory via `draftImagesRef.current` in questions page

**After Consult:**
- No automatic migration from `drafts` bucket to `request-media` bucket
- URLs remain in `drafts` bucket even after request creation
- **Risk:** If `drafts` bucket is cleaned up, images become inaccessible

### 3.3 Image Reusability

**Can URLs be reused?**
- ✅ Yes, if `drafts` bucket is not cleaned up
- ✅ Public URLs remain valid as long as files exist
- ⚠️ **Risk:** No guarantee images persist after draft cleanup
- ⚠️ **Risk:** No migration path from `drafts` to `request-media` bucket

**Current State:**
- Images uploaded during consult are in `drafts` bucket
- Request creation endpoints accept `image_urls` array
- URLs can be copied directly into request `image_urls` field
- **Gap:** No validation that URLs are still accessible
- **Gap:** No cleanup of orphaned draft images

---

## SECTION 4 – Gaps to Persist a Consult as a Request

### 4.1 Missing Endpoint
**Gap:** `/api/requests/from-draft` endpoint does not exist  
**Impact:** Cannot convert completed consult into persisted request  
**Location:** Referenced in `app/user/consult/questions/page.tsx:931`  
**Required Fields:**
- `draft_id` (to identify draft)
- `user_id` (from authenticated user)
- `car_id` (from vehicle selection)
- `description` (from form)
- `image_urls` (from draft_images)
- `ai_diagnosis` (from final diagnosis)
- `ai_recommendations` (from diagnosis recommendations)
- `ai_confidence` (from diagnosis confidence)

### 4.2 Data Only in Memory/Session

**Never Persisted:**
1. **Conversation Messages** (`state.messages` in AI state machine)
   - User messages with text and images
   - AI questions and responses
   - **Location:** Only in React state + sessionStorage
   - **Impact:** Lost on page refresh or new consultation

2. **Question-Answer Pairs** (`state.answers`)
   - Array of `{question, answer}` objects
   - **Location:** sessionStorage + React state
   - **Impact:** Lost after consultation completes
   - **Note:** Used during consult but not saved to request

3. **Research Data** (`researchRef.current`)
   - `top_causes`, `differentiating_factors`
   - **Location:** Only in memory (React ref)
   - **Impact:** Lost after consultation

4. **Draft ID**
   - Generated UUID stored only in sessionStorage
   - **Location:** sessionStorage only
   - **Impact:** No way to resume draft after session ends

### 4.3 Data That Must Be Copied to Request

**Critical Fields for Request:**
1. ✅ `user_id` - Available from authenticated user
2. ✅ `car_id` - Available from vehicle selection
3. ✅ `description` - Available from form/state
4. ✅ `image_urls` - Available from `draftImagesRef.current`
5. ✅ `ai_diagnosis` - Available from `state.diagnosis`
6. ✅ `ai_confidence` - Available from `state.diagnosis.confidence`
7. ⚠️ `title` - **MISSING** - Not generated anywhere
8. ⚠️ `status` - Should default to `"open"` (handled by `/api/requests/start`)

**Optional but Valuable:**
- `ai_recommendations` - Available from `state.diagnosis.recommendations`
- Question-answer history (not currently stored in requests table)
- Research data (not currently stored in requests table)

### 4.4 Draft ID Concept Status

**Current State:**
- ✅ `draft_id` concept exists and is used throughout consult flow
- ✅ Generated on new consultation start
- ✅ Stored in sessionStorage
- ✅ Used to organize draft images in storage
- ❌ **NOT stored in database** - no `drafts` table
- ❌ **NOT linked to requests** - no foreign key relationship

**Recommendation:**
- Option A: Keep `draft_id` as session-only identifier (current approach)
- Option B: Create `drafts` table to persist drafts (allows resume later)
- **Current choice appears to be Option A** (session-only)

---

## SECTION 5 – Risks & Conflicts

### 5.1 Duplicate Request Creation Flows

**Flow 1: `/api/requests/start`**
- Called from `/user/consult/new/page.tsx` BEFORE questions flow
- Creates request with minimal data (description, images, optional AI)
- **Issue:** Creates request too early (before diagnosis)

**Flow 2: `/api/requests/from-draft` (MISSING)**
- Should be called from `/user/consult/questions/page.tsx` AFTER diagnosis
- Would create request with full consult data
- **Issue:** Endpoint doesn't exist

**Flow 3: `/api/requests/create`**
- Not used by any frontend page
- Requires `title` field (not generated anywhere)
- **Issue:** Orphaned endpoint

**Risk:** If `/api/requests/start` is used, request is created before diagnosis is complete. If diagnosis fails or user abandons, orphaned request remains.

### 5.2 Dead/Partially Implemented Endpoints

**Dead Code:**
1. `/api/requests/from-draft` - Referenced but doesn't exist
2. `/api/requests/create` - Exists but not used (requires `title` which isn't generated)

**Partially Implemented:**
1. `/api/requests/start` - Works but creates request too early in flow
2. `/api/requests/upload-image` - Works but uses confusing naming (`draft_id` instead of `request_id`)

### 5.3 Logic That Could Cause Duplicate Requests

**Risk Point 1:** `finalizeDraftAndCreateRequest()` in questions page
- Called when user clicks "Send to garage" or "Finish"
- Currently fails silently (endpoint missing)
- **If endpoint existed:** Could be called multiple times if user clicks button twice
- **Mitigation Needed:** Idempotency check or disable button after first call

**Risk Point 2:** `/api/requests/start` called from new consultation page
- Creates request immediately on vehicle selection
- If user abandons consult, request remains in database
- **Impact:** Orphaned requests with incomplete data

**Risk Point 3:** No validation that draft was already converted
- If `/api/requests/from-draft` existed, no check if request already exists for this `draft_id`
- **Mitigation Needed:** Check if request already exists before creating

### 5.4 Image Storage Conflicts

**Bucket Confusion:**
- Draft images: `drafts` bucket
- Request images: `request-media` bucket (but path uses `drafts/` prefix)
- **Issue:** Inconsistent naming and structure

**Cleanup Risk:**
- No mechanism to clean up draft images after request creation
- Draft images remain in `drafts` bucket indefinitely
- **Impact:** Storage bloat over time

**Migration Gap:**
- No automatic migration of images from `drafts` to `request-media` bucket
- URLs copied directly (work if buckets are both accessible)
- **Risk:** If `drafts` bucket is cleaned up, request images become broken

### 5.5 Session Storage Dependencies

**Critical Dependencies:**
- All draft data lives in sessionStorage
- If user opens new tab, new draft is created (separate sessionStorage)
- If user closes tab, all draft data is lost
- **Impact:** Cannot resume consultation across sessions

**State Synchronization:**
- Multiple components watch `draft_id` changes
- Complex cleanup logic when `draft_id` changes
- **Risk:** Race conditions if `draft_id` changes during active consultation

---

## SECTION 6 – Recommendations (NO CODE)

### 6.1 Immediate Gaps to Fill

1. **Create `/api/requests/from-draft` endpoint**
   - Accept: `draft_id`, `user_id`, `car_id`, `description`, `image_urls`, `ai_diagnosis`, `ai_recommendations`, `ai_confidence`
   - Generate `title` from description (first 50 chars or similar)
   - Insert into `requests` table with `status: "open"`
   - Return `request_id`
   - **Idempotency:** Check if request already exists for this `draft_id` (if drafts table exists) or use unique constraint

2. **Fix Image Storage Strategy**
   - Option A: Keep images in `drafts` bucket, copy URLs to request (current approach, but risky)
   - Option B: Migrate images from `drafts` to `request-media` bucket when creating request
   - Option C: Upload images directly to `request-media` bucket from start (requires refactoring)

3. **Generate Request Title**
   - Extract from description (first 50-100 chars)
   - Or use pattern: "ייעוץ AI - {vehicle} - {date}"
   - Required by `/api/requests/create` but not generated anywhere

### 6.2 Data Persistence Strategy

**Option A: Session-Only Drafts (Current)**
- Keep drafts in sessionStorage only
- Convert to request only when user completes consult
- **Pros:** Simple, no database overhead
- **Cons:** Cannot resume, lost on refresh

**Option B: Database Drafts**
- Create `drafts` table with `draft_id`, `user_id`, `data` (JSONB)
- Save draft state periodically
- **Pros:** Resumable, persistent
- **Cons:** More complex, requires cleanup

**Recommendation:** Option A is sufficient if conversion happens immediately after diagnosis.

### 6.3 Request Creation Timing

**Current Problem:** `/api/requests/start` creates request too early (before diagnosis)

**Recommended Flow:**
1. User starts consult → create draft (sessionStorage only)
2. User completes questions → get diagnosis
3. User clicks "Save" or "Send to garage" → call `/api/requests/from-draft`
4. Create request with full data (description, images, diagnosis, confidence)

**Alternative:** Keep `/api/requests/start` for early creation, but update request later with diagnosis data.

### 6.4 Image Migration Strategy

**Recommended Approach:**
1. Keep images in `drafts` bucket during consult
2. When creating request via `/api/requests/from-draft`:
   - Copy images from `drafts` bucket to `request-media` bucket
   - Update URLs in request `image_urls` field
   - Optionally delete from `drafts` bucket (or keep for audit trail)

**Alternative (Simpler):**
- Keep images in `drafts` bucket
- Copy URLs to request (no migration)
- Accept risk that `drafts` bucket cleanup will break images
- Document that `drafts` bucket must be preserved

### 6.5 Error Handling & Edge Cases

**Missing Validations:**
1. What if `draft_id` doesn't exist in sessionStorage?
2. What if images in `draft_images` are no longer accessible?
3. What if user is not authenticated when creating request?
4. What if vehicle was deleted between consult start and request creation?

**Recommendations:**
- Validate all required fields before creating request
- Check image URL accessibility (optional, but recommended)
- Handle authentication errors gracefully
- Verify vehicle still exists before creating request

### 6.6 Testing Considerations

**Test Scenarios:**
1. Complete consult flow → verify request created with all data
2. Abandon consult mid-flow → verify no orphaned request
3. Multiple rapid clicks on "Save" → verify no duplicate requests
4. SessionStorage cleared mid-consult → verify graceful error handling
5. Image upload fails → verify consult can continue without images
6. Network failure during request creation → verify retry mechanism

---

## SUMMARY

### What Exists
- ✅ Draft ID concept (sessionStorage-based)
- ✅ Draft image upload (`/api/drafts/upload-image`)
- ✅ Image URLs stored in sessionStorage
- ✅ Request creation endpoint (`/api/requests/start`) - but creates too early
- ✅ Request table supports: `user_id`, `car_id`, `description`, `image_urls`, `ai_diagnosis`, `ai_confidence`, `status`

### What's Missing
- ❌ `/api/requests/from-draft` endpoint (referenced but doesn't exist)
- ❌ Request title generation
- ❌ Image migration from `drafts` to `request-media` bucket
- ❌ Idempotency checks for request creation
- ❌ Draft cleanup mechanism

### What's Risky
- ⚠️ Images in `drafts` bucket may be cleaned up, breaking request images
- ⚠️ `/api/requests/start` creates request before diagnosis is complete
- ⚠️ No validation that draft data is still valid when creating request
- ⚠️ SessionStorage dependencies mean data lost on refresh/close

### Cleanest Path Forward
1. Create `/api/requests/from-draft` endpoint
2. Call it from `finalizeDraftAndCreateRequest()` after diagnosis
3. Generate title from description
4. Copy image URLs to request (or migrate images)
5. Add idempotency check to prevent duplicates
6. Consider removing or refactoring `/api/requests/start` to avoid early creation

---

**End of Report**

