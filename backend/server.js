require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database');

// Initialize DB
initializeDatabase();

const app = express();
const PORT = Number(process.env.PORT || 3001);

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/permissions', require('./routes/permissions'));
app.use('/api/vacations', require('./routes/vacations'));
app.use('/api/licenses', require('./routes/licenses'));
app.use('/api/reports', require('./routes/reports'));

// Areas & Positions (via employees router)
const { getDb } = require('./database');
const { authenticate } = require('./middleware/auth');

app.get('/api/areas', authenticate, (req, res) => {
  res.json(getDb().prepare('SELECT * FROM areas ORDER BY name').all());
});

app.get('/api/positions', authenticate, (req, res) => {
  const { area_id } = req.query;
  const query = area_id
    ? 'SELECT * FROM positions WHERE area_id = ? ORDER BY name'
    : 'SELECT * FROM positions ORDER BY name';
  res.json(getDb().prepare(query).all(...(area_id ? [area_id] : [])));
});

// Collaborators list (simplified)
app.get('/api/employees-list', authenticate, (req, res) => {
  const db = getDb();
  const employees = db.prepare(`
    SELECT e.id, e.code, e.first_name || ' ' || e.last_name as name, e.status,
           a.name as area_name, p.name as position_name
    FROM employees e
    LEFT JOIN areas a ON e.area_id = a.id
    LEFT JOIN positions p ON e.position_id = p.id
    ORDER BY e.first_name
  `).all();
  res.json(employees);
});

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Ruta no encontrada' });
  }
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
});

function startServer(port = PORT) {
  const tryListen = (candidatePort) => new Promise((resolve, reject) => {
    const server = app.listen(candidatePort, () => resolve(server));
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        reject(Object.assign(error, { candidatePort }));
      } else {
        reject(error);
      }
    });
  });

  return tryListen(port)
    .catch(async (error) => {
      if (error.code !== 'EADDRINUSE') throw error;

      for (let nextPort = port + 1; nextPort <= port + 5; nextPort++) {
        try {
          return await tryListen(nextPort);
        } catch (err) {
          if (err.code !== 'EADDRINUSE') throw err;
        }
      }

      throw error;
    })
    .then((server) => {
      const actualPort = server.address().port;
      console.log(`
  ╔═══════════════════════════════════════╗
  ║   🏢 HRMS Sistema de RRHH            ║
  ║   Servidor corriendo en puerto ${actualPort} ║
  ║   http://localhost:${actualPort}               ║
  ╚═══════════════════════════════════════╝
      `);
      return server;
    });
}

startServer().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err.message);
  process.exit(1);
});

module.exports = app;
