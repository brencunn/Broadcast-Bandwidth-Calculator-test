import { promises as fs } from 'fs';
import path from 'path';
import type { Event } from '@/lib/types';

const DEFAULT_DIR = '/data/events';
const FALLBACK_DIR = path.join(process.cwd(), 'data', 'events');

const getEventsDir = () => {
  return process.env.EVENT_DATA_DIR || DEFAULT_DIR;
};

const ensureDir = async () => {
  const primary = getEventsDir();
  try {
    await fs.mkdir(primary, { recursive: true });
    return primary;
  } catch {
    await fs.mkdir(FALLBACK_DIR, { recursive: true });
    return FALLBACK_DIR;
  }
};

const getEventFilePath = (dir: string, id: string) => path.join(dir, `${id}.json`);

const readJsonFile = async <T>(filePath: string): Promise<T> => {
  const contents = await fs.readFile(filePath, 'utf8');
  return JSON.parse(contents) as T;
};

const writeJsonFile = async (filePath: string, data: unknown) => {
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tempPath, filePath);
};

let writeLock: Promise<void> = Promise.resolve();

const withWriteLock = async <T>(fn: () => Promise<T>) => {
  const current = writeLock;
  let release: () => void;
  writeLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await current;
  try {
    return await fn();
  } finally {
    release!();
  }
};

export const loadAllEvents = async (): Promise<Event[]> => {
  const dir = await ensureDir();
  const files = await fs.readdir(dir);
  const eventFiles = files.filter((file) => file.endsWith('.json'));
  const events: Event[] = [];

  for (const file of eventFiles) {
    try {
      const event = await readJsonFile<Event>(path.join(dir, file));
      if (event?.id && event?.name && Array.isArray(event?.circuits)) {
        events.push(event);
      }
    } catch {
      // Skip unreadable/bad files
    }
  }

  return events;
};

export const saveAllEvents = async (events: Event[]) => {
  await withWriteLock(async () => {
    const dir = await ensureDir();
    const existingFiles = await fs.readdir(dir);
    const existingIds = new Set(
      existingFiles.filter((file) => file.endsWith('.json')).map((file) => file.replace(/\.json$/, ''))
    );

    const incomingIds = new Set(events.map((event) => event.id));

    // Write/overwrite incoming events
    for (const event of events) {
      const filePath = getEventFilePath(dir, event.id);
      await writeJsonFile(filePath, event);
    }

    // Remove files for deleted events
    for (const id of existingIds) {
      if (!incomingIds.has(id)) {
        const filePath = getEventFilePath(dir, id);
        await fs.unlink(filePath).catch(() => undefined);
      }
    }
  });
};
