const express = require('express');
const { getDb } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const WORK_START = '08:00:00';
const GRACE_MINUTES = 10; // minutes grace period before tardiness

// GET /api/attendance
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { employee_id, date_from, date_to, status, area_id, page = 1, limit = 100 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = `
    SELECT a.*,
           e.first_name, e.last_name, e.code as employee_code,
           ar.name as area_name
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    LEFT JOIN areas ar ON e.area_id = ar.id
    WHERE 1=1
  `;
  const params = [];

  if (employee_id) { query += ' AND a.employee_id = ?'; params.push(employee_id); }
  if (date_from) { query += ' AND a.date >= ?'; params.push(date_from); }
  if (date_to) { query += ' AND a.date <= ?'; params.push(date_to); }
  if (status) { query += ' AND a.status = ?'; params.push(status); }
  if (area_id) { query += ' AND e.area_id = ?'; params.push(area_id); }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM (${query})`).get(...params).cnt;
  query += ' ORDER BY a.date DESC, e.last_name LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const records = db.prepare(query).all(...params);
  res.json({ data: records, total });
});

// GET /api/attendance/today
router.get('/today', authenticate, (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const records = db.prepare(`
    SELECT a.*,
           e.first_name, e.last_name, e.code as employee_code,
           ar.name as area_name
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    LEFT JOIN areas ar ON e.area_id = ar.id
    WHERE a.date = ?
    ORDER BY e.last_name
  `).all(today);
  res.json(records);
});

// POST /api/attendance
router.post('/', authenticate, (req, res) => {
  const db = getDb();
  const { employee_id, date, check_in, check_out, notes } = req.body;

  if (!employee_id || !date) {
    return res.status(400).json({ error: 'Colaborador y fecha son requeridos' });
  }

  // Calculate tardiness
  let tardiness_minutes = 0;
  let status = 'Presente';

  if (check_in) {
    const [h, m] = check_in.split(':').map(Number);
    const checkInMins = h * 60 + m;
    const workStartMins = 8 * 60 + GRACE_MINUTES;
    if (checkInMins > workStartMins) {
      tardiness_minutes = checkInMins - workStartMins;
      status = 'Tardanza';
    }
  } else {
    status = 'Ausente';
  }

  // Calculate overtime
  let overtime_minutes = 0;
  if (check_out) {
    const [h, m] = check_out.split(':').map(Number);
    const checkOutMins = h * 60 + m;
    const normalEndMins = 17 * 60 + 30;
    if (checkOutMins > normalEndMins) {
      overtime_minutes = checkOutMins - normalEndMins;
    }
  }

  const checkInFull = check_in ? `${date} ${check_in}:00` : null;
  const checkOutFull = check_out ? `${date} ${check_out}:00` : null;

  try {
    const result = db.prepare(`
      INSERT INTO attendance (employee_id, date, check_in, check_out, tardiness_minutes, overtime_minutes, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(employee_id, date) DO UPDATE SET
        check_in = excluded.check_in,
        check_out = excluded.check_out,
        tardiness_minutes = excluded.tardiness_minutes,
        overtime_minutes = excluded.overtime_minutes,
        status = excluded.status,
        notes = excluded.notes
    `).run(employee_id, date, checkInFull, checkOutFull, tardiness_minutes, overtime_minutes, status, notes);

    const record = db.prepare('SELECT * FROM attendance WHERE rowid = ?').get(result.lastInsertRowid || 0) ||
                   db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(employee_id, date);
    res.status(201).json(record);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/attendance/:id
router.put('/:id', authenticate, authorize('Administrador', 'RRHH'), (req, res) => {
  const db = getDb();
  const { check_in, check_out, notes, status } = req.body;
  const record = db.prepare('SELECT * FROM attendance WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Registro no encontrado' });

  const date = record.date;
  let tardiness_minutes = record.tardiness_minutes;
  let overtime_minutes = record.overtime_minutes;
  let newStatus = status || record.status;

  if (check_in) {
    const [h, m] = check_in.split(':').map(Number);
    const checkInMins = h * 60 + m;
    const workStartMins = 8 * 60 + GRACE_MINUTES;
    tardiness_minutes = checkInMins > workStartMins ? checkInMins - workStartMins : 0;
    newStatus = tardiness_minutes > 0 ? 'Tardanza' : 'Presente';
  }

  if (check_out) {
    const [h, m] = check_out.split(':').map(Number);
    const checkOutMins = h * 60 + m;
    overtime_minutes = checkOutMins > (17 * 60 + 30) ? checkOutMins - (17 * 60 + 30) : 0;
  }

  if (status) newStatus = status;

  const checkInFull = check_in ? `${date} ${check_in}:00` : record.check_in;
  const checkOutFull = check_out ? `${date} ${check_out}:00` : record.check_out;

  db.prepare(`
    UPDATE attendance SET check_in=?, check_out=?, tardiness_minutes=?, overtime_minutes=?, status=?, notes=?
    WHERE id=?
  `).run(checkInFull, checkOutFull, tardiness_minutes, overtime_minutes, newStatus, notes || record.notes, req.params.id);

  res.json(db.prepare('SELECT * FROM attendance WHERE id = ?').get(req.params.id));
});

// GET /api/attendance/stats
router.get('/stats/summary', authenticate, (req, res) => {
  const db = getDb();
  const { date_from, date_to, area_id } = req.query;
  const today = new Date().toISOString().split('T')[0];
  const from = date_from || today;
  const to = date_to || today;

  let areaFilter = '';
  const areaParams = [];
  if (area_id) { areaFilter = ' AND e.area_id = ?'; areaParams.push(area_id); }

  const summary = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN a.status = 'Presente' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN a.status = 'Tardanza' THEN 1 ELSE 0 END) as tardiness,
      SUM(CASE WHEN a.status = 'Ausente' THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN a.status = 'Permiso' THEN 1 ELSE 0 END) as on_permission,
      SUM(CASE WHEN a.status = 'Vacaciones' THEN 1 ELSE 0 END) as on_vacation,
      SUM(a.overtime_minutes) as total_overtime_minutes,
      SUM(a.tardiness_minutes) as total_tardiness_minutes
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    WHERE a.date BETWEEN ? AND ?${areaFilter}
  `).get(from, to, ...areaParams);

  res.json(summary);
});

module.exports = router;
