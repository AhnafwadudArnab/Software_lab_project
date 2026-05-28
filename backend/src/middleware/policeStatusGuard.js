/**
 * Middleware: policeStatusGuard
 *
 * Enforces that police officers may only set case status to 'active' or 'found'
 * via PATCH /status. Admin role passes through unchanged.
 * Admin role passes through unchanged.
 */
export function policeStatusGuard(req, res, next) {
  // Admin passes through without restriction
  if (req.user.role !== 'police') {
    return next();
  }

  // Police may only set operational statuses through this endpoint.
  const { status } = req.body;
  if (status === 'active' || status === 'found') {
    return next();
  }

  return res.status(403).json({ message: 'Police may only set status to active or found.' });
}
