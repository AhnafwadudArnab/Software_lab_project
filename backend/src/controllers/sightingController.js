import { z } from 'zod';
import { query } from '../config/db.js';
import { uploadBufferToCloudinary } from '../utils/cloudinaryUpload.js';
import { verifyReportWithAI } from '../utils/aiVerifier.js';
import { compareFacesWithInsightFace, isInsightFaceConfigured } from '../utils/insightFace.js';

const sightingSchema = z.object({
  missing_person_id: z.string().min(1),  // TEXT id like missing-report_001
  location_text: z.string().optional(),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  sighted_at: z.string().optional(),
  description: z.string().min(3),
  confidence_level: z.enum(['sure','maybe','not_sure']).default('maybe'),
  reporter_name: z.string().optional(),
  reporter_phone: z.string().optional(),
});

const FACE_MATCH_THRESHOLD = 75;
const FACE_LOW_CONFIDENCE_THRESHOLD = 50;
const LONG_DISTANCE_ROUTE_KM = 120;
const MIN_CLUSTER_SIGHTINGS = 5;
const EARTH_RADIUS_KM = 6371;

function formatObservedAt(value) {
  if (!value) return 'unknown time';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('en-GB') : String(value);
}

async function notifyAdminPolice({ caseId, type, message }) {
  try {
    const recipients = await query(
      "SELECT id FROM users WHERE role IN ('admin', 'police') AND verified = TRUE"
    );

    for (const recipient of recipients.rows) {
      await query(
        `INSERT INTO notifications (user_id, case_id, type, message)
         VALUES ($1, $2, $3, $4)`,
        [recipient.id, caseId, type, message]
      );
    }
  } catch {
    // Sighting submission must not fail just because alert delivery failed.
  }
}

function toPoint(row, fallback = {}) {
  return {
    ...fallback,
    lat: Number(row.lat),
    lng: Number(row.lng),
    location_text: row.location_text,
    observed_at: row.observed_at || row.sighted_at || row.created_at,
  };
}

function compactAreaName(locationText) {
  if (!locationText) return 'Unknown area';
  return String(locationText).split(',').map(part => part.trim()).filter(Boolean)[0] || locationText;
}

function confidenceFromTrail(points) {
  if (points.length < 2) return 30;
  const base = Math.min(72, 35 + points.length * 8);
  const recentBoost = points.some(p => {
    const observed = new Date(p.observed_at).getTime();
    return Number.isFinite(observed) && Date.now() - observed < 72 * 60 * 60 * 1000;
  }) ? 8 : 0;
  const verifiedBoost = points.some(p => p.source === 'verified_sighting' || p.face_match_score >= FACE_MATCH_THRESHOLD) ? 8 : 0;
  return Math.max(30, Math.min(90, base + recentBoost + verifiedBoost));
}

function directionLabel(deltaLat, deltaLng) {
  const vertical = deltaLat > 0.002 ? 'north' : deltaLat < -0.002 ? 'south' : '';
  const horizontal = deltaLng > 0.002 ? 'east' : deltaLng < -0.002 ? 'west' : '';
  if (vertical && horizontal) return `${vertical}-${horizontal}`;
  return vertical || horizontal || 'nearby';
}

function distanceKm(a, b) {
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return 0;
  const toRad = value => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function maxTrailDistanceKm(points) {
  let max = 0;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      max = Math.max(max, distanceKm(points[i], points[j]));
    }
  }
  return max;
}

function centroid(points) {
  const total = points.reduce((acc, point) => ({
    lat: acc.lat + point.lat,
    lng: acc.lng + point.lng,
  }), { lat: 0, lng: 0 });
  return {
    lat: total.lat / points.length,
    lng: total.lng / points.length,
  };
}

function radiusConfidence(points, radiusKm) {
  const base = Math.min(82, 45 + points.length * 6);
  const tightClusterBoost = radiusKm <= 2 ? 10 : radiusKm <= 5 ? 6 : radiusKm <= 10 ? 3 : 0;
  const verifiedBoost = points.some(p => p.face_match_score >= FACE_MATCH_THRESHOLD) ? 8 : 0;
  return Math.max(45, Math.min(92, Math.round(base + tightClusterBoost + verifiedBoost)));
}

function predictNextArea(points) {
  const valid = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (valid.length === 0) return null;

  const last = valid[valid.length - 1];
  if (valid.length === 1) {
    return {
      lat: last.lat,
      lng: last.lng,
      area: `Near ${compactAreaName(last.location_text)}`,
      confidence: 35,
      mode: 'point',
      distance_km: 0,
      basis: 'Only the original last-seen point is available.',
    };
  }

  const maxDistance = maxTrailDistanceKm(valid);
  const sightingPoints = valid.filter(p => p.source !== 'last_seen');

  if (maxDistance <= LONG_DISTANCE_ROUTE_KM && sightingPoints.length >= MIN_CLUSTER_SIGHTINGS) {
    const clusterCenter = centroid(sightingPoints);
    const radiusKm = Math.max(
      0.5,
      ...sightingPoints.map(point => distanceKm(clusterCenter, point))
    );
    const confidence = radiusConfidence(sightingPoints, radiusKm);

    return {
      lat: Number(clusterCenter.lat.toFixed(6)),
      lng: Number(clusterCenter.lng.toFixed(6)),
      area: `Within ${Number(radiusKm.toFixed(1))} km of ${compactAreaName(last.location_text)}`,
      confidence,
      mode: 'radius',
      radius_km: Number(radiusKm.toFixed(2)),
      radius_meters: Math.round(radiusKm * 1000),
      distance_km: Number(maxDistance.toFixed(2)),
      basis: `${sightingPoints.length} nearby verified sightings inside ${LONG_DISTANCE_ROUTE_KM} km. Radius shows the probable search zone.`,
    };
  }

  let totalWeight = 0;
  let avgLatDelta = 0;
  let avgLngDelta = 0;
  for (let i = 1; i < valid.length; i += 1) {
    const weight = i;
    avgLatDelta += (valid[i].lat - valid[i - 1].lat) * weight;
    avgLngDelta += (valid[i].lng - valid[i - 1].lng) * weight;
    totalWeight += weight;
  }

  avgLatDelta /= totalWeight;
  avgLngDelta /= totalWeight;
  const projectedLat = last.lat + avgLatDelta;
  const projectedLng = last.lng + avgLngDelta;
  const direction = directionLabel(avgLatDelta, avgLngDelta);

  return {
    lat: Number(projectedLat.toFixed(6)),
    lng: Number(projectedLng.toFixed(6)),
    area: direction === 'nearby'
      ? `Near ${compactAreaName(last.location_text)}`
      : `${direction} of ${compactAreaName(last.location_text)}`,
    confidence: confidenceFromTrail(valid),
    mode: maxDistance > LONG_DISTANCE_ROUTE_KM ? 'route' : 'point',
    distance_km: Number(maxDistance.toFixed(2)),
    basis: maxDistance > LONG_DISTANCE_ROUTE_KM
      ? `Long-distance movement over ${LONG_DISTANCE_ROUTE_KM} km. Straight route line is shown.`
      : `Fewer than ${MIN_CLUSTER_SIGHTINGS} nearby verified sightings, so radius prediction is not confident yet.`,
  };
}

async function fetchImageBuffer(url) {
  if (!url) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: response.headers.get('content-type') || 'image/jpeg',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function saveAutomaticFaceScan({ sightingId, missingPersonId, queryBuffer, queryMimeType, scannedImageUrl }) {
  if (!queryBuffer) return null;

  let scanStatus = 'error';
  let faceMatchScore = null;
  let scanMetadata = {};

  try {
    const referenceResult = await query(
      'SELECT image_url FROM person_images WHERE missing_person_id=$1 ORDER BY created_at ASC LIMIT 1',
      [missingPersonId]
    );
    const referenceUrl = referenceResult.rows[0]?.image_url;

    if (!referenceUrl) {
      scanMetadata = { reason: 'No reference photo found for this missing person.' };
    } else if (!isInsightFaceConfigured()) {
      scanMetadata = { reason: 'InsightFace service is not configured.' };
    } else {
      const referenceImage = await fetchImageBuffer(referenceUrl);
      if (!referenceImage) {
        scanMetadata = { reason: 'Reference photo could not be downloaded.', referenceUrl };
      } else {
        const comparison = await compareFacesWithInsightFace({
          queryBuffer,
          queryMimeType,
          referenceBuffer: referenceImage.buffer,
          referenceMimeType: referenceImage.mimeType,
        });

        if (!comparison) {
          scanMetadata = { reason: 'Face comparison service returned no usable score.', referenceUrl };
        } else {
          faceMatchScore = comparison.score;
          scanStatus = faceMatchScore >= FACE_MATCH_THRESHOLD
            ? 'matched'
            : faceMatchScore >= FACE_LOW_CONFIDENCE_THRESHOLD
              ? 'low_confidence'
              : 'no_match';
          scanMetadata = { referenceUrl, raw: comparison.raw };
        }
      }
    }

    const result = await query(
      `INSERT INTO sighting_face_scans
        (sighting_id, matched_person_id, face_match_score, scan_status, scanned_image_url, scan_metadata, scanned_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        sightingId,
        scanStatus === 'matched' || scanStatus === 'low_confidence' ? missingPersonId : null,
        faceMatchScore,
        scanStatus,
        scannedImageUrl || null,
        JSON.stringify({ automatic: true, ...scanMetadata }),
        null,
      ]
    );

    if (scanStatus === 'matched') {
      await query('UPDATE sightings SET status=$1 WHERE id=$2', ['verified', sightingId]);
      await notifyAdminPolice({
        caseId: missingPersonId,
        type: 'face_match',
        message: `Auto face match verified for ${missingPersonId}. Score: ${faceMatchScore}%.`,
      });
    }

    return result.rows[0];
  } catch {
    return null;
  }
}

export async function createSighting(req, res, next) {
  try {
    const data = sightingSchema.parse(req.body);
    let imageUrl = null;
    let sightingImageBuffer = null;
    let sightingImageMimeType = null;
    if (req.file) {
      sightingImageBuffer = req.file.buffer;
      sightingImageMimeType = req.file.mimetype;
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
       image_url, confidence_level, status, ai_score, ai_flags, sighted_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$12,COALESCE($13::timestamp, NOW())) RETURNING *`,
      [data.missing_person_id, req.user?.id || null, data.reporter_name || null, data.reporter_phone || null,
       data.location_text || null, data.lat, data.lng, data.description, imageUrl, data.confidence_level, aiScore, aiFlags,
       data.sighted_at || null]
    );
    const sighting = result.rows[0];
    const faceScan = await saveAutomaticFaceScan({
      sightingId: sighting.id,
      missingPersonId: data.missing_person_id,
      queryBuffer: sightingImageBuffer,
      queryMimeType: sightingImageMimeType,
      scannedImageUrl: imageUrl,
    });
    await notifyAdminPolice({
      caseId: data.missing_person_id,
      type: 'new_sighting',
      message: `New sighting for ${data.missing_person_id} at ${data.location_text || 'unknown location'} on ${formatObservedAt(sighting.sighted_at || sighting.created_at)}.`,
    });
    res.status(201).json({ ...sighting, face_scan: faceScan });
  } catch (e) { next(e); }
}

// Fix #6: use LEFT JOIN so sightings for deleted cases are not silently dropped
export async function listSightings(req, res, next) {
  try {
    const result = await query(`SELECT s.*, mp.name AS person_name,
        fs.face_match_score, fs.scan_status, fs.created_at AS scanned_at
      FROM sightings s
      LEFT JOIN missing_persons mp ON mp.id = s.missing_person_id
      LEFT JOIN LATERAL (
        SELECT face_match_score, scan_status, created_at
        FROM sighting_face_scans
        WHERE sighting_id = s.id
        ORDER BY created_at DESC
        LIMIT 1
      ) fs ON TRUE
      ORDER BY COALESCE(s.sighted_at, s.created_at) DESC`);
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
        COALESCE(s.sighted_at, s.created_at) AS sighted_at,
        s.created_at          AS submitted_at,
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

// GET /sightings/movement/:caseId
// Last seen + verified/matched sightings থেকে movement trail এবং probable next area
export async function getMovementAnalysis(req, res, next) {
  try {
    const { caseId } = req.params;
    const caseResult = await query(
      `SELECT id, name, last_seen_location AS location_text, last_seen_lat AS lat,
              last_seen_lng AS lng, last_seen_time AS observed_at, created_at
       FROM missing_persons WHERE id=$1`,
      [caseId]
    );
    const caseRow = caseResult.rows[0];
    if (!caseRow) return res.status(404).json({ message: 'Case not found' });

    const sightingsResult = await query(
      `SELECT
        s.id,
        s.location_text,
        s.lat,
        s.lng,
        COALESCE(s.sighted_at, s.created_at) AS observed_at,
        s.created_at,
        s.status,
        s.description,
        fs.face_match_score,
        fs.scan_status
       FROM sightings s
       LEFT JOIN LATERAL (
         SELECT face_match_score, scan_status
         FROM sighting_face_scans
         WHERE sighting_id = s.id
         ORDER BY created_at DESC
         LIMIT 1
       ) fs ON TRUE
       WHERE s.missing_person_id=$1
         AND (s.status='verified' OR fs.scan_status='matched')
       ORDER BY COALESCE(s.sighted_at, s.created_at) ASC`,
      [caseId]
    );

    const trail = [
      toPoint(caseRow, {
        id: caseRow.id,
        source: 'last_seen',
        title: 'Last seen',
        description: caseRow.location_text,
      }),
      ...sightingsResult.rows.map((row, index) => toPoint(row, {
        id: row.id,
        source: 'verified_sighting',
        title: `Sighting ${index + 1}`,
        description: row.description,
        face_match_score: row.face_match_score,
        scan_status: row.scan_status,
      })),
    ].filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    const prediction = predictNextArea(trail);
    const movementPattern = trail.map(p => compactAreaName(p.location_text)).join(' → ');

    res.json({
      case_id: caseId,
      case_name: caseRow.name,
      movement_pattern: movementPattern,
      trail,
      prediction,
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
