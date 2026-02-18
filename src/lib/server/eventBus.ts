import { EventEmitter } from 'events';

declare global {
  // eslint-disable-next-line no-var
  var __eventBus: EventEmitter | undefined;
}

export const eventBus = global.__eventBus ?? new EventEmitter();

if (!global.__eventBus) {
  global.__eventBus = eventBus;
}
