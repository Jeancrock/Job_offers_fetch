import dotenv from 'dotenv';

import express from 'express';
import axios from 'axios';

import { createClient } from '@supabase/supabase-js';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
let count = 0;
let token = null;

const supabaseUrl = 'https://mwqrifduvmmpclztlxpp.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Codes ROME et préfixes de codes postaux à filtrer
// const romeCodes = ['J1102', 'J1103', 'J1201', 'J1301', 'J1302', 'J1304', 'J1401', 'J1402', 'J1404', 'J1501', 'J1502', 'K1104', 'K1201', 'K1207', 'K1302', 'K1403', 'K1705', 'N4103'];
// const postalPrefixes = ['76', '14', '27', '50', '61'];

// Fonction pour insérer les données dans la base de données
async function insertOffer(offer) {
    // const isValidROME = romeCodes.includes(offer.romeCode);
    // const postalCode = offer.lieuTravail?.codePostal || '';
    // const isValidPostalCode = postalPrefixes.some(prefix => postalCode.startsWith(prefix));

    // if (!isValidROME || !isValidPostalCode) {
    //     console.log(`Offre ${offer.id} ignorée : ne correspond pas aux critères.`);
    //     return;
    // }

    try {
        // Insertion dans la table `offres`
        const { error: offresError } = await supabase
            .from('offres')
            .insert([{
                id: offer.id,
                intitule: offer.intitule,
                description: offer.description,
                dateCreation: offer.dateCreation,
                dateActualisation: offer.dateActualisation,
                romeCode: offer.romeCode,
                romeLibelle: offer.romeLibelle,
                appellationLibelle: offer.appellationLibelle,
                typeContrat: offer.typeContrat,
                typeContratLibelle: offer.typeContratLibelle,
                natureContrat: offer.natureContrat,
                experienceExige: offer.experienceExige,
                experienceLibelle: offer.experienceLibelle,
                nombrePostes: offer.nombrePostes,
                accessibleTH: offer.accessibleTH,
                deplacementCode: offer.deplacementCode || null,
                deplacementLibelle: offer.deplacementLibelle || null,
                qualificationCode: offer.qualificationCode || null,
                qualificationLibelle: offer.qualificationLibelle || null,
                codeNAF: offer.codeNAF || null,
                secteurActivite: offer.secteurActivite || null,
                secteurActiviteLibelle: offer.secteurActiviteLibelle || null,
                origine_offre: offer.origineOffre.origine || null,
                url_origine: offer.origineOffre.urlOrigine || null,
            }]);

        if (offresError) throw offresError;

        // Insertion dans la table `lieu_travail`
        const { error: lieuTravailError } = await supabase
            .from('lieu_travail')
            .insert([{
                id: offer.id,
                offre_id: offer.id,
                libelle: offer.lieuTravail?.libelle || null,
                latitude: offer.lieuTravail?.latitude || null,
                longitude: offer.lieuTravail?.longitude || null,
                code_postal: offer.lieuTravail?.codePostal || null,
                commune: offer.lieuTravail?.commune || null,
            }]);

        if (lieuTravailError) throw lieuTravailError;

        // Insertion dans la table `entreprise`
        const { error: entrepriseError } = await supabase
            .from('entreprise')
            .insert([{
                id: offer.id,
                offre_id: offer.id,
                nom: offer.entreprise?.nom || null,
                logo: offer.entreprise?.logo || null,
                entreprise_adaptee: offer.entreprise?.entrepriseAdaptee || null,
            }]);

        if (entrepriseError) throw entrepriseError;

        // Insertion dans la table `salaire`
        const { error: salaireError } = await supabase
            .from('salaire')
            .insert([{
                id: offer.id,
                offre_id: offer.id,
                libelle: offer.salaire?.libelle || null,
            }]);

        if (salaireError) throw salaireError;

        console.log(`Offre ${offer.id} insérée avec succès.`);
    } catch (err) {
        console.error(`Erreur lors de l'insertion de l'offre ${offer.id} :`, err.message);
        throw err;
    }
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
    if (!token) {
        token = await getToken();
    }

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
            } catch (err) {
                console.error(`Erreur lors de l'insertion de l'offre ${offer.id} :`, err.message);
            }
        }

        console.log('\nMise à jour N°', count);
        console.log('Nouvelles offres récupérées :', newOffers.length);
    } catch (error) {
        if (error.response?.status === 401) {
            console.error('Token expiré ou invalide. Renouvellement en cours...');
            token = await getToken();
            return fetchOffres(); // Recommencer après avoir récupéré un nouveau token
        }
        console.error('Erreur lors de la récupération des offres :', error.response?.data || error.message);
    }
}

// Récupération des offres toutes les 3 secondes (3000 ms)
setInterval(fetchOffres, 3000);

app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});
