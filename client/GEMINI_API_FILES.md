# 📁 Gemini API Related Files & Folders

## 📂 Folder Structure

```
client/
├── app/
│   └── api/
│       ├── ai/                          # Main AI API routes
│       │   ├── research/
│       │   │   └── route.ts            # Research endpoint (initial analysis)
│       │   ├── questions/
│       │   │   └── route.ts            # Questions endpoint (generates questions/diagnosis)
│       │   ├── diagnose/
│       │   │   └── route.ts            # Direct diagnosis endpoint
│       │   └── aiUtils.ts              # Shared utilities
│       └── research/
│           └── route.ts                # Alternative research endpoint (uses lib/ai/client.ts)
│
└── lib/
    └── ai/                              # AI library utilities
        ├── client.ts                    # Unified Gemini client wrapper
        ├── retry.ts                     # Retry logic for API calls
        ├── sanitize.ts                  # Input sanitization
        ├── json.ts                      # JSON parsing utilities
        ├── cache.ts                     # Caching utilities
        ├── prompt-builder.ts            # Prompt building utilities
        ├── state-machine.ts             # State machine for AI flow
        └── types.ts                     # TypeScript type definitions
```

## 📄 Files Using Gemini API

### 1. **API Routes (Server-side)**

#### `app/api/ai/research/route.ts`
- **Purpose**: Initial research phase - analyzes problem description and vehicle info
- **Model**: `gemini-2.5-flash`
- **Returns**: `top_causes`, `differentiating_factors`, `reasoning`
- **Called from**: `app/user/consult/questions/page.tsx` (line 276)

#### `app/api/ai/questions/route.ts`
- **Purpose**: Generates diagnostic questions OR final diagnosis
- **Model**: `gemini-2.5-flash`
- **Returns**: Either `next_question` with `options` OR `final_diagnosis`
- **Called from**: `app/user/consult/questions/page.tsx` (line 327, 438)

#### `app/api/ai/diagnose/route.ts`
- **Purpose**: Direct diagnosis endpoint (alternative flow)
- **Model**: `gemini-2.5-flash`
- **Returns**: `diagnosis`, `self_checks`, `warnings`, `disclaimer`

#### `app/api/research/route.ts`
- **Purpose**: Alternative research endpoint using unified client
- **Model**: `gemini-2.0-flash`
- **Uses**: `lib/ai/client.ts` (GeminiClient class)

### 2. **Library Files**

#### `lib/ai/client.ts`
- **Purpose**: Unified Gemini client wrapper with timeout and retry
- **Class**: `GeminiClient`
- **Features**: Timeout handling, retry logic, input sanitization

#### `lib/ai/retry.ts`
- **Purpose**: Retry logic for failed API calls

#### `lib/ai/sanitize.ts`
- **Purpose**: Sanitizes user input before sending to Gemini

#### `lib/ai/json.ts`
- **Purpose**: Safe JSON parsing utilities

### 3. **Client-side Usage**

#### `app/user/consult/questions/page.tsx`
- **Lines 265-299**: Calls `/api/ai/research`
- **Lines 327-368**: Calls `/api/ai/questions` (first question)
- **Lines 438-486**: Calls `/api/ai/questions` (subsequent questions)

## 🔍 Flow Analysis

### Current Flow:
1. User submits problem description + vehicle details
2. Frontend calls `/api/ai/research` → Gets research data
3. Frontend calls `/api/ai/questions` with research data → Should get first question
4. User answers → Frontend calls `/api/ai/questions` again → Gets next question or diagnosis

## ⚠️ Potential Issues

Based on your issue (no answer after first data submission):

1. **Research API might be failing silently** - It returns fallback on any error
2. **Questions API might be timing out** - No timeout handling in current implementation
3. **JSON parsing might be failing** - `extractJSON` might not handle all response formats
4. **API key might be missing** - Check `process.env.GEMINI_API_KEY`
5. **Model name might be incorrect** - Using `gemini-2.5-flash` (verify this model exists)

## 🛠️ Debugging Steps

1. Check browser console for errors
2. Check server logs for API errors
3. Verify `GEMINI_API_KEY` is set in `.env.local`
4. Add console.logs in:
   - `app/api/ai/research/route.ts` (line 84-86)
   - `app/api/ai/questions/route.ts` (line 214-216)
5. Check network tab to see if requests are completing

