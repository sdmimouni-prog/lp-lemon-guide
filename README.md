# Lemon Mind — landing page du guide

Le formulaire est servi par Node.js et transmet les leads à Google Apps Script. Google Sheets est la source des leads. Les e-mails sont envoyés par le compte propriétaire du script à sd.mimouni@richmedia.ma, a.amazouz@richmedia.ma et t.elabbadi@richmedia.ma.

## Démarrage local

Node.js 22 ou supérieur, aucune dépendance à installer. Dans ce dossier : `npm start`. La page est accessible sur http://127.0.0.1:8097. `npm test` exécute les tests du serveur.

## Connexion Google active

Production : https://lp-lemon-guide.vercel.app/

Projet Apps Script : https://script.google.com/home/projects/1BXGRzxs817vClZmwBKLNzwgqwcU9qW64-sHfNBF-ueUB49KpBwx7krzG/edit

La connexion Vercel → Apps Script est configurée. Une soumission réelle de test a confirmé l’écriture dans le Sheet, le statut « Envoyée » des notifications et le téléchargement du PDF original (empreinte SHA-256 identique). Le tableau est accessible en lecture à toute personne ayant le lien.

Tableau des leads : https://docs.google.com/spreadsheets/d/1dgAXwEEa2yrfQBzBR0ZOzk8ulya1C87Lb8YHsZOqA7s/edit

Pour réinstaller dans un nouvel environnement (les secrets ne sont pas inclus dans le dépôt ni dans le ZIP) :

1. Dans le projet Google Apps Script du compte sd.mimouni@richmedia.ma, remplacer Code.gs par `google-apps-script/Code.gs`.
2. Exécuter `setup` et autoriser l’accès Google demandé. Cette fonction configure le tableau, le place dans ChatGPT, active sa lecture pour toute personne ayant le lien et crée une relance des notifications en échec toutes les cinq minutes.
3. Dans Paramètres du projet > Propriétés du script, copier `WEBHOOK_SECRET` dans `LEMON_WEBHOOK_SECRET` du fichier local `.env`. Ne pas publier ce secret.
4. Déployer une application Web, exécutée en tant que propriétaire, accessible à tous. Le secret est exigé par le code pour toute écriture. Copier l’URL `/exec` dans `APPS_SCRIPT_URL` du `.env`.
5. Redémarrer `npm start`, puis vérifier une soumission de test et sa notification aux trois destinataires.

Dans un nouvel environnement sans ces variables, le serveur renvoie une erreur explicite et ne simule pas d’enregistrement.

## Fonctionnement

- Validation des champs côté navigateur et serveur, champ piège contre les robots et limitation des tentatives.
- Identifiant stable lors d’une nouvelle tentative, verrou Google et détection des doublons pour éviter une seconde ligne après une interruption réseau.
- Enregistrement dans Google Sheets avant confirmation au visiteur. Les erreurs d’envoi e-mail restent marquées dans le tableau et sont retentées par un déclencheur.
- Téléchargement du PDF original fourni, protégé par un lien signé valable une heure. Le serveur ne publie pas le dossier `private`, les tests, le script Google ni `.env`.
- Les notifications sont livrées au moins une fois : une interruption Google juste après l’envoi et avant la mise à jour du statut peut exceptionnellement produire un second e-mail.
- Le choix « actualités » enregistre une préférence ; aucune campagne de newsletter n’est envoyée automatiquement.

## Mise en ligne

Vercel : `vercel.json` configure la génération des fichiers publics et les fonctions `api/leads.mjs` et `api/download.mjs`. Ajouter `APPS_SCRIPT_URL`, `LEMON_WEBHOOK_SECRET` et `DOWNLOAD_SECRET` dans les variables d’environnement Vercel, puis redéployer. Les valeurs Google doivent correspondre au déploiement Apps Script actif. Tant qu’elles sont absentes, l’API répond 503 avec un message lisible.

Sur Vercel, le PDF de 27 Mo est distribué comme fichier statique pour éviter les limites des réponses des fonctions. Après validation du lien signé, `/download/guide.pdf` redirige vers ce fichier. Le fichier statique peut être partagé directement : ce parcours est un formulaire de collecte, pas une protection confidentielle du PDF, également présent dans le dépôt GitHub public.

Un hébergement Node.js persistant reste possible : configurer les variables du `.env.example`, `HOST=0.0.0.0` et le port fourni par l’hébergeur, puis lancer `npm start` derrière HTTPS. Dans ce mode, le serveur transmet directement le PDF après validation du lien signé.

Documentation Google : https://developers.google.com/apps-script/guides/web et https://developers.google.com/apps-script/reference/mail/mail-app
