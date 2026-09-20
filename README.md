# Lemon Mind — landing page du guide

Le formulaire est servi par Node.js et transmet les leads à Google Apps Script. Google Sheets est la source des leads. Les e-mails sont envoyés par le compte propriétaire du script à sd.mimouni@richmedia.ma, a.amazouz@richmedia.ma et t.elabbadi@richmedia.ma.

## Démarrage local

Node.js 22 ou supérieur, aucune dépendance à installer. Dans ce dossier : `npm start`. La page est accessible sur http://127.0.0.1:8097. `npm test` exécute les tests du serveur.

## Connexion Google à terminer

Tableau créé : https://docs.google.com/spreadsheets/d/1dgAXwEEa2yrfQBzBR0ZOzk8ulya1C87Lb8YHsZOqA7s/edit

1. Dans le projet Google Apps Script du compte sd.mimouni@richmedia.ma, remplacer Code.gs par `google-apps-script/Code.gs`.
2. Exécuter `setup` et autoriser l’accès Google demandé. Cette fonction configure le tableau, le place dans ChatGPT, active sa lecture pour toute personne ayant le lien et crée une relance des notifications en échec toutes les cinq minutes.
3. Dans Paramètres du projet > Propriétés du script, copier `WEBHOOK_SECRET` dans `LEMON_WEBHOOK_SECRET` du fichier local `.env`. Ne pas publier ce secret.
4. Déployer une application Web, exécutée en tant que propriétaire, accessible à tous. Le secret est exigé par le code pour toute écriture. Copier l’URL `/exec` dans `APPS_SCRIPT_URL` du `.env`.
5. Redémarrer `npm start`, puis vérifier une soumission de test et sa notification aux trois destinataires.

Tant que ces étapes ne sont pas terminées, le serveur renvoie une erreur explicite et ne simule pas d’enregistrement. Le tableau n’est pas encore public tant que `setup` n’a pas réussi.

## Fonctionnement

- Validation des champs côté navigateur et serveur, consentement explicite au tableau accessible par lien, champ piège contre les robots et limitation des tentatives.
- Identifiant stable lors d’une nouvelle tentative, verrou Google et détection des doublons pour éviter une seconde ligne après une interruption réseau.
- Enregistrement dans Google Sheets avant confirmation au visiteur. Les erreurs d’envoi e-mail restent marquées dans le tableau et sont retentées par un déclencheur.
- Téléchargement du PDF original fourni, protégé par un lien signé valable une heure. Le serveur ne publie pas le dossier `private`, les tests, le script Google ni `.env`.
- Les notifications sont livrées au moins une fois : une interruption Google juste après l’envoi et avant la mise à jour du statut peut exceptionnellement produire un second e-mail.
- Le choix « actualités » enregistre une préférence ; aucune campagne de newsletter n’est envoyée automatiquement.

## Mise en ligne

Ce projet exige un hébergement Node.js persistant. Une publication des seuls fichiers statiques ne peut pas faire fonctionner `/api/leads`. Configurer les variables d’environnement du `.env.example`, `HOST=0.0.0.0` et le port fourni par l’hébergeur. Conserver le PDF dans `private/` et lancer `npm start` derrière HTTPS.

Documentation Google : https://developers.google.com/apps-script/guides/web et https://developers.google.com/apps-script/reference/mail/mail-app
