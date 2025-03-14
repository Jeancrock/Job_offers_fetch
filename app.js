import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// Chargement des variables d'environnement depuis le fichier .env
dotenv.config();

// Initialisation de l'application Express
const app = express();

// Définition du port à partir des variables d'environnement
const port = process.env.PORT;
let count = 0;  // Compteur pour suivre les mises à jour
let token = null;  // Variable pour stocker le token OAuth

// Création du client Supabase avec les informations d'URL et clé d'API
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// // Fonction pour supprimer les offres avec une date d'actualisation de plus d'un mois
async function deleteOldOffers() {
    const oneMonthAgo = new Date();  // Date du jour
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);  // On soustrait un mois à la date actuelle

    try {
        // Suppression des offres dont la date d'actualisation est plus ancienne qu'un mois
        const { error } = await supabase
            .from('offres')
            .delete()
            .lt('dateActualisation', oneMonthAgo.toISOString());  // Utilisation du filtre sur `dateActualisation`

        if (error) throw error;  // En cas d'erreur, on lance une exception

        console.log('Suppression des offres vieilles de plus d\'un mois réussie.');
    } catch (err) {
        console.error('Erreur lors de la suppression des anciennes offres :', err.message);  // Log en cas d'erreur
    }
}

// Fonction pour insérer les données d'une offre dans la base de données
async function insertOffer(offer) {
    try {
        // Insertion dans la table `offres` avec les données de l'offre
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
                typeContrat: offer.typeContrat,
                typeContratLibelle: offer.typeContratLibelle,
                natureContrat: offer.natureContrat,
                experienceExige: offer.experienceExige,
                experienceLibelle: offer.experienceLibelle,
                nombrePostes: offer.nombrePostes,
                accessibleTH: offer.accessibleTH,
                deplacementLibelle: offer.deplacementLibelle || null,
                qualificationLibelle: offer.qualificationLibelle || null,
                codeNAF: offer.codeNAF || null,
                secteurActiviteLibelle: offer.secteurActiviteLibelle || null,
                url_origine: offer.origineOffre.urlOrigine || null,
            }]);

        if (offresError) throw offresError;  // Gestion de l'erreur en cas d'échec d'insertion

        // Insertion dans la table `lieu_travail` avec les informations du lieu de travail
        const { error: lieuTravailError } = await supabase
            .from('lieu_travail')
            .insert([{
                id: offer.id,
                libelle: offer.lieuTravail?.libelle || null,
                latitude: offer.lieuTravail?.latitude || null,
                longitude: offer.lieuTravail?.longitude || null,
                code_postal: offer.lieuTravail?.codePostal || null,
                commune: offer.lieuTravail?.commune || null,
            }]);

        if (lieuTravailError) throw lieuTravailError;  // Gestion des erreurs d'insertion du lieu de travail

        // Insertion dans la table `entreprise` avec les informations sur l'entreprise
        const { error: entrepriseError } = await supabase
            .from('entreprise')
            .insert([{
                id: offer.id,
                nom: offer.entreprise?.nom || null,
                logo: offer.entreprise?.logo || null,
            }]);

        if (entrepriseError) throw entrepriseError;  // Gestion des erreurs d'insertion sur l'entreprise

        // Insertion dans la table `salaire` avec les informations salariales
        const { error: salaireError } = await supabase
            .from('salaire')
            .insert([{
                id: offer.id,
                libelle: offer.salaire?.libelle || null,
            }]);

        if (salaireError) throw salaireError;  // Gestion des erreurs d'insertion des informations sur le salaire

        console.log(`Offre ${offer.id} insérée avec succès.`);
    } catch (err) {
        if (!err['code'] === "23505") {  // Si l'erreur n'est pas liée à une duplication
            console.error(`Erreur lors de l'insertion de l'offre ${offer.id} :`, err.message);
            throw err;  // Relance l'erreur pour traitement ailleurs
        }
    }
}

// Fonction pour récupérer le token d'authentification OAuth2
async function getToken() {
    const tokenUrl = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire';  // URL de récupération du token

    // Préparation des données nécessaires à la requête OAuth2
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('client_id', process.env.CLIENT_ID);
    formData.append('client_secret', process.env.CLIENT_SECRET);
    formData.append('scope', process.env.SCOPE);

    try {
        // Requête pour récupérer le token
        const response = await axios.post(tokenUrl, formData.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return response.data.access_token;  // Renvoie du token OAuth2
    } catch (error) {
        console.error('Erreur lors de la récupération du token:', error.response?.data || error.message);  // Log de l'erreur si la récupération échoue
        throw error;  // Relance de l'erreur pour gestion
    }
}

// Fonction pour récupérer les offres d'emploi depuis l'API et les stocker en base de données
async function fetchOffres() {
    if (!token) {
        token = await getToken();  // Si le token est nul, récupération d'un nouveau token
    }

    count += 1;  // Incrémentation du compteur de mises à jour
    const url = 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search';  // URL de l'API pour récupérer les offres

    try {
        // Requête pour récupérer les offres
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,  // Ajout du token dans les en-têtes de la requête
                'Accept': 'application/json',
            },
        });

        const newOffers = response.data.resultats;  // Récupération des offres depuis la réponse de l'API

        // Insertion de chaque offre dans la base de données
        for (const offer of newOffers) {
            try {
                await insertOffer(offer);  // Appel de la fonction pour insérer chaque offre
            } catch (err) {
                console.error(`Erreur lors de l'insertion de l'offre ${offer.id} :`, err.message);  // Log en cas d'erreur d'insertion
            }
        }

        // Suppression des anciennes offres après l'insertion des nouvelles
        await deleteOldOffers();

        console.log('\nMise à jour N°', count);  // Log du nombre de mises à jour effectuées
    } catch (error) {
        if (error.response?.status === 401) {  // Si le token est expiré ou invalide
            console.error('Token expiré ou invalide. Renouvellement en cours...');
            token = await getToken();  // Récupération d'un nouveau token
            return fetchOffres();  // Recommencer après avoir récupéré un nouveau token
        }
        console.error('Erreur lors de la récupération des offres :', error.response?.data || error.message);  // Log en cas d'autre erreur
    }
}

// Récupération des offres toutes les 3 secondes (3000 ms)
setInterval(fetchOffres, 3000);  // Appel périodique à la fonction fetchOffres toutes les 3 secondes

// Démarrage du serveur Express sur le port spécifié
app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});
