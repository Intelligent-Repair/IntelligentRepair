# סקירת Backend ותקשורת עם Frontend – Intelligent Repair

מסמך זה מסביר ברמה עסקית וטכנית-גבוהה:

- למה ה־Backend נחוץ במערכת
- איך הוא מתקשר ל־Frontend
- מה התפקיד של כל חלק במבנה התיקיות הנוכחי

המסמך מיועד במיוחד למפתחים חדשים בצוות.

---

## 1. התמונה הגדולה – Frontend מול Backend

### Frontend – מה שהמשתמש רואה

ה־Frontend (בפרויקט `client/` או `frontend/`) הוא אפליקציית **Next.js** שאחראית על:

- מסכים כמו:
  - דף בית / התחברות
  - Dashboard
  - דיווח תקלה (`/report`)
  - מסך מוסכים (`/garage`)
- איסוף קלט מהמשתמש:
  - בחירת רכב
  - תיאור תקלה
  - העלאת תמונה
  - בחירת מוסך
- הצגת תוצאות:
  - תשובת ה-AI (אבחון)
  - רשימת דוחות
  - סטטוס פנייה למוסך

ה־Frontend **לא יודע** איך לדבר עם OpenAI, איך לשמור דוחות או איך לגשת ל־DB.  
בכל פעם שהוא צריך “דאטה אמיתי” – הוא קורא ל־Backend דרך HTTP.

---

### Backend – המוח והשרת

ה־Backend (בתיקייה `backend/`) הוא שרת **FastAPI** בפייתון שאחראי על:

- קבלת בקשות מה־Frontend (REST API).
- גישה ל־DB (דרך Supabase).
- קריאה ל־OpenAI לצורך אבחון תקלות.
- ניהול הלוגיקה העסקית:
  - דוחות תקלות (Reports)
  - רכבים
  - מוסכים ו־Tickets
  - תהליך האבחון (Diagnostics)

אפשר לחשוב על זה כך:

- ה־Frontend הוא “עמדת השירות ללקוח”.
- ה־Backend הוא “המוסך/צוות מומחים מאחורי הקלעים” שמבצע את כל העבודה.

---

## 2. זרימת עבודה לדוגמה – דיווח תקלה + אבחון AI

### 2.1 צעד מצד הלקוח (Frontend)

1. המשתמש נכנס למסך **דיווח תקלה** (`/report`).
2. בוחר רכב מתוך רשימת הרכבים שלו.
3. כותב **תיאור תקלה**.
4. מעלה **תמונה** (לדוגמה – רעש, נורת אזהרה, צילום לוח שעונים).
5. לוחץ על כפתור “שלח אבחון”.

בשלב זה ה־Frontend אוסף את הכל ושולח בקשה ל־Backend.

---

### 2.2 קריאה ל־Backend – אבחון

ה־Frontend שולח בקשה לנתיב לדוגמה:

`POST /api/v1/diagnostics`

עם גוף בקשה שמכיל:

- `vehicle_id`
- `description`
- קובץ תמונה

ב־Backend:

1. הקובץ `api/v1/endpoints/diagnostics.py` מקבל את הבקשה.
2. הוא משתמש ב־`schemas/diagnostics.py` כדי לוודא שהקלט תקין (Pydantic).
3. הוא קורא לפונקציות בשכבת ה־Services:
   - `manual_service` – איתור מדריך הרכב הרלוונטי (Manual).
   - `openai_service` – בניית prompt ושליחת בקשה ל־OpenAI.
   - `report_service` – יצירת Report חדש במסד הנתונים ושמירת התמונה.

בסוף התהליך, ה־Backend מחזיר ל־Frontend אובייקט JSON עם:

- מזהה הדוח (`report_id`)
- תיאור האבחון מה־AI (`ai_summary` / המלצה)
- מידע נוסף (חומרה, הצעות פעולה וכו’)

---

### 2.3 הצגת התוצאה ושליחה למוסך

ה־Frontend מציג למשתמש את תשובת ה־AI.  
אם המשתמש לוחץ “שלח למוסך”:

1. ה־Frontend שולח בקשה נוספת:
   - לדוגמה: `POST /api/v1/garages/tickets`
2. בקובץ `api/v1/endpoints/garages.py`:
   - מתבצעת קריאה ל־`garage_service` שמייצרת **Ticket** חדש,
   - מחברת בין הדוח (`Report`) למוסך (`Garage`),
   - מעדכנת סטטוס (Open / In Progress / Closed).

ה־Backend מחזיר ל־Frontend שהפנייה נוצרה בהצלחה, וה־Frontend מציג למשתמש הודעה מתאימה.

---

## 3. סקירת מבנה התיקיות ב־Backend

להלן מבנה הבקאנד כפי שהוא מופיע בפרויקט:

```text
backend/
└── app/
    ├── api/
    │   └── v1/
    │       ├── endpoints/
    │       │   ├── auth.py
    │       │   ├── diagnostics.py
    │       │   ├── garages.py
    │       │   ├── reports.py
    │       │   └── vehicles.py
    │       └── router.py
    ├── core/
    │   ├── .env.example
    │   ├── config.py
    │   ├── errors.py
    │   └── logging.py
    ├── db/
    │   ├── models/        # (בעתיד: user, vehicle, report, ticket וכו')
    │   └── supabase.py
    ├── schemas/
    │   ├── auth.py
    │   ├── diagnostics.py
    │   ├── garages.py
    │   ├── reports.py
    │   └── vehicles.py
    ├── services/
    │   ├── garage_service.py
    │   ├── manual_service.py
    │   ├── openai_service.py
    │   └── report_service.py
    ├── tests/
    │   ├── test_auth.py
    │   ├── test_diagnostics.py
    │   └── test_reports.py
    ├── main.py
    ├── Dockerfile
    └── requirements.txt
```
