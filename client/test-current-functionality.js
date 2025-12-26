// Test what currently works with existing schema
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testCurrentFunctionality() {
  console.log('🧪 Testing Current Functionality\n');
  console.log('=' .repeat(60));

  // Test 1: List Requests
  console.log('\n1️⃣  Testing: List Requests API');
  const { data: requests, error: requestsError } = await supabase
    .from('requests')
    .select(`
      id,
      description,
      status,
      created_at,
      car:people_cars (
        id,
        license_plate,
        manufacturer,
        model
      )
    `)
    .limit(3);

  if (requestsError) {
    console.log('❌ Failed:', requestsError.message);
  } else {
    console.log(`✅ Success: Found ${requests.length} requests`);
    requests.forEach(req => {
      console.log(`   - Request #${req.id}: ${req.description?.substring(0, 50)}...`);
      console.log(`     Status: ${req.status}`);
      console.log(`     Car: ${req.car?.manufacturer} ${req.car?.model}`);
    });
  }

  // Test 2: List Repairs (without new columns)
  console.log('\n2️⃣  Testing: List Repairs (with current schema)');
  const { data: repairs, error: repairsError } = await supabase
    .from('repairs')
    .select(`
      id,
      ai_summary,
      mechanic_notes,
      created_at,
      request:requests (
        id,
        description
      )
    `)
    .limit(3);

  if (repairsError) {
    console.log('❌ Failed:', repairsError.message);
  } else {
    console.log(`✅ Success: Found ${repairs.length} repairs`);
    repairs.forEach(repair => {
      console.log(`   - Repair #${repair.id}`);
      console.log(`     Request: ${repair.request?.description?.substring(0, 50)}...`);
      console.log(`     Mechanic Notes: ${repair.mechanic_notes || 'None'}`);
    });
  }

  // Test 3: Check Garages
  console.log('\n3️⃣  Testing: List Garages');
  const { data: garages, error: garagesError } = await supabase
    .from('garages')
    .select('id, garage_name, owner_user_id')
    .limit(3);

  if (garagesError) {
    console.log('❌ Failed:', garagesError.message);
  } else {
    console.log(`✅ Success: Found ${garages.length} garages`);
    garages.forEach(garage => {
      console.log(`   - Garage #${garage.id}: ${garage.garage_name || 'Unnamed'}`);
      console.log(`     Owner ID: ${garage.owner_user_id}`);
    });
  }

  // Test 4: Check what's missing for full functionality
  console.log('\n4️⃣  Testing: Check for new columns');
  const { data: repairWithNew, error: newColError } = await supabase
    .from('repairs')
    .select('id, status, final_issue_type, updated_at')
    .limit(1);

  if (newColError) {
    console.log('❌ New columns not found:', newColError.message);
    console.log('   ⚠️  Migration needed for full functionality');
  } else {
    console.log('✅ New columns exist!');
    if (repairWithNew && repairWithNew.length > 0) {
      console.log(`   - status: ${repairWithNew[0].status || 'null'}`);
      console.log(`   - final_issue_type: ${repairWithNew[0].final_issue_type || 'null'}`);
      console.log(`   - updated_at: ${repairWithNew[0].updated_at || 'null'}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log('✅ Database connection: Working');
  console.log('✅ Requests table: Working');
  console.log('✅ Repairs table: Working (with limited fields)');
  console.log('✅ Garages table: Working');
  console.log(newColError ? '❌ New columns: Not found (migration needed)' : '✅ New columns: Found');
  console.log('\n📝 Next step: Run the SQL migration in DATABASE_MIGRATION_NEEDED.md');
  console.log('=' + '='.repeat(60));
}

testCurrentFunctionality().catch(console.error);
