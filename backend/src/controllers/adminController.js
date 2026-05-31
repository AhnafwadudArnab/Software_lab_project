import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../config/db.js';
import { compareFacesWithInsightFace, isInsightFaceConfigured } from '../utils/insightFace.js';
import { uploadBufferToCloudinary } from '../utils/cloudinaryUpload.js';

// ── Police Updates ────────────────────────────────────────────

/**
 * POST /api/admin/cases/:id/updates
 * Police or admin adds a text update note to a case.
 */
export async function addPoliceUpdate(req, res, next) {
  try {
    const schema = z.object({ update_text: z.string().min(3) });
    const { update_text } = schema.parse(req.body);
    const { id } = req.params;

    const caseCheck = await query('SELECT id FROM missing_persons WHERE id=$1', [id]);
    if (!caseCheck.rows[0]) return res.status(404).json({ message: 'Case not found' });

    const result = await query(
      'INSERT INTO police_updates (missing_person_id, police_id, update_text) VALUES ($1,$2,$3) RETURNING *',
      [id, req.user.id, update_text]
    );
    // Create a notification for the case reporter (guardian) if present
    try {
      const caseRow = await query('SELECT guardian_id, name FROM missing_persons WHERE id=$1', [id]);
      const guardianId = caseRow.rows[0]?.guardian_id;
      const caseName = caseRow.rows[0]?.name || 'Case';
      if (guardianId) {
        const msg = `${req.user.name} added an update for ${caseName}: ${update_text.slice(0, 240)}`;
        await query(
          'INSERT INTO notifications (user_id, case_id, type, message) VALUES ($1,$2,$3,$4)',
          [guardianId, id, 'police_update', msg]
        );
      }
    } catch (notifyErr) {
      // don't block the update if notification fails
      console.error('Failed to create notification for guardian:', notifyErr.message || notifyErr);
    }

    res.status(201).json(result.rows[0]);
  } catch (e) { next(e); }
}

/**
 * GET /api/admin/cases/:id/updates
 * List all police update notes for a case.
 */
export async function getPoliceUpdates(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT pu.*, u.name AS officer_name
       FROM police_updates pu
       LEFT JOIN users u ON u.id = pu.police_id
       WHERE pu.missing_person_id = $1
       ORDER BY pu.created_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (e) { next(e); }
}

export async function stats(req, res, next) {
  try {
    const users = await query('SELECT COUNT(*)::int total FROM users');
    const cases = await query('SELECT status, COUNT(*)::int count FROM missing_persons GROUP BY status');
    const sightings = await query('SELECT status, COUNT(*)::int count FROM sightings GROUP BY status');
    res.json({ totalUsers: users.rows[0].total, cases: cases.rows, sightings: sightings.rows });
  } catch (e) { next(e); }
}

export async function users(req, res, next) {
  try {
    const result = await query('SELECT id,name,email,phone,role,verified,created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (e) { next(e); }
}

export async function createPolice(req, res, next) {
  try {
    const schema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(6), phone: z.string().optional() });
    const data = schema.parse(req.body);
    const hash = await bcrypt.hash(data.password, 10);
    const result = await query('INSERT INTO users (name,email,phone,password_hash,role,verified) VALUES ($1,$2,$3,$4,\'police\',true) RETURNING id,name,email,role,verified', [data.name, data.email, data.phone || null, hash]);
    res.status(201).json(result.rows[0]);
  } catch (e) { next(e); }
}

const cameraSchema = z.object({
  name: z.string().min(2).max(120),
  organization: z.string().max(120).optional().nullable(),
  owner_name: z.string().max(120).optional().nullable(),
  owner_phone: z.string().max(40).optional().nullable(),
  owner_email: z.string().email().optional().or(z.literal('')).nullable(),
  verified_owner: z.coerce.boolean().default(false),
  region: z.string().min(2).max(80),
  city: z.string().min(2).max(80),
  area: z.string().max(120).optional().nullable(),
  location_text: z.string().max(240).optional().nullable(),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
  access_type: z.enum(['authorized', 'authority', 'owner_upload']).default('owner_upload'),
  status: z.enum(['unknown', 'online', 'offline', 'maintenance']).default('unknown'),
  notes: z.string().max(500).optional().nullable(),
});

const cameraSelect = `
  SELECT c.*, u.name AS last_checked_by_name
  FROM cctv_cameras c
  LEFT JOIN users u ON u.id = c.last_checked_by
`;

export async function listCctvCameras(req, res, next) {
  try {
    const schema = z.object({
      region: z.string().optional(),
      city: z.string().optional(),
      status: z.enum(['unknown', 'online', 'offline', 'maintenance']).optional(),
    });
    const filters = schema.parse(req.query);
    const where = [];
    const params = [];

    for (const key of ['region', 'city', 'status']) {
      if (filters[key]) {
        params.push(filters[key]);
        where.push(`${key} = $${params.length}`);
      }
    }

    const result = await query(
      `${cameraSelect}
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY region ASC, city ASC, area ASC NULLS LAST, name ASC`,
      params
    );
    res.json(result.rows);
  } catch (e) { next(e); }
}

export async function createCctvCamera(req, res, next) {
  try {
    const data = cameraSchema.parse(req.body);
    const result = await query(
      `INSERT INTO cctv_cameras
       (name, organization, owner_name, owner_phone, owner_email, verified_owner,
        region, city, area, location_text, lat, lng, access_type, status, notes, created_by)
       VALUES ($1,$2,$3,$4,NULLIF($5,''),$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        data.name,
        data.organization || null,
        data.owner_name || null,
        data.owner_phone || null,
        data.owner_email || null,
        data.verified_owner,
        data.region,
        data.city,
        data.area || null,
        data.location_text || null,
        data.lat ?? null,
        data.lng ?? null,
        data.access_type,
        data.status,
        data.notes || null,
        req.user.id,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) { next(e); }
}

export async function updateCctvCamera(req, res, next) {
  try {
    const data = cameraSchema.partial().parse(req.body);
    const entries = Object.entries(data);
    if (!entries.length) return res.status(400).json({ message: 'No camera fields provided' });

    const sets = [];
    const params = [];
    for (const [key, value] of entries) {
      params.push(value === '' ? null : value);
      sets.push(`${key} = $${params.length}`);
    }
    params.push(req.params.id);

    const result = await query(
      `UPDATE cctv_cameras
       SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Camera not found' });
    res.json(result.rows[0]);
  } catch (e) { next(e); }
}

export async function checkCctvCamera(req, res, next) {
  try {
    const schema = z.object({
      status: z.enum(['online', 'offline', 'maintenance', 'unknown']),
      notes: z.string().max(500).optional().nullable(),
    });
    const data = schema.parse(req.body);
    const result = await query(
      `UPDATE cctv_cameras
       SET status = $1, notes = COALESCE($2, notes), last_checked_at = NOW(),
           last_checked_by = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [data.status, data.notes || null, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Camera not found' });

    await query(
      `INSERT INTO audit_logs (user_id, action, target_type, target_id, notes)
       VALUES ($1, 'cctv_status_check', 'cctv_camera', $2, $3)`,
      [req.user.id, String(req.params.id), `Marked ${data.status}${data.notes ? `: ${data.notes}` : ''}`]
    );

    res.json(result.rows[0]);
  } catch (e) { next(e); }
}

export async function listCctvEvidenceRequests(req, res, next) {
  try {
    const result = await query(
      `SELECT r.*, c.name AS camera_name, c.region, c.city, c.area,
              mp.name AS case_name,
              u.name AS requested_by_name,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', up.id,
                    'evidence_url', up.evidence_url,
                    'public_id', up.public_id,
                    'file_type', up.file_type,
                    'uploaded_by_name', up.uploaded_by_name,
                    'uploaded_by_contact', up.uploaded_by_contact,
                    'notes', up.notes,
                    'created_at', up.created_at
                  )
                ) FILTER (WHERE up.id IS NOT NULL),
                '[]'
              ) AS uploads
       FROM cctv_evidence_requests r
       JOIN cctv_cameras c ON c.id = r.camera_id
       JOIN missing_persons mp ON mp.id = r.missing_person_id
       LEFT JOIN users u ON u.id = r.requested_by
       LEFT JOIN cctv_evidence_uploads up ON up.request_id = r.id
       GROUP BY r.id, c.id, mp.id, u.id
       ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (e) { next(e); }
}

export async function createCctvEvidenceRequest(req, res, next) {
  try {
    const schema = z.object({
      camera_id: z.string().uuid(),
      missing_person_id: z.string().min(1),
      request_message: z.string().max(1000).optional().nullable(),
    });
    const data = schema.parse(req.body);

    const camera = await query('SELECT id, verified_owner FROM cctv_cameras WHERE id=$1', [data.camera_id]);
    if (!camera.rows[0]) return res.status(404).json({ message: 'CCTV camera not found' });
    if (!camera.rows[0].verified_owner) {
      return res.status(400).json({ message: 'Camera owner must be verified before an evidence request is created' });
    }

    const missingCase = await query('SELECT id FROM missing_persons WHERE id=$1', [data.missing_person_id]);
    if (!missingCase.rows[0]) return res.status(404).json({ message: 'Case not found' });

    const uploadToken = crypto.randomBytes(24).toString('hex');
    const result = await query(
      `INSERT INTO cctv_evidence_requests
       (camera_id, missing_person_id, requested_by, request_message, upload_token, upload_token_expires_at)
       VALUES ($1,$2,$3,$4,$5,NOW() + INTERVAL '14 days')
       RETURNING *`,
      [data.camera_id, data.missing_person_id, req.user.id, data.request_message || null, uploadToken]
    );

    await query(
      `INSERT INTO audit_logs (user_id, action, target_type, target_id, notes)
       VALUES ($1, 'cctv_evidence_request_created', 'missing_person', $2, $3)`,
      [req.user.id, data.missing_person_id, `Camera request ${result.rows[0].id}`]
    );

    res.status(201).json(result.rows[0]);
  } catch (e) { next(e); }
}

export async function getCctvEvidenceUploadToken(req, res, next) {
  try {
    const result = await query(
      `SELECT r.id, r.request_status, r.request_message, r.upload_token_expires_at,
              c.name AS camera_name, c.organization, c.owner_name, c.region, c.city, c.area,
              mp.id AS case_id, mp.name AS case_name
       FROM cctv_evidence_requests r
       JOIN cctv_cameras c ON c.id = r.camera_id
       JOIN missing_persons mp ON mp.id = r.missing_person_id
       WHERE r.upload_token = $1`,
      [req.params.token]
    );
    const request = result.rows[0];
    if (!request) return res.status(404).json({ message: 'Evidence upload request not found' });
    if (new Date(request.upload_token_expires_at) < new Date()) {
      return res.status(410).json({ message: 'Evidence upload link has expired' });
    }
    res.json(request);
  } catch (e) { next(e); }
}

export async function uploadCctvEvidence(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: 'Please attach a CCTV image or video file' });

    const schema = z.object({
      uploaded_by_name: z.string().min(2).max(120),
      uploaded_by_contact: z.string().min(3).max(160),
      notes: z.string().max(1000).optional().nullable(),
    });
    const data = schema.parse(req.body);

    const requestResult = await query(
      `SELECT id, upload_token_expires_at
       FROM cctv_evidence_requests
       WHERE upload_token = $1 AND request_status IN ('pending','submitted')`,
      [req.params.token]
    );
    const request = requestResult.rows[0];
    if (!request) return res.status(404).json({ message: 'Evidence upload request not found' });
    if (new Date(request.upload_token_expires_at) < new Date()) {
      return res.status(410).json({ message: 'Evidence upload link has expired' });
    }

    const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'missing-diary/cctv-evidence');
    const uploadResult = await query(
      `INSERT INTO cctv_evidence_uploads
       (request_id, uploaded_by_name, uploaded_by_contact, evidence_url, public_id, file_type, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [request.id, data.uploaded_by_name, data.uploaded_by_contact, uploaded.secure_url, uploaded.public_id, req.file.mimetype, data.notes || null]
    );

    await query(
      `UPDATE cctv_evidence_requests
       SET request_status = 'submitted', submitted_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [request.id]
    );

    res.status(201).json(uploadResult.rows[0]);
  } catch (e) { next(e); }
}

export async function scanFaces(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'A photo is required for scanning' });
    }

    if (!isInsightFaceConfigured()) {
      return res.status(503).json({
        message: 'InsightFace scan is not configured. Set INSIGHTFACE_API_URL and INSIGHTFACE_TOKEN.',
      });
    }

    // Only scan active/verified cases — no point matching against found/closed/rejected
    const result = await query(
      'SELECT mp.id, mp.name, mp.status, mp.age, mp.gender, mp.last_seen_location, ' +
      'COALESCE(json_agg(DISTINCT pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), \'[]\') AS images ' +
      'FROM missing_persons mp ' +
      'LEFT JOIN person_images pi ON pi.missing_person_id = mp.id ' +
      "WHERE mp.status IN ('active','verified') " +
      'GROUP BY mp.id ORDER BY mp.created_at DESC'
    );

    const queryImage = req.file.buffer;
    const queryMimeType = req.file.mimetype;
    const matches = [];

    for (const candidate of result.rows) {
      const images = Array.isArray(candidate.images) ? candidate.images.slice(0, 3) : [];
      let bestMatch = null;

      for (const imageUrl of images) {
        try {
          const response = await fetch(imageUrl);
          if (!response.ok) continue;

          const referenceBuffer = Buffer.from(await response.arrayBuffer());
          const referenceMimeType = response.headers.get('content-type') || 'image/jpeg';
          const faceMatch = await compareFacesWithInsightFace({
            queryBuffer: queryImage,
            queryMimeType,
            referenceBuffer,
            referenceMimeType,
          });

          if (faceMatch && (!bestMatch || faceMatch.score > bestMatch.score)) {
            bestMatch = {
              score: faceMatch.score,
              imageUrl,
            };
          }
        } catch {
          // Skip broken reference images and keep scanning other candidates.
        }
      }

      if (bestMatch) {
        matches.push({
          case_id: candidate.id,
          name: candidate.name,
          status: candidate.status,
          age: candidate.age,
          gender: candidate.gender,
          last_seen_location: candidate.last_seen_location,
          image_url: bestMatch.imageUrl,
          score: bestMatch.score,
        });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    res.json({ matches: matches.slice(0, 10) });
  } catch (e) {
    next(e);
  }
}
