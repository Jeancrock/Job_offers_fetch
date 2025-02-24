require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment'); // Utilisation de moment pour gérer les horodatages

const app = express();
const port = 3100;
let count = 0;
let token = null;

// Connexion à la base de données SQLite
const db = new sqlite3.Database('./offres.db', (err) => {
    if (err) {
        console.error('Erreur lors de la connexion à la base de données :', err.message);
    } else {
        console.log('Connecté à la base de données SQLite.');
    }
});

// Fonction pour créer les tables (si elles n'existent pas encore)
function createTables() {
    db.run(`
        CREATE TABLE IF NOT EXISTS offres (
            id TEXT PRIMARY KEY,
            intitule TEXT,
            description TEXT,
            dateCreation DATETIME,
            dateActualisation DATETIME,
            romeCode TEXT,
            romeLibelle TEXT,
            appellationLibelle TEXT,
            typeContrat TEXT,
            typeContratLibelle TEXT,
            natureContrat TEXT,
            experienceExige TEXT,
            experienceLibelle TEXT,
            nombrePostes INTEGER,
            accessibleTH BOOLEAN,
            deplacementCode TEXT,
            deplacementLibelle TEXT,
            qualificationCode TEXT,
            qualificationLibelle TEXT,
            codeNAF TEXT,
            secteurActivite TEXT,
            secteurActiviteLibelle TEXT,
            origine_offre TEXT,
            url_origine TEXT,
            offres_manque_candidats BOOLEAN
        );
    `);

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
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS entreprise (
            id TEXT PRIMARY KEY,
            offre_id TEXT,
            nom TEXT,
            logo TEXT,
            entreprise_adaptee BOOLEAN,
            FOREIGN KEY (offre_id) REFERENCES offres(id) ON DELETE CASCADE
        );
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS salaire (
            id TEXT PRIMARY KEY,
            offre_id TEXT,
            libelle TEXT,
            FOREIGN KEY (offre_id) REFERENCES offres(id) ON DELETE CASCADE
        );
    `);
}

// Fonction pour insérer les données dans la base de données
async function insertOffer(offer) {
    return new Promise((resolve, reject) => {
        // Insertion dans la table `offres`
        db.run(`
            INSERT INTO offres (id, intitule, description, dateCreation, dateActualisation, romeCode, romeLibelle, appellationLibelle, typeContrat, typeContratLibelle, natureContrat, experienceExige, experienceLibelle, nombrePostes, accessibleTH, deplacementCode, deplacementLibelle, qualificationCode, qualificationLibelle, codeNAF, secteurActivite, secteurActiviteLibelle, origine_offre, url_origine, offres_manque_candidats)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            offer.id,
            offer.intitule,
            offer.description,
            offer.dateCreation,
            offer.dateActualisation,
            offer.romeCode,
            offer.romeLibelle,
            offer.appellationLibelle,
            offer.typeContrat,
            offer.typeContratLibelle,
            offer.natureContrat,
            offer.experienceExige,
            offer.experienceLibelle,
            offer.nombrePostes,
            offer.accessibleTH,
            offer.deplacementCode || null,
            offer.deplacementLibelle || null,
            offer.qualificationCode || null,
            offer.qualificationLibelle || null,
            offer.codeNAF || null,
            offer.secteurActivite || null,
            offer.secteurActiviteLibelle || null,
            offer.origineOffre.origine || null,
            offer.origineOffre.urlOrigine || null,
            offer.offresManqueCandidats || null
        ], function (err) {
            if (err) {
                return reject(err);
            }

            // Insertion dans la table `lieu_travail`
            db.run(`
                INSERT INTO lieu_travail (id, offre_id, libelle, latitude, longitude, code_postal, commune)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                offer.id,
                offer.id,
                offer.lieuTravail?.libelle || null,
                offer.lieuTravail?.latitude || null,
                offer.lieuTravail?.longitude || null,
                offer.lieuTravail?.codePostal || null,
                offer.lieuTravail?.commune || null
            ], function (err) {
                if (err) {
                    return reject(err);
                }

                // Insertion dans la table `entreprise`
                db.run(`
                    INSERT INTO entreprise (id, offre_id, nom, logo, entreprise_adaptee)
                    VALUES (?, ?, ?, ?, ?)
                `, [
                    offer.id,
                    offer.id,
                    offer.entreprise?.nom || null,
                    offer.entreprise?.logo || null,
                    offer.entreprise?.entrepriseAdaptee || null
                ], function (err) {
                    if (err) {
                        return reject(err);
                    }

                    // Insertion dans la table `salaire`
                    db.run(`
                        INSERT INTO salaire (id, offre_id, libelle)
                        VALUES (?, ?, ?)
                    `, [
                        offer.id,
                        offer.id,
                        offer.salaire?.libelle || null
                    ], function (err) {
                        if (err) {
                            return reject(err);
                        }
                        resolve();
                    });
                });
            });
        });
    });
}

// Fonction pour récupérer le token d'authentification OAuth2
async function getToken() {
    const tokenUrl = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire';

    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('client_id', process.env.CLIENT_ID);
    formData.append('client_secret', process.env.CLIENT_SECRET);
    formData.append('scope', process.env.SCOPE);

    try {
        const response = await axios.post(tokenUrl, formData.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Erreur lors de la récupération du token:', error.response?.data || error.message);
        throw error;
    }
}

// Fonction pour récupérer les offres d'emploi depuis l'API et les stocker en base de données
async function fetchOffres() {
    count += 1;
    const url = 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search';

    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            },
        });

        const newOffers = response.data.resultats;

        // Insertion de chaque offre dans la base de données
        for (const offer of newOffers) {
            try {
                await insertOffer(offer);
                console.log(`Offre ${offer.id} insérée avec succès.`);
            } catch (err) {
                console.error(`Erreur lors de l'insertion de l'offre ${offer.id} :`, err.message);
            }
        }

        console.log('\nMise à jour N°', count);
        console.log('Nouvelles offres récupérées :', newOffers.length);

        return response.data;
    } catch (error) {
        if (error.response?.status === 401) {
            console.error('Token expiré ou invalide. Renouvellement du token...');
            token = await getToken();
            return fetchOffres();
        }
        console.error('Erreur lors de la récupération des offres:', error.response?.data || error.message);
        throw error;
    }
}

// Fonction principale pour démarrer le processus
async function startFetchingOffres() {
    try {
        token = await getToken();
        setInterval(async () => {
            try {
                await fetchOffres();
            } catch (error) {
                console.error('Échec de la récupération des offres:', error.message);
            }
        }, 3000); // Toutes les 3 secondes

        await fetchOffres(); // Appel initial
    } catch (error) {
        console.error('Échec lors du démarrage de la récupération des offres:', error.message);
    }
}

// Démarrer le serveur et lancer le processus
app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
    createTables(); // Crée les tables à l'initialisation
    startFetchingOffres();
});
