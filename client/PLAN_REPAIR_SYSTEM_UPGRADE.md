# תכנית שיפור מערכת דיווח תיקונים ו-REPAIRS

## מטרה
לשדרג את מערכת דיווח התיקונים כך שתשמור נתונים איכותיים ב-REPAIRS למטרות סטטיסטיקה ולמידה.

## 1. עדכון טבלת REPAIRS

### שדות חדשים להוספה:
```sql
ALTER TABLE public.repairs ADD COLUMN IF NOT EXISTS vehicle_info JSONB NULL;
ALTER TABLE public.repairs ADD COLUMN IF NOT EXISTS problem_category VARCHAR(50) NULL;
ALTER TABLE public.repairs ADD COLUMN IF NOT EXISTS mechanic_description TEXT NULL;
ALTER TABLE public.repairs ADD COLUMN IF NOT EXISTS mechanic_description_ai TEXT NULL;
ALTER TABLE public.repairs ADD COLUMN IF NOT EXISTS labor_hours DECIMAL(5,2) NULL;
ALTER TABLE public.repairs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL;
ALTER TABLE public.repairs ADD COLUMN IF NOT EXISTS garage_request_id UUID NULL;
```

### Foreign Key:
```sql
ALTER TABLE public.repairs 
ADD CONSTRAINT repairs_garage_request_id_fkey 
FOREIGN KEY (garage_request_id) 
REFERENCES public.garage_requests(id) 
ON DELETE SET NULL;
```

### Constraint לקטגוריית תקלה:
```sql
ALTER TABLE public.repairs
ADD CONSTRAINT valid_problem_category CHECK (
  problem_category IS NULL OR
  problem_category IN (
    'engine', 'brakes', 'electrical', 'ac', 'starting',
    'gearbox', 'noise', 'suspension', 'transmission',
    'fuel_system', 'cooling_system', 'exhaust', 'tires',
    'steering', 'other'
  )
);
```

## 2. עדכון דף דיווח (`app/garage/requests/[request_id]/report/page.tsx`)

### מבנה הטופס החדש:
1. **Section 1 - נתוני רכב (read-only)**
   - טעינה אוטומטית מ-garage_request
   - הצגה: יצרן, דגם, שנת ייצור, מספר רישוי

2. **Section 2 - קטגוריית תקלה (dropdown)**
   - רשימה: engine, brakes, electrical, ac, starting, gearbox, noise, suspension, transmission, fuel_system, cooling_system, exhaust, tires, steering, other
   - שדה חובה

3. **Section 3 - תיאור מפורט (textarea)**
   - טקסט חופשי שהמכונאי מזין
   - שדה חובה
   - מינימום 50 תווים

4. **Section 4 - שעות עבודה (number input)**
   - שדה חובה
   - ערכים חיוביים בלבד

5. **כפתור "סיים טיפול"**
   - במקום "שמור דיווח"

### Flow חדש:
- טעינת נתוני garage_request בעת טעינת העמוד
- שליחה ל-API endpoint חדש: `/api/garage/requests/[id]/complete`

## 3. API Endpoint חדש (`app/api/garage/requests/[request_id]/complete/route.ts`)

### לוגיקה:
1. אימות המשתמש והמוסך
2. אימות ש-garage_request קיים ושייך למוסך
3. אימות שהסטטוס הוא pending או viewed
4. קבלת: problem_category, mechanic_description, labor_hours
5. טעינת נתוני רכב מ-garage_request.vehicle_info
6. עדכון garage_request.status ל-'closed_yes'
7. קריאה ל-OpenAI API לעיבוד הטקסט (background או sync)
8. יצירת רשומה חדשה ב-REPAIRS עם כל הנתונים:
   - request_id (מ-garage_request.request_id)
   - garage_id
   - vehicle_info (מ-garage_request.vehicle_info)
   - problem_category
   - mechanic_description
   - mechanic_description_ai (מהתוצאה של OpenAI)
   - labor_hours
   - status: 'completed'
   - completed_at: now()
   - garage_request_id
9. החזרת הצלחה

### פונקציית OpenAI לשיפור הטקסט:
```typescript
async function improveMechanicDescription(text: string): Promise<string> {
  // קריאה ל-OpenAI API עם prompt מתאים
  // החזרת טקסט משופר
}
```

## 4. עדכון API קיימים

### `app/api/garage/dashboard/repairs/route.ts`:
- להוסיף שאילתת השדות החדשים:
  - vehicle_info
  - problem_category
  - mechanic_description
  - mechanic_description_ai
  - labor_hours
  - completed_at
  - garage_request_id

### `app/api/garage/dashboard/pie/route.ts`:
- להוסיף אפשרות לסנן לפי problem_category

## 5. עדכון הדשבורד (`app/garage/dashboard/page.tsx`)

### תצוגת Repairs:
- להוסיף עמודות חדשות בטבלה:
  - קטגוריית תקלה (problem_category)
  - תיאור מפורט (mechanic_description_ai - הגרסה המשופרת)
  - שעות עבודה (labor_hours)
- להוסיף אפשרות לצפייה בפרטי תיקון (modal או עמוד נפרד)

### סטטיסטיקות חדשות אפשריות:
- תפלגות לפי קטגוריות תקלות
- ממוצע שעות עבודה לפי קטגוריית תקלה
- רשימת תיקונים עם תיאורים משופרים

## 6. קבצי Migration

### `database_migration_repairs_upgrade.sql`:
- הוספת כל השדות החדשים
- הוספת Foreign Key
- הוספת Constraints
- הוספת Indexes (אם נדרש)

## 7. קבצים לעדכון

### Frontend:
1. `app/garage/requests/[request_id]/report/page.tsx` - עיצוב מחדש מלא
2. `app/garage/dashboard/page.tsx` - עדכון תצוגת repairs

### Backend:
1. `app/api/garage/requests/[request_id]/complete/route.ts` - endpoint חדש
2. `app/api/garage/dashboard/repairs/route.ts` - עדכון query
3. `lib/ai/text-improver.ts` - פונקציה חדשה לעיבוד טקסט (אופציונלי)

## 8. Intregration עם OpenAI

### Prompt מוצע:
```
אתה מומחה רכב מקצועי. שפר את הטקסט הטכני הבא כך שיהיה:
- מדויק וטכני יותר
- מובנה וקריא יותר
- משתמש במינוח מקצועי תקין
- שומר על כל המידע החשוב

הטקסט המקורי:
[mechanic_description]

החזר רק את הטקסט המשופר, ללא הסברים נוספים.
```

### אופציה 1: Sync (פשוט יותר, אבל איטי יותר)
- ביצוע בזמן אמת ב-API endpoint
- המשתמש ממתין לעיבוד
- פשוט יותר ליישום

### אופציה 2: Background (מהיר יותר, אבל מורכב יותר)
- יצירת repair עם mechanic_description_ai = NULL
- ביצוע עיבוד ברקע
- עדכון מאוחר יותר
- דורש מערכת jobs או webhooks

**המלצה**: להתחיל עם Sync, ולעבור ל-Background אם יש בעיות ביצועים.

## 9. UI/UX - דף דיווח

### Layout:
```
┌─────────────────────────────────────┐
│  [←]  דיווח על סיום טיפול          │
├─────────────────────────────────────┤
│                                     │
│  📋 נתוני רכב                      │
│  ┌─────────────────────────────┐   │
│  │ יצרן: Toyota (read-only)   │   │
│  │ דגם: Corolla (read-only)   │   │
│  │ שנת ייצור: 2018 (read-only)│   │
│  │ מספר רישוי: 2441975 (read) │   │
│  └─────────────────────────────┘   │
│                                     │
│  🔧 קטגוריית תקלה *                │
│  [Dropdown: בחר קטגוריה...]        │
│                                     │
│  📝 תיאור מפורט *                  │
│  [Textarea - גדול]                  │
│                                     │
│  ⏱️ שעות עבודה *                   │
│  [Input: number]                    │
│                                     │
│  [ביטול]  [סיים טיפול →]           │
└─────────────────────────────────────┘
```

## 10. Validation Rules

### Client-side:
- קטגוריית תקלה: חובה
- תיאור מפורט: חובה, מינימום 50 תווים
- שעות עבודה: חובה, מספר חיובי

### Server-side:
- אימות ש-garage_request קיים
- אימות ש-status הוא pending/viewed
- אימות כל השדות

## 11. Error Handling

### תרחישים:
1. garage_request לא נמצא → 404
2. garage_request לא שייך למוסך → 403
3. סטטוס לא תקין → 400
4. OpenAI API נכשל → שמירת repair עם mechanic_description_ai = NULL
5. יצירת repair נכשלה → rollback עדכון garage_request

## 12. Testing Checklist

- [ ] דף דיווח טוען נתוני רכב נכון
- [ ] בחירת קטגוריה עובדת
- [ ] validation עובד
- [ ] API יוצר repair נכון
- [ ] OpenAI משפר טקסט נכון
- [ ] הדשבורד מציג נתונים חדשים
- [ ] סטטיסטיקות עובדות עם קטגוריות

## 13. Migration Steps

1. הרץ `database_migration_repairs_upgrade.sql`
2. עדכן את דף הדיווח
3. צור את ה-API endpoint החדש
4. עדכן את API הדשבורד
5. עדכן את תצוגת הדשבורד
6. בדוק end-to-end

## הערות חשובות

- **קטגוריות תקלות**: מומלץ להשתמש ב-enum קיים מ-REPAIRS (final_issue_type) או ליצור טבלה נפרדת
- **OpenAI**: להתחיל עם sync, לעבור ל-background אם צריך
- **גיבוי**: לפני migration, לגבות את המסד
- **Rollback**: להכין rollback script למקרה של בעיות

