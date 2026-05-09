import type { AnyEvent } from "carbone-cost";

const MAX_RECENT_EVENTS = 100;

const eventStore: AnyEvent[] = [];

export function addRecentEvent(event: AnyEvent): void {
  eventStore.push(event);
  if (eventStore.length > MAX_RECENT_EVENTS) {
    eventStore.splice(0, eventStore.length - MAX_RECENT_EVENTS);
  }
}

export function getRecentEvents(limit = 50): AnyEvent[] {
  if (limit <= 0) {
    return [];
  }
  return eventStore.slice(-Math.min(limit, MAX_RECENT_EVENTS));
}
