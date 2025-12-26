# ⚡ Quick Start Guide

## 🔧 Run This SQL First!

**Copy and paste into Supabase SQL Editor:**

```sql
-- Add missing columns
ALTER TABLE repairs 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'in_progress',
ADD COLUMN IF NOT EXISTS final_issue_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_repairs_status ON repairs(status);
CREATE INDEX IF NOT EXISTS idx_repairs_final_issue_type ON repairs(final_issue_type);

-- Update existing records
UPDATE repairs SET status = 'in_progress' WHERE status IS NULL;
UPDATE repairs SET updated_at = created_at WHERE updated_at IS NULL;
```

**Where to run:**
1. Go to: https://rdrlxmpwkkeryfcszltc.supabase.co
2. Click: SQL Editor (left sidebar)
3. Click: New Query
4. Paste the SQL above
5. Click: Run (or Ctrl+Enter)

## ✅ After Running SQL

Tell me "Migration complete" and I'll:
1. ✅ Test all APIs
2. ✅ Test all filters
3. ✅ Test frontend pages
4. ✅ Generate complete test report

## 🎯 Total Time: 2 minutes!
