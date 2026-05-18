import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../config/db.js';
import { compareFacesWithInsightFace, isInsightFaceConfigured } from '../utils/insightFace.js';

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
