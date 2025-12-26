// Attempt to run database migration via Supabase
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Try with the provided service key (even though format seems off)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔧 Attempting Database Migration...\n');

// Try to execute SQL via RPC or REST API
async function runMigration() {
  // Create client with service key
  const supabase = createClient(supabaseUrl, serviceKey);

  const migrationSQL = `
    ALTER TABLE repairs 
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'in_progress';
    
    ALTER TABLE repairs 
    ADD COLUMN IF NOT EXISTS final_issue_type VARCHAR(50);
    
    ALTER TABLE repairs 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    
    CREATE INDEX IF NOT EXISTS idx_repairs_status ON repairs(status);
    CREATE INDEX IF NOT EXISTS idx_repairs_final_issue_type ON repairs(final_issue_type);
    
    UPDATE repairs SET status = 'in_progress' WHERE status IS NULL;
    UPDATE repairs SET updated_at = created_at WHERE updated_at IS NULL;
  `;

  console.log('Trying to execute migration via Supabase RPC...');
  
  // Try using rpc if available
  const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
  
  if (error) {
    console.log('❌ RPC failed:', error.message);
    console.log('\n⚠️  Manual migration required. Please run the SQL in Supabase Dashboard:');
    console.log('\n```sql');
    console.log(migrationSQL);
    console.log('```\n');
    return false;
  } else {
    console.log('✅ Migration successful!');
    return true;
  }
}

runMigration().catch(err => {
  console.log('❌ Migration failed:', err.message);
  console.log('\n⚠️  Please run the migration manually in Supabase SQL Editor');
  console.log('See QUICK_START.md for instructions');
});
