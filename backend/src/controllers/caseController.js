import { z } from 'zod';
import { query } from '../config/db.js';
import { uploadBufferToCloudinary } from '../utils/cloudinaryUpload.js';
import { verifyReportWithAI } from '../utils/aiVerifier.js';

const caseSchema = z.object({
  reporter_name: z.string().min(2),
  reporter_phone: z.string().min(5),
  reporter_relation: z.string().min(2),
  name: z.string().min(2),
  name_bn: z.string().optional(),
  age: z.coerce.number().int().optional(),
  gender: z.string().optional(),
  skin_color: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  clothing: z.string().optional(),
  identifying_marks: z.string().optional(),
  medical_info: z.string().optional(),
  description: z.string().optional(),
  last_seen_location: z.string().min(2),
  last_seen_lat: z.coerce.number(),
  last_seen_lng: z.coerce.number(),
  last_seen_time: z.string().optional(),
  photo_description: z.string().optional()
});

const PUBLIC_STATUSES = ['active', 'verified', 'found', 'closed'];

export async function listCases(req, res, next) {
  try {
    const status = req.query.status;
    const mine = req.query.mine === 'true';
    const user = req.user;

    // Admin/police: see all cases, optionally filtered by status
    if (user && (user.role === 'admin' || user.role === 'police')) {
      let sql =
        'SELECT mp.*, COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), \'[]\') AS images ' +
        'FROM missing_persons mp LEFT JOIN person_images pi ON pi.missing_person_id = mp.id';
      const params = [];
      if (status) {
        params.push(status);
        sql += ' WHERE mp.status=$1';
      }
      sql += ' GROUP BY mp.id ORDER BY mp.created_at DESC';
      const result = await query(sql, params);
      return res.json(result.rows);
    }

    // Logged-in user requesting only their own cases
    if (user && mine) {
      const result = await query(
        'SELECT mp.*, COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), \'[]\') AS images ' +
        'FROM missing_persons mp LEFT JOIN person_images pi ON pi.missing_person_id = mp.id ' +
        'WHERE mp.guardian_id=$1 ' +
        'GROUP BY mp.id ORDER BY mp.created_at DESC',
        [user.id]
      );
      return res.json(result.rows);
    }

    // Unauthenticated / anonymous witnesses: only public-status cases
    const placeholders = PUBLIC_STATUSES.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(
      'SELECT mp.*, COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), \'[]\') AS images ' +
      'FROM missing_persons mp LEFT JOIN person_images pi ON pi.missing_person_id = mp.id ' +
      `WHERE mp.status IN (${placeholders}) ` +
      'GROUP BY mp.id ORDER BY mp.created_at DESC',
      PUBLIC_STATUSES
    );
    res.json(result.rows);
  } catch (e) { next(e); }
}

export async function getCase(req, res, next) {
  try {
    const result = await query(
      'SELECT mp.*, ' +
      'COALESCE(json_agg(DISTINCT pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), \'[]\') AS images ' +
      'FROM missing_persons mp ' +
      'LEFT JOIN person_images pi ON pi.missing_person_id=mp.id ' +
      'WHERE mp.id=$1 GROUP BY mp.id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Case not found' });

    const user = req.user;
    const c = result.rows[0];

    // Police may access all cases (they need to see found/closed cases they worked on)
    // Only truly restrict non-authenticated public access via PUBLIC_STATUSES in listCases

    // Admin/police see all sightings; everyone else sees only verified sightings
    const isPrivileged = user && (user.role === 'admin' || user.role === 'police');
    const sightings = (await query(
      isPrivileged
        ? 'SELECT * FROM sightings WHERE missing_person_id=$1 ORDER BY created_at DESC'
        : "SELECT * FROM sightings WHERE missing_person_id=$1 AND status='verified' ORDER BY created_at DESC",
      [req.params.id]
    )).rows;
    res.json({ ...c, sightings });
  } catch (e) { next(e); }
}

export async function createCase(req, res, next) {
  try {
    const data = caseSchema.parse(req.body);
    // Admin/police submissions are verified immediately; all others are pending
    const role = req.user?.role;
    const status = (role === 'admin' || role === 'police') ? 'verified' : 'pending';

    // Run AI assistive verification (non-blocking — failure is graceful)
    let aiScore = null;
    let aiFlags = null;
    if (status === 'pending') {
      const aiResult = await verifyReportWithAI(data);
      if (aiResult) {
        aiScore = aiResult.score;
        aiFlags = aiResult.flags.length > 0 ? aiResult.flags.join('; ') : null;
      }
    }

    const result = await query(
      'INSERT INTO missing_persons ' +
      '(reporter_name,reporter_phone,reporter_relation,name,name_bn,age,gender,skin_color,height,weight,' +
      'clothing,identifying_marks,medical_info,description,last_seen_location,last_seen_lat,last_seen_lng,' +
      'last_seen_time,status,ai_verification_score,ai_flags,guardian_id) ' +
      'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *',
      [
        data.reporter_name, data.reporter_phone, data.reporter_relation,
        data.name, data.name_bn || null, data.age || null, data.gender || null,
        data.skin_color || null, data.height || null, data.weight || null,
        data.clothing || null, data.identifying_marks || null, data.medical_info || null,
        data.description || null, data.last_seen_location, data.last_seen_lat, data.last_seen_lng,
        data.last_seen_time || null, status, aiScore, aiFlags,
        req.user?.id || null,  // guardian_id — set if user is logged in
      ]
    );
    const created = result.rows[0];
    const files = req.files || [];
    let firstImage = true;
    for (const f of files) {
      const uploaded = await uploadBufferToCloudinary(f.buffer, 'missing-diary/missing-persons');
      const photoDesc = firstImage ? (data.photo_description || null) : null;
      await query(
        'INSERT INTO person_images (missing_person_id,image_url,public_id) VALUES ($1,$2,$3)',
        [created.id, uploaded.secure_url, uploaded.public_id]
      );
      firstImage = false;
    }
    res.status(201).json(created);
  } catch (e) { next(e); }
}

export async function deleteCase(req, res, next) {
  try {
    const result = await query('DELETE FROM missing_persons WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Case not found' });
    await query('INSERT INTO audit_logs (user_id,action,target_type,target_id) VALUES ($1,$2,$3,$4)',
      [req.user.id, 'Deleted case', 'missing_person', req.params.id]);
    res.json({ message: 'Case deleted' });
  } catch (e) { next(e); }
}

export async function updateCaseStatus(req, res, next) {
  try {
    const schema = z.object({
      status: z.enum(['pending','verified','active','found','closed','rejected']),
      notes: z.string().optional()
    });
    const { status, notes } = schema.parse(req.body);
    const result = await query('UPDATE missing_persons SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [status, req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Case not found' });
    await query(
      'INSERT INTO audit_logs (user_id,action,target_type,target_id,notes) VALUES ($1,$2,$3,$4,$5)',
      [req.user.id, 'Updated case status to ' + status, 'missing_person', req.params.id, notes || null]
    );
    res.json(result.rows[0]);
  } catch (e) { next(e); }
}

export async function getCaseAudit(req, res, next) {
  try {
    const result = await query(
      'SELECT al.*, u.name AS actor_name ' +
      'FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id ' +
      'WHERE al.target_id=$1 AND al.target_type=\'missing_person\' ' +
      'ORDER BY al.created_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (e) { next(e); }
}

export async function approveCase(req, res, next) {
  try {
    const result = await query(
      'UPDATE missing_persons SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      ['active', req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Case not found' });
    const notes = req.body?.notes || null;
    await query(
      'INSERT INTO audit_logs (user_id,action,target_type,target_id,notes) VALUES ($1,$2,$3,$4,$5)',
      [req.user.id, 'Approved case — status set to active', 'missing_person', req.params.id, notes]
    );
    res.json(result.rows[0]);
  } catch (e) { next(e); }
}

export async function rejectCase(req, res, next) {
  try {
    const result = await query(
      'UPDATE missing_persons SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      ['rejected', req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Case not found' });
    const notes = req.body?.notes || null;
    await query(
      'INSERT INTO audit_logs (user_id,action,target_type,target_id,notes) VALUES ($1,$2,$3,$4,$5)',
      [req.user.id, 'Rejected case', 'missing_person', req.params.id, notes]
    );
    res.json(result.rows[0]);
  } catch (e) { next(e); }
}

export async function requestInfo(req, res, next) {
  try {
    const result = await query(
      'SELECT mp.*, COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), \'[]\') AS images ' +
      'FROM missing_persons mp LEFT JOIN person_images pi ON pi.missing_person_id = mp.id ' +
      'WHERE mp.id=$1 GROUP BY mp.id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Case not found' });
    const notes = req.body?.notes || null;
    await query(
      'INSERT INTO audit_logs (user_id,action,target_type,target_id,notes) VALUES ($1,$2,$3,$4,$5)',
      [req.user.id, 'Requested info on case', 'missing_person', req.params.id, notes]
    );
    res.json(result.rows[0]);
  } catch (e) { next(e); }
}
