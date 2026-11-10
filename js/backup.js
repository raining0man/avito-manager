import { db, doc, getDocs, setDoc, collection } from './firebase.js';
import { store } from './store.js';

/**
 * Экспорт всех коллекций в один JSON.
 */
export async function exportAll() {
    const out = { meta: { exportedAt: new Date().toISOString(), schemaVersion: 2 } };
    for (const name of ['niches', 'blocks', 'templates', 'accounts', 'placements']) {
        const snap = await getDocs(collection(db, name));
        out[name] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return out;
}

export async function downloadBackup() {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avito_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/**
 * Валидация структуры импортируемого файла.
 * Возвращает { ok, error, data }
 */
export function validateBackup(raw) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'Файл пуст или не JSON' };
    const required = ['niches', 'blocks', 'templates', 'accounts', 'placements'];
    for (const key of required) {
        if (!Array.isArray(raw[key])) {
            return { ok: false, error: `Отсутствует массив "${key}"` };
        }
    }
    // структурная проверка каждого блока
    for (const b of raw.blocks) {
        if (!b.id || !b.slotKey || typeof b.text !== 'string') {
            return { ok: false, error: 'Повреждён блок (нет id/slotKey/text)' };
        }
    }
    for (const n of raw.niches) {
        if (!n.id || !n.name || !Array.isArray(n.slots)) {
            return { ok: false, error: 'Повреждена ниша' };
        }
    }
    return { ok: true, data: raw };
}

/**
 * Полная замена базы импортом. Возвращает Promise.
 */
export async function applyBackup(data, { mode = 'replace' } = {}) {
    const collections = ['niches', 'blocks', 'templates', 'accounts', 'placements'];

    if (mode === 'replace') {
        // мягко удаляем всё существующее
        for (const name of collections) {
            const snap = await getDocs(collection(db, name));
            const now = Date.now();
            for (const d of snap.docs) {
                if (!d.data().deletedAt) {
                    await setDoc(d.ref, { deletedAt: now, updatedAt: now }, { merge: true });
                }
            }
        }
    }

    // пишем импортированное (по одному, чтобы не упереться в лимит batch)
    for (const name of collections) {
        const arr = data[name] || [];
        for (const item of arr) {
            const id = item.id;
            if (!id) continue;
            const now = Date.now();
            await setDoc(doc(db, name, id), {
                ...item,
                deletedAt: null,
                createdAt: item.createdAt || now,
                updatedAt: now
            }, { merge: true });
        }
    }
}

/**
 * Авто-снапшот в облако. Раз в сутки. Храним последние 7.
 * Вызывается после успешной инициализации синхронизации.
 */
export async function maybeAutoSnapshot() {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const snapRef = doc(db, 'backups', today);
        // если уже есть — пропускаем
        const snap = await getDocs(collection(db, 'backups'));
        const existingIds = snap.docs.map(d => d.id);
        if (existingIds.includes(today)) return;

        const data = await exportAll();
        // урезаем meta
        const payload = {
            createdAt: Date.now(),
            collections: {
                niches: data.niches,
                blocks: data.blocks,
                templates: data.templates,
                accounts: data.accounts,
                placements: data.placements
            }
        };
        await setDoc(snapRef, payload);

        // удаляем старые (оставляем 7 последних)
        const sorted = existingIds.sort().reverse();
        for (const old of sorted.slice(7)) {
            await setDoc(doc(db, 'backups', old), { deletedAt: Date.now() });
        }
    } catch (e) {
        console.warn('auto snapshot failed:', e);
    }
}

/**
 * Список облачных снапшотов.
 */
export async function listSnapshots() {
    const snap = await getDocs(collection(db, 'backups'));
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(x => !x.deletedAt)
        .sort((a, b) => b.id.localeCompare(a.id));
}

/**
 * Восстановление из облачного снапшота.
 */
export async function restoreSnapshot(snapshotId) {
    const snap = await getDocs(collection(db, 'backups'));
    const target = snap.docs.find(d => d.id === snapshotId);
    if (!target) throw new Error('Снапшот не найден');
    const data = target.data().collections;
    await applyBackup({
        niches: data.niches || [],
        blocks: data.blocks || [],
        templates: data.templates || [],
        accounts: data.accounts || [],
        placements: data.placements || []
    });
}

// ---------- localStorage cache (fast restore при оффлайне) ----------
const LS_KEY = 'avito2_cache';

export function persistCache() {
    try {
        const { niches, blocks, templates, accounts, placements } = store.state;
        localStorage.setItem(LS_KEY, JSON.stringify({
            savedAt: Date.now(),
            niches, blocks, templates, accounts, placements
        }));
    } catch (e) {
        console.warn('cache save:', e);
    }
}

export function loadCache() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        store.setState({
            niches: data.niches || [],
            blocks: data.blocks || [],
            templates: data.templates || [],
            accounts: data.accounts || [],
            placements: data.placements || []
        });
        return true;
    } catch { return false; }
}

export function clearCache() {
    localStorage.removeItem(LS_KEY);
}
