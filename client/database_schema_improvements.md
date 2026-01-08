# שיפורים מוצעים לסכמת המסד הנתונים

## בעיות שזוהו:

### 1. חסר שדה `operating_hours` בטבלת `garages`
**בעיה:** הקוד מנסה לקרוא ולעדכן שדה שלא קיים במסד הנתונים.

**פתרון:** הוסף את השדה `operating_hours` (ראה `database_migration_operating_hours.sql`)

### 2. חיפוש אחר `user_id` שלא קיים
**בעיה:** הקוד מחפש גם `user_id` אבל בטבלה יש רק `owner_user_id`.

**פתרון:** תוקן בקוד - עכשיו מחפש רק `owner_user_id`.

### 3. כפילות בטבלת `users`
**בעיה:** הטבלה `users` מופיעה פעמיים בסכמה.

**פתרון:** הסר את הכפילות.

## שיפורים מוצעים נוספים:

### 1. שדות חסרים בטבלת `garages`:
```sql
-- שדות מוצעים להוספה:
- operating_hours JSONB NULL  -- שעות פעילות (כבר מוצע)
- description TEXT NULL       -- תיאור המוסך
- website TEXT NULL          -- אתר אינטרנט
- updated_at TIMESTAMP       -- תאריך עדכון אחרון
- is_active BOOLEAN DEFAULT true  -- האם המוסך פעיל
```

### 2. אינדקסים מוצעים:
```sql
-- אינדקסים לשיפור ביצועים:
CREATE INDEX idx_garages_owner_user_id ON public.garages(owner_user_id);
CREATE INDEX idx_garages_city ON public.garages("City");
CREATE INDEX idx_garages_active ON public.garages(is_active) WHERE is_active = true;
```

### 3. Foreign Key Constraints:
```sql
-- הוסף Foreign Key ל-owner_user_id:
ALTER TABLE public.garages
ADD CONSTRAINT fk_garages_owner_user 
FOREIGN KEY (owner_user_id) 
REFERENCES public.users(id) 
ON DELETE SET NULL;
```

### 4. שדות עם ערכים ברירת מחדל:
```sql
-- שדות עם ערכי ברירת מחדל:
ALTER TABLE public.garages
ALTER COLUMN created_at SET DEFAULT now();

-- אם תוסיף updated_at:
ALTER TABLE public.garages
ADD COLUMN updated_at TIMESTAMP DEFAULT now();

-- Trigger לעדכון אוטומטי של updated_at:
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_garages_updated_at 
BEFORE UPDATE ON public.garages 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 5. בדיקות (Constraints) מוצעות:
```sql
-- בדיקה שטלפון בפורמט תקין (אופציונלי):
ALTER TABLE public.garages
ADD CONSTRAINT check_phone_format 
CHECK (phone ~ '^[0-9+\-() ]+$' OR phone IS NULL);

-- בדיקה ששעות הפעילות בפורמט תקין (אופציונלי):
-- ניתן להוסיף בדיקה מורכבת יותר עם JSON schema validation
```

### 6. שיפור שמות שדות:
```sql
-- שדות עם אותיות גדולות (City, Street, Number) - מומלץ לשנות ל-lowercase:
-- City -> city
-- Street -> street  
-- Number -> number

-- או להוסיף alias:
-- ALTER TABLE public.garages RENAME COLUMN "City" TO city;
-- ALTER TABLE public.garages RENAME COLUMN "Street" TO street;
-- ALTER TABLE public.garages RENAME COLUMN "Number" TO number;
```

## סדר ביצוע מומלץ:

1. **ראשית - הוסף את `operating_hours`** (קריטי לתפקוד):
   ```sql
   -- הרץ את database_migration_operating_hours.sql
   ```

2. **שנית - הוסף אינדקסים** (לשיפור ביצועים):
   ```sql
   CREATE INDEX idx_garages_owner_user_id ON public.garages(owner_user_id);
   ```

3. **שלישית - הוסף Foreign Key** (לשלמות הנתונים):
   ```sql
   ALTER TABLE public.garages
   ADD CONSTRAINT fk_garages_owner_user 
   FOREIGN KEY (owner_user_id) 
   REFERENCES public.users(id) 
   ON DELETE SET NULL;
   ```

4. **אופציונלי - שדות נוספים** (לשיפור הפונקציונליות)

