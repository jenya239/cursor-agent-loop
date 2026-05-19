export type AgentBusEvent = 'agent:busy' | 'agent:idle';

type Handler = () => void;

class AgentBusImpl {
  private readonly subs = new Map<AgentBusEvent, Set<Handler>>();

  on(event: AgentBusEvent, fn: Handler): () => void {
    let set = this.subs.get(event);
    if (!set) {
      set = new Set();
      this.subs.set(event, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit(event: AgentBusEvent): void {
    for (const fn of this.subs.get(event) ?? []) fn();
  }
}

export const agentBus = new AgentBusImpl();
