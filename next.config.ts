import type { NextConfig } from "next";
import { BASE_PATH } from "./src/lib/base-path";

const nextConfig: NextConfig = {
  // Hébergé en sous-chemin derrière Traefik : https://www.shonen.app/hackathon-sillage-anthropic
  // basePath fait que Next préfixe TOUTES les routes et assets (/_next/...) par ce chemin,
  // donc pas de stripprefix côté Traefik : on route le préfixe tel quel vers le conteneur.
  // BASE_PATH vient de l'env (NEXT_PUBLIC_BASE_PATH, défini dans le .env du serveur).
  // En local il est vide -> `undefined` -> pas de basePath, l'app reste à la racine.
  basePath: BASE_PATH || undefined,
  // En dev, les assets HMR sont servis via le proxy www.shonen.app (origine différente de localhost) :
  // on autorise explicitement ces origines pour /_next/* sinon Next 16 bloque les requêtes cross-origin.
  allowedDevOrigins: ["www.shonen.app", "shonen.app"],
};

export default nextConfig;
