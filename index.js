const express = require('express');
const session = require('express-session');
const Keycloak = require('keycloak-connect');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const db = require('./database');

const app = express();
app.use(express.json());

const PORT = 3000;

// ─── SESSION CONFIGURATION ────────────────────────────────────
const memoryStore = new session.MemoryStore();

app.use(session({
  secret: 'api-secret',
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));

// ─── KEYCLOAK CONFIGURATION ───────────────────────────────────
const keycloak = new Keycloak({ store: memoryStore }, './keycloak-config.json');
app.use(keycloak.middleware());

// ─── SWAGGER CONFIGURATION ────────────────────────────────────
const swaggerDocument = YAML.load('./openapi.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ─── ROUTE RACINE ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json("Registre de personnes ! Choisissez le bon routage !");
});

// ─── ROUTE PROTÉGÉE TEST ──────────────────────────────────────
app.get('/secure', keycloak.protect(), (req, res) => {
  res.json({ message: 'Vous êtes authentifié !' });
});

// ─── GET /personnes — Récupérer toutes les personnes ──────────
app.get('/personnes', keycloak.protect(), (req, res) => {
  db.all("SELECT * FROM personnes", [], (err, rows) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json({ message: "success", data: rows });
  });
});

// ─── GET /personnes/:id — Récupérer une personne par ID ───────
app.get('/personnes/:id', keycloak.protect(), (req, res) => {
  const id = req.params.id;

  db.get("SELECT * FROM personnes WHERE id = ?", [id], (err, row) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ message: "Personne non trouvée" });
    }
    res.json({ message: "success", data: row });
  });
});

// ─── POST /personnes — Créer une nouvelle personne ────────────
app.post('/personnes', keycloak.protect(), (req, res) => {
  const { nom, adresse } = req.body;

  if (!nom) {
    return res.status(400).json({ error: "Le champ 'nom' est obligatoire." });
  }

  db.run(
    `INSERT INTO personnes (nom, adresse) VALUES (?, ?)`,
    [nom, adresse || null],
    function (err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.status(201).json({ message: "success", data: { id: this.lastID } });
    }
  );
});

// ─── PUT /personnes/:id — Mettre à jour une personne ──────────
app.put('/personnes/:id', keycloak.protect(), (req, res) => {
  const id = req.params.id;
  const { nom, adresse } = req.body;

  if (!nom) {
    return res.status(400).json({ error: "Le champ 'nom' est obligatoire." });
  }

  db.run(
    `UPDATE personnes SET nom = ?, adresse = ? WHERE id = ?`,
    [nom, adresse || null, id],
    function (err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: "Personne non trouvée" });
      }
      res.json({ message: "success" });
    }
  );
});

// ─── DELETE /personnes/:id — Supprimer une personne ───────────
app.delete('/personnes/:id', keycloak.protect(), (req, res) => {
  const id = req.params.id;

  db.run(`DELETE FROM personnes WHERE id = ?`, [id], function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: "Personne non trouvée" });
    }
    res.json({ message: "success" });
  });
});

// ─── LANCEMENT DU SERVEUR ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📄 Swagger docs available at http://localhost:${PORT}/api-docs`);
});