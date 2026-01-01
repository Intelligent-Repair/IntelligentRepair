# תיעוד API של ChatGPT - IntelligentRepair

## תוכן עניינים
1. [מבנה הפרויקט](#מבנה-הפרויקט)
2. [תיקיית lib/ai](#תיקיית-libai)
3. [תיקיית app/api/ai](#תיקיית-appapiai)
4. [תיקיית app/user/consult/questions](#תיקיית-appuserconsultquestions)

---

## מבנה הפרויקט

```
client/
├── lib/
│   └── ai/                    # ספריית AI - לוגיקה מרכזית ל-ChatGPT API
│       ├── client.ts          # לקוח OpenAI (ChatGPT) - ניהול קריאות API
│       ├── image-utils.ts     # עיבוד תמונות למולטימדיה
│       ├── prompt-builder.ts  # בניית prompts בעברית ל-ChatGPT
│       ├── retry.ts           # לוגיקת retry ו-timeout
│       ├── sanitize.ts        # ניקוי וסינון קלט
│       ├── state-machine.ts   # מכונת מצבים לאבחון
│       └── types.ts           # הגדרות TypeScript
│
├── app/
│   ├── api/
│   │   └── ai/                # API Routes - נקודות קצה ל-ChatGPT
│   │       ├── aiUtils.ts      # כלי עזר למיצוי JSON
│   │       ├── questions/
│   │       │   └── route.ts    # API endpoint לשאלות ואבחון
│   │       └── research/
│   │           └── route.ts    # API endpoint למחקר ראשוני
│   │
│   └── user/
│       └── consult/
│           └── questions/     # ממשק משתמש לאבחון AI
│               ├── page.tsx    # עמוד ראשי - ניהול זרימת השאלות
│               ├── hooks/
│               │   └── useAIStateMachine.ts  # Hook לניהול מצב
│               └── components/ # רכיבי UI
│                   ├── ChatBubble.tsx
│                   ├── FinalDiagnosisCard.tsx
│                   ├── FreeTextInput.tsx
│                   ├── InstructionBubble.tsx
│                   ├── MultiChoiceButtons.tsx
│                   ├── TypingBubble.tsx
│                   ├── TypingIndicator.tsx
│                   ├── WarningBanner.tsx
│                   └── YesNoButtons.tsx
```

---

## תיקיית lib/ai

### סקירה כללית
תיקייה זו מכילה את הלוגיקה המרכזית לתקשורת עם ChatGPT API. כל הקבצים כאן הם utilities שניתן לעשות בהם שימוש חוזר בכל חלקי האפליקציה.

### קבצים מפורטים:

#### 1. `client.ts` - לקוח OpenAI (ChatGPT)
**תפקיד:** ניהול כל הקריאות ל-ChatGPT API.

**תכונות עיקריות:**
- **יצירת לקוח OpenAI:** משתמש ב-`OpenAI` SDK עם מפתח API
- **תמיכה במולטימדיה:** יכול לשלוח טקסט + תמונות (vision API)
- **ניהול timeout:** timeout של 30 שניות (מוגדל למולטימדיה)
- **לוגיקת retry:** ניסיונות חוזרים עם exponential backoff
- **ניהול שגיאות:** זיהוי content filter refusals ושגיאות אחרות
- **JSON mode:** תמיכה ב-`response_format: { type: "json_object" }` לקבלת תשובות מובנות

**פונקציות מרכזיות:**
- `createOpenAIClient()` - יצירת instance של לקוח
- `generateContent()` - שליחת prompt ל-ChatGPT וקבלת תשובה

**דוגמת שימוש:**
```typescript
const client = createOpenAIClient(apiKey, "gpt-4o", {
  responseFormat: { type: "json_object" }
});

const response = await client.generateContent(prompt, {
  images: imageParts,
  temperature: 0.7
});
```

---

#### 2. `image-utils.ts` - עיבוד תמונות
**תפקיד:** המרת תמונות לפורמט base64 לשליחה ל-ChatGPT Vision API.

**תכונות:**
- **אימות גודל:** בדיקת גודל תמונה (מינימום 1KB, מקסימום 5MB)
- **זיהוי MIME type:** זיהוי אוטומטי של סוג התמונה (PNG, JPEG, WebP, GIF)
- **המרה ל-base64:** המרת תמונה ל-base64 עם inlineData format
- **ניהול שגיאות:** טיפול בשגיאות טעינה והמרה

**פונקציות:**
- `fetchImageAsInlineData(url)` - טעינת תמונה מהאינטרנט והמרתה לפורמט ChatGPT

**שימוש:**
```typescript
const imagePart = await fetchImageAsInlineData("https://example.com/image.jpg");
// מחזיר: { inlineData: { mimeType: "image/jpeg", data: "base64..." } }
```

---

#### 3. `prompt-builder.ts` - בניית Prompts
**תפקיד:** בניית prompts בעברית מותאמים לאבחון רכב.

**תכונות עיקריות:**
- **Prompts מותאמים:** prompts בעברית עם הוראות ספציפיות לאבחון רכב
- **זיהוי נורות אזהרה:** זיהוי אוטומטי של נורות אדומות/כתומות (שמן, מנוע, בלם, וכו')
- **אזהרות בטיחות:** הוספת אזהרות אוטומטיות למצבים מסוכנים
- **אופטימיזציה של tokens:** סיכום תשובות קודמות לחיסכון ב-tokens
- **תמיכה בתמונות:** הוראות מיוחדות לזיהוי נורות מתמונות

**פונקציות מרכזיות:**
- `buildChatPrompt()` - בניית prompt לשאלות במהלך האבחון
- `buildDiagnosisPrompt()` - בניית prompt לאבחון סופי
- `buildResearchPrompt()` - בניית prompt למחקר ראשוני
- `buildShortDescriptionPrompt()` - בניית prompt לתיאור קצר

**דוגמת prompt:**
הפונקציה בונה prompts בעברית עם הוראות מפורטות:
- זיהוי נורות מתמונות (אסור לשאול "מה אתה רואה" - צריך לזהות ישירות)
- לוגיקה לסוגי שאלות (yes/no, multi-choice, text input)
- כללי אבחון (מתי להחזיר אבחון, מתי להמשיך לשאול)
- אזהרות בטיחות אוטומטיות

---

#### 4. `retry.ts` - לוגיקת Retry ו-Timeout
**תפקיד:** ניהול ניסיונות חוזרים ושגיאות timeout.

**תכונות:**
- **Exponential backoff:** המתנה הולכת וגדלה בין ניסיונות
- **זיהוי שגיאות retryable:** זיהוי אוטומטי של שגיאות שניתן לנסות שוב (429, 500, timeout, וכו')
- **Timeout wrapper:** הגבלת זמן לביצוע פעולות

**פונקציות:**
- `withRetry()` - ביצוע פעולה עם ניסיונות חוזרים
- `withTimeout()` - הגבלת זמן לביצוע promise

**שימוש:**
```typescript
const result = await withRetry(
  () => apiCall(),
  { maxRetries: 2, backoffMs: [1000, 2000] }
);
```

---

#### 5. `sanitize.ts` - ניקוי קלט
**תפקיד:** ניקוי וסינון קלט משתמש לפני שליחה ל-ChatGPT.

**תכונות:**
- **הסרת HTML:** הסרת תגי HTML וסקריפטים
- **הסרת תווים מסוכנים:** הסרת Unicode control characters
- **הגבלת אורך:** הגבלת אורך טקסט (5000 תווים, 2000 לתיאורים)
- **ניקוי רווחים:** איחוד רווחים כפולים

**פונקציות:**
- `sanitizeInput()` - ניקוי כללי
- `sanitizeDescription()` - ניקוי תיאורים (אורך קצר יותר)
- `normalizeVehicle()` - ניקוי פרטי רכב

---

#### 6. `state-machine.ts` - מכונת מצבים
**תפקיד:** ניהול מצב האבחון בצורה מובנית.

**מצבים:**
- `IDLE` - מצב התחלתי
- `ASKING` - שואל שאלה
- `WAITING_FOR_ANSWER` - ממתין לתשובה
- `PROCESSING` - מעבד תשובה
- `FINISHED` - סיים אבחון
- `ERROR` - שגיאה

**Actions:**
- `INIT` - אתחול עם רכב ותיאור
- `ASKING` - התחלת שאלה
- `NEXT_QUESTION` - שאלה חדשה
- `ANSWER` - תשובת משתמש
- `FINISH` - סיום עם אבחון
- `ERROR` - שגיאה

**פונקציות:**
- `aiStateReducer()` - reducer function (pure function)
- `createInitialState()` - יצירת מצב התחלתי
- `stateMachineHelpers` - פונקציות עזר לבדיקת מצב

---

#### 7. `types.ts` - הגדרות TypeScript
**תפקיד:** הגדרת כל הטיפוסים המשמשים במערכת AI.

**טיפוסים מרכזיים:**
- `InlineDataPart` - פורמט תמונה ל-ChatGPT
- `VehicleInfo` - פרטי רכב
- `UserAnswer` - תשובת משתמש
- `AIQuestion` - שאלה מ-ChatGPT
- `DiagnosisData` - תוצאות אבחון
- `AIState` - מצב מכונת המצבים
- `ChatMessage` - הודעת צ'אט

---

## תיקיית app/api/ai

### סקירה כללית
תיקייה זו מכילה את נקודות הקצה (API routes) שמתקשרות עם ChatGPT. כל route הוא Next.js API route שמקבל בקשות HTTP ומחזיר תשובות JSON.

### קבצים מפורטים:

#### 1. `aiUtils.ts` - כלי עזר
**תפקיד:** פונקציות עזר לעיבוד תשובות מ-ChatGPT.

**פונקציות:**
- `extractJSON()` - מיצוי JSON מתשובת ChatGPT (הסרת markdown code blocks)

**שימוש:**
```typescript
const json = extractJSON("```json\n{...}\n```");
// מחזיר: {...}
```

---

#### 2. `questions/route.ts` - API לשאלות ואבחון
**תפקיד:** נקודת הקצה הראשית לאבחון AI. מנהלת את כל זרימת השאלות והאבחון.

**Flow:**
1. משתמש שולח תיאור + תמונות (אופציונלי)
2. ChatGPT מחזיר שאלה או אבחון (אם confidence >= 90%)
3. משתמש עונה (עד 5 שאלות)
4. אחרי 5 שאלות או 90% confidence → אבחון סופי

**תכונות מרכזיות:**

**א. עיבוד תמונות:**
- טעינת תמונות מ-URLs
- המרה לפורמט base64
- שליחה ל-ChatGPT Vision API

**ב. זיהוי תשובות:**
- `isUncertainAnswer()` - זיהוי תשובות "לא בטוח", "לא יודע"
- `isSuccessAnswer()` - זיהוי תשובות שמעידות על פתרון הבעיה
- `shouldTriggerInstructionsForNo()` - זיהוי מתי להציג הוראות

**ג. הוראות אוטומטיות:**
- `generateInstructionMessage()` - יצירת הוראות לבדיקות (שמן, מצבר, בלמים, וכו')
- תרחישים מוגדרים מראש עם שלבים מפורטים
- תמיכה במידע ספציפי לרכב (סוג שמן, לחץ אוויר, וכו')

**ד. ניהול אבחון:**
- `buildDiagnosisResponse()` - בניית תשובת אבחון מובנית
- `generateFinalDiagnosis()` - יצירת אבחון סופי
- `isClearCaseForDiagnosis()` - זיהוי מקרים ברורים לאבחון מוקדם

**ה. בטיחות:**
- `isDangerousContext()` - זיהוי מצבים מסוכנים (נורות אדומות)
- `isCautionContext()` - זיהוי מצבי זהירות (נורות כתומות)
- `checkForCriticalLights()` - זיהוי נורות קריטיות

**ו. מניעת כפילויות:**
- בדיקת שאלות שכבר נשאלו
- מניעת חזרה על שאלות זהות

**פרמטרים:**
- `description` - תיאור הבעיה
- `answers` - מערך תשובות קודמות
- `image_urls` - רשימת URLs של תמונות (עד 3)
- `vehicle` - פרטי רכב (לא נשלח ל-ChatGPT, רק למאגר)

**תשובה:**
```json
{
  "type": "question" | "diagnosis" | "instruction",
  "question": "שאלה בעברית",
  "options": ["אופציה 1", "אופציה 2"],
  "confidence": 0.85,
  "safety_warning": "אזהרת בטיחות (אופציונלי)",
  "caution_notice": "הודעת זהירות (אופציונלי)"
}
```

---

#### 3. `research/route.ts` - API למחקר ראשוני
**תפקיד:** נקודת קצה למחקר ראשוני על הבעיה (אופציונלי).

**תכונות:**
- שימוש ב-`gpt-4o-mini` לחיסכון בעלויות
- טמפרטורה נמוכה (0.2) לתשובות עקביות
- אימות עם Zod schema
- החזרת מילות מפתח, חומרה, וסיבות אפשריות

**פרמטרים:**
- `description` - תיאור הבעיה

**תשובה:**
```json
{
  "top_causes": ["סיבה 1", "סיבה 2"],
  "differentiating_factors": ["גורם 1", "גורם 2"],
  "reasoning": "הסבר",
  "severity": "low" | "medium" | "high" | "critical",
  "keywords": ["מילת מפתח 1", "מילת מפתח 2"]
}
```

---

## תיקיית app/user/consult/questions

### סקירה כללית
תיקייה זו מכילה את ממשק המשתמש לאבחון AI. זהו החלק החזיתי שמציג את השאלות, מקבל תשובות, ומציג את האבחון הסופי.

### קבצים מפורטים:

#### 1. `page.tsx` - עמוד ראשי
**תפקיד:** ניהול כל זרימת האבחון בצד הלקוח.

**תכונות מרכזיות:**

**א. ניהול מצב:**
- שימוש ב-`useAIStateMachine` hook לניהול מצב
- שמירת מצב ב-sessionStorage לשחזור
- ניהול תמונות מ-draft

**ב. תקשורת עם API:**
- `fetchResearchWithRetry()` - שליחת בקשה למחקר ראשוני
- `handleAnswer()` - שליחת תשובה וקבלת שאלה חדשה
- ניהול timeout ו-retry

**ג. עיבוד תשובות:**
- `parseQuestion()` - פרסור תשובת שאלה
- `parseDiagnosis()` - פרסור תשובת אבחון
- טיפול בשגיאות עם fallbacks

**ד. UI:**
- הצגת הודעות צ'אט
- הצגת שאלות עם אפשרויות בחירה
- הצגת אבחון סופי
- הצגת אזהרות בטיחות

**ה. שמירה:**
- `finalizeDraftAndCreateRequest()` - שמירת אבחון כ-request
- ניקוי sessionStorage לאחר שמירה

---

#### 2. `hooks/useAIStateMachine.ts` - Hook לניהול מצב
**תפקיד:** React hook לניהול מצב האבחון.

**תכונות:**
- שימוש ב-`useReducer` עם `aiStateReducer`
- מעקב אחר שינויים ב-`draft_id` לאיפוס מצב
- Actions נוחים לשימוש:
  - `init()` - אתחול
  - `nextQuestion()` - שאלה חדשה
  - `answer()` - תשובה
  - `finish()` - סיום
  - `error()` - שגיאה

**שימוש:**
```typescript
const { state, dispatch, helpers } = useAIStateMachine();

dispatch.init({ vehicle, description });
dispatch.nextQuestion(question);
dispatch.answer("כן", "האם יש רעש?");
```

---

#### 3. `components/` - רכיבי UI

##### `ChatBubble.tsx`
**תפקיד:** הצגת הודעות צ'אט (משתמש/AI).

**תכונות:**
- תמיכה בתמונות
- אפקט typewriter (אופציונלי)
- עיצוב שונה למשתמש ו-AI

---

##### `FinalDiagnosisCard.tsx`
**תפקיד:** הצגת אבחון סופי.

**תכונות:**
- הצגת אבחנה מובילה + אפשרויות נוספות
- הצגת הסבר ("למה אנחנו חושבים שזוהי הבעיה?")
- הצגת המלצות לבדיקות עצמיות
- דיסקליימר

---

##### `FreeTextInput.tsx`
**תפקיד:** שדה קלט טקסט חופשי.

**תכונות:**
- textarea עם auto-resize
- שליחה ב-Enter
- עיצוב מודרני עם אנימציות

---

##### `InstructionBubble.tsx`
**תפקיד:** הצגת הוראות לבדיקה (כשמשתמש אומר "לא יודע").

**תכונות:**
- עיצוב שונה מהודעות רגילות (צבע כתום)
- הצגת שלבים מפורטים
- תמיכה בפורמט markdown

---

##### `MultiChoiceButtons.tsx`
**תפקיד:** כפתורי בחירה מרובה.

**תכונות:**
- תמיכה ב-3-5 אפשרויות
- אנימציות לחיצה
- עיצוב pill-shaped

---

##### `TypingIndicator.tsx`
**תפקיד:** אינדיקטור הקלדה (כש-AI "כותב").

**תכונות:**
- 3 נקודות אנימציה
- עיצוב iMessage-style

---

##### `WarningBanner.tsx`
**תפקיד:** באנר אזהרה (סכנה/זהירות).

**תכונות:**
- שני סוגים: danger (אדום) ו-caution (כתום)
- כפתור סגירה
- אנימציות

---

##### `YesNoButtons.tsx`
**תפקיד:** כפתורי כן/לא.

**תכונות:**
- עיצוב דומה ל-MultiChoiceButtons
- אנימציות לחיצה

---

## זרימת עבודה כללית

### 1. אתחול
```
משתמש → טופס → questions/page.tsx
  ↓
טעינת תמונות מ-sessionStorage
  ↓
אתחול state machine
  ↓
שליחת בקשה ל-/api/ai/research (אופציונלי)
```

### 2. שאלות
```
questions/page.tsx → /api/ai/questions
  ↓
route.ts → lib/ai/client.ts → ChatGPT API
  ↓
ChatGPT מחזיר שאלה/אבחון
  ↓
route.ts מעבד תשובה
  ↓
questions/page.tsx מציג שאלה
  ↓
משתמש עונה
  ↓
חזרה ל-2
```

### 3. אבחון
```
ChatGPT מחזיר type: "diagnosis"
  ↓
route.ts בונה תשובת אבחון
  ↓
questions/page.tsx מציג FinalDiagnosisCard
  ↓
משתמש שומר כ-request
```

---

## נקודות חשובות

### 1. אבטחה
- כל הקלט מנוקה ב-`sanitize.ts` לפני שליחה ל-ChatGPT
- אין שליחת פרטי רכב ל-ChatGPT (רק למאגר)
- ניהול שגיאות content filter

### 2. ביצועים
- שימוש ב-`gpt-4o-mini` למחקר (חיסכון בעלויות)
- שימוש ב-`gpt-4o` לשאלות ואבחון (דיוק גבוה)
- אופטימיזציה של prompts לחיסכון ב-tokens
- retry logic למניעת אובדן בקשות

### 3. חוויית משתמש
- timeout handling עם הודעות למשתמש
- fallback questions במקרה של שגיאה
- אנימציות חלקות
- תמיכה מלאה ב-RTL

### 4. תמיכה בתמונות
- זיהוי אוטומטי של נורות מתמונות
- אסור לשאול "מה אתה רואה" - צריך לזהות ישירות
- תמיכה עד 3 תמונות

---

## סיכום

מערכת האבחון AI בנויה על ChatGPT API עם:
- **לוגיקה מרכזית** ב-`lib/ai/` - ניתנת לשימוש חוזר
- **API routes** ב-`app/api/ai/` - נקודות קצה מובנות
- **ממשק משתמש** ב-`app/user/consult/questions/` - חוויית משתמש חלקה

כל הקוד כתוב בעברית עם תמיכה מלאה ב-RTL, ניהול שגיאות מתקדם, ואבטחה גבוהה.

