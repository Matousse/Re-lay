# Re:lay

Re:lay est un agent GTM conçu pour ressusciter les opportunités commerciales perdues qui dorment
dans un CRM, en transformant des signaux passifs (changement de poste, levée de fonds, visite
renouvelée du site, etc.) en actions de reconquête ultra-personnalisées.

Projet de hackathon : pas d'authentification, pas de base de données pour l'instant. L'objectif
est de brancher un CRM (réel ou mocké) et un LLM pour générer les relances.

## Stack

- **Next.js 16 (App Router)** — RSC par défaut, `"use client"` seulement quand nécessaire.
- **TypeScript strict**
- **Tailwind CSS v4** + **shadcn/ui** (`components.json`, style `base-nova`) — ne jamais modifier
  les fichiers générés dans `src/components/ui/`, composer par-dessus.
- **Lucide** pour les icônes — jamais de SVG inline.
- **Zod** pour la validation des schémas (input HTTP et domaine).
- **TanStack Query** pour tout le server-state côté client (`src/components/providers.tsx` monte
  le `QueryClientProvider` dans `layout.tsx`). Jamais de `useEffect` + `fetch` manuel.
- **Anthropic** comme fournisseur LLM (clé dans `ANTHROPIC_API_KEY`, validée par `src/lib/env.ts`).
- **Vitest** + Testing Library pour les tests.
- **ESLint (flat config)** + **Prettier** (avec `prettier-plugin-tailwindcss`) + **Husky** +
  **lint-staged** en pre-commit.

Pas de Better Auth, pas de Drizzle/DB pour cette itération — à ajouter si le scope évolue après le
hackathon.

## Architecture

Le projet n'a pas de base de données : la couche `queries/` habituelle est remplacée par une
couche `integrations/` qui isole les appels aux APIs externes (CRM, LLM). Dépendance à sens
unique :

```
integrations/  → services/  → routes API (route.ts) / RSC (page.tsx)
```

- **`src/integrations/`** : clients d'APIs externes uniquement (CRM, fournisseur LLM). Aucune
  logique métier — juste "aller chercher / envoyer la donnée".
- **`src/services/`** : logique métier et orchestration (scoring des signaux, génération des
  messages de relance, etc.). Consomme `integrations/`.
- **`src/app/api/**/route.ts`** : point d'entrée HTTP. Valide l'input avec Zod (`InputSchema`),
  appelle un service, ne contient aucune logique métier.
- **`src/app/**/page.tsx`** : RSC qui appellent directement un service pour la lecture serveur.
- **`src/types/`** : schémas Zod du domaine (suffixe `Schema`) et types dérivés.
- **`src/lib/`** : utilitaires transverses (`env.ts`, `utils.ts` de shadcn, futur query client).

**Nommage** : fichiers par domaine (`opportunity.ts`, pas `opportunityService.ts` — le dossier
donne le contexte). Types en PascalCase, constantes en SCREAMING_SNAKE_CASE, hooks préfixés `use`.

## Variables d'environnement

Voir `.env.example`. Toute variable d'env doit être ajoutée au schéma Zod dans `src/lib/env.ts`
avant d'être utilisée — jamais de `process.env.X` direct ailleurs dans le code.

## Commandes

```bash
npm run dev          # serveur de dev (Turbopack)
npm run build         # build de prod
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm run format        # Prettier --write
npm run format:check  # Prettier --check
npm run test          # Vitest
```

Un hook Husky (`pre-commit`) lance `lint-staged` (ESLint --fix + Prettier) sur les fichiers
stagés.

## Garde-fous

- Validation Zod à la frontière HTTP **et** à la frontière domaine avant tout appel à
  `integrations/`.
- Secrets uniquement dans `.env` (jamais commité — voir `.gitignore`).
- Pas de logique métier dans les routes API ni dans les RSC : tout passe par `services/`.
- Pas de `fetch` + `useEffect` pour du server-state côté client : passer par TanStack Query.
- Pas de modification des fichiers générés dans `src/components/ui/`.

### Git

- **Never run `git commit` nor `git push` without explicit permission from the user.** Always commit locally, then ask before pushing.

### Testing, Linting

- Always end by verifying your work with `npm run lint`

### Clean Code

- When asked to do lots of frontend or backend modifications, make sure to load the skill 'clean-code' before
