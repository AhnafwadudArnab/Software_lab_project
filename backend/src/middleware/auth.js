import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query('SELECT id,name,email,phone,role,verified FROM users WHERE id=$1', [decoded.id]);
    if (!result.rows[0]) return res.status(401).json({ message: 'Invalid token' });
    req.user = result.rows[0];
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Optional auth — sets req.user if token present, but allows anonymous requests
export async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await query('SELECT id,name,email,phone,role,verified FROM users WHERE id=$1', [decoded.id]);
      if (result.rows[0]) req.user = result.rows[0];
    }
  } catch { /* ignore invalid tokens for anonymous */ }
  next();
}

// Fix #3: guard against req.user being null before accessing .role
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role))
      return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}
