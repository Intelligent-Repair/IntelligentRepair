#!/usr/bin/env node

/**
 * End-to-End Test Suite for Garage Repair Management API
 * Tests all API endpoints with real database operations
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://rdrlxmpwkkeryfcszltc.supabase.co';
const SERVICE_KEY = 'sb_secret_DXi46cYHb8E-6iYsR4dZEw_71zHELz7';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  tests: []
};

function log(message, type = 'info') {
  const colors = {
    success: '\x1b[32m✓\x1b[0m',
    error: '\x1b[31m✗\x1b[0m',
    info: '\x1b[36mℹ\x1b[0m',
    warning: '\x1b[33m⚠\x1b[0m'
  };
  console.log(`${colors[type] || ''} ${message}`);
}

async function test(name, fn) {
  testResults.total++;
  try {
    await fn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'PASS' });
    log(`${name}`, 'success');
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'FAIL', error: error.message });
    log(`${name}: ${error.message}`, 'error');
  }
}

// Helper to check if column exists
async function columnExists(table, column) {
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .limit(1);
  return !error;
}

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   Garage Repair Management API - E2E Test Suite       ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // ====================
  // DATABASE SCHEMA TESTS
  // ====================
  console.log('\n📊 DATABASE SCHEMA TESTS\n');

  await test('Repairs table exists', async () => {
    const { data, error } = await supabase.from('repairs').select('id').limit(1);
    if (error) throw new Error(`Repairs table: ${error.message}`);
  });

  await test('Requests table exists', async () => {
    const { data, error } = await supabase.from('requests').select('id').limit(1);
    if (error) throw new Error(`Requests table: ${error.message}`);
  });

  await test('Garages table exists', async () => {
    const { data, error } = await supabase.from('garages').select('id').limit(1);
    if (error) throw new Error(`Garages table: ${error.message}`);
  });

  await test('People_cars table exists', async () => {
    const { data, error } = await supabase.from('people_cars').select('id').limit(1);
    if (error) throw new Error(`People_cars table: ${error.message}`);
  });

  await test('Users table exists', async () => {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) throw new Error(`Users table: ${error.message}`);
  });

  // Check for required columns
  await test('Repairs table has status column', async () => {
    const exists = await columnExists('repairs', 'status');
    if (!exists) throw new Error('status column missing');
  });

  await test('Repairs table has final_issue_type column', async () => {
    const exists = await columnExists('repairs', 'final_issue_type');
    if (!exists) throw new Error('final_issue_type column missing');
  });

  await test('Repairs table has updated_at column', async () => {
    const exists = await columnExists('repairs', 'updated_at');
    if (!exists) throw new Error('updated_at column missing');
  });

  await test('Repairs table has mechanic_notes column', async () => {
    const exists = await columnExists('repairs', 'mechanic_notes');
    if (!exists) throw new Error('mechanic_notes column missing');
  });

  // ====================
  // DATA RETRIEVAL TESTS
  // ====================
  console.log('\n📦 DATA RETRIEVAL TESTS\n');

  let testGarageId, testRequestId, testRepairId, testUserId, testCarId;

  await test('Fetch garages with users', async () => {
    const { data, error } = await supabase
      .from('garages')
      .select('id, garage_name, owner_user_id')
      .limit(5);
    
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error('No garages found');
    
    testGarageId = data[0].id;
    log(`  Found ${data.length} garages, using garage_id: ${testGarageId}`, 'info');
  });

  await test('Fetch requests with relationships', async () => {
    const { data, error } = await supabase
      .from('requests')
      .select(`
        id, 
        description, 
        status, 
        user_id,
        car_id,
        car:people_cars(
          id, 
          license_plate,
          user_id,
          vehicle_catalog:vehicle_catalog_id(manufacturer, model)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error('No requests found');
    
    testRequestId = data[0].id;
    testUserId = data[0].user_id;
    testCarId = data[0].car_id;
    log(`  Found ${data.length} requests, using request_id: ${testRequestId}`, 'info');
  });

  await test('Fetch repairs with all relationships', async () => {
    const { data, error } = await supabase
      .from('repairs')
      .select(`
        id,
        status,
        mechanic_notes,
        final_issue_type,
        garage_id,
        request:requests(
          id,
          description,
          car:people_cars(
            id,
            license_plate,
            vehicle_catalog:vehicle_catalog_id(manufacturer, model),
            user:users(id, first_name, last_name, phone)
          )
        )
      `)
      .limit(1);
    
    if (error) throw new Error(error.message);
    
    if (data && data.length > 0) {
      testRepairId = data[0].id;
      log(`  Found ${data.length} repairs, using repair_id: ${testRepairId}`, 'info');
    } else {
      log('  No existing repairs found (this is OK for a fresh database)', 'info');
    }
  });

  // ====================
  // BUSINESS LOGIC TESTS
  // ====================
  console.log('\n🔧 BUSINESS LOGIC TESTS\n');

  let createdRepairId;

  await test('Create repair from request (accept flow)', async () => {
    if (!testRequestId || !testGarageId) {
      throw new Error('Missing test data (request or garage)');
    }

    // Check if request is already converted
    const { data: existing } = await supabase
      .from('repairs')
      .select('id')
      .eq('request_id', testRequestId)
      .maybeSingle();

    if (existing) {
      log(`  Request ${testRequestId} already has repair ${existing.id}`, 'warning');
      createdRepairId = existing.id;
      return; // Not an error, just skip
    }

    // Create a new repair
    const { data, error } = await supabase
      .from('repairs')
      .insert({
        request_id: testRequestId,
        garage_id: testGarageId,
        ai_summary: 'Test AI summary for e2e testing',
        status: 'in_progress',
        mechanic_notes: null,
        final_issue_type: null
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('No repair created');
    
    createdRepairId = data.id;
    testRepairId = data.id;
    log(`  Created repair_id: ${createdRepairId}`, 'info');

    // Update request status
    await supabase
      .from('requests')
      .update({ status: 'accepted' })
      .eq('id', testRequestId);
  });

  await test('Update repair with mechanic notes', async () => {
    if (!testRepairId) {
      throw new Error('No repair available for testing');
    }

    const { data, error } = await supabase
      .from('repairs')
      .update({
        mechanic_notes: 'E2E Test: Replaced brake pads and rotors',
        updated_at: new Date().toISOString()
      })
      .eq('id', testRepairId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Update failed');
    if (!data.mechanic_notes) throw new Error('Mechanic notes not saved');
    
    log(`  Updated repair ${testRepairId} with mechanic notes`, 'info');
  });

  await test('Update repair status to completed', async () => {
    if (!testRepairId) {
      throw new Error('No repair available for testing');
    }

    const { data, error } = await supabase
      .from('repairs')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', testRepairId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Update failed');
    if (data.status !== 'completed') throw new Error('Status not updated');
    
    log(`  Updated repair ${testRepairId} status to completed`, 'info');
  });

  await test('Set final issue type', async () => {
    if (!testRepairId) {
      throw new Error('No repair available for testing');
    }

    const { data, error } = await supabase
      .from('repairs')
      .update({
        final_issue_type: 'brakes',
        updated_at: new Date().toISOString()
      })
      .eq('id', testRepairId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Update failed');
    if (data.final_issue_type !== 'brakes') throw new Error('Issue type not saved');
    
    log(`  Set final_issue_type to 'brakes' for repair ${testRepairId}`, 'info');
  });

  // ====================
  // FILTER & QUERY TESTS
  // ====================
  console.log('\n🔍 FILTER & QUERY TESTS\n');

  await test('Filter repairs by status', async () => {
    const { data, error } = await supabase
      .from('repairs')
      .select('id, status')
      .eq('status', 'completed')
      .limit(10);

    if (error) throw new Error(error.message);
    log(`  Found ${data?.length || 0} completed repairs`, 'info');
  });

  await test('Filter repairs by issue type', async () => {
    const { data, error } = await supabase
      .from('repairs')
      .select('id, final_issue_type')
      .eq('final_issue_type', 'brakes')
      .limit(10);

    if (error) throw new Error(error.message);
    log(`  Found ${data?.length || 0} repairs with 'brakes' issue`, 'info');
  });

  await test('Filter repairs by garage', async () => {
    if (!testGarageId) {
      throw new Error('No test garage available');
    }

    const { data, error } = await supabase
      .from('repairs')
      .select('id, garage_id')
      .eq('garage_id', testGarageId)
      .limit(10);

    if (error) throw new Error(error.message);
    log(`  Found ${data?.length || 0} repairs for garage ${testGarageId}`, 'info');
  });

  await test('Complex filter: status + issue_type', async () => {
    const { data, error } = await supabase
      .from('repairs')
      .select('id, status, final_issue_type')
      .eq('status', 'completed')
      .eq('final_issue_type', 'brakes')
      .limit(10);

    if (error) throw new Error(error.message);
    log(`  Found ${data?.length || 0} completed brake repairs`, 'info');
  });

  await test('Join query: repairs with car manufacturer', async () => {
    const { data, error } = await supabase
      .from('repairs')
      .select(`
        id,
        request:requests(
          car:people_cars(
            license_plate,
            vehicle_catalog:vehicle_catalog_id(
              manufacturer,
              model
            )
          )
        )
      `)
      .limit(5);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error('No data returned');
    
    log(`  Successfully joined repairs -> requests -> cars`, 'info');
  });

  // ====================
  // DATA VALIDATION TESTS
  // ====================
  console.log('\n✅ DATA VALIDATION TESTS\n');

  await test('Valid repair statuses only', async () => {
    const { data, error } = await supabase
      .from('repairs')
      .select('status')
      .limit(100);

    if (error) throw new Error(error.message);
    
    const validStatuses = ['in_progress', 'completed', 'on_hold', 'cancelled'];
    const invalidStatuses = data
      ?.map(r => r.status)
      .filter(s => s && !validStatuses.includes(s));

    if (invalidStatuses && invalidStatuses.length > 0) {
      throw new Error(`Invalid statuses found: ${invalidStatuses.join(', ')}`);
    }
    
    log(`  All repair statuses are valid`, 'info');
  });

  await test('Valid issue types only', async () => {
    const { data, error } = await supabase
      .from('repairs')
      .select('final_issue_type')
      .not('final_issue_type', 'is', null)
      .limit(100);

    if (error) throw new Error(error.message);
    
    const validTypes = [
      'engine', 'brakes', 'electrical', 'ac', 'starting', 
      'gearbox', 'noise', 'suspension', 'transmission',
      'fuel_system', 'cooling_system', 'exhaust', 'tires', 
      'steering', 'other'
    ];
    
    const invalidTypes = data
      ?.map(r => r.final_issue_type)
      .filter(t => t && !validTypes.includes(t));

    if (invalidTypes && invalidTypes.length > 0) {
      throw new Error(`Invalid issue types found: ${invalidTypes.join(', ')}`);
    }
    
    log(`  All issue types are valid`, 'info');
  });

  await test('All repairs have valid request references', async () => {
    const { data, error } = await supabase
      .from('repairs')
      .select('id, request_id, request:requests(id)')
      .limit(50);

    if (error) throw new Error(error.message);
    
    const orphanedRepairs = data?.filter(r => !r.request);
    
    if (orphanedRepairs && orphanedRepairs.length > 0) {
      throw new Error(`Found ${orphanedRepairs.length} repairs without valid requests`);
    }
    
    log(`  All repairs have valid request references`, 'info');
  });

  // ====================
  // PRINT RESULTS
  // ====================
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                   TEST RESULTS                         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`Total Tests: ${testResults.total}`);
  console.log(`\x1b[32m✓ Passed: ${testResults.passed}\x1b[0m`);
  console.log(`\x1b[31m✗ Failed: ${testResults.failed}\x1b[0m`);
  console.log(`\nSuccess Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%\n`);

  if (testResults.failed > 0) {
    console.log('Failed Tests:');
    testResults.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => {
        console.log(`  \x1b[31m✗\x1b[0m ${t.name}: ${t.error}`);
      });
    console.log('');
  }

  // Clean up test data
  if (createdRepairId) {
    console.log(`\n🧹 Cleaning up test repair (ID: ${createdRepairId})...`);
    await supabase.from('repairs').delete().eq('id', createdRepairId);
    console.log('✓ Cleanup complete\n');
  }

  process.exit(testResults.failed === 0 ? 0 : 1);
}

// Run the tests
runTests().catch(err => {
  console.error('\n\x1b[31m✗ Test suite failed:\x1b[0m', err);
  process.exit(1);
});
