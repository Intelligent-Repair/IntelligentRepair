# 🔧 מסמך אפיון מערכת - מערכת האבחון החכמה
## System Flow Audit - Intelligent Repair Agent

---

## 📁 1. מיפוי קבצים (File Inventory)

### Knowledge Base (KB) - קבצי הידע
| קובץ | תפקיד | סוג | שורות |
|------|--------|-----|--------|
| `lib/knowledge/warning-lights.json` | מאגר נורות אזהרה + תרחישים + שאלות מפתח | JSON | ~1500 |
| `lib/knowledge/scenarios.ts` | תרחישים סטטיים (הרכב לא מניע, התחממות) | TypeScript | ~290 |
| `lib/knowledge/safety-rules.ts` | חוקי בטיחות קריטיים ואזהרות | TypeScript | ~95 |
| `lib/knowledge/keywords.json` | מילות מפתח לזיהוי danger/caution | JSON | ~40 |

### Logic Engine - מנוע הלוגיקה
| קובץ | תפקיד | שורות |
|------|--------|--------|
| `lib/ai/context-analyzer.ts` | ניתוח קלט → SAFETY_STOP / WARNING_LIGHT / START_SCENARIO / CONSULT_AI | ~258 |
| `app/api/ai/questions/route.ts` | Router ראשי + KB Flow מאוחד (שאלות, ניקוד, אבחון) | ~860 |

### Backend/AI - שרת ובינה מלאכותית
| קובץ | תפקיד | שורות |
|------|--------|--------|
| `lib/ai/prompt-builder.ts` | בניית Prompt ל-AI (Data Coordinator בלבד!) | ~345 |
| `lib/ai/client.ts` | OpenAI Client wrapper | - |

### Frontend State - ניהול מצב בצד הלקוח
| קובץ | תפקיד | שורות |
|------|--------|--------|
| `app/user/consult/questions/hooks/useHybridFlow.ts` | ניהול state, שליחת הודעות, עדכון context | ~546 |
| `app/user/consult/questions/page.tsx` | עמוד הצ'אט הראשי + רינדור רכיבים | ~306 |

### Frontend Components - רכיבי UI
| קובץ | תפקיד |
|------|--------|
| `FinalDiagnosisCard.tsx` | כרטיס אבחון סופי |
| `ChatBubble.tsx` | בועות הודעה |
| `MultiChoiceButtons.tsx` | כפתורי בחירה |
| `InstructionBubble.tsx` | הוראות ביצוע (inspect/fill) |

### Types - טיפוסים
| קובץ | תפקיד |
|------|--------|
| `lib/types/knowledge.ts` | DiagnosticState, Scenario, SafetyRule, WarningLight | ~142 |
| `lib/ai/types.ts` | UserAnswer, AI response types |

---

## 🔄 2. תיאור ה-Flow (Step-by-Step)

### תרשים זרימה ראשי

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INPUT (message + images)                    │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    useHybridFlow.ts → sendMessage()                      │
│    - בניית conversationHistory (Q&A pairs)                               │
│    - שליחת context מלא לשרת                                              │
│    - Success/Failure interceptors                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         route.ts → POST()                                │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          ▼                          ▼                          ▼
   ┌─────────────┐          ┌─────────────┐          ┌─────────────────┐
   │  MODE A-0   │          │   MODE A    │          │    MODE B       │
   │  KB-DRIVEN  │          │  SCENARIO   │          │    ANALYZER     │
   │ (light type │          │   RUNNER    │          │ (new requests)  │
   │  in context)│          │(scenarioId) │          │                 │
   └─────────────┘          └─────────────┘          └─────────────────┘
          │                          │                          │
          ▼                          ▼                          ▼
   ┌─────────────┐          ┌─────────────┐          ┌─────────────────┐
   │ route.ts    │          │  SCENARIOS  │          │context-analyzer │
   │ (KB inline) │          │    .ts      │          │      .ts        │
   └─────────────┘          └─────────────┘          └─────────────────┘
```

### שלב א': ניטור בטיחות (Safety First) - `context-analyzer.ts`

**מיקום:** `analyzeUserContext()` lines 173-192

```typescript
// סדר הפעולות:
for (const rule of SAFETY_RULES) {
  const matchedKeyword = rule.keywords.find(keyword =>
    containsNonNegatedKeyword(normalizedText, keyword)
  );
  if (matchedKeyword) {
    return { type: 'SAFETY_STOP', rule };  // ← עוצר הכל!
  }
}
```

**חוקי בטיחות קריטיים (מסיימים שיחה):**
- `brakes_fail` - אין בלמים
- `steering_fail` - הגה ננעל
- `smoke_fire` - עשן/אש
- `fuel_leak` - נזילת דלק
- `oil_pressure` - נורת שמן אדומה

**חוקי אזהרה (ממשיכים שיחה):**
- `safety_hood` - פתיחת מכסה מנוע
- `safety_under_car` - בדיקה מתחת לרכב
- `battery_acid` - קורוזיה על מצבר

### שלב ב': סיווג נורה/תרחיש - `context-analyzer.ts`

**פונקציה:** `detectWarningLight()` lines 55-162

```
קלט: "נדלקה לי הנורה" + תמונה
           │
           ▼
┌───────────────────────────────────────┐
│  1. בדיקת "תשובה פשוטה" (skip)        │
│     "דולקת קבוע", "מהבהבת" וכו'       │
└───────────────────────────────────────┘
           │ לא
           ▼
┌───────────────────────────────────────┐
│  2. בדיקת אזכור נורה                  │
│     hasLightNoun + hasLightVerb       │
└───────────────────────────────────────┘
           │ כן
           ▼
┌───────────────────────────────────────┐
│  3. בדיקת keywords.json               │
│     danger[] → severity: 'danger'     │
│     caution[] → severity: 'caution'   │
└───────────────────────────────────────┘
           │
           ▼
┌───────────────────────────────────────┐
│  4. בדיקת warning-lights.json         │
│     לפי שמות בעברית/אנגלית            │
└───────────────────────────────────────┘
           │
           ▼
   { lightId, severity } | null
```

### שלב ג': ניהול ה-KB Flow - `route.ts` (Inline)

**עקרונות:**
1. **KB Enforcement** - כל השאלות מגיעות מה-KB, לא מה-AI
2. **Fast Path** - אבחון מוקדם כשסיבה מגיעה לסף (DIAGNOSIS_THRESHOLD = 5)
3. **Structured Instructions** - החזרת הוראות מובנות עם actionType

**פונקציות מפתח (ב-route.ts):**

```typescript
// 1. זיהוי סימפטומים מטקסט (מ-car-symptoms.json)
detectSymptomFromText(userText) → SymptomMatch | null

// 2. קביעת תרחיש מתוך התשובות
determineScenario(lightType, answers)
  → 'flashing' | 'steady_symptoms' | 'steady_normal' | 'while_driving'

// 3. עדכון ניקוד סיבות
updateScores(scores, questionId, answer, lightType, scenarioId)
  → Record<string, number>

// 4. בדיקת תנאי אבחון
shouldDiagnose(scores, count, severity)
  → boolean (אם סיבה הגיעה לסף או הגענו למקסימום שאלות)

// 5. שליפת השאלה הבאה
getNextQuestion(lightType, scenarioId, askedIds, lastAnswer)
  → KBQuestion | null

// 6. יצירת אבחון מה-KB
generateDiagnosis(lightType, scenarioId, scores, answers)
  → { type: 'diagnosis_report', title, results, mechanicReport, ... }
```

### שלב ד': AI כ-Data Coordinator - `prompt-builder.ts`

**תפקיד ה-AI מוגבל ל:**
1. זיהוי נורות מתמונות (image recognition)
2. מיפוי טקסט חופשי ל-options מה-KB
3. **אסור** להמציא שאלות או אבחונים!

```typescript
// הפרומפט מכיל:
- הנחיות לזיהוי נורות מתמונה (לפי צורה)
- KB Context מסונן (רק הנורה הרלוונטית אם ידועה)
- היסטוריית שיחה עם אזהרות נגד חזרה על שאלות
- פורמט תגובה מחייב: { type: "question", text, options }
```

---

## 🧠 3. ניהול מצב (State Management)

### DiagnosticState - מבנה הסטייט

```typescript
interface DiagnosticState {
  // --- Scenario Runner State ---
  currentScenarioId: string | null;      // ID של התרחיש הפעיל
  currentStepId: string | null;          // ID של הצעד הנוכחי
  suspects: Record<string, number>;      // ניקוד חשודים { battery: 3, starter: -1 }
  reportData: {
    verified: string[];     // דברים שאומתו
    ruledOut: string[];     // דברים שנשללו
    skipped: string[];      // דברים שדולגו
    criticalFindings: string[];  // ממצאים קריטיים
  };

  // --- KB Warning Light State ---
  detectedLightType?: string;            // 'check_engine_light', 'battery_light'
  lightSeverity?: 'danger' | 'caution';  // נורה אדומה/כתומה
  currentLightScenario?: string;         // 'flashing', 'steady_symptoms'
  causeScores?: Record<string, number>;  // { misfire: 4, sensor_failure: 2 }
  askedQuestionIds?: string[];           // ['first_question', 'followup_steady']
  currentQuestionId?: string;            // ID השאלה הנוכחית

  // --- Flow Control ---
  kbSource?: boolean;                    // האם ה-flow מונחה ע"י KB
  isLightContext?: boolean;              // האם אנחנו באבחון נורה
  lastActionType?: 'fill' | 'inspect';   // סוג ההוראה האחרונה
  pendingScenarioId?: string;            // תרחיש להמשך אחרי אזהרת בטיחות
  awaitingLightConfirmation?: boolean;   // ממתינים לאישור שהנורה כבתה
}
```

### זרימת Context

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          useHybridFlow.ts                                │
│                                                                         │
│  state.context ──────► POST /api/ai/questions                           │
│       ▲                         │                                       │
│       │                         ▼                                       │
│       │              response.context ────────────────┐                 │
│       │                         │                     │                 │
│       │              response.detectedLightType ──────┤                 │
│       │              response.lightSeverity ──────────┤                 │
│       │              response.kbSource ───────────────┤                 │
│       │                                               │                 │
│       └───────────── contextUpdates ◄─────────────────┘                 │
│                                                                         │
│  🔧 קריטי: ALWAYS send full context!                                    │
│  body: { message, context: state.context, answers: conversationHistory }│
└─────────────────────────────────────────────────────────────────────────┘
```

### נקודות קריטיות בשמירת Context

1. **`useHybridFlow.ts` line 243**: שולח את `state.context` המלא לשרת
2. **`useHybridFlow.ts` lines 255-329**: מעדכן context מתגובת השרת
3. **`route.ts` lines 131-221**: MODE A-0 משתמש ב-context.detectedLightType
4. **`route.ts` lines 207-214**: מחזיר context מעודכן לקליינט

---

## ⚠️ 4. ניתוח נקודות תורפה (Critical Review)

### 4.1 קוד מיותר (Dead Code)

#### ❌ ב-`route.ts`:

| פונקציה/קטע | סטטוס | הסבר |
|-------------|--------|------|
| `updateSuspectsAndReport()` | ✅ בשימוש | עדיין נדרש ל-MODE A (Scenario Runner) |
| `generateMechanicReport()` | ✅ בשימוש | עדיין נדרש ל-MODE A |
| `callExpertAI()` | ✅ פעיל | שכבה 3 - AI מומחה לזיהוי תמונות ומקרים לא מוכרים |

**✅ הוסר:**
- `findKBAction()` - אוחד לתוך route.ts
- `detectLightType()` - הועבר ל-context-analyzer
- `getKBActionById()` - אוחד לתוך route.ts
- `handleLegacyAIFlow()` - הוחלף ב-callExpertAI()
- `buildResearchPrompt()` - הוסר (לא בשימוש)
- `buildSymptomPrompt()` - הוסר (לא בשימוש)
- `/api/ai/research` endpoint - הוסר (לא בשימוש)

#### ✅ ב-`prompt-builder.ts`:

| פונקציה | סטטוס |
|---------|--------|
| `buildChatPrompt()` | ✅ פעיל | משמש לאבחון נורות עם/בלי תמונה |
| `buildGeneralExpertPrompt()` | ✅ פעיל | שכבה 3 - מומחה AI כללי |

### 4.2 חוסר עקביות בטיפוסים

#### ⚠️ בין Backend ל-Frontend:

| נושא | Backend (route.ts) | Frontend (useHybridFlow.ts) |
|------|--------------------|-----------------------------|
| Response type | `type: 'diagnosis'` | מצפה ל-`'diagnosis'` או `'diagnosis_report'` ✅ |
| Options | `options: string[]` | מצפה ל-`string[]` ✅ |
| Context נested | `response.context.detectedLightType` | מטפל נכון ב-nested context ✅ |

#### ✅ תוקן:
- `useHybridFlow.ts` lines 287-321: מטפל נכון ב-context מקונן מהשרת

### 4.3 רכיבי UI לא מחוברים

| רכיב | בעיה | סטטוס |
|------|------|-------|
| `FinalDiagnosisCard.tsx` | מצפה ל-`results[]` עם `issue`, `probability`, `explanation` | ✅ route.ts מחזיר פורמט נכון |
| `InstructionBubble.tsx` | צריך `actionType: 'inspect' \| 'fill'` | ⚠️ לבדוק שמועבר נכון |
| `MultiChoiceButtons.tsx` | RTL alignment | ✅ תוקן עם flex-row-reverse |

---

## 🔧 5. בעיות ידועות ותיקונים נדרשים

### 5.1 בעיות קיימות

#### 🔴 בעיה: AI מחזיר פורמט שגוי

**תיאור:** לפעמים ה-AI מחזיר:
```json
{ "warning_light": "battery_light", "first_question": { "question": "..." } }
```
במקום:
```json
{ "type": "question", "text": "...", "options": [...] }
```

**תיקון ב-route.ts lines 545-612:**
```typescript
// Case 1: AI returned { warning_light: "...", first_question: {...} }
if (extracted.warning_light) {
  newLightType = extracted.warning_light;
  if (extracted.first_question) {
    extracted.type = 'question';
    extracted.text = extracted.first_question.question;
    extracted.options = extracted.first_question.options || ['כן', 'לא'];
  }
}
```

#### 🟡 בעיה: שאלות חוזרות

**סימפטום:** AI שואל את אותה שאלה פעמיים

**תיקון:** `route.ts` מנהל `askedQuestionIds` ב-context ומסנן שאלות שכבר נשאלו

#### 🟡 בעיה: Content Filter של OpenAI

**סימפטום:** "I'm sorry, I can't assist with that request"

**תיקון ב-route.ts:** Fallback לאבחון מבוסס KB אם יש מספיק מידע

### 5.2 המלצות לשיפור

1. **הוספת Logging מובנה:**
   ```typescript
   // לכל שלב ב-flow:
   console.log(`[KB Flow] Stage: ${stage}, Light: ${lightType}, Score: ${JSON.stringify(causeScores)}`);
   ```

2. **Validation Layer:**
   ```typescript
   // בתחילת route.ts:
   function validateRequest(body: RequestBody): ValidationResult {
     if (!body.message && !body.description) return { error: 'No input' };
     // ...
   }
   ```

3. **Fallback Diagnosis:**
   - אם AI נכשל, ליצור אבחון בסיסי מה-KB
   - אם KB לא מכיל את הנורה, להפנות למוסך

---

## 📊 6. מטריקות ותיקוף

### Flow Coverage

| סוג קלט | Flow | KB Coverage |
|---------|------|-------------|
| נורת צ'ק אנג'ין | MODE A-0 → route.ts (KB inline) | ✅ מלא |
| נורת מצבר | MODE A-0 → route.ts (KB inline) | ✅ מלא |
| נורת שמן | MODE A-0 → route.ts (KB inline) | ✅ מלא |
| "הרכב לא מניע" | MODE A → Scenario Runner | ✅ מלא |
| "יוצא עשן" | SAFETY_STOP | ✅ מלא |
| "בעיה ברכב" | CONSULT_AI → handleLegacyAIFlow | ⚠️ תלוי ב-AI |

### סף אבחון

| Severity | Max Questions | Threshold Score |
|----------|---------------|-----------------|
| danger (red) | 3 | 3 |
| caution (orange) | 5 | 3 |

---

## 📝 7. סיכום

### מה עובד טוב ✅
1. היררכיה קבועה: Safety → Light → Scenario → AI
2. KB-driven flow מונע "הזיות" של AI
3. Fast Path מאפשר אבחון מהיר כשיש ודאות
4. Context persistence מאפשר המשכיות שיחה

### מה דורש שיפור ⚠️
1. Response format validation - לוודא AI מחזיר פורמט נכון
2. Better error recovery - כשה-KB לא מכיל מידע
3. Comprehensive testing - בדיקות E2E לכל flows

### מה הוסר 🗑️
1. Hardcoded diagnosis logic מ-handleLegacyAIFlow
2. Duplicate detection logic (אוחד לתוך route.ts)
3. Forced follow-up logic (מנוהל ע"י KB)

---

*נוצר אוטומטית - עודכן לאחרונה: ${new Date().toLocaleString('he-IL')}*

