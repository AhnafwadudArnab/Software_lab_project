import { ZodError } from 'zod';

export function notFound(req, res) { res.status(404).json({ message: 'Route not found' }); }

// Fix #15: detect Zod errors and return clean 400 instead of leaking schema details
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation error',
      errors: (err.errors ?? err.issues ?? []).map(e => ({ field: e.path.join('.'), message: e.message }))
    });
  }
  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File too large. Maximum size is 5MB.' });
  }
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
}
