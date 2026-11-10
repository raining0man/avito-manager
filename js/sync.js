import {
    db, doc, getDoc, setDoc, onSnapshot, collection, writeBatch
} from './firebase.js';
import { store } from './store.js';
import { uid } from './ids.js';

const COLLECTIONS = ['niches', 'blocks', 'templates', 'accounts', 'placements'];

function pillStatus(pending) {
    return pending > 0 ? 'saving' : 'online';
}

/**
 * Подписка на все коллекции. Firestore сам отдаёт optimistic-апдейты
 * из локального кэша, поэтому UI обновляется мгновенно.
 */
export function startSync() {
    const pending = {};
    const bump = (name, n) => {
        pending[name] = n;
        const total = Object.values(pending).reduce((a, b) => a + b, 0);
        store.setState({
            sync: {
                ...store.state.sync,
                status: pillStatus(total),
                pendingWrites: total,
                lastSyncAt: Date.now()
            }
        });
    };

    for (const name of COLLECTIONS) {
        onSnapshot(
            collection(db, name),
            snap => {
                const rows = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(x => !x.deletedAt);
                store.setState({ [name]: rows });
                bump(name, snap.metadata.hasPendingWrites ? 1 : 0);
            },
            err => {
                console.error(`snapshot ${name}:`, err);
                store.setState({
                    sync: { ...store.state.sync, status: 'error', error: err.message }
                });
            }
        );
    }

    onSnapshot(doc(db, 'config', 'app'), snap => {
        store.setState({ config: snap.exists() ? snap.data() : {} });
    });

    // Первичная синхронизация достигнута когда пришёл хотя бы один снапшот
    store.setState({ sync: { ...store.state.sync, status: 'online' } });
}

// ==========================================
// МИГРАЦИЯ СО СТАРОЙ ВЕРСИИ (data/main)
// ==========================================
export async function migrateIfNeeded() {
    const configRef = doc(db, 'config', 'app');
    const cfg = await getDoc(configRef);
    if (cfg.exists() && (cfg.data().schemaVersion || 0) >= 2) return;

    const legacySnap = await getDoc(doc(db, 'data', 'main'));
    if (!legacySnap.exists()) {
        await setDoc(configRef, { schemaVersion: 2, createdAt: Date.now() });
        return;
    }

    console.log('Мигрируем данные со старой версии...');
    const legacy = legacySnap.data();
    let batch = writeBatch(db);
    let ops = 0;
    const flush = async () => {
        if (ops > 0) { await batch.commit(); batch = writeBatch(db); ops = 0; }
    };
    const put = async (coll, id, data) => {
        batch.set(doc(db, coll, id), data);
        ops++;
        if (ops >= 400) await flush();
    };

    // Дефолтные слоты, которые были в старой версии
    const defaultSlots = [
        { key: 'title',        name: 'Название',      role: 'title', maxLength: 50,  order: 0 },
        { key: 'problem',      name: 'Проблема',      role: 'body',  maxLength: 800, order: 1 },
        { key: 'process',      name: 'Что делаем',    role: 'body',  maxLength: 800, order: 2 },
        { key: 'advantages',   name: 'Преимущества',  role: 'body',  maxLength: 800, order: 3 },
        { key: 'cta',          name: 'Призыв',        role: 'body',  maxLength: 500, order: 4 },
        { key: 'top_services', name: 'Топ услуг',     role: 'body',  maxLength: 800, order: 5 },
        { key: 'photo',        name: 'Фото',          role: 'body',  maxLength: 500, order: 6 },
        { key: 'visit',        name: 'Осмотр',        role: 'body',  maxLength: 500, order: 7 },
        { key: 'brands',       name: 'Марки авто',    role: 'body',  maxLength: 800, order: 8 },
        { key: 'location',     name: 'Адрес',         role: 'body',  maxLength: 500, order: 9 }
    ];

    const now = Date.now();

    // ---- Ниши ----
    const nichesObj = legacy.blocks?.niches || {};
    for (const [nicheKey, nicheData] of Object.entries(nichesObj)) {
        await put('niches', nicheKey, {
            id: nicheKey,
            name: nicheData.name || nicheKey,
            slots: defaultSlots.map(s => ({ ...s, required: s.role === 'title' })),
            order: 0, createdAt: now, updatedAt: now
        });

        // Названия -> блоки в слоте title
        (nicheData.titles || []).forEach(t => {
            const text = typeof t === 'string' ? t : t.text;
            if (!text) return;
            const id = uid('blk');
            put('blocks', id, {
                id, nicheId: nicheKey, slotKey: 'title', text,
                hidden: t.hidden || false, universal: false,
                useCount: 0, lastUsedAt: null,
                createdAt: now, updatedAt: now
            });
        });

        // Остальные блоки ниши
        for (const [slotKey, arr] of Object.entries(nicheData)) {
            if (slotKey === 'name' || slotKey === 'titles') continue;
            if (!Array.isArray(arr)) continue;
            arr.forEach(item => {
                const text = typeof item === 'string' ? item : item.text;
                if (!text) return;
                const id = uid('blk');
                put('blocks', id, {
                    id, nicheId: nicheKey, slotKey, text,
                    hidden: item.hidden || false, universal: false,
                    useCount: 0, lastUsedAt: null,
                    createdAt: now, updatedAt: now
                });
            });
        }
    }

    // ---- Универсальные блоки ----
    for (const [slotKey, arr] of Object.entries(legacy.blocks?.universal || {})) {
        if (!Array.isArray(arr)) continue;
        arr.forEach(item => {
            const text = typeof item === 'string' ? item : item.text;
            if (!text) return;
            const id = uid('blk');
            put('blocks', id, {
                id, nicheId: null, slotKey, text,
                hidden: item.hidden || false, universal: true,
                useCount: 0, lastUsedAt: null,
                createdAt: now, updatedAt: now
            });
        });
    }

    // ---- Аккаунты ----
    (legacy.accounts || []).forEach(acc => {
        const id = acc.id || uid('acc');
        put('accounts', id, {
            id, name: acc.name || 'Без названия',
            platform: acc.platform || 'Авито',
            archived: false, createdAt: now, updatedAt: now
        });
    });

    // ---- Шаблоны ----
    (legacy.templates || []).forEach(t => {
        const id = t.id || uid('tpl');
        put('templates', id, {
            id,
            nicheId: t.niche || null,
            title: t.title || '',
            description: t.description || '',
            blocks: [],
            comboKey: '',
            comment: t.comment || '',
            status: t.status || 'active',
            legacy: true,
            createdAt: now, updatedAt: now
        });
    });

    // ---- Размещения ----
    (legacy.placements || []).forEach(p => {
        const id = p.id || uid('plc');
        put('placements', id, {
            id, templateId: p.templateId, accountId: p.accountId,
            date: p.date || new Date().toISOString(),
            createdAt: now, updatedAt: now
        });
    });

    await flush();

    await setDoc(configRef, {
        schemaVersion: 2,
        createdAt: now,
        migratedFrom: 'data/main',
        migratedAt: now
    });
    console.log('Миграция завершена.');
}
