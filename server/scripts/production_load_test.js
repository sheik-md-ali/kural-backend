/**
 * Production Load Testing Script
 * Simulates realistic user flows on production server
 * Tests real data-fetching APIs with proper RBAC roles
 */

import https from 'https';

const BASE_URL = 'https://www.kuralapp.in';

// Test Users with different RBAC roles
const TEST_USERS = {
  admin: { identifier: 'admin@kuralapp.com', password: 'admin123', role: 'L0' },
  aci111: { identifier: 'testaci111@test.com', password: 'test123', role: 'L2', ac: 111 }
};

// Load Test Configuration
const CONFIG = {
  CONCURRENT_USERS: process.argv[2] ? [parseInt(process.argv[2])] : [50, 100, 200, 500],
  TEST_DURATION_PER_LEVEL: 30000, // 30 seconds per level
  THINK_TIME_MS: 50, // Time between requests
  RAMP_UP_TIME: 5000, // 5 seconds to ramp up
};

// Results storage
const results = {
  testStartTime: new Date().toISOString(),
  config: CONFIG,
  tests: [],
  summary: {},
  serverMetrics: {},
  errors: []
};

// Helper function for HTTPS requests
function makeRequest(method, path, body = null, cookie = null) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'KuralLoadTest/1.0'
      },
      rejectUnauthorized: true
    };

    if (cookie) {
      options.headers['Cookie'] = cookie;
    }

    const startTime = Date.now();
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        const setCookie = res.headers['set-cookie'];
        let newCookie = cookie;
        if (setCookie) {
          newCookie = setCookie[0].split(';')[0];
        }

        let responseData = null;
        try {
          responseData = JSON.parse(data);
        } catch (e) {
          responseData = data;
        }

        resolve({
          status: res.statusCode,
          duration,
          success: res.statusCode >= 200 && res.statusCode < 400,
          size: data.length,
          cookie: newCookie,
          data: responseData
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        status: 0,
        duration: Date.now() - startTime,
        success: false,
        error: err.message,
        cookie
      });
    });

    req.setTimeout(30000, () => {
      req.destroy();
      resolve({
        status: 0,
        duration: 30000,
        success: false,
        error: 'Timeout',
        cookie
      });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Calculate percentiles
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(p / 100 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// Simulate realistic user flow with mixed roles (Admin L0 + ACI L2)
async function simulateUserFlow(userId, duration, flowResults) {
  const startTime = Date.now();
  let cookie = null;

  // Alternate between admin (L0) and ACI 111 (L2) users for mixed traffic
  // 50% Admin users, 50% ACI users - simulates real-world mixed usage
  const user = userId % 2 === 0 ? TEST_USERS.admin : TEST_USERS.aci111;
  const isAdmin = user.role === 'L0';
  const acId = isAdmin ? 111 : user.ac; // Admin can access any AC, ACI uses assigned AC

  while (Date.now() - startTime < duration) {
    try {
      // Step 1: Login
      const loginResult = await makeRequest('POST', '/api/auth/login', {
        identifier: user.identifier,
        password: user.password
      });
      flowResults.login.push({
        duration: loginResult.duration,
        success: loginResult.success,
        status: loginResult.status,
        role: user.role
      });

      if (!loginResult.success) {
        flowResults.errors.push({ step: 'login', role: user.role, error: loginResult.error || `HTTP ${loginResult.status}` });
        await new Promise(r => setTimeout(r, CONFIG.THINK_TIME_MS * 2));
        continue;
      }
      cookie = loginResult.cookie;

      // Step 2: Get current user (auth check)
      const meResult = await makeRequest('GET', '/api/auth/me', null, cookie);
      flowResults.authMe.push({
        duration: meResult.duration,
        success: meResult.success,
        status: meResult.status,
        role: user.role
      });
      await new Promise(r => setTimeout(r, CONFIG.THINK_TIME_MS));

      // Step 3: Dashboard stats
      const dashboardResult = await makeRequest('GET', '/api/rbac/dashboard/stats', null, cookie);
      flowResults.dashboard.push({
        duration: dashboardResult.duration,
        success: dashboardResult.success,
        status: dashboardResult.status,
        role: user.role
      });
      await new Promise(r => setTimeout(r, CONFIG.THINK_TIME_MS));

      // Step 4: Get voters (paginated) - Admin accesses all ACs, ACI accesses assigned AC
      const votersResult = await makeRequest('GET', `/api/voters/${acId}?limit=50&page=1`, null, cookie);
      flowResults.voters.push({
        duration: votersResult.duration,
        success: votersResult.success,
        status: votersResult.status,
        role: user.role,
        count: votersResult.data?.voters?.length || 0
      });
      await new Promise(r => setTimeout(r, CONFIG.THINK_TIME_MS));

      // Step 5: Get booths
      const boothsResult = await makeRequest('GET', `/api/rbac/booths?ac=${acId}`, null, cookie);
      flowResults.booths.push({
        duration: boothsResult.duration,
        success: boothsResult.success,
        status: boothsResult.status,
        role: user.role,
        count: boothsResult.data?.length || 0
      });
      await new Promise(r => setTimeout(r, CONFIG.THINK_TIME_MS));

      // Step 6: Get families
      const familiesResult = await makeRequest('GET', `/api/families/${acId}?limit=30&page=1`, null, cookie);
      flowResults.families.push({
        duration: familiesResult.duration,
        success: familiesResult.success,
        status: familiesResult.status,
        role: user.role
      });
      await new Promise(r => setTimeout(r, CONFIG.THINK_TIME_MS));

      // Step 7: Get surveys
      const surveysResult = await makeRequest('GET', '/api/surveys', null, cookie);
      flowResults.surveys.push({
        duration: surveysResult.duration,
        success: surveysResult.success,
        status: surveysResult.status,
        role: user.role
      });
      await new Promise(r => setTimeout(r, CONFIG.THINK_TIME_MS));

      // Step 8: Get master data
      const masterDataResult = await makeRequest('GET', '/api/master-data/sections', null, cookie);
      flowResults.masterData.push({
        duration: masterDataResult.duration,
        success: masterDataResult.success,
        status: masterDataResult.status,
        role: user.role
      });
      await new Promise(r => setTimeout(r, CONFIG.THINK_TIME_MS));

      // Step 9: Admin-only endpoints (RBAC users list)
      if (isAdmin) {
        const usersResult = await makeRequest('GET', '/api/rbac/users?limit=50', null, cookie);
        flowResults.adminUsers = flowResults.adminUsers || [];
        flowResults.adminUsers.push({
          duration: usersResult.duration,
          success: usersResult.success,
          status: usersResult.status
        });
        await new Promise(r => setTimeout(r, CONFIG.THINK_TIME_MS));
      }

      // Step 10: Logout
      const logoutResult = await makeRequest('POST', '/api/auth/logout', null, cookie);
      flowResults.logout.push({
        duration: logoutResult.duration,
        success: logoutResult.success,
        status: logoutResult.status,
        role: user.role
      });

      // Think time between full flows
      await new Promise(r => setTimeout(r, CONFIG.THINK_TIME_MS * 3));

    } catch (err) {
      flowResults.errors.push({ step: 'flow', role: user.role, error: err.message });
    }
  }
}

// Run load test at specific concurrency
async function runLoadTest(concurrency, duration) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  LOAD TEST: ${concurrency} Virtual Users for ${duration/1000}s`);
  console.log(`${'═'.repeat(70)}`);

  const flowResults = {
    login: [],
    authMe: [],
    dashboard: [],
    voters: [],
    booths: [],
    families: [],
    surveys: [],
    masterData: [],
    logout: [],
    errors: []
  };

  const testStartTime = Date.now();

  // Ramp up users gradually
  const users = [];
  const rampUpDelay = CONFIG.RAMP_UP_TIME / concurrency;

  console.log(`  Ramping up ${concurrency} users over ${CONFIG.RAMP_UP_TIME/1000}s...`);

  for (let i = 0; i < concurrency; i++) {
    await new Promise(r => setTimeout(r, rampUpDelay));
    users.push(simulateUserFlow(i, duration, flowResults));
  }

  console.log(`  All users active. Running test...`);
  await Promise.all(users);

  const testDuration = Date.now() - testStartTime;

  // Calculate metrics for each endpoint
  const endpoints = ['login', 'authMe', 'dashboard', 'voters', 'booths', 'families', 'surveys', 'masterData', 'logout'];
  const endpointMetrics = {};

  endpoints.forEach(endpoint => {
    const data = flowResults[endpoint];
    if (data.length === 0) {
      endpointMetrics[endpoint] = { noData: true };
      return;
    }

    const durations = data.map(d => d.duration);
    const successCount = data.filter(d => d.success).length;

    endpointMetrics[endpoint] = {
      totalRequests: data.length,
      successfulRequests: successCount,
      failedRequests: data.length - successCount,
      errorRate: ((data.length - successCount) / data.length * 100).toFixed(2) + '%',
      throughput: (data.length / (testDuration / 1000)).toFixed(2) + ' req/s',
      latency: {
        min: Math.min(...durations),
        max: Math.max(...durations),
        avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        p50: percentile(durations, 50),
        p75: percentile(durations, 75),
        p90: percentile(durations, 90),
        p95: percentile(durations, 95),
        p99: percentile(durations, 99)
      }
    };
  });

  // Calculate overall metrics
  const allDurations = endpoints.flatMap(e => flowResults[e].map(d => d.duration));
  const allRequests = endpoints.reduce((sum, e) => sum + flowResults[e].length, 0);
  const allSuccess = endpoints.reduce((sum, e) => sum + flowResults[e].filter(d => d.success).length, 0);

  const overallMetrics = {
    concurrency,
    testDurationMs: testDuration,
    totalRequests: allRequests,
    successfulRequests: allSuccess,
    failedRequests: allRequests - allSuccess,
    errorRate: ((allRequests - allSuccess) / allRequests * 100).toFixed(2) + '%',
    throughput: (allRequests / (testDuration / 1000)).toFixed(2) + ' req/s',
    latency: {
      min: Math.min(...allDurations),
      max: Math.max(...allDurations),
      avg: Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length),
      p50: percentile(allDurations, 50),
      p75: percentile(allDurations, 75),
      p90: percentile(allDurations, 90),
      p95: percentile(allDurations, 95),
      p99: percentile(allDurations, 99)
    },
    errors: flowResults.errors.slice(0, 10) // First 10 errors
  };

  // Print results
  console.log(`\n  Results for ${concurrency} VUs:`);
  console.log(`  ${'─'.repeat(66)}`);
  console.log(`  Total Requests: ${allRequests} | Success: ${allSuccess} | Failed: ${allRequests - allSuccess}`);
  console.log(`  Throughput: ${overallMetrics.throughput} | Error Rate: ${overallMetrics.errorRate}`);
  console.log(`  Latency: avg=${overallMetrics.latency.avg}ms, p95=${overallMetrics.latency.p95}ms, p99=${overallMetrics.latency.p99}ms`);

  console.log(`\n  Per-Endpoint Breakdown:`);
  console.log(`  ${'Endpoint'.padEnd(15)} | ${'Requests'.padEnd(10)} | ${'Success'.padEnd(10)} | ${'Avg(ms)'.padEnd(10)} | ${'P95(ms)'.padEnd(10)} | ${'P99(ms)'.padEnd(10)}`);
  console.log(`  ${'─'.repeat(75)}`);

  endpoints.forEach(endpoint => {
    const m = endpointMetrics[endpoint];
    if (m.noData) {
      console.log(`  ${endpoint.padEnd(15)} | No data`);
    } else {
      console.log(`  ${endpoint.padEnd(15)} | ${String(m.totalRequests).padEnd(10)} | ${String(m.successfulRequests).padEnd(10)} | ${String(m.latency.avg).padEnd(10)} | ${String(m.latency.p95).padEnd(10)} | ${String(m.latency.p99).padEnd(10)}`);
    }
  });

  return {
    concurrency,
    overall: overallMetrics,
    endpoints: endpointMetrics
  };
}

// Main execution
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║       KURAL BACKEND - PRODUCTION REAL DATA LOAD TEST                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`\nTest started at: ${new Date().toISOString()}`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Configuration:`);
  console.log(`  - Virtual User levels: ${CONFIG.CONCURRENT_USERS.join(', ')}`);
  console.log(`  - Test duration per level: ${CONFIG.TEST_DURATION_PER_LEVEL / 1000}s`);
  console.log(`  - Ramp-up time: ${CONFIG.RAMP_UP_TIME / 1000}s`);
  console.log(`  - Think time: ${CONFIG.THINK_TIME_MS}ms`);

  // Verify connectivity
  console.log('\nVerifying server connectivity...');
  const healthCheck = await makeRequest('GET', '/api/health');
  if (!healthCheck.success) {
    console.error('ERROR: Cannot reach production server');
    process.exit(1);
  }
  console.log('✓ Server is reachable\n');

  // Verify test user can login
  console.log('Verifying test user credentials...');
  const testLogin = await makeRequest('POST', '/api/auth/login', {
    identifier: TEST_USERS.aci111.identifier,
    password: TEST_USERS.aci111.password
  });
  if (!testLogin.success) {
    console.error('ERROR: Test user login failed:', testLogin.status);
    process.exit(1);
  }
  console.log('✓ Test user authenticated successfully\n');

  // Run tests at each concurrency level
  for (const concurrency of CONFIG.CONCURRENT_USERS) {
    const testResult = await runLoadTest(concurrency, CONFIG.TEST_DURATION_PER_LEVEL);
    results.tests.push(testResult);

    // Brief pause between test levels
    if (CONFIG.CONCURRENT_USERS.indexOf(concurrency) < CONFIG.CONCURRENT_USERS.length - 1) {
      console.log('\n  Cooling down for 5 seconds before next test level...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  // Generate summary
  console.log('\n\n' + '═'.repeat(70));
  console.log('                        LOAD TEST SUMMARY');
  console.log('═'.repeat(70));

  console.log('\nOverall Performance by VU Level:');
  console.log('─'.repeat(70));
  console.log(`${'VUs'.padEnd(8)} | ${'Requests'.padEnd(12)} | ${'Throughput'.padEnd(15)} | ${'Error Rate'.padEnd(12)} | ${'P95 Latency'.padEnd(12)} | ${'P99 Latency'.padEnd(12)}`);
  console.log('─'.repeat(70));

  results.tests.forEach(test => {
    const o = test.overall;
    console.log(`${String(test.concurrency).padEnd(8)} | ${String(o.totalRequests).padEnd(12)} | ${o.throughput.padEnd(15)} | ${o.errorRate.padEnd(12)} | ${(o.latency.p95 + 'ms').padEnd(12)} | ${(o.latency.p99 + 'ms').padEnd(12)}`);
  });

  // Find optimal capacity
  const stableTests = results.tests.filter(t => parseFloat(t.overall.errorRate) < 1);
  const maxStableVUs = stableTests.length > 0 ? Math.max(...stableTests.map(t => t.concurrency)) : 0;
  const maxThroughput = Math.max(...results.tests.map(t => parseFloat(t.overall.throughput)));

  results.summary = {
    maxStableVirtualUsers: maxStableVUs,
    maxThroughput: maxThroughput.toFixed(2) + ' req/s',
    recommendedCapacity: Math.floor(maxStableVUs * 0.8),
    bottlenecks: []
  };

  // Identify bottlenecks
  results.tests.forEach(test => {
    Object.entries(test.endpoints).forEach(([endpoint, metrics]) => {
      if (!metrics.noData && metrics.latency.p95 > 1000) {
        results.summary.bottlenecks.push({
          endpoint,
          concurrency: test.concurrency,
          p95: metrics.latency.p95
        });
      }
    });
  });

  console.log('\n─'.repeat(70));
  console.log(`\nCapacity Analysis:`);
  console.log(`  Max Stable Virtual Users: ${results.summary.maxStableVirtualUsers}`);
  console.log(`  Max Throughput: ${results.summary.maxThroughput}`);
  console.log(`  Recommended Capacity (80%): ${results.summary.recommendedCapacity} concurrent users`);

  if (results.summary.bottlenecks.length > 0) {
    console.log(`\nBottlenecks Identified:`);
    results.summary.bottlenecks.forEach(b => {
      console.log(`  - ${b.endpoint} at ${b.concurrency} VUs: P95=${b.p95}ms`);
    });
  }

  results.testEndTime = new Date().toISOString();

  // Output JSON
  console.log('\n\n--- JSON RESULTS ---');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
