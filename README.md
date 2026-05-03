# MoleTrack — suivi sécurisé de grains de beauté

App web mobile-first (PWA) pour photographier et suivre dans le temps des zones du corps (grains de beauté, taches…) avec **chiffrement bout-en-bout**.

## Sécurité

- Chaque photo est chiffrée localement (AES-GCM 256) avant l'upload.
- La clé est dérivée d'un **code PIN à 6 chiffres** via PBKDF2-SHA256 (250 000 itérations) + un sel aléatoire par utilisateur.
- Le serveur (Supabase Storage + Postgres) ne voit que des blobs chiffrés. Personne d'autre que toi — Anthropic, Supabase ou un attaquant ayant la base — ne peut lire les images.
- Le PIN ne quitte jamais l'appareil. Si tu le perds, **les photos sont irrécupérables**.

## Stack

- React 19 + Vite + TypeScript
- Tailwind v4
- Supabase (auth anonyme + Postgres + Storage privé avec RLS)
- vite-plugin-pwa (manifest + service worker)
- WebCrypto pour le chiffrement, getUserMedia pour la capture caméra

## Lancer en local

```bash
npm install
cp .env.example .env.local   # remplir VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

## Build

```bash
npm run build
```

Le projet contient une migration SQL appliquée côté Supabase qui crée :
- `user_settings` (sel + vérificateur de PIN par user)
- `photos` (métadonnées + chemins de blobs chiffrés)
- bucket Storage `mole-photos` (privé, RLS par user)
