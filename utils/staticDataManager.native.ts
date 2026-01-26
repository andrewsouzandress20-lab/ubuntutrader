// Versão para desktop/Electron: salva snapshot em arquivo local
import fs from 'fs';
import path from 'path';

const STATIC_PATH = path.join(__dirname, '../indices_snapshot.json');
const STATIC_TIMESTAMP_PATH = path.join(__dirname, '../indices_snapshot.timestamp');
const STATIC_DURATION_MS = 15 * 60 * 1000;

export function setStaticIndicesSnapshot(snapshot: any) {
  fs.writeFileSync(STATIC_PATH, JSON.stringify(snapshot));
  fs.writeFileSync(STATIC_TIMESTAMP_PATH, Date.now().toString());
}

export function getStaticIndicesSnapshot(): any | null {
  if (!fs.existsSync(STATIC_TIMESTAMP_PATH) || !fs.existsSync(STATIC_PATH)) return null;
  const ts = parseInt(fs.readFileSync(STATIC_TIMESTAMP_PATH, 'utf-8'), 10);
  const age = Date.now() - ts;
  if (age > STATIC_DURATION_MS) {
    fs.unlinkSync(STATIC_PATH);
    fs.unlinkSync(STATIC_TIMESTAMP_PATH);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(STATIC_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

export function clearStaticIndicesSnapshot() {
  if (fs.existsSync(STATIC_PATH)) fs.unlinkSync(STATIC_PATH);
  if (fs.existsSync(STATIC_TIMESTAMP_PATH)) fs.unlinkSync(STATIC_TIMESTAMP_PATH);
}
