const sqlite3 = require('sqlite3').verbose();

// Ouvre une connexion à la base de données SQLite (ou crée le fichier si nécessaire)
const db = new sqlite3.Database('./offres.db', (err) => {
    if (err) {
        console.error('Erreur lors de la connexion à la base de données :', err.message);
    } else {
        console.log('Connecté à la base de données SQLite.');
    }
});

// Fonction pour créer les tables
function createTables() {
    // Création de la table `offres`
    db.run(`DROP TABLE IF EXISTS offres;

CREATE TABLE offres (
    id TEXT PRIMARY KEY,
    intitule TEXT,
    description TEXT,
    dateCreation TEXT,
    dateActualisation TEXT,
    lieuTravail_libelle TEXT,
    lieuTravail_latitude REAL,
    lieuTravail_longitude REAL,
    lieuTravail_codePostal TEXT,
    lieuTravail_commune TEXT,
    romeCode TEXT,
    romeLibelle TEXT,
    appellationlibelle TEXT,
    typeContrat TEXT,
    typeContratLibelle TEXT,
    natureContrat TEXT,
    experienceExige TEXT,
    experienceLibelle TEXT,
    salaire_libelle TEXT,
    dureeTravailLibelle TEXT,
    dureeTravailLibelleConverti TEXT,
    alternance BOOLEAN,
    nombrePostes INTEGER,
    accessibleTH BOOLEAN
);

    `, (err) => {
        if (err) {
            console.error('Erreur lors de la création de la table `offres` :', err.message);
        } else {
            console.log('Table `offres` créée avec succès.');
        }
    });

    // Création de la table `lieu_travail`
    db.run(`
        CREATE TABLE IF NOT EXISTS lieu_travail (
            id TEXT PRIMARY KEY,
            offre_id TEXT,
            libelle TEXT,
            latitude REAL,
            longitude REAL,
            code_postal TEXT,
            commune TEXT,
            FOREIGN KEY (offre_id) REFERENCES offres(id) ON DELETE CASCADE
        );
    `, (err) => {
        if (err) {
            console.error('Erreur lors de la création de la table `lieu_travail` :', err.message);
        } else {
            console.log('Table `lieu_travail` créée avec succès.');
        }
    });

    // Création de la table `entreprise`
    db.run(`
        CREATE TABLE IF NOT EXISTS entreprise (
            id TEXT PRIMARY KEY,
            offre_id TEXT,
            nom TEXT,
            logo TEXT,
            entreprise_adaptee BOOLEAN,
            FOREIGN KEY (offre_id) REFERENCES offres(id) ON DELETE CASCADE
        );
    `, (err) => {
        if (err) {
            console.error('Erreur lors de la création de la table `entreprise` :', err.message);
        } else {
            console.log('Table `entreprise` créée avec succès.');
        }
    });

    // Création de la table `salaire`
    db.run(`
        CREATE TABLE IF NOT EXISTS salaire (
            id TEXT PRIMARY KEY,
            offre_id TEXT,
            libelle TEXT,
            FOREIGN KEY (offre_id) REFERENCES offres(id) ON DELETE CASCADE
        );
    `, (err) => {
        if (err) {
            console.error('Erreur lors de la création de la table `salaire` :', err.message);
        } else {
            console.log('Table `salaire` créée avec succès.');
        }
    });
}

// Appeler la fonction pour créer les tables
createTables();

// Ferme la connexion à la base de données quand c'est terminé
db.close((err) => {
    if (err) {
        console.error('Erreur lors de la fermeture de la base de données :', err.message);
    } else {
        console.log('Connexion à la base de données fermée.');
    }
});
