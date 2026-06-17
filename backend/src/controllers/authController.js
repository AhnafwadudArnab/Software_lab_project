import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import tls from 'tls';
import { z } from 'zod';
import { query } from '../config/db.js';

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  phone: z.string().optional(),
  password: z.string().min(6),
  // Public registration should create a non-privileged 'viewer' role
  // Police accounts are created by admin via POST /api/admin/police
  // Do not accept `role` from clients — server assigns viewer explicitly.
});

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1)
});

const forgotPasswordSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase())
});

const profileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().transform((value) => value.trim().toLowerCase()).optional(),
  phone: z.string().optional().nullable(),
  current_password: z.string().optional(),
  new_password: z.string().min(6).optional()
});

function sign(user) { return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' }); }

function makeTemporaryPassword() {
  return crypto.randomBytes(9).toString('base64url');
}

async function sendPasswordEmail(to, temporaryPassword) {
  const subject = 'Missing Diary password reset';
  const text = [
    'Your Missing Diary password has been reset.',
    '',
    `Temporary password: ${temporaryPassword}`,
    '',
    'Please log in with this password and change it from User Profile.'
  ].join('\n');

  const smtpSent = await sendWithSmtp({ to, subject, text });
  if (smtpSent) return true;

  if (process.env.RESEND_API_KEY) {
    const from = process.env.MAIL_FROM || 'Missing Diary <onboarding@resend.dev>';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to, subject, text })
    });
    if (!response.ok) {
      throw new Error(`Email provider rejected reset email: ${response.status}`);
    }
    return true;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('Password reset email fallback', { to, temporaryPassword });
    return false;
  }

  throw new Error('Email service is not configured');
}

function smtpAddress(value) {
  const match = String(value || '').match(/<([^>]+)>/);
  return match ? match[1] : value;
}

async function sendWithSmtp({ to, subject, text }) {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  if (!user || !pass) return false;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const from = process.env.MAIL_FROM || user;
  const fromAddress = smtpAddress(from);
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    text
  ].join('\r\n').replace(/\r?\n\./g, '\r\n..');

  const socket = tls.connect({ host, port, servername: host });
  socket.setEncoding('utf8');
  let buffer = '';

  function readResponse() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off('data', onData);
        reject(new Error('SMTP response timeout'));
      }, 15000);

      function onData(chunk) {
        buffer += chunk;
        const lines = buffer.split(/\r?\n/).filter(Boolean);
        const last = lines[lines.length - 1] || '';
        if (/^\d{3} /.test(last)) {
          clearTimeout(timer);
          socket.off('data', onData);
          const response = buffer;
          buffer = '';
          resolve(response);
        }
      }

      socket.on('data', onData);
      socket.once('error', reject);
    });
  }

  function write(command) {
    socket.write(`${command}\r\n`);
  }

  async function command(commandText, expectedCodes) {
    write(commandText);
    const response = await readResponse();
    const ok = expectedCodes.some(code => response.startsWith(code));
    if (!ok) throw new Error(`SMTP command failed: ${response}`);
  }

  try {
    await new Promise((resolve, reject) => {
      socket.once('secureConnect', resolve);
      socket.once('error', reject);
    });
    await readResponse();
    await command('EHLO missing-diary.local', ['250']);
    await command('AUTH LOGIN', ['334']);
    await command(Buffer.from(user).toString('base64'), ['334']);
    await command(Buffer.from(pass).toString('base64'), ['235']);
    await command(`MAIL FROM:<${fromAddress}>`, ['250']);
    await command(`RCPT TO:<${to}>`, ['250', '251']);
    await command('DATA', ['354']);
    await command(`${message}\r\n.`, ['250']);
    await command('QUIT', ['221']);
    return true;
  } finally {
    socket.end();
  }
}

export async function register(req, res, next) {
  try {
    const data = registerSchema.parse(req.body);
    const exists = await query('SELECT id FROM users WHERE email=$1', [data.email]);
    if (exists.rows.length) return res.status(409).json({ message: 'Email already exists' });
    const hash = await bcrypt.hash(data.password, 10);
    // Force role to viewer regardless of client input. They become guardian after uploading a case.
    const role = 'viewer';
    const result = await query(
      'INSERT INTO users (name,email,phone,password_hash,role,verified) VALUES ($1,$2,$3,$4,$5,true) RETURNING id,name,email,role,verified',
      [data.name, data.email, data.phone || null, hash, role]
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
    res.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, verified: user.verified }, token: sign(user) });
  } catch (e) { next(e); }
}

export async function me(req, res) { res.json({ user: req.user }); }

export async function forgotPassword(req, res, next) {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = await query('SELECT id,email,role FROM users WHERE email=$1', [email]);
    const user = result.rows[0];

    // Keep response generic so attackers cannot enumerate registered emails.
    if (!user || user.role === 'admin' || user.role === 'police') {
      return res.json({ message: 'If this email exists, password reset instructions have been sent.' });
    }

    const temporaryPassword = makeTemporaryPassword();
    const emailSent = await sendPasswordEmail(user.email, temporaryPassword);
    const hash = await bcrypt.hash(temporaryPassword, 10);
    await query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, user.id]);

    res.json({
      message: emailSent
        ? 'A temporary password has been sent to your email.'
        : 'Email service is not configured. Check the backend console for the temporary password in development.'
    });
  } catch (e) { next(e); }
}

export async function updateProfile(req, res, next) {
  try {
    const data = profileSchema.parse(req.body);
    const current = (await query('SELECT * FROM users WHERE id=$1', [req.user.id])).rows[0];
    if (!current) return res.status(404).json({ message: 'User not found' });

    if (data.email && data.email !== current.email) {
      const exists = await query('SELECT id FROM users WHERE email=$1 AND id<>$2', [data.email, req.user.id]);
      if (exists.rows.length) return res.status(409).json({ message: 'Email already exists' });
    }

    if (data.new_password) {
      if (current.role === 'admin' || current.role === 'police') {
        return res.status(403).json({ message: 'Admin and police passwords cannot be changed from User Profile.' });
      }
      if (!data.current_password) return res.status(400).json({ message: 'Current password is required.' });
      const ok = await bcrypt.compare(data.current_password, current.password_hash);
      if (!ok) return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const nextName = data.name ?? current.name;
    const nextEmail = data.email ?? current.email;
    const nextPhone = data.phone === undefined ? current.phone : (data.phone || null);
    const nextHash = data.new_password ? await bcrypt.hash(data.new_password, 10) : current.password_hash;

    const updated = await query(
      'UPDATE users SET name=$1,email=$2,phone=$3,password_hash=$4 WHERE id=$5 RETURNING id,name,email,phone,role,verified',
      [nextName, nextEmail, nextPhone, nextHash, req.user.id]
    );
    res.json({ user: updated.rows[0] });
  } catch (e) { next(e); }
}
