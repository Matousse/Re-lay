// Single source of truth for the deployment base path (imported by
// next.config.ts). Next's router prefixes links and redirects automatically,
// but raw fetch() calls to route handlers must go through withBasePath().
//
// La valeur vient de l'env NEXT_PUBLIC_BASE_PATH, définie dans le .env du serveur.
// Absente (dev local) -> chaîne vide -> aucun basePath, l'app tourne à la racine.
// Le préfixe NEXT_PUBLIC_ est requis : sans lui la valeur ne serait pas inlinée
// dans le bundle client, et withBasePath() verrait undefined côté navigateur.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
