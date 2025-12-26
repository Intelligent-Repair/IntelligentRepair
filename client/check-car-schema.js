// Check people_cars table structure
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkCarSchema() {
  console.log('🚗 Checking people_cars table structure...\n');

  const { data: cars, error } = await supabase
    .from('people_cars')
    .select('*')
    .limit(1);

  if (error) {
    console.log('❌ Error:', error.message);
  } else if (cars && cars.length > 0) {
    console.log('✅ Sample car record columns:');
    console.log(Object.keys(cars[0]));
    console.log('\n📋 Sample data:');
    console.log(JSON.stringify(cars[0], null, 2));
  } else {
    console.log('⚠️  No cars found in database');
  }

  // Check if there's a vehicle_catalog table
  console.log('\n🔍 Checking for vehicle_catalog table...');
  const { data: catalog, error: catalogError } = await supabase
    .from('vehicle_catalog')
    .select('*')
    .limit(1);

  if (catalogError) {
    console.log('❌ vehicle_catalog error:', catalogError.message);
  } else if (catalog && catalog.length > 0) {
    console.log('✅ vehicle_catalog exists!');
    console.log('Columns:', Object.keys(catalog[0]));
    console.log('\n📋 Sample data:');
    console.log(JSON.stringify(catalog[0], null, 2));
  } else {
    console.log('⚠️  vehicle_catalog table is empty');
  }
}

checkCarSchema().catch(console.error);
