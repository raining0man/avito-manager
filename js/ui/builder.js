import { store } from '../store.js';
import { saveTemplate, saveBlock, markBlockUsed } from '../actions.js';
import { generateUniqueCombo, comboKeyOf, maxSimilarity } from '../uniqueness.js';
import { toast } from './toast.js';
import { promptModal, confirmModal } from './modal.js';
import { uid } from '../ids.js';

export function renderBuilder(root) {
    root.innerHTML = `
        <section class="card">
            <div class="card-header">
                <h2>🏗 Конструктор</h2>
                <div class="header-actions">
                    <button class="btn btn-secondary" id="btn-random">🎲 Собрать</button>
                    <button class="btn btn-secondary" id="btn-batch">📦 Пакет</button>
                </div>
            </div>
            <div class="card-body">
                <div class="input-group">
                    <label>Ниша</label>
                    <select id="niche-select"></select>
                </div>
                <div class="slots-list" id="slots-list"></div>
                <div class="input-group">
                    <label>Предпросмотр <span class="hint" id="preview-counter"></span></label>
                    <textarea id="preview" rows="10" readonly placeholder="Выберите варианты — увидите текст здесь"></textarea>
                </div>
                <div class="input-group">
                    <label>Внутренний комментарий</label>
                    <input type="text" id="comment" placeholder="Например: аккаунт А, 10.11">
                </div>
            </div>
            <div class="card-footer">
                <button class="btn btn-primary" id="btn-save">💾 Сохранить объявление</button>
            </div>
        </section>
    `;

    const els = {
        nicheSelect: root.querySelector('#niche-select'),
        slotsList: root.querySelector('#slots-list'),
        preview: root.querySelector('#preview'),
        previewCounter: root.querySelector('#preview-counter'),
        comment: root.querySelector('#comment'),
        btnRandom: root.querySelector('#btn-random'),
        btnBatch: root.querySelector('#btn-batch'),
        btnSave: root.querySelector('#btn-save')
    };

    // локальное состояние выбора
    const selection = {};        // slotKey -> blockId
    const locked = {};           // slotKey -> true

    let lastNichesRef = null;
    let lastBlocksRef = null;
    let lastTemplatesRef = null;

    function getCurrentNiche() {
        return store.state.niches.find(n => n.id === els.nicheSelect.value) || null;
    }

    function blocksForSlot(nicheId, slotKey) {
        return store.state.blocks.filter(b =>
            b.slotKey === slotKey &&
            (b.nicheId === nicheId || b.universal === true) &&
            !b.hidden
        );
    }

    function renderNicheSelect() {
        const niches = [...store.state.niches].sort((a, b) => (a.order || 0) - (b.order || 0));
        const prev = els.nicheSelect.value;
        els.nicheSelect.innerHTML = '<option value="">— выберите нишу —</option>' +
            niches.map(n => `<option value="${n.id}">${escapeHtml(n.name)}</option>`).join('');
        if (prev && niches.some(n => n.id === prev)) els.nicheSelect.value = prev;
        else if (niches.length === 1) els.nicheSelect.value = niches[0].id;
    }

    function renderSlots() {
        const niche = getCurrentNiche();
        if (!niche) {
            els.slotsList.innerHTML = `<div class="empty"><span class="empty-icon">🗂</span>Выберите нишу или создайте её в «Библиотеке»</div>`;
            els.preview.value = '';
            updatePreviewCounter('');
            return;
        }

        const slots = [...(niche.slots || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
        els.slotsList.innerHTML = slots.map(slot => {
            const pool = blocksForSlot(niche.id, slot.key);
            const opts = pool.map(b =>
                `<option value="${b.id}" ${selection[slot.key] === b.id ? 'selected' : ''}>${escapeHtml(b.text.slice(0, 80))}</option>`
            ).join('');
            const currentText = pool.find(b => b.id === selection[slot.key])?.text || '';
            const len = currentText.length;
            const over = len > slot.maxLength;
            const counter = slot.maxLength
                ? `<span class="slot-meta ${over ? 'char-counter warning' : ''}">${len} / ${slot.maxLength}</span>`
                : '';
            return `
                <div class="slot-row" data-slot="${slot.key}">
                    <div class="slot-row-head">
                        <div class="slot-name">
                            ${escapeHtml(slot.name)}
                            ${slot.role === 'title' ? '<span class="role-tag">заголовок</span>' : ''}
                            ${slot.required ? '<span class="role-tag" style="background:var(--warning);color:#111;">обяз.</span>' : ''}
                        </div>
                        ${counter}
                    </div>
                    <div class="slot-controls">
                        <select class="slot-select" data-slot="${slot.key}">
                            <option value="">— не использовать —</option>
                            ${opts}
                        </select>
                        <button class="btn-ghost ${locked[slot.key] ? 'active' : ''}" data-action="lock" title="Закрепить при генерации">🔒</button>
                        <button class="btn-ghost" data-action="random" title="Случайно для слота">🎲</button>
                        <button class="btn-ghost" data-action="add" title="Добавить вариант">+</button>
                    </div>
                </div>
            `;
        }).join('');

        // слушатели
        els.slotsList.querySelectorAll('.slot-select').forEach(sel => {
            sel.onchange = () => {
                const k = sel.dataset.slot;
                if (sel.value) selection[k] = sel.value;
                else delete selection[k];
                renderSlots();
            };
        });
        els.slotsList.querySelectorAll('[data-action="lock"]').forEach(btn => {
            btn.onclick = () => {
                const key = btn.closest('.slot-row').dataset.slot;
                locked[key] = !locked[key];
                renderSlots();
            };
        });
        els.slotsList.querySelectorAll('[data-action="random"]').forEach(btn => {
            btn.onclick = () => {
                const key = btn.closest('.slot-row').dataset.slot;
                const pool = blocksForSlot(niche.id, key);
                if (!pool.length) return toast('В этом слоте пока нет вариантов', 'warning');
                const pick = pool[Math.floor(Math.random() * pool.length)];
                selection[key] = pick.id;
                renderSlots();
            };
        });
        els.slotsList.querySelectorAll('[data-action="add"]').forEach(btn => {
            btn.onclick = async () => {
                const key = btn.closest('.slot-row').dataset.slot;
                const text = await promptModal('Новый вариант блока', {
                    label: 'Текст блока',
                    multiline: true
                });
                if (!text) return;
                const slot = (niche.slots || []).find(s => s.key === key);
                if (slot.maxLength && slot.role === 'title' && text.length > slot.maxLength) {
                    return toast(`Заголовок не может быть длиннее ${slot.maxLength} символов`, 'error');
                }
                const id = await saveBlock({
                    nicheId: niche.id, slotKey: key, text,
                    hidden: false, universal: false, useCount: 0
                });
                selection[key] = id;
                toast('Блок добавлен', 'success');
            };
        });

        updatePreview();
    }

    function updatePreview() {
        const niche = getCurrentNiche();
        if (!niche) { els.preview.value = ''; return; }
        const slots = [...(niche.slots || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
        const parts = [];
        for (const slot of slots) {
            const id = selection[slot.key];
            if (!id) continue;
            const block = store.state.blocks.find(b => b.id === id);
            if (block) parts.push(block.text);
        }
        els.preview.value = parts.join('\n\n');
        updatePreviewCounter(els.preview.value);
    }

    function updatePreviewCounter(text) {
        const len = text.length;
        els.previewCounter.textContent = `${len} символов`;
        els.previewCounter.className = 'hint' + (len > 3000 ? ' char-counter warning' : '');
    }

    function collectSelected() {
        const niche = getCurrentNiche();
        if (!niche) return [];
        const slots = [...(niche.slots || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
        const out = [];
        for (const slot of slots) {
            const id = selection[slot.key];
            if (!id) continue;
            const block = store.state.blocks.find(b => b.id === id);
            if (block) out.push({
                slotKey: slot.key,
                slotName: slot.name,
                role: slot.role,
                blockId: block.id,
                text: block.text,
                maxLength: slot.maxLength
            });
        }
        return out;
    }

    async function validateAndSave(blocks, comment) {
        const niche = getCurrentNiche();
        if (!niche) return { ok: false, error: 'Ниша не выбрана' };

        // обязательные слоты
        const slots = niche.slots || [];
        for (const slot of slots) {
            if (slot.required && !blocks.find(b => b.slotKey === slot.key)) {
                return { ok: false, error: `Не выбран обязательный слот: ${slot.name}` };
            }
        }
        // лимит длины title
        for (const b of blocks) {
            if (b.maxLength && b.text.length > b.maxLength) {
                return { ok: false, error: `«${b.slotName}» длиннее ${b.maxLength} символов` };
            }
        }
        const description = blocks.map(b => b.text).join('\n\n');
        if (description.length > 3000) {
            return { ok: false, error: `Описание длиннее 3000 символов (${description.length})` };
        }

        const comboKey = comboKeyOf(blocks);
        const sameNicheTemplates = store.state.templates.filter(t => t.nicheId === niche.id);
        const { max, worst } = maxSimilarity(description, sameNicheTemplates, 3);
        if (max >= 0.75) {
            const proceed = await confirmModal(
                'Слишком похоже на существующее',
                `Сходство ${(max * 100).toFixed(0)}% с объявлением «${escapeHtml(worst.title || 'без названия')}».<br>Всё равно сохранить?`
            );
            if (!proceed) return { ok: false, cancelled: true };
        }

        const titleBlock = blocks.find(b => b.role === 'title');
        const title = titleBlock?.text || blocks[0]?.text?.slice(0, 50) || 'Без названия';

        await saveTemplate({
            nicheId: niche.id,
            title,
            description,
            blocks: blocks.map(b => ({ slotKey: b.slotKey, blockId: b.blockId, text: b.text, role: b.role })),
            comboKey,
            comment: comment || '',
            status: 'active',
            legacy: false
        });

        // помечаем блоки использованными
        for (const b of blocks) {
            markBlockUsed(b.blockId).catch(() => {});
        }
        return { ok: true };
    }

    els.nicheSelect.onchange = () => {
        // чистим выбор при смене ниши
        Object.keys(selection).forEach(k => delete selection[k]);
        Object.keys(locked).forEach(k => delete locked[k]);
        renderSlots();
    };

    els.btnSave.onclick = async () => {
        const blocks = collectSelected();
        if (!blocks.length) return toast('Выберите хотя бы один блок', 'warning');
        const result = await validateAndSave(blocks, els.comment.value.trim());
        if (result.cancelled) return;
        if (!result.ok) return toast(result.error, 'error');
        toast('Объявление сохранено', 'success');
        // очистка
        Object.keys(selection).forEach(k => delete selection[k]);
        els.comment.value = '';
        renderSlots();
    };

    els.btnRandom.onclick = async () => {
        const niche = getCurrentNiche();
        if (!niche) return toast('Выберите нишу', 'warning');
        const slots = [...(niche.slots || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
        const blocksBySlot = {};
        for (const s of slots) blocksBySlot[s.key] = blocksForSlot(niche.id, s.key);
        const usedCombos = new Set(
            store.state.templates
                .filter(t => t.nicheId === niche.id && t.comboKey)
                .map(t => t.comboKey)
        );
        const lockedBlocks = {};
        for (const [k, v] of Object.entries(locked)) {
            if (!v) continue;
            const b = store.state.blocks.find(x => x.id === selection[k]);
            if (b) lockedBlocks[k] = b;
        }
        const picked = generateUniqueCombo(slots, blocksBySlot, usedCombos, lockedBlocks);
        if (!picked) return toast('Не удалось собрать уникальную комбинацию (все использованы?)', 'error');
        Object.keys(selection).forEach(k => delete selection[k]);
        for (const b of picked) selection[b.slotKey] = b.id;
        renderSlots();
        toast('Комбинация собрана', 'success');
    };

    els.btnBatch.onclick = async () => {
        const niche = getCurrentNiche();
        if (!niche) return toast('Выберите нишу', 'warning');
        const countStr = await promptModal('Сколько объявлений сгенерировать?', {
            label: 'Число (1–100)', value: '10'
        });
        const count = Math.min(100, Math.max(1, parseInt(countStr) || 0));
        if (!count) return;

        const slots = [...(niche.slots || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
        const blocksBySlot = {};
        for (const s of slots) blocksBySlot[s.key] = blocksForSlot(niche.id, s.key);
        const usedCombos = new Set(
            store.state.templates
                .filter(t => t.nicheId === niche.id && t.comboKey)
                .map(t => t.comboKey)
        );

        const saved = [];
        const seenInBatch = new Set();
        for (let i = 0; i < count; i++) {
            const picked = generateUniqueCombo(slots, blocksBySlot, usedCombos);
            if (!picked) break;
            const key = comboKeyOf(picked);
            if (seenInBatch.has(key)) break;
            seenInBatch.add(key);

            // проверка длины
            let ok = true;
            for (const b of picked) {
                const slot = slots.find(s => s.key === b.slotKey);
                if (slot?.maxLength && b.text.length > slot.maxLength) { ok = false; break; }
            }
            if (!ok) continue;

            const blocks = picked.map(b => {
                const slot = slots.find(s => s.key === b.slotKey);
                return {
                    slotKey: b.slotKey, slotName: slot.name, role: slot.role,
                    blockId: b.id, text: b.text, maxLength: slot.maxLength
                };
            });
            const description = blocks.map(b => b.text).join('\n\n');
            if (description.length > 3000) continue;

            const titleBlock = blocks.find(b => b.role === 'title');
            const title = titleBlock?.text || blocks[0]?.text?.slice(0, 50) || 'Без названия';

            await saveTemplate({
                nicheId: niche.id, title, description,
                blocks: blocks.map(b => ({ slotKey: b.slotKey, blockId: b.blockId, text: b.text, role: b.role })),
                comboKey: key, comment: 'пакетная генерация', status: 'active'
            });
            saved.push(title);
            usedCombos.add(key);
        }
        toast(`Сохранено ${saved.length} объявлений`, saved.length ? 'success' : 'warning');
    };

    // Реактивность
    const unsubscribe = store.subscribe(state => {
        if (state.niches !== lastNichesRef) {
            lastNichesRef = state.niches;
            renderNicheSelect();
            renderSlots();
        } else if (state.blocks !== lastBlocksRef) {
            lastBlocksRef = state.blocks;
            renderSlots();
        }
        lastTemplatesRef = state.templates;
    });

    // инициализация
    renderNicheSelect();
    renderSlots();

    return () => {
        unsubscribe();
    };
}

// ---------- helpers ----------
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
