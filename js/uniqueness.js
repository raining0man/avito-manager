/**
 * Weighted random: блоки с малым useCount получают больший вес.
 * weight = 1 / (useCount + 1)
 */
export function pickWeighted(items) {
    if (!items.length) return null;
    const weights = items.map(b => 1 / ((b.useCount || 0) + 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
    }
    return items[items.length - 1];
}

/**
 * Комбинированный ключ из отсортированных blockId.
 */
export function comboKeyOf(blocks) {
    return blocks
        .map(b => b.blockId || b.id)
        .filter(Boolean)
        .sort()
        .join('|');
}

/**
 * Проверка что comboKey ещё не встречался.
 */
export function isComboUnique(comboKey, templates) {
    if (!comboKey) return true;
    return !templates.some(t => t.comboKey === comboKey);
}

// ---------- Jaccard ----------
function shingles(text, size = 3) {
    const words = (text || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(Boolean);
    if (words.length < size) return new Set(words);
    const set = new Set();
    for (let i = 0; i <= words.length - size; i++) {
        set.add(words.slice(i, i + size).join(' '));
    }
    return set;
}

export function jaccard(a, b) {
    if (!a.size && !b.size) return 0;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    return inter / (a.size + b.size - inter);
}

/**
 * Максимальное сходство текста с массивом уже сохранённых.
 */
export function maxSimilarity(text, templates, size = 3) {
    const sh = shingles(text, size);
    let max = 0;
    let worst = null;
    for (const t of templates) {
        const sim = jaccard(sh, shingles(t.description || '', size));
        if (sim > max) { max = sim; worst = t; }
    }
    return { max, worst };
}

/**
 * Генерация одной уникальной комбинации.
 * slots: [{key, name, maxLength, role}]
 * blocksBySlot: { [slotKey]: Block[] }
 * usedComboKeys: Set<string>
 */
export function generateUniqueCombo(slots, blocksBySlot, usedComboKeys, locked = {}) {
    const MAX_ATTEMPTS = 500;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const picked = [];
        for (const slot of slots) {
            if (locked[slot.key]) { picked.push(locked[slot.key]); continue; }
            const pool = (blocksBySlot[slot.key] || []).filter(b => !b.hidden);
            if (!pool.length) continue;
            picked.push(pickWeighted(pool));
        }
        if (!picked.length) return null;
        const key = comboKeyOf(picked);
        if (!usedComboKeys.has(key)) return picked;
    }
    return null;
}
