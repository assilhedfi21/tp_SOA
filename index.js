// ─── IMPORTS ─────────────────────────────────────────────────
const express = require('express');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const db = require('./database');

const app = express();
const PORT = 3000;

// ─── MIDDLEWARES ────────────────────────────────────────────

// JSON body parser
app.use(express.json());

// CORS — autoriser toutes les origines
app.use(cors());
// Pour restreindre à certains domaines, utiliser :
// app.use(cors({ origin: ['http://localhost:4200'] }));

// Rate limiting — 100 requêtes max / 15 min / IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    message: "Trop de requêtes effectuées depuis cette IP, veuillez réessayer après 15 minutes."
  }
});
app.use(limiter);

// Session pour Keycloak
const memoryStore = new session.MemoryStore();
app.use(session({
  secret: 'api-secret',
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));

// Keycloak
const keycloak = new Keycloak({ store: memoryStore }, './keycloak-config.json');
app.use(keycloak.middleware());

// Swagger
const swaggerDocument = YAML.load('./openapi.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ─── ROUTES ─────────────────────────────────────────────────

// Racine
app.get('/', (req, res) => {
  res.json("Registre de personnes ! Choisissez le bon routage !");
});

// Test Keycloak
app.get('/secure', keycloak.protect(), (req, res) => {
  res.json({ message: 'Vous êtes authentifié !' });
});

// GET /personnes — Lister toutes les personnes
app.get('/personnes', keycloak.protect(), (req, res) => {
  db.all("SELECT * FROM personnes", [], (err, rows) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: "success", data: rows });
  });
});

// GET /personnes/:id — Lire une personne par ID
app.get('/personnes/:id', keycloak.protect(), (req, res) => {
  const id = req.params.id;
  db.get("SELECT * FROM personnes WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!row) return res.status(404).json({ message: "Personne non trouvée" });
    res.json({ message: "success", data: row });
  });
});

// POST /personnes — Créer une nouvelle personne
app.post('/personnes', keycloak.protect(), (req, res) => {
  const { nom, adresse } = req.body;
  if (!nom) return res.status(400).json({ error: "Le champ 'nom' est obligatoire." });

  db.run(
    `INSERT INTO personnes (nom, adresse) VALUES (?, ?)`,
    [nom, adresse || null],
    function(err) {
      if (err) return res.status(400).json({ error: err.message });
      res.status(201).json({ message: "success", data: { id: this.lastID } });
    }
  );
});

// PUT /personnes/:id — Modifier une personne
app.put('/personnes/:id', keycloak.protect(), (req, res) => {
  const id = req.params.id;
  const { nom, adresse } = req.body;
  if (!nom) return res.status(400).json({ error: "Le champ 'nom' est obligatoire." });

  db.run(
    `UPDATE personnes SET nom = ?, adresse = ? WHERE id = ?`,
    [nom, adresse || null, id],
    function(err) {
      if (err) return res.status(400).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ message: "Personne non trouvée" });
      res.json({ message: "success" });
    }
  );
});

// DELETE /personnes/:id — Supprimer une personne
app.delete('/personnes/:id', keycloak.protect(), (req, res) => {
  const id = req.params.id;
  db.run(`DELETE FROM personnes WHERE id = ?`, [id], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ message: "Personne non trouvée" });
    res.json({ message: "success" });
  });
});

// ─── LANCEMENT DU SERVEUR ───────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📄 Swagger docs available at http://localhost:${PORT}/api-docs`);
});