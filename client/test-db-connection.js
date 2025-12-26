// Test database connection and structure
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Try with anon key first
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('Using anon key to test database (limited permissions)...\n');

async function checkDatabase() {
  console.log('🔍 Checking database structure...\n');

  // Check repairs table structure
  console.log('📋 Checking repairs table...');
  const { data: repairs, error: repairsError } = await supabase
    .from('repairs')
    .select('*')
    .limit(1);

  if (repairsError) {
    console.log('❌ Repairs table error:', repairsError.message);
    console.log('Details:', repairsError);
  } else {
    console.log('✅ Repairs table exists');
    if (repairs && repairs.length > 0) {
      console.log('Sample repair columns:', Object.keys(repairs[0]));
    } else {
      console.log('Table is empty - checking via RPC or information_schema');
    }
  }

  // Check requests table
  console.log('\n📋 Checking requests table...');
  const { data: requests, error: requestsError } = await supabase
    .from('requests')
    .select('*')
    .limit(1);

  if (requestsError) {
    console.log('❌ Requests table error:', requestsError.message);
  } else {
    console.log('✅ Requests table exists');
    if (requests && requests.length > 0) {
      console.log('Sample request columns:', Object.keys(requests[0]));
    }
  }

  // Check garages table
  console.log('\n📋 Checking garages table...');
  const { data: garages, error: garagesError } = await supabase
    .from('garages')
    .select('*')
    .limit(1);

  if (garagesError) {
    console.log('❌ Garages table error:', garagesError.message);
  } else {
    console.log('✅ Garages table exists');
    if (garages && garages.length > 0) {
      console.log('Sample garage columns:', Object.keys(garages[0]));
    }
  }

  // Count records
  console.log('\n📊 Record counts:');
  
  const { count: repairsCount } = await supabase
    .from('repairs')
    .select('*', { count: 'exact', head: true });
  console.log(`Repairs: ${repairsCount || 0}`);

  const { count: requestsCount } = await supabase
    .from('requests')
    .select('*', { count: 'exact', head: true });
  console.log(`Requests: ${requestsCount || 0}`);

  const { count: garagesCount } = await supabase
    .from('garages')
    .select('*', { count: 'exact', head: true });
  console.log(`Garages: ${garagesCount || 0}`);

  console.log('\n✅ Database check complete!');
}

checkDatabase().catch(console.error);
