import { db, doc, setDoc, updateDoc, deleteDoc, collection, getDocs, writeBatch } from './firebase.js';
import { uid } from './ids.js';

// ==========================================
// NICHES
// ==========================================
export async function saveNiche(niche) {
    const id = niche.id || uid('niche');
    const now = Date.now();
    await setDoc(doc(db, 'niches', id), {
        ...niche, id, createdAt: niche.createdAt || now, updatedAt: now
    }, { merge: true });
    return id;
}

export async function deleteNiche(id) {
    // мягкое удаление + каскад на блоки/шаблоны
    const now = Date.now();
    await updateDoc(doc(db, 'niches', id), { deletedAt: now, updatedAt: now });
    const [blocks, templates] = await Promise.all([
        getDocs(collection(db, 'blocks')),
        getDocs(collection(db, 'templates'))
    ]);
    const batch = writeBatch(db);
    blocks.forEach(d => {
        if (d.data().nicheId === id) batch.update(d.ref, { deletedAt: now, updatedAt: now });
    });
    templates.forEach(d => {
        if (d.data().nicheId === id) batch.update(d.ref, { deletedAt: now, updatedAt: now });
    });
    await batch.commit();
}

// ==========================================
// SLOTS — живут внутри niche.slots
// ==========================================
export async function updateNicheSlots(nicheId, slots) {
    await updateDoc(doc(db, 'niches', nicheId), {
        slots, updatedAt: Date.now()
    });
}

// ==========================================
// BLOCKS
// ==========================================
export async function saveBlock(block) {
    const id = block.id || uid('blk');
    const now = Date.now();
    await setDoc(doc(db, 'blocks', id), {
        ...block, id, createdAt: block.createdAt || now, updatedAt: now
    }, { merge: true });
    return id;
}

export async function toggleBlockHidden(block) {
    await updateDoc(doc(db, 'blocks', block.id), {
        hidden: !block.hidden, updatedAt: Date.now()
    });
}

export async function markBlockUsed(blockId) {
    const ref = doc(db, 'blocks', blockId);
    const now = Date.now();
    // используем инкремент через update (Firestore поддерживает increment, но
    // для простоты читаем-пишем — кэш всё равно даст optimistic update)
    // В этой версии — простой update; useCount держим в шаблоне при сохранении
    await updateDoc(ref, { lastUsedAt: now, updatedAt: now });
}

export async function deleteBlock(id) {
    await updateDoc(doc(db, 'blocks', id), {
        deletedAt: Date.now(), updatedAt: Date.now()
    });
}

// ==========================================
// TEMPLATES
// ==========================================
export async function saveTemplate(tpl) {
    const id = tpl.id || uid('tpl');
    const now = Date.now();
    await setDoc(doc(db, 'templates', id), {
        ...tpl, id, createdAt: tpl.createdAt || now, updatedAt: now
    }, { merge: true });
    return id;
}

export async function updateTemplateStatus(id, status) {
    await updateDoc(doc(db, 'templates', id), { status, updatedAt: Date.now() });
}

export async function deleteTemplate(id) {
    await updateDoc(doc(db, 'templates', id), {
        deletedAt: Date.now(), updatedAt: Date.now()
    });
}

// ==========================================
// ACCOUNTS
// ==========================================
export async function saveAccount(acc) {
    const id = acc.id || uid('acc');
    const now = Date.now();
    await setDoc(doc(db, 'accounts', id), {
        ...acc, id, createdAt: acc.createdAt || now, updatedAt: now
    }, { merge: true });
    return id;
}

export async function deleteAccount(id) {
    const now = Date.now();
    await updateDoc(doc(db, 'accounts', id), { deletedAt: now, updatedAt: now });
    // каскад: убираем placements этого аккаунта
    const placements = await getDocs(collection(db, 'placements'));
    const batch = writeBatch(db);
    placements.forEach(d => {
        if (d.data().accountId === id) batch.update(d.ref, { deletedAt: now, updatedAt: now });
    });
    await batch.commit();
}

// ==========================================
// PLACEMENTS
// ==========================================
export async function setTemplateAccounts(templateId, accountIds) {
    const existing = await getDocs(collection(db, 'placements'));
    const now = Date.now();
    const batch = writeBatch(db);
    const keepSet = new Set(accountIds);

    existing.forEach(d => {
        const p = d.data();
        if (p.templateId !== templateId) return;
        if (keepSet.has(p.accountId)) keepSet.delete(p.accountId); // уже стоит
        else batch.update(d.ref, { deletedAt: now, updatedAt: now }); // убираем
    });

    // добавляем недостающие
    for (const accId of keepSet) {
        batch.set(doc(db, 'placements', uid('plc')), {
            id: uid('plc'), templateId, accountId: accId,
            date: new Date().toISOString(),
            createdAt: now, updatedAt: now
        });
    }
    await batch.commit();
}
