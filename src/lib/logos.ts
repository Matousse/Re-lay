import type { ConnectorId } from "@/types/connectors";
import { withBasePath } from "@/lib/base-path";

// Favicons vendored into public/logos so the demo never depends on network.
// withBasePath() préfixe le basePath : next/image transmet ce chemin tel quel à son
// optimiseur (/_next/image?url=...), or l'optimiseur ne rajoute PAS le basePath lui-même.
// Sans ce préfixe, sous le sous-chemin, il chercherait /logos/x.png à la racine -> image cassée.
// En local (basePath vide) withBasePath() renvoie le chemin inchangé.
export const CONNECTOR_LOGOS: Record<ConnectorId, string> = {
  sillage: withBasePath("/logos/sillage.png"),
  fullenrich: withBasePath("/logos/fullenrich.png"),
  hubspot: withBasePath("/logos/hubspot.png"),
};
