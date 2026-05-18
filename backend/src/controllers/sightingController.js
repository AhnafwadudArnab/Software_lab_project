import { z } from 'zod';
import { query } from '../config/db.js';
import { uploadBufferToCloudinary } from '../utils/cloudinaryUpload.js';
import { verifyReportWithAI } from '../utils/aiVerifier.js';

const sightingSchema = z.object({
  missing_person_id: z.string().min(1),  // TEXT id like missing-report_001
  location_text: z.string().optional(),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  description: z.string().min(3),
  confidence_level: z.enum(['sure','maybe','not_sure']).default('maybe'),
  reporter_name: z.string().optional(),
  reporter_phone: z.string().optional(),
});

export async function createSighting(req, res, next) {
  try {
    const data = sightingSchema.parse(req.body);
    let imageUrl = null;
    if (req.file) {
      const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'missing-diary/sightings');
      imageUrl = uploaded.secure_url;
    }
    const aiResult = await verifyReportWithAI({
      description: data.description,
      last_seen_location: data.location_text,
    });
    const aiScore = aiResult?.score ?? null;
    const aiFlags = aiResult?.flags?.length > 0 ? aiResult.flags.join('; ') : null;
    // req.user may be null for anonymous submissions
    const result = await query(`INSERT INTO sightings
      (missing_person_id, reported_by, reporter_name, reporter_phone, location_text, lat, lng, description,
       image_url, confidence_level, status, ai_score, ai_flags)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$12) RETURNING *`,
      [data.missing_person_id, req.user?.id || null, data.reporter_name || null, data.reporter_phone || null,
       data.location_text || null, data.lat, data.lng, data.description, imageUrl, data.confidence_level, aiScore, aiFlags]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) { next(e); }
}

// Fix #6: use LEFT JOIN so sightings for deleted cases are not silently dropped
export async function listSightings(req, res, next) {
  try {
    const result = await query(`SELECT s.*, mp.name AS person_name FROM sightings s
      LEFT JOIN missing_persons mp ON mp.id = s.missing_person_id
      ORDER BY s.created_at DESC`);
    res.json(result.rows);
  } catch (e) { next(e); }
}

export async function updateSightingStatus(req, res, next) {
  try {
    // 4.7 — added 'flagged' to accepted statuses
    const schema = z.object({ status: z.enum(['pending','verified','rejected','flagged']) });
    const { status } = schema.parse(req.body);
    const result = await query('UPDATE sightings SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Sighting not found' });
    // 4.7 — audit log for all statuses including 'flagged'
    await query('INSERT INTO audit_logs (user_id,action,target_type,target_id) VALUES ($1,$2,$3,$4)', [req.user.id, `Updated sighting status to ${status}`, 'sighting', req.params.id]);
    res.json(result.rows[0]);
  } catch (e) { next(e); }
}

// AI Matching — keyword-based similarity between sighting descriptions and case details
export async function matchSightings(req, res, next) {
  try {
    const { caseId } = req.params;
    const caseResult = await query(
      'SELECT name, description, clothing, gender, age, last_seen_location FROM missing_persons WHERE id=$1',
      [caseId]
    );
    if (!caseResult.rows[0]) return res.status(404).json({ message: 'Case not found' });
    const c = caseResult.rows[0];

    const caseKeywords = [c.name, c.description, c.clothing, c.gender, c.last_seen_location]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3);

    const sightingsResult = await query(
      `SELECT s.*, u.name AS reporter_name FROM sightings s
       LEFT JOIN users u ON u.id = s.reported_by
       WHERE s.missing_person_id = $1 ORDER BY s.created_at DESC`,
      [caseId]
    );

    const scored = sightingsResult.rows.map(s => {
      const sightingWords = (s.description || '').toLowerCase().split(/\s+/);
      const matches = sightingWords.filter(w => caseKeywords.includes(w));
      const score = caseKeywords.length > 0
        ? Math.round((matches.length / caseKeywords.length) * 100)
        : 0;
      return { ...s, ai_match_score: score, ai_matched_keywords: matches };
    });

    scored.sort((a, b) => b.ai_match_score - a.ai_match_score);

    res.json({ case: c, matches: scored });
  } catch (e) { next(e); }
}

export async function approveSighting(req, res, next) {
  try {
    const result = await query(
      'UPDATE sightings SET status=$1 WHERE id=$2 RETURNING *',
      ['verified', req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Sighting not found' });
    const notes = req.body?.notes || null;
    await query(
      'INSERT INTO audit_logs (user_id,action,target_type,target_id,notes) VALUES ($1,$2,$3,$4,$5)',
      [req.user.id, 'Approved sighting', 'sighting', req.params.id, notes]
    );
    res.json(result.rows[0]);
  } catch (e) { next(e); }
}

export async function rejectSighting(req, res, next) {
  try {
    const result = await query(
      'UPDATE sightings SET status=$1 WHERE id=$2 RETURNING *',
      ['rejected', req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Sighting not found' });
    const notes = req.body?.notes || null;
    await query(
      'INSERT INTO audit_logs (user_id,action,target_type,target_id,notes) VALUES ($1,$2,$3,$4,$5)',
      [req.user.id, 'Rejected sighting', 'sighting', req.params.id, notes]
    );
    res.json(result.rows[0]);
  } catch (e) { next(e); }
}

export async function getSightingAudit(req, res, next) {
  try {
    const result = await query(
      'SELECT al.*, u.name AS actor_name ' +
      'FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id ' +
      'WHERE al.target_id=$1 AND al.target_type=\'sighting\' ' +
      'ORDER BY al.created_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (e) { next(e); }
}

// GET /sightings/history/:caseId
// একটা case এর সব verified sighting + face scan result history
// Public endpoint — anonymous user রাও দেখতে পারবে
export async function getSightingHistory(req, res, next) {
  try {
    const { caseId } = req.params;

    // Case exists কিনা check করো
    const caseCheck = await query(
      'SELECT id, name, status FROM missing_persons WHERE id=$1',
      [caseId]
    );
    if (!caseCheck.rows[0]) {
      return res.status(404).json({ message: 'Case not found' });
    }

    const isPrivileged = req.user && (req.user.role === 'admin' || req.user.role === 'police');

    // Privileged users সব sighting দেখবে, public শুধু verified দেখবে
    const statusFilter = isPrivileged
      ? ''
      : "AND s.status = 'verified'";

    const result = await query(
      `SELECT
        s.id                  AS sighting_id,
        s.missing_person_id,
        s.reporter_name,
        s.location_text,
        s.lat,
        s.lng,
        s.description,
        s.image_url,
        s.confidence_level,
        s.status              AS sighting_status,
        s.ai_score,
        s.created_at          AS sighted_at,
        fs.id                 AS scan_id,
        fs.face_match_score,
        fs.scan_status,
        fs.scanned_image_url,
        fs.created_at         AS scanned_at,
        mp.name               AS matched_person_name,
        mp.last_seen_location AS matched_person_last_seen
      FROM sightings s
      LEFT JOIN sighting_face_scans fs ON fs.sighting_id = s.id
      LEFT JOIN missing_persons mp     ON mp.id = fs.matched_person_id
      WHERE s.missing_person_id = $1
      ${statusFilter}
      ORDER BY s.created_at DESC`,
      [caseId]
    );

    res.json({
      case_id: caseId,
      case_name: caseCheck.rows[0].name,
      case_status: caseCheck.rows[0].status,
      total: result.rows.length,
      history: result.rows,
    });
  } catch (e) { next(e); }
}

// POST /sightings/:sightingId/face-scan
// Face scan result save করো (system/admin call করবে)
export async function saveFaceScanResult(req, res, next) {
  try {
    const { sightingId } = req.params;
    const schema = z.object({
      matched_person_id:  z.string().optional().nullable(),
      face_match_score:   z.coerce.number().min(0).max(100).optional().nullable(),
      scan_status:        z.enum(['matched', 'no_match', 'low_confidence', 'error']),
      scanned_image_url:  z.string().url().optional().nullable(),
      scan_metadata:      z.record(z.unknown()).optional().nullable(),
    });

    const data = schema.parse(req.body);

    // Sighting exists কিনা check
    const sightingCheck = await query('SELECT id, missing_person_id FROM sightings WHERE id=$1', [sightingId]);
    if (!sightingCheck.rows[0]) {
      return res.status(404).json({ message: 'Sighting not found' });
    }

    const result = await query(
      `INSERT INTO sighting_face_scans
        (sighting_id, matched_person_id, face_match_score, scan_status, scanned_image_url, scan_metadata, scanned_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        sightingId,
        data.matched_person_id || null,
        data.face_match_score ?? null,
        data.scan_status,
        data.scanned_image_url || null,
        data.scan_metadata ? JSON.stringify(data.scan_metadata) : null,
        req.user?.id || null,
      ]
    );

    // যদি match হয়, sighting status verified করে দাও
    if (data.scan_status === 'matched' && data.face_match_score >= 70) {
      await query('UPDATE sightings SET status=$1 WHERE id=$2', ['verified', sightingId]);
    }

    await query(
      'INSERT INTO audit_logs (user_id,action,target_type,target_id,notes) VALUES ($1,$2,$3,$4,$5)',
      [req.user?.id || null, `Face scan result saved: ${data.scan_status}`, 'sighting', sightingId,
       data.face_match_score ? `Score: ${data.face_match_score}` : null]
    );

    res.status(201).json(result.rows[0]);
  } catch (e) { next(e); }
}
