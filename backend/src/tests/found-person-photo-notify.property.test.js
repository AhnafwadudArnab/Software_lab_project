/**
 * Property-Based Tests — found-person-photo-notify
 *
 * Tests Properties 1, 2, 3, 4, 5, 6, 10, 11 using fast-check with { numRuns: 100 }.
 *
 * Each test directly exercises the controller logic by injecting mock
 * req/res objects and a mock query function, following the same pattern
 * as police-role-restriction.property.test.js.
 */

import { jest, test, expect, describe } from '@jest/globals';
import fc from 'fast-check';

// ── Mock setup ────────────────────────────────────────────────────────────────
// We mock the db module and cloudinaryUpload module before importing controllers.

const mockQuery = jest.fn();
const mockUploadBufferToCloudinary = jest.fn();

jest.unstable_mockModule('../config/db.js', () => ({
  query: mockQuery,
}));

jest.unstable_mockModule('../utils/cloudinaryUpload.js', () => ({
  uploadBufferToCloudinary: mockUploadBufferToCloudinary,
}));

// Dynamically import controllers AFTER mocks are set up
const { uploadFoundPhoto, getFoundPhotos } = await import('../controllers/foundPhotoController.js');
const { getNotifications } = await import('../controllers/notificationController.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a mock res object that captures status code and json body.
 * res.status() returns res so .json() can be chained.
 */
function makeRes() {
  const res = {
    _status: null,
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };
  return res;
}

/**
 * Build a mock req for uploadFoundPhoto with a given file and case id.
 */
function makeUploadReq({ caseId, mimetype, size, userId = 'user-uuid-123' }) {
  return {
    params: { id: caseId },
    user: { id: userId },
    file: { mimetype, size, buffer: Buffer.from('fake-image-data') },
  };
}

const NON_FOUND_STATUSES = ['pending', 'verified', 'active', 'closed', 'rejected'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ── Property 1: Found-photo upload triggers status update for all non-found cases ──

/**
 * Property 1: Found-photo upload triggers status update for all non-found cases
 * Validates: Requirements 1.2
 *
 * For any case with a status other than 'found', when a valid found-person photo
 * is uploaded via POST /api/cases/:id/found-photo, the system SHALL update the
 * case status to 'found' in the database.
 */
describe('Feature: found-person-photo-notify, Property 1: found-photo upload triggers status update for all non-found cases', () => {
  test(
    'Property 1: UPDATE missing_persons SET status=found is called for every non-found case status',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...NON_FOUND_STATUSES),
          fc.uuid(),
          fc.uuid(),
          async (nonFoundStatus, caseId, userId) => {
            mockQuery.mockReset();
            mockUploadBufferToCloudinary.mockReset();

            const fakeCase = {
              id: caseId,
              name: 'Test Person',
              status: nonFoundStatus,
              guardian_id: null,
            };

            // Track all query calls
            const queryCalls = [];
            mockQuery.mockImplementation(async (sql, params) => {
              queryCalls.push({ sql, params });
              if (sql.includes('SELECT * FROM missing_persons')) {
                return { rows: [fakeCase] };
              }
              if (sql.includes('INSERT INTO found_person_photos')) {
                return {
                  rows: [{
                    id: 'photo-uuid',
                    missing_person_id: caseId,
                    uploaded_by: userId,
                    image_url: 'https://cloudinary.com/fake',
                    public_id: 'missing-diary/found-persons/fake',
                    created_at: new Date().toISOString(),
                  }],
                };
              }
              return { rows: [] };
            });

            mockUploadBufferToCloudinary.mockResolvedValue({
              secure_url: 'https://cloudinary.com/fake',
              public_id: 'missing-diary/found-persons/fake',
            });

            const req = makeUploadReq({
              caseId,
              mimetype: 'image/jpeg',
              size: 1024,
              userId,
            });
            const res = makeRes();
            const next = jest.fn();

            await uploadFoundPhoto(req, res, next);

            // Assert: no error was thrown
            expect(next).not.toHaveBeenCalled();

            // Assert: UPDATE missing_persons SET status='found' was called
            const updateCall = queryCalls.find(
              c => c.sql.includes('UPDATE missing_persons') && c.params.includes('found')
            );
            expect(updateCall).toBeDefined();
            expect(updateCall.params[0]).toBe('found');
            expect(updateCall.params[1]).toBe(caseId);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ── Property 2: Invalid MIME types are always rejected ────────────────────────

/**
 * Property 2: Invalid MIME types are always rejected
 * Validates: Requirements 1.6
 *
 * For any file whose MIME type is not image/jpeg, image/png, or image/webp,
 * the POST /api/cases/:id/found-photo endpoint SHALL return HTTP 400 with
 * the message "Invalid file type. Only JPEG, PNG, and WebP images are accepted".
 */
describe('Feature: found-person-photo-notify, Property 2: invalid MIME types are always rejected', () => {
  test(
    'Property 2: uploadFoundPhoto returns 400 for any MIME type that is not jpeg, png, or webp',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate MIME type strings that are NOT in the allowed list
          fc.string({ minLength: 1, maxLength: 50 }).filter(
            s => !ALLOWED_MIME_TYPES.includes(s)
          ),
          fc.uuid(),
          async (invalidMimeType, caseId) => {
            mockQuery.mockReset();
            mockUploadBufferToCloudinary.mockReset();

            const req = {
              params: { id: caseId },
              user: { id: 'user-uuid-123' },
              file: {
                mimetype: invalidMimeType,
                size: 1024,
                buffer: Buffer.from('fake-image-data'),
              },
            };
            const res = makeRes();
            const next = jest.fn();

            await uploadFoundPhoto(req, res, next);

            // Assert: HTTP 400 is returned
            expect(res._status).toBe(400);
            // Assert: correct error message
            expect(res._body).toMatchObject({
              message: 'Invalid file type. Only JPEG, PNG, and WebP images are accepted',
            });
            // Assert: no DB calls were made
            expect(mockQuery).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ── Property 3: Oversized files are always rejected ───────────────────────────

/**
 * Property 3: Oversized files are always rejected
 * Validates: Requirements 1.7
 *
 * For any file whose size exceeds 5 MB (5 × 1024 × 1024 bytes),
 * the POST /api/cases/:id/found-photo endpoint SHALL return HTTP 400
 * with the message "File too large. Maximum size is 5 MB".
 */
describe('Feature: found-person-photo-notify, Property 3: oversized files are always rejected', () => {
  test(
    'Property 3: uploadFoundPhoto returns 400 for any file size exceeding 5 MB',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate file sizes strictly greater than 5 MB
          fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 10 }),
          fc.uuid(),
          async (oversizedFileSize, caseId) => {
            mockQuery.mockReset();
            mockUploadBufferToCloudinary.mockReset();

            const req = {
              params: { id: caseId },
              user: { id: 'user-uuid-123' },
              file: {
                mimetype: 'image/jpeg',
                size: oversizedFileSize,
                buffer: Buffer.from('fake-image-data'),
              },
            };
            const res = makeRes();
            const next = jest.fn();

            await uploadFoundPhoto(req, res, next);

            // Assert: HTTP 400 is returned
            expect(res._status).toBe(400);
            // Assert: correct error message
            expect(res._body).toMatchObject({
              message: 'File too large. Maximum size is 5 MB',
            });
            // Assert: no DB calls were made
            expect(mockQuery).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ── Property 4: Audit log is written for every successful found-photo upload ──

/**
 * Property 4: Audit log is written for every successful found-photo upload
 * Validates: Requirements 1.8
 *
 * For any valid found-photo upload request (valid file, existing case, authorized user),
 * the system SHALL insert a row into audit_logs with action = "Uploaded found-person photo",
 * target_type = "missing_person", and target_id equal to the case ID.
 */
describe('Feature: found-person-photo-notify, Property 4: audit log is written for every successful upload', () => {
  test(
    'Property 4: audit_logs INSERT is called with correct action, target_type, and target_id for every valid upload',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.constantFrom(...NON_FOUND_STATUSES),
          async (caseId, userId, caseStatus) => {
            mockQuery.mockReset();
            mockUploadBufferToCloudinary.mockReset();

            const fakeCase = {
              id: caseId,
              name: 'Test Person',
              status: caseStatus,
              guardian_id: null,
            };

            const queryCalls = [];
            mockQuery.mockImplementation(async (sql, params) => {
              queryCalls.push({ sql, params });
              if (sql.includes('SELECT * FROM missing_persons')) {
                return { rows: [fakeCase] };
              }
              if (sql.includes('INSERT INTO found_person_photos')) {
                return {
                  rows: [{
                    id: 'photo-uuid',
                    missing_person_id: caseId,
                    uploaded_by: userId,
                    image_url: 'https://cloudinary.com/fake',
                    public_id: 'missing-diary/found-persons/fake',
                    created_at: new Date().toISOString(),
                  }],
                };
              }
              return { rows: [] };
            });

            mockUploadBufferToCloudinary.mockResolvedValue({
              secure_url: 'https://cloudinary.com/fake',
              public_id: 'missing-diary/found-persons/fake',
            });

            const req = makeUploadReq({
              caseId,
              mimetype: 'image/jpeg',
              size: 1024,
              userId,
            });
            const res = makeRes();
            const next = jest.fn();

            await uploadFoundPhoto(req, res, next);

            // Assert: no error was thrown
            expect(next).not.toHaveBeenCalled();

            // Assert: audit_logs INSERT was called
            const auditCall = queryCalls.find(
              c => c.sql.includes('INSERT INTO audit_logs')
            );
            expect(auditCall).toBeDefined();

            // Assert: action = "Uploaded found-person photo"
            expect(auditCall.params).toContain('Uploaded found-person photo');
            // Assert: target_type = "missing_person"
            expect(auditCall.params).toContain('missing_person');
            // Assert: target_id = caseId
            expect(auditCall.params).toContain(caseId);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ── Property 5: Guardian notification is created for every successful upload with a guardian ──

/**
 * Property 5: Guardian notification is created for every successful upload with a guardian
 * Validates: Requirements 2.1
 *
 * For any case that has a non-null guardian_id, when a valid found-person photo is uploaded,
 * the system SHALL insert a row into notifications with user_id = guardian_id,
 * type = "found_person_photo", and a message containing the case name.
 */
describe('Feature: found-person-photo-notify, Property 5: guardian notification is created for every successful upload with a guardian', () => {
  test(
    'Property 5: notifications INSERT is called with correct user_id, type, and message for every upload with a guardian',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (caseId, userId, guardianId, caseName) => {
            mockQuery.mockReset();
            mockUploadBufferToCloudinary.mockReset();

            const fakeCase = {
              id: caseId,
              name: caseName,
              status: 'active',
              guardian_id: guardianId,
            };

            const queryCalls = [];
            mockQuery.mockImplementation(async (sql, params) => {
              queryCalls.push({ sql, params });
              if (sql.includes('SELECT * FROM missing_persons')) {
                return { rows: [fakeCase] };
              }
              if (sql.includes('INSERT INTO found_person_photos')) {
                return {
                  rows: [{
                    id: 'photo-uuid',
                    missing_person_id: caseId,
                    uploaded_by: userId,
                    image_url: 'https://cloudinary.com/fake',
                    public_id: 'missing-diary/found-persons/fake',
                    created_at: new Date().toISOString(),
                  }],
                };
              }
              return { rows: [] };
            });

            mockUploadBufferToCloudinary.mockResolvedValue({
              secure_url: 'https://cloudinary.com/fake',
              public_id: 'missing-diary/found-persons/fake',
            });

            const req = makeUploadReq({ caseId, mimetype: 'image/jpeg', size: 1024, userId });
            const res = makeRes();
            const next = jest.fn();

            await uploadFoundPhoto(req, res, next);

            // Assert: no error was thrown
            expect(next).not.toHaveBeenCalled();

            // Assert: notifications INSERT was called
            const notifCall = queryCalls.find(
              c => c.sql.includes('INSERT INTO notifications')
            );
            expect(notifCall).toBeDefined();

            // Assert: user_id = guardian_id
            expect(notifCall.params[0]).toBe(guardianId);
            // Assert: type = "found_person_photo" (embedded in SQL)
            expect(notifCall.sql).toContain('found_person_photo');
            // Assert: message contains the case name
            const message = notifCall.params[2];
            expect(typeof message).toBe('string');
            expect(message).toContain(caseName);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ── Property 6: Notifications are returned in descending creation order ───────

/**
 * Property 6: Notifications are returned in descending creation order
 * Validates: Requirements 2.2
 *
 * For any set of notifications belonging to a user, GET /api/notifications SHALL
 * return them ordered by created_at DESC — the most recently created notification
 * appears first.
 */
describe('Feature: found-person-photo-notify, Property 6: notifications are returned in descending creation order', () => {
  test(
    'Property 6: getNotifications returns notifications ordered by created_at DESC',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate an array of notification objects with varying created_at timestamps
          fc.array(
            fc.record({
              id: fc.uuid(),
              user_id: fc.uuid(),
              type: fc.constantFrom('found_person_photo', 'request_info'),
              message: fc.string({ minLength: 1, maxLength: 100 }),
              read: fc.boolean(),
              created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
                .filter(d => Number.isFinite(d.getTime()))
                .map(d => d.toISOString()),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          fc.uuid(),
          async (notifications, userId) => {
            mockQuery.mockReset();

            // The DB returns notifications already sorted DESC (as the real query does)
            const sortedDesc = [...notifications].sort(
              (a, b) => new Date(b.created_at) - new Date(a.created_at)
            );

            mockQuery.mockResolvedValue({ rows: sortedDesc });

            const req = { user: { id: userId } };
            const res = {
              _body: null,
              json(body) { this._body = body; return this; },
            };
            const next = jest.fn();

            await getNotifications(req, res, next);

            // Assert: no error was thrown
            expect(next).not.toHaveBeenCalled();

            const returned = res._body;
            expect(Array.isArray(returned)).toBe(true);
            expect(returned).toHaveLength(sortedDesc.length);

            // Assert: the response is ordered by created_at DESC
            for (let i = 0; i < returned.length - 1; i++) {
              const current = new Date(returned[i].created_at).getTime();
              const next_ = new Date(returned[i + 1].created_at).getTime();
              expect(current).toBeGreaterThanOrEqual(next_);
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ── Property 10: GET /api/cases/:id/found-photos returns all required fields ordered by created_at ASC ──

/**
 * Property 10: GET /api/cases/:id/found-photos returns all required fields ordered by created_at ASC
 * Validates: Requirements 5.1
 *
 * For any set of found-person photos linked to a case, GET /api/cases/:id/found-photos
 * SHALL return a JSON array where each element contains id, image_url, public_id,
 * and created_at, and the array is ordered by created_at ASC.
 */
describe('Feature: found-person-photo-notify, Property 10: GET /api/cases/:id/found-photos returns all required fields ordered by created_at ASC', () => {
  test(
    'Property 10: getFoundPhotos returns all required fields and is ordered by created_at ASC',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          // Generate an array of found-photo objects
          fc.array(
            fc.record({
              id: fc.uuid(),
              image_url: fc.webUrl(),
              public_id: fc.string({ minLength: 1, maxLength: 50 }),
              created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
                .filter(d => Number.isFinite(d.getTime()))
                .map(d => d.toISOString()),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          async (caseId, photos) => {
            mockQuery.mockReset();

            // DB returns photos sorted ASC (as the real query does)
            const sortedAsc = [...photos].sort(
              (a, b) => new Date(a.created_at) - new Date(b.created_at)
            );

            // First query: SELECT case (status = 'found' so no auth required)
            // Second query: SELECT photos
            let callCount = 0;
            mockQuery.mockImplementation(async (sql) => {
              callCount++;
              if (sql.includes('SELECT id, status FROM missing_persons')) {
                return { rows: [{ id: caseId, status: 'found' }] };
              }
              if (sql.includes('SELECT id, image_url, public_id, created_at FROM found_person_photos')) {
                return { rows: sortedAsc };
              }
              return { rows: [] };
            });

            const req = {
              params: { id: caseId },
              user: { id: 'user-uuid-123' },
            };
            const res = {
              _body: null,
              json(body) { this._body = body; return this; },
            };
            const next = jest.fn();

            await getFoundPhotos(req, res, next);

            // Assert: no error was thrown
            expect(next).not.toHaveBeenCalled();

            const returned = res._body;
            expect(Array.isArray(returned)).toBe(true);
            expect(returned).toHaveLength(sortedAsc.length);

            // Assert: each element contains all required fields
            for (const photo of returned) {
              expect(photo).toHaveProperty('id');
              expect(photo).toHaveProperty('image_url');
              expect(photo).toHaveProperty('public_id');
              expect(photo).toHaveProperty('created_at');
            }

            // Assert: ordered by created_at ASC
            for (let i = 0; i < returned.length - 1; i++) {
              const current = new Date(returned[i].created_at).getTime();
              const next_ = new Date(returned[i + 1].created_at).getTime();
              expect(current).toBeLessThanOrEqual(next_);
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ── Property 11: Unauthenticated access to found-photos is blocked for non-found cases ──

/**
 * Property 11: Unauthenticated access to found-photos is blocked for non-found cases
 * Validates: Requirements 5.4
 *
 * For any case whose status is not 'found', an unauthenticated request to
 * GET /api/cases/:id/found-photos SHALL return HTTP 401.
 */
describe('Feature: found-person-photo-notify, Property 11: unauthenticated access to found-photos is blocked for non-found cases', () => {
  test(
    'Property 11: getFoundPhotos returns 401 for unauthenticated requests when case status is not found',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...NON_FOUND_STATUSES),
          fc.uuid(),
          async (nonFoundStatus, caseId) => {
            mockQuery.mockReset();

            mockQuery.mockImplementation(async (sql) => {
              if (sql.includes('SELECT id, status FROM missing_persons')) {
                return { rows: [{ id: caseId, status: nonFoundStatus }] };
              }
              return { rows: [] };
            });

            // Unauthenticated request: req.user is undefined
            const req = {
              params: { id: caseId },
              user: undefined,
            };
            const res = makeRes();
            const next = jest.fn();

            await getFoundPhotos(req, res, next);

            // Assert: HTTP 401 is returned
            expect(res._status).toBe(401);
            expect(res._body).toMatchObject({ message: 'Authentication required' });
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
