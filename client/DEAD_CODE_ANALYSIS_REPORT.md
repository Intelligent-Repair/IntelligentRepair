# Dead Code Analysis Report
## System Architecture Refactoring: Pure AI → Hybrid Logic

**Date:** Generated after refactoring to Hybrid Logic Architecture  
**Scope:** `lib/ai` folder and related dependencies

---

## Executive Summary

The backend has been refactored from a "Pure AI" approach to a "Hybrid Logic" approach. This analysis identifies:
- ✅ **Essential files** that must be kept
- ⚠️ **Potentially unused imports** that should be cleaned
- ❌ **Dead code** that can be safely removed (if not used by frontend)
- 📋 **Type duplication** between old and new type systems

---

## Architecture Overview

### New Architecture Flow:
```
Entry Point: app/api/ai/questions/route.ts
    ↓
    ├─→ MODE A: Scenario Runner (Static Logic)
    │   └─→ lib/knowledge/scenarios.ts
    │
    ├─→ MODE B: Context Analyzer
    │   └─→ lib/ai/context-analyzer.ts
    │       ├─→ lib/knowledge/scenarios.ts
    │       └─→ lib/knowledge/safety-rules.ts (MISSING - needs to be created)
    │
    └─→ MODE C: AI Fallback (Legacy)
        └─→ handleLegacyAIFlow()
            ├─→ lib/ai/client.ts
            ├─→ lib/ai/image-utils.ts
            └─→ lib/ai/prompt-builder.ts
```

---

## File-by-File Analysis

### ✅ ESSENTIAL FILES (Must Keep)

#### 1. `lib/ai/client.ts` ✅ **ESSENTIAL**
- **Status:** ✅ Used by backend
- **Used by:** `app/api/ai/questions/route.ts` (line 231)
- **Dependencies:** 
  - `lib/ai/retry.ts` (withRetry, withTimeout)
  - `lib/ai/sanitize.ts` (sanitizeInput)
- **Purpose:** OpenAI API client wrapper with retry/timeout logic
- **Action:** ✅ KEEP

#### 2. `lib/ai/image-utils.ts` ✅ **ESSENTIAL**
- **Status:** ✅ Used by backend
- **Used by:** `app/api/ai/questions/route.ts` (line 234)
- **Dependencies:** `lib/ai/types.ts` (InlineDataPart)
- **Purpose:** Fetch and convert images to OpenAI inlineData format
- **Action:** ✅ KEEP

#### 3. `lib/ai/prompt-builder.ts` ✅ **ESSENTIAL**
- **Status:** ✅ Used by backend
- **Used by:** `app/api/ai/questions/route.ts` (line 242)
- **Dependencies:** 
  - `lib/ai/sanitize.ts` (sanitizeInput)
  - `lib/ai/types.ts` (UserAnswer)
- **Exports used:**
  - ✅ `buildChatPrompt` - Used in handleLegacyAIFlow (line 242)
  - ⚠️ `buildDiagnosisPrompt` - **IMPORTED but NOT USED in current route.ts**
  - ✅ `DANGER_KEYWORDS` - Imported (line 5) but **NOT USED** in current code
- **Action:** ✅ KEEP (but clean unused exports)

#### 4. `lib/ai/context-analyzer.ts` ✅ **ESSENTIAL**
- **Status:** ✅ Core of new architecture
- **Used by:** `app/api/ai/questions/route.ts` (line 161)
- **Dependencies:**
  - `lib/knowledge/scenarios.ts` (SCENARIOS)
  - `lib/knowledge/safety-rules.ts` (SAFETY_RULES) - **⚠️ MISSING FILE**
  - `lib/types/knowledge.ts` (SafetyRule, Scenario)
- **Action:** ✅ KEEP (but fix missing import)

#### 5. `lib/ai/retry.ts` ✅ **ESSENTIAL**
- **Status:** ✅ Used by backend (indirectly)
- **Used by:** 
  - `lib/ai/client.ts` (line 7)
  - `app/user/consult/questions/page.tsx` (frontend - line 15)
- **Purpose:** Retry logic with exponential backoff
- **Action:** ✅ KEEP

#### 6. `lib/ai/sanitize.ts` ✅ **ESSENTIAL**
- **Status:** ✅ Used by backend (indirectly)
- **Used by:**
  - `lib/ai/client.ts` (line 8)
  - `lib/ai/prompt-builder.ts` (line 1)
- **Purpose:** Input sanitization utilities
- **Action:** ✅ KEEP

#### 7. `lib/ai/types.ts` ⚠️ **PARTIALLY ESSENTIAL**
- **Status:** ⚠️ Used by both backend and frontend
- **Used by Backend:**
  - `app/api/ai/questions/route.ts` (UserAnswer - line 9)
  - `lib/ai/prompt-builder.ts` (UserAnswer)
  - `lib/ai/image-utils.ts` (InlineDataPart)
- **Used by Frontend:**
  - `app/user/consult/questions/hooks/useAIStateMachine.ts` (AIState, AIAction, AIQuestion, DiagnosisData, VehicleInfo)
  - `app/user/consult/questions/page.tsx` (AIQuestion, DiagnosisData, VehicleInfo)
- **Purpose:** Type definitions for AI consultation flow
- **Action:** ✅ KEEP (but see Type Duplication section)

#### 8. `lib/ai/state-machine.ts` ⚠️ **FRONTEND ONLY**
- **Status:** ⚠️ NOT used by backend, but used by frontend
- **Used by:** 
  - `app/user/consult/questions/hooks/useAIStateMachine.ts` (line 8)
  - `app/user/consult/questions/page.tsx` (via useAIStateMachine hook)
- **NOT used by:** Backend (`app/api/ai/questions/route.ts`)
- **Purpose:** React state machine for frontend UI state management
- **Action:** ✅ KEEP (frontend dependency)

---

## ⚠️ ISSUES FOUND

### 1. Missing File: `lib/knowledge/safety-rules.ts`
- **Status:** ❌ **MISSING**
- **Required by:** `lib/ai/context-analyzer.ts` (line 1)
- **Impact:** Will cause runtime error when analyzer tries to check safety rules
- **Action:** 🔴 **CRITICAL - MUST CREATE**

### 2. Import Usage: `buildDiagnosisPrompt` ✅ **USED**
- **Location:** `app/api/ai/questions/route.ts` (line 21, used on line 1153)
- **Status:** ✅ **ACTIVELY USED** in saved file version
- **Note:** The file on disk has 1663 lines (saved version) vs 266 lines (possibly unsaved version)
- **Usage:** Called in a helper function around line 1153
- **Action:** ✅ **KEEP** - This is used in the legacy AI flow

### 3. Import Usage: `DANGER_KEYWORDS` ✅ **USED**
- **Location:** `app/api/ai/questions/route.ts` (line 21, used on line 971)
- **Status:** ✅ **ACTIVELY USED** in saved file version
- **Usage:** Used to check for danger keywords in legacy flow (line 971)
- **Action:** ✅ **KEEP** - Still needed for legacy AI fallback logic

---

## Type Duplication Analysis

### Comparison: `lib/ai/types.ts` vs `lib/types/knowledge.ts`

#### ✅ No Duplication Found
- `lib/ai/types.ts` contains:
  - `UserAnswer`, `VehicleInfo`, `DiagnosisData`, `AIState`, `AIAction`, etc.
  - These are for the **legacy AI flow** and **frontend state management**
  
- `lib/types/knowledge.ts` contains:
  - `ActionType`, `Suspect`, `DiagnosticAction`, `Scenario`, `DiagnosticState`, `SafetyRule`
  - These are for the **new hybrid logic** (scenarios)

**Conclusion:** ✅ **No duplication** - Different purposes, both needed.

---

## Files That Can Be Safely Deleted

### ❌ NONE - All files are either:
1. Used by backend (new architecture)
2. Used by frontend (React components)
3. Utility functions used indirectly

---

## Recommended Actions

### 🔴 CRITICAL (Must Fix)
1. **Create `lib/knowledge/safety-rules.ts`**
   - Required by `context-analyzer.ts`
   - Should export `SAFETY_RULES: SafetyRule[]`
   - Example structure:
     ```typescript
     import { SafetyRule } from '@/lib/types/knowledge';
     
     export const SAFETY_RULES: SafetyRule[] = [
       {
         id: 'fire',
         keywords: ['אש', 'עשן', 'שריפה'],
         message: 'עצור מיד! יש סכנת אש.',
         level: 'critical'
       },
       // ... more rules
     ];
     ```

### ⚠️ RECOMMENDED (Code Organization)
2. **Note on file versions:**
   - The saved `route.ts` file has 1663 lines and uses both `buildDiagnosisPrompt` and `DANGER_KEYWORDS`
   - There may be an unsaved version with only 266 lines
   - **Action:** Ensure all changes are saved and imports match actual usage

3. **Consider code organization:**
   - The legacy AI flow (lines ~900-1200+) could potentially be refactored
   - But keep it for now as it's the fallback mechanism

### ✅ OPTIONAL (Code Quality)
4. **Consider moving `DANGER_KEYWORDS` to `safety-rules.ts`:**
   - If `DANGER_KEYWORDS` is still needed for legacy flow
   - Could be converted to `SafetyRule` format

---

## Dependency Graph

```
app/api/ai/questions/route.ts
├─→ lib/ai/context-analyzer.ts ✅
│   ├─→ lib/knowledge/scenarios.ts ✅
│   ├─→ lib/knowledge/safety-rules.ts ❌ MISSING
│   └─→ lib/types/knowledge.ts ✅
│
├─→ lib/ai/client.ts ✅
│   ├─→ lib/ai/retry.ts ✅
│   └─→ lib/ai/sanitize.ts ✅
│
├─→ lib/ai/image-utils.ts ✅
│   └─→ lib/ai/types.ts ✅
│
├─→ lib/ai/prompt-builder.ts ✅
│   ├─→ lib/ai/sanitize.ts ✅
│   └─→ lib/ai/types.ts ✅
│
└─→ lib/types/knowledge.ts ✅

Frontend Dependencies:
├─→ lib/ai/state-machine.ts ✅ (used by useAIStateMachine.ts)
└─→ lib/ai/types.ts ✅ (used by frontend components)
```

---

## Summary

### Files Status:
- ✅ **7 files** are essential and actively used
- ⚠️ **1 file** (`state-machine.ts`) is frontend-only but necessary
- ❌ **0 files** can be safely deleted
- 🔴 **1 file** (`safety-rules.ts`) is missing and must be created

### Import Status:
- ✅ **All imports are used** - `buildDiagnosisPrompt` and `DANGER_KEYWORDS` are used in the legacy flow (lines 971, 1153)

### Type System:
- ✅ **No duplication** - Old and new type systems serve different purposes

---

## Next Steps

1. 🔴 **URGENT:** Create `lib/knowledge/safety-rules.ts`
   - Required by `context-analyzer.ts`
   - Export `SAFETY_RULES: SafetyRule[]` array
   
2. ✅ **Verify:** All imports in `route.ts` are used (confirmed via grep)
   - `buildDiagnosisPrompt` - Used on line 1153
   - `DANGER_KEYWORDS` - Used on line 971
   
3. ⚠️ **Note:** File version discrepancy detected
   - Saved file: 1663 lines (uses all imports)
   - Possibly unsaved version: 266 lines
   - **Action:** Ensure all changes are saved
   
4. ✅ **Test:** Ensure all imports resolve correctly after creating `safety-rules.ts`

---

**Report Generated:** System Architecture Analysis  
**Status:** Ready for implementation

