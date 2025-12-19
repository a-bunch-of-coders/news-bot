import fs from "fs/promises";
import path from "path";

export interface OpinionatedFeed {
  name: string;
  url: string;
  description?: string;
};

export interface OpinionatedCollection {
  topic: string;
  feeds: OpinionatedFeed[];
};

const OPINIONATED_DIR = path.resolve(process.cwd(), "opinionated");

function normalizeTopic(s: string): string {
  return s.trim().toLowerCase();
}

async function dirExists(p: string): Promise<boolean> {
  try {
    const st = await fs.stat(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

/**
 * Load a collection by topic name.
 * Behavior matches your Rust:
 *  1) Scan opinionated/*.json and match collection.topic case-insensitively
 *  2) Fallback to opinionated/<topic>.json (topic lowercased)
 */
export async function loadCollection(topic: string): Promise<OpinionatedCollection> {
  if (!(await dirExists(OPINIONATED_DIR))) {
    throw new Error("Opinionated directory not found");
  }

  const wanted = normalizeTopic(topic);

  const entries = await fs.readdir(OPINIONATED_DIR, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (!ent.name.toLowerCase().endsWith(".json")) continue;

    const filePath = path.join(OPINIONATED_DIR, ent.name);
    try {
      const collection = await readJsonFile<OpinionatedCollection>(filePath);
      if (normalizeTopic(collection.topic) === wanted) {
        return collection;
      }
    } catch {
      // Ignore parse errors here—Rust tries "if let Ok(collection) ...", then continues
    }
  }

  // Fallback: opinionated/<topic>.json
  const fallback = path.join(OPINIONATED_DIR, `${wanted}.json`);
  return readJsonFile<OpinionatedCollection>(fallback);
}

/**
 * List all topics. Matches Rust:
 * - If directory missing: return []
 * - For each .json: try to parse and push collection.topic
 * - On parse error: push filename stem instead
 * - Sort topics
 */
export async function topics(): Promise<string[]> {
  const out: string[] = [];
  if (!(await dirExists(OPINIONATED_DIR))) return out;

  const entries = await fs.readdir(OPINIONATED_DIR, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (!ent.name.toLowerCase().endsWith(".json")) continue;

    const filePath = path.join(OPINIONATED_DIR, ent.name);
    try {
      const collection = await readJsonFile<OpinionatedCollection>(filePath);
      out.push(collection.topic);
    } catch {
      const stem = ent.name.replace(/\.json$/i, "");
      out.push(stem);
    }
  }

  out.sort((a, b) => a.localeCompare(b));
  return out;
}
