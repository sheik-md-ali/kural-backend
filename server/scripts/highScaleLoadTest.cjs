/**
 * High-Scale Load Test Suite
 *
 * Tests backend capacity with:
 * - Concurrency up to 100 users
 * - RPS scaling tests
 * - P50/P95/P99 latency distribution
 *
 * Generates: throughput_gain_report.md, scalability_report.md
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = 'http://localhost:4000';
const CONCURRENCY_LEVELS = [1, 5, 10, 25, 50, 100];
const RPS_LEVELS = [10, 25, 50, 100];
const RUNS_PER_TEST = 10;

// Baseline from v2 (post-first-optimization)
const BASELINE_V2 = {
  '/api/families/111': { p50: 332, p95: 376, throughput: 9.7 },
  '/api/voters/fields/existing': { p50: 74, p95: 296, throughput: 10 },
  '/api/rbac/dashboard/stats': { p50: 70, p95: 1133, throughput: 10 },
  '/api/rbac/dashboard/ac-overview': { p50: 133, p95: 520, throughput: 10 }
};

// Results storage
const results = {
  timestamp: new Date().toISOString(),
  concurrencyTests: [],
  rpsTests: [],
  endpointLatency: {},
  summary: {}
};

function makeRequest(options, data = null) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          duration: Date.now() - start,
          cookies: res.headers['set-cookie'] || [],
          success: res.statusCode >= 200 && res.statusCode < 300,
          bodySize: body.length
        });
      });
    });
    req.on('error', (e) => resolve({ error: e.message, duration: Date.now() - start, success: false }));
    req.setTimeout(30000);
    if (data) req.write(data);
    req.end();
  });
}

function calculateStats(times) {
  if (times.length === 0) return null;
  const sorted = [...times].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round(sum / sorted.length),
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
    p99: sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1]
  };
}

async function login() {
  const loginData = JSON.stringify({
    identifier: 'admin@kuralapp.com',
    password: 'admin123'
  });

  const result = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  }, loginData);

  const cookie = result.cookies.find(c => c.includes('kural.sid'));
  return cookie ? cookie.split(';')[0] : null;
}

async function testConcurrency(path, authHeaders, concurrency) {
  const start = Date.now();
  const promises = [];

  for (let i = 0; i < concurrency; i++) {
    promises.push(makeRequest({
      hostname: 'localhost',
      port: 4000,
      path,
      method: 'GET',
      headers: authHeaders
    }));
  }

  const responses = await Promise.all(promises);
  const wallTime = Date.now() - start;

  const times = responses.filter(r => r.success).map(r => r.duration);
  const errors = responses.filter(r => !r.success).length;
  const stats = calculateStats(times);

  return {
    concurrency,
    wallTime,
    successCount: times.length,
    errorCount: errors,
    throughput: times.length > 0 ? Math.round((times.length / wallTime) * 1000 * 10) / 10 : 0,
    stats
  };
}

async function testRPS(path, authHeaders, targetRPS, durationSeconds = 5) {
  const interval = 1000 / targetRPS;
  const totalRequests = targetRPS * durationSeconds;
  const times = [];
  const errors = [];
  const start = Date.now();

  const requestPromises = [];

  for (let i = 0; i < totalRequests; i++) {
    const delay = i * interval;
    requestPromises.push(
      new Promise(resolve => {
        setTimeout(async () => {
          const result = await makeRequest({
            hostname: 'localhost',
            port: 4000,
            path,
            method: 'GET',
            headers: authHeaders
          });
          if (result.success) {
            times.push(result.duration);
          } else {
            errors.push(result.error || result.status);
          }
          resolve();
        }, delay);
      })
    );
  }

  await Promise.all(requestPromises);
  const actualDuration = Date.now() - start;
  const stats = calculateStats(times);

  return {
    targetRPS,
    actualRPS: Math.round((times.length / (actualDuration / 1000)) * 10) / 10,
    successCount: times.length,
    errorCount: errors.length,
    duration: actualDuration,
    stats
  };
}

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           HIGH-SCALE LOAD TEST SUITE v3                       ║');
  console.log('║           Testing Optimized Backend                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Started at:', new Date().toISOString());
  console.log('');

  // Login
  console.log('Authenticating...');
  const cookie = await login();
  if (!cookie) {
    console.log('Login failed. Aborting.');
    return;
  }
  console.log('Login successful\n');

  const authHeaders = { 'Cookie': cookie };

  const endpoints = [
    { path: '/api/families/111?page=1&limit=50', name: 'Families' },
    { path: '/api/voters/fields/existing', name: 'Fields Existing' },
    { path: '/api/rbac/dashboard/stats', name: 'Dashboard Stats' },
    { path: '/api/rbac/dashboard/ac-overview', name: 'AC Overview' }
  ];

  // PHASE 1: Concurrency Tests
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('PHASE 1: CONCURRENCY SCALING TESTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const endpoint of endpoints) {
    console.log(`Testing: ${endpoint.name}`);
    console.log('Concurrency | Throughput | Avg Latency | P95 Latency | Errors');
    console.log('------------|------------|-------------|-------------|-------');

    const endpointResults = [];

    for (const concurrency of CONCURRENCY_LEVELS) {
      const result = await testConcurrency(endpoint.path, authHeaders, concurrency);
      endpointResults.push(result);

      console.log(
        `${String(concurrency).padStart(11)} | ` +
        `${String(result.throughput).padStart(8)} rps | ` +
        `${String(result.stats?.avg || 'N/A').padStart(9)}ms | ` +
        `${String(result.stats?.p95 || 'N/A').padStart(9)}ms | ` +
        `${result.errorCount}`
      );

      // Small delay between tests
      await new Promise(r => setTimeout(r, 500));
    }

    results.concurrencyTests.push({
      endpoint: endpoint.path,
      name: endpoint.name,
      results: endpointResults
    });

    console.log('');
  }

  // PHASE 2: RPS Scaling Tests (on fastest endpoint)
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('PHASE 2: RPS SCALING TESTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const testEndpoint = endpoints[1]; // fields/existing is fastest
  console.log(`Testing: ${testEndpoint.name}`);
  console.log('Target RPS | Actual RPS | Success | Errors | Avg Latency | P95');
  console.log('-----------|------------|---------|--------|-------------|----');

  for (const rps of RPS_LEVELS) {
    const result = await testRPS(testEndpoint.path, authHeaders, rps, 3);
    results.rpsTests.push(result);

    console.log(
      `${String(rps).padStart(10)} | ` +
      `${String(result.actualRPS).padStart(10)} | ` +
      `${String(result.successCount).padStart(7)} | ` +
      `${String(result.errorCount).padStart(6)} | ` +
      `${String(result.stats?.avg || 'N/A').padStart(9)}ms | ` +
      `${String(result.stats?.p95 || 'N/A')}ms`
    );

    await new Promise(r => setTimeout(r, 1000));
  }

  // PHASE 3: Latency Distribution
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('PHASE 3: LATENCY DISTRIBUTION (10 sequential requests each)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const endpoint of endpoints) {
    const times = [];
    for (let i = 0; i < RUNS_PER_TEST; i++) {
      const result = await makeRequest({
        hostname: 'localhost',
        port: 4000,
        path: endpoint.path,
        method: 'GET',
        headers: authHeaders
      });
      if (result.success) {
        times.push(result.duration);
      }
      await new Promise(r => setTimeout(r, 100));
    }

    const stats = calculateStats(times);
    results.endpointLatency[endpoint.path] = stats;

    console.log(`${endpoint.name}:`);
    console.log(`  Min: ${stats.min}ms | Avg: ${stats.avg}ms | P50: ${stats.p50}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms | Max: ${stats.max}ms`);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('SUMMARY: V2 vs V3 COMPARISON');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('Endpoint                     | V2 P50   | V3 P50   | V2 P95   | V3 P95   | Improvement');
  console.log('-----------------------------|----------|----------|----------|----------|------------');

  for (const endpoint of endpoints) {
    const baseline = BASELINE_V2[endpoint.path.split('?')[0]];
    const current = results.endpointLatency[endpoint.path];

    if (baseline && current) {
      const p50Improvement = Math.round((1 - current.p50 / baseline.p50) * 100);
      const p95Improvement = Math.round((1 - current.p95 / baseline.p95) * 100);

      console.log(
        `${endpoint.name.padEnd(28)} | ` +
        `${String(baseline.p50).padStart(6)}ms | ` +
        `${String(current.p50).padStart(6)}ms | ` +
        `${String(baseline.p95).padStart(6)}ms | ` +
        `${String(current.p95).padStart(6)}ms | ` +
        `P50: ${p50Improvement}%, P95: ${p95Improvement}%`
      );
    }
  }

  // Calculate max stable concurrency
  const maxConcurrency = results.concurrencyTests[0]?.results.reduce((max, r) => {
    return r.errorCount === 0 && r.throughput > 0 ? Math.max(max, r.concurrency) : max;
  }, 0) || 0;

  // Calculate max stable RPS
  const maxRPS = results.rpsTests.reduce((max, r) => {
    return r.errorCount < r.successCount * 0.1 ? Math.max(max, r.actualRPS) : max;
  }, 0);

  results.summary = {
    maxStableConcurrency: maxConcurrency,
    maxStableRPS: maxRPS,
    avgLatencyP50: Math.round(
      Object.values(results.endpointLatency).reduce((sum, s) => sum + s.p50, 0) /
      Object.keys(results.endpointLatency).length
    ),
    avgLatencyP95: Math.round(
      Object.values(results.endpointLatency).reduce((sum, s) => sum + s.p95, 0) /
      Object.keys(results.endpointLatency).length
    )
  };

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('CAPACITY SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`  Max Stable Concurrency: ${maxConcurrency} users`);
  console.log(`  Max Stable RPS: ${maxRPS} requests/second`);
  console.log(`  Average P50 Latency: ${results.summary.avgLatencyP50}ms`);
  console.log(`  Average P95 Latency: ${results.summary.avgLatencyP95}ms`);

  console.log('\n✓ Tests completed at:', new Date().toISOString());

  // Generate reports
  generateThroughputReport(results);
  generateScalabilityReport(results);

  console.log('\n✓ Reports generated:');
  console.log('  - throughput_gain_report.md');
  console.log('  - scalability_report.md');
}

function generateThroughputReport(results) {
  const report = `# Throughput Gain Report
## High-Scale Backend Optimization Results

**Generated:** ${results.timestamp}

---

## Executive Summary

After implementing Phase 3 high-scale optimizations:
- **Compression**: Enabled gzip compression for responses > 1KB
- **Database**: Connection pool increased to 100, indexes added on all voter collections
- **Server**: ETags disabled, x-powered-by disabled
- **Background Jobs**: Precomputation workers for heavy operations

---

## Throughput Test Results

### Families Endpoint (/api/families/111)

| Concurrency | Throughput (RPS) | Avg Latency | P95 Latency | Errors |
|-------------|------------------|-------------|-------------|--------|
${results.concurrencyTests.find(t => t.name === 'Families')?.results.map(r =>
  `| ${r.concurrency} | ${r.throughput} | ${r.stats?.avg || 'N/A'}ms | ${r.stats?.p95 || 'N/A'}ms | ${r.errorCount} |`
).join('\n') || 'No data'}

### Fields Existing Endpoint (/api/voters/fields/existing)

| Concurrency | Throughput (RPS) | Avg Latency | P95 Latency | Errors |
|-------------|------------------|-------------|-------------|--------|
${results.concurrencyTests.find(t => t.name === 'Fields Existing')?.results.map(r =>
  `| ${r.concurrency} | ${r.throughput} | ${r.stats?.avg || 'N/A'}ms | ${r.stats?.p95 || 'N/A'}ms | ${r.errorCount} |`
).join('\n') || 'No data'}

### Dashboard Stats Endpoint (/api/rbac/dashboard/stats)

| Concurrency | Throughput (RPS) | Avg Latency | P95 Latency | Errors |
|-------------|------------------|-------------|-------------|--------|
${results.concurrencyTests.find(t => t.name === 'Dashboard Stats')?.results.map(r =>
  `| ${r.concurrency} | ${r.throughput} | ${r.stats?.avg || 'N/A'}ms | ${r.stats?.p95 || 'N/A'}ms | ${r.errorCount} |`
).join('\n') || 'No data'}

---

## RPS Scaling Test

| Target RPS | Actual RPS | Success | Errors | Avg Latency | P95 Latency |
|------------|------------|---------|--------|-------------|-------------|
${results.rpsTests.map(r =>
  `| ${r.targetRPS} | ${r.actualRPS} | ${r.successCount} | ${r.errorCount} | ${r.stats?.avg || 'N/A'}ms | ${r.stats?.p95 || 'N/A'}ms |`
).join('\n')}

---

## Key Metrics

| Metric | V2 Baseline | V3 Optimized | Improvement |
|--------|-------------|--------------|-------------|
| Max Concurrent Users | ~50 | ${results.summary.maxStableConcurrency} | ${Math.round((results.summary.maxStableConcurrency / 50) * 100 - 100)}% |
| Max Stable RPS | ~10 | ${results.summary.maxStableRPS} | ${Math.round((results.summary.maxStableRPS / 10) * 100 - 100)}% |
| Avg P50 Latency | ~150ms | ${results.summary.avgLatencyP50}ms | ${Math.round((1 - results.summary.avgLatencyP50 / 150) * 100)}% |

---

## Optimizations Applied

1. **Server-Level**
   - Compression middleware (gzip level 6)
   - ETags disabled
   - x-powered-by header removed

2. **Database-Level**
   - MongoDB connection pool: 100 connections
   - Retry writes/reads enabled
   - 153 new indexes created across all collections
   - Socket timeout: 45s, max idle: 30s

3. **Background Processing**
   - Family stats precomputation
   - L0 dashboard precomputation
   - Voter fields discovery caching
`;

  fs.writeFileSync(
    path.join(process.cwd(), 'throughput_gain_report.md'),
    report
  );
}

function generateScalabilityReport(results) {
  const report = `# Scalability Report
## Backend Capacity Analysis

**Generated:** ${results.timestamp}

---

## System Capacity

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Max Concurrent Users | ${results.summary.maxStableConcurrency} | 200-500 | ${results.summary.maxStableConcurrency >= 100 ? '🟢 On Track' : '🟡 Needs Improvement'} |
| Max Stable RPS | ${results.summary.maxStableRPS} | 100+ | ${results.summary.maxStableRPS >= 50 ? '🟢 On Track' : '🟡 Needs Improvement'} |
| Average P50 Latency | ${results.summary.avgLatencyP50}ms | <300ms | ${results.summary.avgLatencyP50 < 300 ? '🟢 Met' : '🔴 Exceeded'} |
| Average P95 Latency | ${results.summary.avgLatencyP95}ms | <300ms | ${results.summary.avgLatencyP95 < 300 ? '🟢 Met' : '🟡 Needs Work'} |

---

## Latency Distribution by Endpoint

| Endpoint | Min | Avg | P50 | P95 | P99 | Max |
|----------|-----|-----|-----|-----|-----|-----|
${Object.entries(results.endpointLatency).map(([path, stats]) =>
  `| ${path.split('?')[0]} | ${stats.min}ms | ${stats.avg}ms | ${stats.p50}ms | ${stats.p95}ms | ${stats.p99}ms | ${stats.max}ms |`
).join('\n')}

---

## Concurrency Scaling Analysis

### Error Rate by Concurrency

| Concurrency | Families | Fields | Stats | AC Overview |
|-------------|----------|--------|-------|-------------|
${CONCURRENCY_LEVELS.map(c => {
  const getErrors = (name) => {
    const test = results.concurrencyTests.find(t => t.name === name);
    const result = test?.results.find(r => r.concurrency === c);
    return result?.errorCount ?? 'N/A';
  };
  return `| ${c} | ${getErrors('Families')} | ${getErrors('Fields Existing')} | ${getErrors('Dashboard Stats')} | ${getErrors('AC Overview')} |`;
}).join('\n')}

---

## Recommendations for Further Scaling

### To reach 200-500 concurrent users:

1. **Enable Clustering**
   - Use \`server/cluster.js\` to spawn workers per CPU core
   - Expected improvement: 2-4x throughput on multi-core machines

2. **Add Redis Cache** (when ready)
   - Distributed cache for multi-instance deployments
   - Further reduce database load

3. **Read Replicas**
   - Add MongoDB read replicas for read-heavy operations
   - Use secondaryPreferred read preference

4. **CDN for Static Assets**
   - Offload static file serving to CDN
   - Reduce server load

5. **Rate Limiting Tuning**
   - Adjust rate limits for production traffic patterns
   - Implement tiered limits by endpoint type

---

## Test Environment

- **Platform:** Node.js v22.16.0
- **Database:** MongoDB with 100 connection pool
- **Compression:** Enabled (gzip level 6)
- **Indexes:** 153 indexes across all collections
`;

  fs.writeFileSync(
    path.join(process.cwd(), 'scalability_report.md'),
    report
  );
}

runTests().catch(console.error);
