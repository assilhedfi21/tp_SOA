const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./maBaseDeDonnees.sqlite',
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      console.error('Erreur de connexion :', err.message);
    } else {
      console.log('Connecté à la base de données SQLite.');

      db.run(`CREATE TABLE IF NOT EXISTS personnes (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        nom     TEXT NOT NULL,
        adresse TEXT
      )`, (err) => {
        if (err) {
          console.error('Erreur création table :', err.message);
        } else {
          // Données initiales
          const initData = [
            { nom: 'Bob',     adresse: '10 rue de Paris' },
            { nom: 'Alice',   adresse: '20 avenue Lyon' },
            { nom: 'Charlie', adresse: '5 boulevard Marseille' },
          ];

          initData.forEach(({ nom, adresse }) => {
            db.run(
              `INSERT INTO personnes (nom, adresse) VALUES (?, ?)`,
              [nom, adresse]
            );
          });

          console.log('Données initiales insérées.');
        }
      });
    }
  }
);

module.exports = db;