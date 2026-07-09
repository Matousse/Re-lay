import type { z } from "zod";
import type { LlmClient } from "@/integrations/llm/client";
import type { Account, Signal } from "@/types/pipeline";

// Deterministic, offline LlmClient for demos and tests: no API key, no
// network, no latency surprises on stage. Instead of matching on prompt
// wording (brittle), it builds one candidate per known output shape from the
// node's input payload and returns the first one the requested schema accepts.
type NodeInput = {
  signal?: Signal;
  account?: Account;
  lossAnalysis?: { rootCause: string; newAngle: string };
  contact?: { name: string; role: string };
};

export class FakeLlm implements LlmClient {
  async structured<T>(input: { system: string; user: string; schema: z.ZodType<T> }): Promise<T> {
    const payload = JSON.parse(input.user) as NodeInput;
    for (const candidate of [lossAnalysisCandidate(payload), draftCandidate(payload)]) {
      const parsed = input.schema.safeParse(candidate);
      if (parsed.success) return parsed.data;
    }
    throw new Error("FakeLlm: no candidate matches the requested schema");
  }
}

function lossAnalysisCandidate(payload: NodeInput) {
  const reason = payload.account?.lossReason ?? "raison inconnue";
  const detail = payload.signal?.detail ?? "un signal récent";
  return {
    rootCause: `Deal perdu pour cause de ${reason} : le sponsor de l'époque n'a pas obtenu l'arbitrage en interne.`,
    evidence: (payload.account?.notes ?? []).map((note) => `${note.date} — ${note.text}`),
    newAngle: `${detail} : le contexte qui avait bloqué le deal a changé, on repart de la valeur déjà démontrée.`,
  };
}

function draftCandidate(payload: NodeInput) {
  const company = payload.signal?.company ?? "votre entreprise";
  const firstName = payload.contact?.name.split(" ")[0] ?? "bonjour";
  const angle =
    payload.lossAnalysis?.newAngle ?? "le contexte a changé depuis nos derniers échanges";
  return {
    subject: `${company} × Re:lay — le contexte a changé`,
    body: [
      `Bonjour ${firstName},`,
      "",
      `Nous avions échangé avec ${company} il y a quelques mois, sans donner suite à l'époque. ${angle}`,
      "",
      "Seriez-vous ouvert·e à un point de 15 minutes cette semaine pour voir si le sujet mérite d'être rouvert ?",
      "",
      "Bien à vous,",
      "L'équipe Re:lay",
    ].join("\n"),
    rationale: `Relance justifiée par le signal « ${payload.signal?.detail ?? "récent"} » et l'analyse de l'échec passé.`,
  };
}
