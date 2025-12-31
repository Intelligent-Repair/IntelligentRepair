// Add missing columns to repairs table
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function addMissingColumns() {
  console.log('🔧 Adding missing columns to repairs table...\n');

  // Note: We need to use SQL to add columns, which requires service_role or direct SQL access
  // Let's try using the SQL editor or RPC function if available
  
  const alterTableSQL = `
    -- Add status column if it doesn't exist
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'repairs' AND column_name = 'status'
      ) THEN
        ALTER TABLE repairs ADD COLUMN status VARCHAR(50) DEFAULT 'in_progress';
      END IF;
    END $$;

    -- Add final_issue_type column if it doesn't exist
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'repairs' AND column_name = 'final_issue_type'
      ) THEN
        ALTER TABLE repairs ADD COLUMN final_issue_type VARCHAR(50);
      END IF;
    END $$;

    -- Add updated_at column if it doesn't exist
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'repairs' AND column_name = 'updated_at'
      ) THEN
        ALTER TABLE repairs ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
      END IF;
    END $$;
  `;

  console.log('SQL to execute:');
  console.log(alterTableSQL);
  console.log('\n⚠️  Please run this SQL in your Supabase SQL Editor:');
  console.log('   Dashboard → SQL Editor → New Query → Paste and Run\n');
}

addMissingColumns().catch(console.error);
