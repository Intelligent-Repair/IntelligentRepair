# תכנית שיפור מערכת דיווח תיקונים - גרסה סופית

## שינויים עיקריים מהתכנית הקודמת

### 1. טבלת קטגוריות תקלות
- ✅ **טבלה נפרדת** `problem_categories` (לא enum)
- ✅ **15 קטגוריות** - כולל כל הקטגוריות מהדשבורד + נוספות מ-REPAIRS + "אחר"
- ✅ **Foreign Key** מ-REPAIRS.problem_category ל-problem_categories.code
- ✅ **עקביות** - אותה רשימה בדשבורד ובדיווח תיקון

### 2. עיבוד טקסט OpenAI
- ✅ **בזמן אמת (Sync)** - המשתמש ממתין לעיבוד
- ✅ **רק הטקסט המעובד נשמר** - לא שומרים את הטקסט המקורי
- ✅ **שדה יחיד** - `mechanic_description_ai` בלבד (ללא mechanic_description)

### 3. Flow מלא

```
מכונאי בוחר "דווח על סיום טיפול"
    ↓
דף דיווח נטען
    ↓
1. טעינת נתוני רכב מ-garage_request (read-only)
2. בחירת קטגוריית תקלה (dropdown מ-problem_categories)
3. הזנת תיאור מפורט
4. הזנת שעות עבודה
5. לחיצה על "סיים טיפול"
    ↓
API: /api/garage/requests/[request_id]/complete
    ↓
1. עדכון garage_request.status = 'closed_yes'
2. קריאה ל-OpenAI API לעיבוד הטקסט
3. יצירת repair ב-REPAIRS עם:
   - vehicle_info (מ-garage_request)
   - problem_category
   - mechanic_description_ai (הטקסט המעובד בלבד)
   - labor_hours
   - completed_at
   - garage_request_id
    ↓
החזרה לדף פניות
```

## קבצי Migration

### 1. `database_migration_problem_categories.sql`
- יצירת טבלת `problem_categories`
- הוספת 15 קטגוריות (כולל "אחר")
- Indexes לביצועים

### 2. `database_migration_repairs_upgrade.sql` (מעודכן)
- הוספת שדות חדשים ל-REPAIRS
- Foreign Key ל-problem_categories
- **ללא** שדה mechanic_description (רק mechanic_description_ai)

## קטגוריות תקלות (15 קטגוריות)

1. engine - מנוע
2. brakes - בלמים
3. electrical - חשמל
4. ac - מיזוג אוויר
5. starting - מערכת התנעה
6. gearbox - תיבת הילוכים
7. noise - רעש/רטט
8. suspension - מתלים
9. transmission - תמסורת
10. fuel_system - מערכת דלק
11. cooling_system - מערכת קירור
12. exhaust - מערכת פליטה
13. tires - צמיגים
14. steering - הגה
15. other - אחר

## קבצים לעדכון

### Frontend:
1. `app/garage/requests/[request_id]/report/page.tsx`
   - טעינת נתוני רכב מ-API
   - Dropdown קטגוריות מ-API
   - טופס פשוט: category + description + labor_hours
   - כפתור "סיים טיפול"

2. `app/garage/dashboard/page.tsx`
   - עדכון filter קטגוריות לטעון מ-problem_categories
   - תצוגת קטגוריות ב-repairs

### Backend:
1. `app/api/garage/requests/[request_id]/complete/route.ts` (חדש)
   - אימות garage_request
   - עדכון status ל-closed_yes
   - קריאה ל-OpenAI לעיבוד טקסט
   - יצירת repair

2. `app/api/garage/dashboard/filters/route.ts` (עדכון)
   - להוסיף endpoint להחזרת קטגוריות מ-problem_categories

3. `app/api/garage/dashboard/repairs/route.ts` (עדכון)
   - להוסיף שאילתת problem_category
   - להוסיף join ל-problem_categories לשם עברית

4. `lib/ai/text-improver.ts` (חדש - אופציונלי)
   - פונקציה לעיבוד טקסט מקצועי

## API Endpoints חדשים/מעודכנים

### GET `/api/problem-categories`
מחזיר רשימת כל הקטגוריות הפעילות:
```json
{
  "categories": [
    { "code": "engine", "name_he": "מנוע", "display_order": 1 },
    ...
  ]
}
```

### POST `/api/garage/requests/[request_id]/complete`
משלים תיקון ויוצר repair:
- Body: `{ problem_category, description, labor_hours }`
- עיבוד OpenAI בזמן אמת
- יצירת repair

## OpenAI Integration

### Prompt לעיבוד טקסט:
```
אתה מומחה רכב מקצועי. שפר את הטקסט הטכני הבא כך שיהיה:
- מדויק וטכני יותר
- מובנה וקריא יותר  
- משתמש במינוח מקצועי תקין
- שומר על כל המידע החשוב

קטגוריית התקלה: [problem_category]
הטקסט המקורי: [description]

החזר רק את הטקסט המשופר, ללא הסברים נוספים.
```

### שימוש:
- קריאה מ-`lib/ai/client.ts` (OpenAIClient קיים)
- Model: gpt-4o
- Timeout: 30 שניות
- Retry: 2 פעמים

## Validation

### Client-side:
- קטגוריית תקלה: חובה
- תיאור: חובה, מינימום 50 תווים
- שעות עבודה: חובה, מספר חיובי

### Server-side:
- אימות קטגוריה קיימת ב-problem_categories
- אימות garage_request קיים ושייך למוסך
- אימות status הוא pending/viewed
- טיפול בשגיאות OpenAI (אם נכשל, לשמור ללא עיבוד?)

## Error Handling

1. **garage_request לא נמצא** → 404
2. **garage_request לא שייך למוסך** → 403
3. **סטטוס לא תקין** → 400
4. **קטגוריה לא קיימת** → 400
5. **OpenAI נכשל** → 2 אופציות:
   - Option A: להחזיר שגיאה למשתמש (המשתמש מנסה שוב)
   - Option B: לשמור repair עם mechanic_description_ai = NULL (לעדכן מאוחר יותר)
   
   **המלצה**: Option A - יותר בטוח

## Testing Checklist

- [ ] טבלת problem_categories נוצרה עם כל הקטגוריות
- [ ] Foreign Key עובד נכון
- [ ] דף דיווח טוען נתוני רכב
- [ ] Dropdown קטגוריות מציג נכון
- [ ] OpenAI מעבד טקסט נכון
- [ ] Repair נוצר עם כל הנתונים
- [ ] Dashboard מציג קטגוריות נכון
- [ ] פילטרים עובדים עם קטגוריות

## סדר ביצוע

1. **הרץ Migration 1**: `database_migration_problem_categories.sql`
2. **הרץ Migration 2**: `database_migration_repairs_upgrade.sql`
3. **צור API**: `/api/problem-categories`
4. **עדכן דף דיווח**: טעינת קטגוריות + עיצוב חדש
5. **צור API**: `/api/garage/requests/[request_id]/complete`
6. **עדכן dashboard**: טעינת קטגוריות + תצוגת repairs
7. **בדוק end-to-end**

## הערות חשובות

- ✅ **רק הטקסט המעובד נשמר** - לא הטקסט המקורי
- ✅ **טבלת קטגוריות** - עקביות מלאה בין דשבורד לדיווח
- ✅ **15 קטגוריות** - כולל "אחר"
- ✅ **Sync OpenAI** - בזמן אמת, המשתמש ממתין
- ✅ **Foreign Keys** - שלמות הנתונים

