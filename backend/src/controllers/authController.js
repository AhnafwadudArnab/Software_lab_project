import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../config/db.js';

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  phone: z.string().optional(),
  password: z.string().min(6),
  role: z.literal('guardian').default('guardian')
});

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1)
});

function sign(user) { return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' }); }

export async function register(req, res, next) {
  try {
    const data = registerSchema.parse(req.body);
    const exists = await query('SELECT id FROM users WHERE email=$1', [data.email]);
    if (exists.rows.length) return res.status(409).json({ message: 'Email already exists' });
    const hash = await bcrypt.hash(data.password, 10);
    const result = await query(
      'INSERT INTO users (name,email,phone,password_hash,role,verified) VALUES ($1,$2,$3,$4,$5,true) RETURNING id,name,email,role,verified',
      [data.name, data.email, data.phone || null, hash, data.role]
    );
    const user = result.rows[0];
    res.status(201).json({ user, token: sign(user) });
  } catch (e) { next(e); }
}

export async function login(req, res, next) {
  try {
    const data = loginSchema.parse(req.body);
    const result = await query('SELECT * FROM users WHERE email=$1', [data.email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });
    const ok = await bcrypt.compare(data.password, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Invalid email or password' });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, verified: user.verified }, token: sign(user) });
  } catch (e) { next(e); }
}

export async function me(req, res) { res.json({ user: req.user }); }
