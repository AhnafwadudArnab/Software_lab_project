import { query } from '../config/db.js';

/**
 * GET /api/notifications
 * Returns all notifications for the authenticated user, ordered by created_at DESC.
 */
export async function getNotifications(req, res, next) {
  try {
    // Support admin/police 'all' view via ?all=true. Admins get all notifications;
    // police get their own plus public case-related notifications (new sightings, face_match, found photos).
    const wantAll = req.query?.all === 'true';
    let sql, params;
    if (wantAll && req.user.role === 'admin') {
      sql = `SELECT n.*, mp.name AS case_name
             FROM notifications n
             LEFT JOIN missing_persons mp ON mp.id = n.case_id
             WHERE n.user_id = $1 OR n.user_id IS NULL
             ORDER BY n.created_at DESC`;
      params = [req.user.id];
    } else if (wantAll && req.user.role === 'police') {
      // Police should see their own notifications plus system-level broadcast notifications.
      sql = `SELECT n.*, mp.name AS case_name
             FROM notifications n
             LEFT JOIN missing_persons mp ON mp.id = n.case_id
             WHERE n.user_id = $1 OR n.user_id IS NULL
             ORDER BY n.created_at DESC`;
      params = [req.user.id];
    } else {
      sql = `SELECT n.*, mp.name AS case_name FROM notifications n LEFT JOIN missing_persons mp ON mp.id = n.case_id WHERE n.user_id = $1 ORDER BY n.created_at DESC`;
      params = [req.user.id];
    }
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) {
    next(e);
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
export async function markNotificationRead(req, res, next) {
  try {
    const isPrivileged = req.user.role === 'admin' || req.user.role === 'police';
    const result = await query(
      isPrivileged
        ? 'UPDATE notifications SET read=TRUE WHERE id=$1 AND (user_id=$2 OR user_id IS NULL) RETURNING *'
        : 'UPDATE notifications SET read=TRUE WHERE id=$1 AND user_id=$2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Notification not found' });
    res.json(result.rows[0]);
  } catch (e) {
    next(e);
  }
}

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications for the authenticated user as read.
 */
export async function markAllNotificationsRead(req, res, next) {
  try {
    const isPrivileged = req.user.role === 'admin' || req.user.role === 'police';
    await query(
      isPrivileged
        ? 'UPDATE notifications SET read=TRUE WHERE (user_id=$1 OR user_id IS NULL) AND read=FALSE'
        : 'UPDATE notifications SET read=TRUE WHERE user_id=$1 AND read=FALSE',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (e) {
    next(e);
  }
}
