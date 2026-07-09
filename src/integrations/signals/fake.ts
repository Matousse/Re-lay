import type { Signal } from "@/types/pipeline";
import type { SignalSource } from "@/integrations/signals/port";
import signals from "@/integrations/signals/data.json";

export class FakeSignalSource implements SignalSource {
  private signals = signals as Signal[];
  async getById(id: string): Promise<Signal | null> {
    return this.signals.find((s) => s.id === id) ?? null;
  }
  async list(): Promise<Signal[]> {
    return this.signals;
  }
}
