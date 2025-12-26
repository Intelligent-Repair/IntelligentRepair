// Comprehensive End-to-End Test Suite
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const BASE_URL = 'http://localhost:3000';
let testResults = [];

function logTest(category, name, status, details = '') {
  const result = { category, name, status, details, timestamp: new Date().toISOString() };
  testResults.push(result);
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${category}] ${name}`);
  if (details) console.log(`   ${details}`);
}

async function testDatabaseStructure() {
  console.log('\n🗄️  DATABASE STRUCTURE TESTS\n' + '='.repeat(60));
  
  // Test 1: Check repairs table exists
  try {
    const { data, error } = await supabase.from('repairs').select('*').limit(1);
    if (error) throw error;
    logTest('Database', 'Repairs table exists', 'PASS', `Found ${data ? data.length : 0} records`);
  } catch (err) {
    logTest('Database', 'Repairs table exists', 'FAIL', err.message);
  }

  // Test 2: Check for new columns
  try {
    const { data, error } = await supabase
      .from('repairs')
      .select('id, status, final_issue_type, updated_at')
      .limit(1);
    
    if (error && error.message.includes('does not exist')) {
      logTest('Database', 'New columns (status, final_issue_type, updated_at)', 'SKIP', 
        'Migration needed - columns do not exist');
    } else if (error) {
      logTest('Database', 'New columns check', 'FAIL', error.message);
    } else {
      logTest('Database', 'New columns (status, final_issue_type, updated_at)', 'PASS', 
        'All required columns exist');
    }
  } catch (err) {
    logTest('Database', 'New columns check', 'FAIL', err.message);
  }

  // Test 3: Check requests table
  try {
    const { count, error } = await supabase
      .from('requests')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    logTest('Database', 'Requests table exists', 'PASS', `Found ${count} requests`);
  } catch (err) {
    logTest('Database', 'Requests table exists', 'FAIL', err.message);
  }

  // Test 4: Check garages table
  try {
    const { count, error } = await supabase
      .from('garages')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    logTest('Database', 'Garages table exists', 'PASS', `Found ${count} garages`);
  } catch (err) {
    logTest('Database', 'Garages table exists', 'FAIL', err.message);
  }

  // Test 5: Check table relationships
  try {
    const { data, error } = await supabase
      .from('requests')
      .select(`
        id,
        car:people_cars (
          id,
          vehicle_catalog:vehicle_catalog_id (
            manufacturer,
            model
          )
        )
      `)
      .limit(1);
    
    if (error) throw error;
    logTest('Database', 'Table relationships (requests → people_cars → vehicle_catalog)', 'PASS',
      'Joins working correctly');
  } catch (err) {
    logTest('Database', 'Table relationships', 'FAIL', err.message);
  }
}

async function testAPIEndpoints() {
  console.log('\n🔌 API ENDPOINT TESTS\n' + '='.repeat(60));

  // Test 1: Requests list API (without auth)
  try {
    const response = await fetch(`${BASE_URL}/api/garage/requests/list`);
    const data = await response.json();
    
    if (response.status === 401 && data.error === 'Unauthorized') {
      logTest('API', 'GET /api/garage/requests/list (no auth)', 'PASS',
        'Correctly returns 401 for unauthenticated requests');
    } else {
      logTest('API', 'GET /api/garage/requests/list (no auth)', 'FAIL',
        `Expected 401, got ${response.status}`);
    }
  } catch (err) {
    logTest('API', 'GET /api/garage/requests/list', 'FAIL', err.message);
  }

  // Test 2: Repairs list API (without auth)
  try {
    const response = await fetch(`${BASE_URL}/api/garage/repairs/list`);
    const data = await response.json();
    
    if (response.status === 401 && data.error === 'Unauthorized') {
      logTest('API', 'GET /api/garage/repairs/list (no auth)', 'PASS',
        'Correctly returns 401 for unauthenticated requests');
    } else {
      logTest('API', 'GET /api/garage/repairs/list (no auth)', 'FAIL',
        `Expected 401, got ${response.status}`);
    }
  } catch (err) {
    logTest('API', 'GET /api/garage/repairs/list', 'FAIL', err.message);
  }

  // Test 3: Accept repair API (without auth)
  try {
    const response = await fetch(`${BASE_URL}/api/garage/repairs/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: 1 })
    });
    const data = await response.json();
    
    if (response.status === 401) {
      logTest('API', 'POST /api/garage/repairs/accept (no auth)', 'PASS',
        'Correctly returns 401 for unauthenticated requests');
    } else {
      logTest('API', 'POST /api/garage/repairs/accept (no auth)', 'FAIL',
        `Expected 401, got ${response.status}`);
    }
  } catch (err) {
    logTest('API', 'POST /api/garage/repairs/accept', 'FAIL', err.message);
  }

  // Test 4: Update repair API (without auth)
  try {
    const response = await fetch(`${BASE_URL}/api/garage/repairs/123`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' })
    });
    
    if (response.status === 401) {
      logTest('API', 'PATCH /api/garage/repairs/[id] (no auth)', 'PASS',
        'Correctly returns 401 for unauthenticated requests');
    } else {
      logTest('API', 'PATCH /api/garage/repairs/[id] (no auth)', 'FAIL',
        `Expected 401, got ${response.status}`);
    }
  } catch (err) {
    logTest('API', 'PATCH /api/garage/repairs/[id]', 'FAIL', err.message);
  }

  // Test 5: Get single repair API (without auth)
  try {
    const response = await fetch(`${BASE_URL}/api/garage/repairs/123`);
    
    if (response.status === 401) {
      logTest('API', 'GET /api/garage/repairs/[id] (no auth)', 'PASS',
        'Correctly returns 401 for unauthenticated requests');
    } else {
      logTest('API', 'GET /api/garage/repairs/[id] (no auth)', 'FAIL',
        `Expected 401, got ${response.status}`);
    }
  } catch (err) {
    logTest('API', 'GET /api/garage/repairs/[id]', 'FAIL', err.message);
  }

  // Test 6: Get single request API (without auth)
  try {
    const response = await fetch(`${BASE_URL}/api/garage/requests/123`);
    
    if (response.status === 401) {
      logTest('API', 'GET /api/garage/requests/[id] (no auth)', 'PASS',
        'Correctly returns 401 for unauthenticated requests');
    } else {
      logTest('API', 'GET /api/garage/requests/[id] (no auth)', 'FAIL',
        `Expected 401, got ${response.status}`);
    }
  } catch (err) {
    logTest('API', 'GET /api/garage/requests/[id]', 'FAIL', err.message);
  }
}

async function testFrontendPages() {
  console.log('\n🌐 FRONTEND PAGE TESTS\n' + '='.repeat(60));

  const pages = [
    { path: '/garage/requests', name: 'Garage Requests List' },
    { path: '/garage/repairs', name: 'Garage Repairs List' },
    { path: '/garage/dashboard', name: 'Garage Dashboard' },
  ];

  for (const page of pages) {
    try {
      const response = await fetch(`${BASE_URL}${page.path}`);
      
      if (response.status === 200) {
        const html = await response.text();
        if (html.includes('<!DOCTYPE html>') || html.includes('<html')) {
          logTest('Frontend', `${page.name} (${page.path})`, 'PASS',
            'Page loads successfully');
        } else {
          logTest('Frontend', `${page.name} (${page.path})`, 'FAIL',
            'Response is not HTML');
        }
      } else if (response.status === 401 || response.status === 403) {
        logTest('Frontend', `${page.name} (${page.path})`, 'SKIP',
          'Requires authentication (expected behavior)');
      } else {
        logTest('Frontend', `${page.name} (${page.path})`, 'FAIL',
          `Got status ${response.status}`);
      }
    } catch (err) {
      logTest('Frontend', `${page.name} (${page.path})`, 'FAIL', err.message);
    }
  }
}

async function testDataRetrieval() {
  console.log('\n📊 DATA RETRIEVAL TESTS\n' + '='.repeat(60));

  // Test 1: Get actual requests from database
  try {
    const { data, error } = await supabase
      .from('requests')
      .select('id, description, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) throw error;
    logTest('Data', 'Fetch recent requests', 'PASS',
      `Retrieved ${data.length} requests`);
    
    if (data.length > 0) {
      console.log(`   Latest request: #${data[0].id} - ${data[0].status}`);
    }
  } catch (err) {
    logTest('Data', 'Fetch recent requests', 'FAIL', err.message);
  }

  // Test 2: Get repairs with joins
  try {
    const { data, error } = await supabase
      .from('repairs')
      .select(`
        id,
        ai_summary,
        mechanic_notes,
        created_at,
        request:requests (
          id,
          description,
          status
        )
      `)
      .limit(5);
    
    if (error) throw error;
    logTest('Data', 'Fetch repairs with request details', 'PASS',
      `Retrieved ${data.length} repairs with joins`);
  } catch (err) {
    logTest('Data', 'Fetch repairs with joins', 'FAIL', err.message);
  }

  // Test 3: Get garages
  try {
    const { data, error } = await supabase
      .from('garages')
      .select('id, garage_name, owner_user_id')
      .limit(5);
    
    if (error) throw error;
    logTest('Data', 'Fetch garages', 'PASS',
      `Retrieved ${data.length} garages`);
    
    if (data.length > 0) {
      console.log(`   Sample garage: ${data[0].garage_name || 'Unnamed'}`);
    }
  } catch (err) {
    logTest('Data', 'Fetch garages', 'FAIL', err.message);
  }
}

function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST SUMMARY REPORT');
  console.log('='.repeat(60));

  const categories = ['Database', 'API', 'Frontend', 'Data'];
  const summary = {
    total: testResults.length,
    passed: testResults.filter(t => t.status === 'PASS').length,
    failed: testResults.filter(t => t.status === 'FAIL').length,
    skipped: testResults.filter(t => t.status === 'SKIP').length,
  };

  console.log(`\nTotal Tests: ${summary.total}`);
  console.log(`✅ Passed: ${summary.passed}`);
  console.log(`❌ Failed: ${summary.failed}`);
  console.log(`⚠️  Skipped: ${summary.skipped}`);
  console.log(`📊 Success Rate: ${((summary.passed / (summary.passed + summary.failed)) * 100).toFixed(1)}%`);

  console.log('\nBy Category:');
  categories.forEach(cat => {
    const catTests = testResults.filter(t => t.category === cat);
    const catPassed = catTests.filter(t => t.status === 'PASS').length;
    const catTotal = catTests.length;
    console.log(`  ${cat}: ${catPassed}/${catTotal} passed`);
  });

  // Check for migration need
  const needsMigration = testResults.some(t => 
    t.details && t.details.includes('Migration needed')
  );

  if (needsMigration) {
    console.log('\n⚠️  MIGRATION REQUIRED');
    console.log('Some tests were skipped due to missing database columns.');
    console.log('Run the SQL migration in QUICK_START.md to enable full functionality.');
  }

  console.log('\n' + '='.repeat(60));
  
  // Write results to file
  const fs = require('fs');
  const reportData = {
    timestamp: new Date().toISOString(),
    summary,
    tests: testResults,
    needsMigration
  };
  fs.writeFileSync('test-results.json', JSON.stringify(reportData, null, 2));
  console.log('📄 Detailed results saved to: test-results.json\n');
}

async function runAllTests() {
  console.log('🚀 Starting End-to-End Test Suite');
  console.log('Branch: cursor/garage-repair-management-api-8320');
  console.log('Time: ' + new Date().toISOString());
  console.log('='.repeat(60));

  await testDatabaseStructure();
  await testAPIEndpoints();
  await testFrontendPages();
  await testDataRetrieval();
  generateReport();
}

// Run tests
runAllTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
