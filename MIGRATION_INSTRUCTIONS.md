# Database Migration Instructions

## ⚠️ IMPORTANT: Manual SQL Execution Required

The following columns need to be added to the `repairs` table for the Garage Repair Management API to work properly.

## How to Run

1. Go to your Supabase Dashboard: https://rdrlxmpwkkeryfcszltc.supabase.co/project/_/sql/new
2. Copy the SQL below
3. Paste it into the SQL Editor
4. Click "Run" (or press Ctrl+Enter)

## SQL Migration Script

### ⚡ QUICK VERSION (Recommended for now)

Just add the 3 columns - that's all you need!

```sql
-- Add missing columns to repairs table
ALTER TABLE repairs 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'in_progress',
ADD COLUMN IF NOT EXISTS final_issue_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
```

✅ **Done!** Run tests: `cd /workspace/client && node test-e2e.js`

---

### 🚀 FULL VERSION (Optional - for performance optimization)

Add this **later** when you have thousands of repairs:

```sql
-- Add missing columns to repairs table
ALTER TABLE repairs 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'in_progress',
ADD COLUMN IF NOT EXISTS final_issue_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add helpful comments
COMMENT ON COLUMN repairs.status IS 'Status: in_progress, completed, on_hold, cancelled';
COMMENT ON COLUMN repairs.final_issue_type IS 'Issue type: engine, brakes, electrical, ac, starting, gearbox, noise, suspension, transmission, fuel_system, cooling_system, exhaust, tires, steering, other';
COMMENT ON COLUMN repairs.updated_at IS 'Last update timestamp';

-- Create indexes for better performance (optional - improves filtering speed)
CREATE INDEX IF NOT EXISTS idx_repairs_status ON repairs(status);
CREATE INDEX IF NOT EXISTS idx_repairs_final_issue_type ON repairs(final_issue_type);
CREATE INDEX IF NOT EXISTS idx_repairs_garage_id ON repairs(garage_id);

-- Create auto-update trigger for updated_at (optional - auto-updates timestamp)
CREATE OR REPLACE FUNCTION update_repairs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_repairs_updated_at ON repairs;
CREATE TRIGGER trigger_repairs_updated_at
    BEFORE UPDATE ON repairs
    FOR EACH ROW
    EXECUTE FUNCTION update_repairs_updated_at();

-- Verify (optional - just prints to console)
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'repairs' 
    AND column_name IN ('status', 'final_issue_type', 'updated_at');
```

### 📖 What's Optional?

| Feature | Required? | What It Does | When To Add |
|---------|-----------|--------------|-------------|
| **3 columns** | ✅ YES | Makes API work | Now |
| **Indexes** | ❌ No | Makes filtering faster | When you have 10,000+ repairs |
| **Auto-update trigger** | ❌ No | Auto-updates `updated_at` | Now is fine (small benefit) |
| **Comments** | ❌ No | Documentation in DB | Nice to have |

## After Running

Come back here and run:

```bash
cd /workspace/client
node test-e2e.js
```

All tests should pass after the migration!

## What These Columns Do

- **status**: Tracks repair progress (in_progress, completed, on_hold, cancelled)
- **final_issue_type**: Categories the type of repair performed
- **updated_at**: Automatically tracks when the repair was last modified
