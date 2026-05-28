/**
 * Unit Tests — police-role-restriction (Task 3.2)
 *
 * Tests that route guards correctly block police from admin-only endpoints
 * and allow admin through.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 7.1
 *
 * Uses Jest + Supertest with jest.unstable_mockModule for ESM mocking.
 * All mocks are set up BEFORE the app/router is dynamically imported.
 */

import { jest } from '@jest/globals';

// ── Mock: DB query — avoid real DB calls ─────────────────────────────────────
// We'll configure the mock implementation per-test via the returned mock fn.
const mockQuery = jest.fn();

await jest.unstable_mockModule('../config/db.js', () => ({
  query: mockQuery,
}));

// ── Mock: auth middleware ─────────────────────────────────────────────────────
// requireAuth: injects req.user from a test-controlled variable and calls next()
// requireRole: use the REAL logic (pure function, no DB needed)
// optionalAuth: just calls next() without setting req.user

let testUser = null; // set per-test to control which user is injected

await jest.unstable_mockModule('../middleware/auth.js', () => ({
  requireAuth: jest.fn((req, _res, next) => {
    req.user = testUser;
    next();
  }),
  requireRole: (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  },
  optionalAuth: jest.fn((_req, _res, next) => next()),
}));

// ── Mock: upload middleware ───────────────────────────────────────────────────
await jest.unstable_mockModule('../utils/upload.js', () => ({
  upload: {
    array: () => (_req, _res, next) => next(),
    single: () => (_req, _res, next) => next(),
  },
}));

// ── Mock: AI verifier ─────────────────────────────────────────────────────────
await jest.unstable_mockModule('../utils/aiVerifier.js', () => ({
  verifyReportWithAI: jest.fn().mockResolvedValue(null),
}));

// ── Mock: Cloudinary upload ───────────────────────────────────────────────────
await jest.unstable_mockModule('../utils/cloudinaryUpload.js', () => ({
  uploadBufferToCloudinary: jest.fn().mockResolvedValue({
    secure_url: 'https://cdn.example.com/test.jpg',
    public_id: 'test-public-id',
  }),
}));

// ── Mock: timeline controllers ────────────────────────────────────────────────
await jest.unstable_mockModule('../controllers/timelineController.js', () => ({
  getTimeline: jest.fn((_req, res) => res.json([])),
  addTimelineEntry: jest.fn((_req, res) => res.status(201).json({})),
}));

// ── Mock: location controllers ────────────────────────────────────────────────
await jest.unstable_mockModule('../controllers/locationController.js', () => ({
  recordLocation: jest.fn((_req, res) => res.status(201).json({})),
  getTrail: jest.fn((_req, res) => res.json([])),
}));

// ── Mock: sighting controllers ────────────────────────────────────────────────
await jest.unstable_mockModule('../controllers/sightingController.js', () => ({
  createSighting:       jest.fn((_req, res) => res.status(201).json({})),
  listSightings:        jest.fn((_req, res) => res.json([])),
  updateSightingStatus: jest.fn((_req, res) => res.json({})),
  matchSightings:       jest.fn((_req, res) => res.json({})),
  approveSighting:      jest.fn((_req, res) => res.json({})),
  rejectSighting:       jest.fn((_req, res) => res.json({})),
  getSightingAudit:     jest.fn((_req, res) => res.json([])),
  getSightingHistory:   jest.fn((_req, res) => res.json({ history: [] })),
  saveFaceScanResult:   jest.fn((_req, res) => res.status(201).json({})),
  getMovementAnalysis:  jest.fn((_req, res) => res.json({ trail: [], prediction: null })),
}));

// ── Dynamic imports AFTER mocks are set up ────────────────────────────────────
const { default: supertest } = await import('supertest');
const { default: express } = await import('express');
const { default: caseRouter }    = await import('../routes/caseRoutes.js');
const { default: sightingRouter } = await import('../routes/sightingRoutes.js');

// Build a minimal Express app with the case router
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/cases', caseRouter);
  return app;
}

// Build a minimal Express app with the sighting router
function buildSightingApp() {
  const app = express();
  app.use(express.json());
  app.use('/sightings', sightingRouter);
  return app;
}

// ── Test users ────────────────────────────────────────────────────────────────
const POLICE_USER = { id: 'police-user-id', role: 'police' };
const ADMIN_USER  = { id: 'admin-user-id',  role: 'admin'  };

// Fake case row returned by DB for admin success tests
const FAKE_CASE = {
  id: 'case-123',
  name: 'Test Person',
  status: 'pending',
  updated_at: new Date().toISOString(),
};

// ── Helper: reset mocks between tests ────────────────────────────────────────
function resetMocks() {
  mockQuery.mockReset();
}

// ─────────────────────────────────────────────────────────────────────────────
// POLICE TESTS — all admin-only endpoints must return 403
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Test 1: Police POST /cases/:id/approve → 403
 * Validates: Requirement 1.1
 */
test('Police POST /cases/:id/approve returns 403', async () => {
  resetMocks();
  testUser = POLICE_USER;
  const app = buildApp();

  const res = await supertest(app)
    .post('/cases/case-123/approve')
    .send({});

  expect(res.status).toBe(403);
});

/**
 * Test 2: Police POST /cases/:id/reject → 403
 * Validates: Requirement 1.2
 */
test('Police POST /cases/:id/reject returns 403', async () => {
  resetMocks();
  testUser = POLICE_USER;
  const app = buildApp();

  const res = await supertest(app)
    .post('/cases/case-123/reject')
    .send({});

  expect(res.status).toBe(403);
});

/**
 * Test 3: Police POST /cases/:id/request-info → 403
 * Validates: Requirement 1.3
 */
test('Police POST /cases/:id/request-info returns 403', async () => {
  resetMocks();
  testUser = POLICE_USER;
  const app = buildApp();

  const res = await supertest(app)
    .post('/cases/case-123/request-info')
    .send({});

  expect(res.status).toBe(403);
});

/**
 * Test 4: Police DELETE /cases/:id → 403
 * Validates: Requirement 1.4
 */
test('Police DELETE /cases/:id returns 403', async () => {
  resetMocks();
  testUser = POLICE_USER;
  const app = buildApp();

  const res = await supertest(app)
    .delete('/cases/case-123');

  expect(res.status).toBe(403);
});

/**
 * Test 5: Police GET /cases/:id/audit → 403
 * Validates: Requirement 1.5
 */
test('Police GET /cases/:id/audit returns 403', async () => {
  resetMocks();
  testUser = POLICE_USER;
  const app = buildApp();

  const res = await supertest(app)
    .get('/cases/case-123/audit');

  expect(res.status).toBe(403);
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN NON-REGRESSION TESTS — admin must still get 200
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Test 6: Admin POST /cases/:id/approve → 200
 * Validates: Requirement 7.1
 */
test('Admin POST /cases/:id/approve returns 200', async () => {
  resetMocks();
  testUser = ADMIN_USER;

  // approveCase: UPDATE missing_persons → returns updated row
  //              INSERT audit_logs → returns nothing meaningful
  mockQuery
    .mockResolvedValueOnce({ rows: [{ ...FAKE_CASE, status: 'verified' }] }) // UPDATE
    .mockResolvedValueOnce({ rows: [] });                                      // INSERT audit_log

  const app = buildApp();

  const res = await supertest(app)
    .post('/cases/case-123/approve')
    .send({});

  expect(res.status).toBe(200);
});

/**
 * Test 7: Admin POST /cases/:id/reject → 200
 * Validates: Requirement 7.1
 */
test('Admin POST /cases/:id/reject returns 200', async () => {
  resetMocks();
  testUser = ADMIN_USER;

  // rejectCase: UPDATE missing_persons → returns updated row
  //             INSERT audit_logs → returns nothing meaningful
  mockQuery
    .mockResolvedValueOnce({ rows: [{ ...FAKE_CASE, status: 'rejected' }] }) // UPDATE
    .mockResolvedValueOnce({ rows: [] });                                      // INSERT audit_log

  const app = buildApp();

  const res = await supertest(app)
    .post('/cases/case-123/reject')
    .send({});

  expect(res.status).toBe(200);
});

// ─────────────────────────────────────────────────────────────────────────────
// SIGHTING ROUTE GUARD TESTS — police blocked, admin allowed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Test 8: Police GET /sightings → 403
 * Validates: Requirement 1.6
 */
test('Police GET /sightings returns 403', async () => {
  resetMocks();
  testUser = POLICE_USER;
  const app = buildSightingApp();

  const res = await supertest(app)
    .get('/sightings');

  expect(res.status).toBe(403);
});

/**
 * Test 9: Police POST /sightings/:id/approve → 403
 * Validates: Requirement 1.7
 */
test('Police POST /sightings/:id/approve returns 403', async () => {
  resetMocks();
  testUser = POLICE_USER;
  const app = buildSightingApp();

  const res = await supertest(app)
    .post('/sightings/sighting-123/approve')
    .send({});

  expect(res.status).toBe(403);
});

/**
 * Test 10: Police POST /sightings/:id/reject → 403
 * Validates: Requirement 1.8
 */
test('Police POST /sightings/:id/reject returns 403', async () => {
  resetMocks();
  testUser = POLICE_USER;
  const app = buildSightingApp();

  const res = await supertest(app)
    .post('/sightings/sighting-123/reject')
    .send({});

  expect(res.status).toBe(403);
});

/**
 * Test 11: Police PATCH /sightings/:id/status → 403
 * Validates: Requirement 1.9
 */
test('Police PATCH /sightings/:id/status returns 403', async () => {
  resetMocks();
  testUser = POLICE_USER;
  const app = buildSightingApp();

  const res = await supertest(app)
    .patch('/sightings/sighting-123/status')
    .send({ status: 'verified' });

  expect(res.status).toBe(403);
});

/**
 * Test 12: Police GET /sightings/:id/audit → 403
 * Validates: Requirement 1.10
 */
test('Police GET /sightings/:id/audit returns 403', async () => {
  resetMocks();
  testUser = POLICE_USER;
  const app = buildSightingApp();

  const res = await supertest(app)
    .get('/sightings/sighting-123/audit');

  expect(res.status).toBe(403);
});

/**
 * Test 13: Admin GET /sightings → 200 (non-regression)
 * Validates: Requirement 7.1
 */
test('Admin GET /sightings returns 200', async () => {
  resetMocks();
  testUser = ADMIN_USER;
  const app = buildSightingApp();

  const res = await supertest(app)
    .get('/sightings');

  expect(res.status).toBe(200);
});
