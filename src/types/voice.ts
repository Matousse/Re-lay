import { z } from "zod";

// Input for the TTS route — the assistant reply we want spoken back aloud.
export const SpeakInputSchema = z.object({
  text: z.string().min(1).max(4000),
});
export type SpeakInput = z.infer<typeof SpeakInputSchema>;
