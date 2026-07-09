import type { Signal } from "@/types/pipeline";

export interface SignalSource {
  getById(id: string): Promise<Signal | null>;
  list(): Promise<Signal[]>;
}
