import { store } from '../store.js';
import {
    saveNiche, deleteNiche, updateNicheSlots,
    saveBlock, toggleBlockHidden, deleteBlock
} from '../actions.js';
import { toast } from './toast.js';
import { promptModal, confirmModal } from './modal.js';
import { uid } from '../ids.js';

const SUBTABS = [
    { id: 'niches', label: 'Ниши' },
    { id: 'slots',  label: 'Слоты' },
    { id: 'blocks', label: 'Блоки' }
];

const DEFAULT_SLOTS = () => ([
    { key: 'title',  name: 'Название',     role: 'title', maxLength: 50,  order: 0, required: true },
    { key: 'intro',  name: 'Вступление',   role: 'body',  maxLength: 800, order: 1, required: false },
    { key: 'problem',name: 'Проблема',     role: 'body',  maxLength: 800, order: 2, required: false },
    { key: 'solution',name: 'Решение',     role: 'body',  maxLength: 800, order: 3, required: false },
    { key: 'cta',    name: 'Призыв',       role: 'body',  maxLength: 500, order: 4, required: false }
]);

export function renderLibrary(root) {
    root.innerHTML = `
        <section class="card">
            <div class="card-header">
                <h2>📚 Библиотека</h2>
            </div>
            <div class="subtabs" id="subtabs">
                ${SUBTABS.map((t, i) => `
                    <button class="subtab ${i === 0 ? 'active' : ''}" data-subtab="${t.id}">${t.label}</button>
                `).join('')}
            </div>
            <div class="card-body" id="subtabs-content"></div>
        </section>
    `;

    const content = root.querySelector('#subtabs-content');
    let activeSubtab = 'niches';
    let selectedNicheId = store.state.niches[0]?.id || null;

    root.querySelectorAll('.subtab').forEach(btn => {
        btn.onclick = () => {
            activeSubtab = btn.dataset.subtab;
            root.querySelectorAll('.subtab').forEach(b => b.classList.toggle('active', b === btn));
            renderSubtab();
        };
    });

    function renderSubtab() {
        content.innerHTML = '';
        if (activeSubtab === 'niches') renderNiches(content, {
            onSelect: id => { selectedNicheId = id; }
        });
        else if (activeSubtab === 'slots') renderSlotsTab(content, {
            getNicheId: () => selectedNicheId,
            setNicheId: id => { selectedNicheId = id; renderSubtab(); }
        });
        else if (activeSubtab === 'blocks') renderBlocksTab(content, {
            getNicheId: () => selectedNicheId,
            setNicheId: id => { selectedNicheId = id; renderSubtab(); }
        });
    }

    const unsubscribe = store.subscribe(() => {
        // перерисовываем при изменении данных
        if (activeSubtab === 'niches') renderSubtab();
    });

    renderSubtab();
    return () => unsubscribe();
}

// ==========================================
// NICHES
// ==========================================
function renderNiches(container, { onSelect }) {
    const niches = [...store.state.niches].sort((a, b) => (a.order || 0) - (b.order || 0));

    container.innerHTML = `
        <div class="filters" style="margin-bottom:12px;">
            <button class="btn btn-primary" id="btn-add-niche">+ Создать нишу</button>
        </div>
        <div id="niches-list"></div>
    `;

    container.querySelector('#btn-add-niche').onclick = async () => {
        const name = await promptModal('Новая ниша', { label: 'Название', placeholder: 'Например: Ремонт двигателя' });
        if (!name) return;
        await saveNiche({ name, slots: DEFAULT_SLOTS(), order: niches.length });
        toast('Ниша создана', 'success');
    };

    const list = container.querySelector('#niches-list');
    if (!niches.length) {
        list.innerHTML = `<div class="empty"><span class="empty-icon">📂</span>Ниши появятся здесь</div>`;
        return;
    }

    list.innerHTML = niches.map(n => `
        <div class="template-card" data-id="${n.id}">
            <div class="template-main">
                <div class="template-info">
                    <div class="template-title">${escapeHtml(n.name)}</div>
                    <div class="template-desc">
                        Слотов: ${(n.slots || []).length} ·
                        Блоков: ${store.state.blocks.filter(b => b.nicheId === n.id).length} ·
                        Объявлений: ${store.state.templates.filter(t => t.nicheId === n.id).length}
                    </div>
                </div>
                <div class="template-actions">
                    <button class="btn-ghost" data-action="edit" title="Переименовать">✏️</button>
                    <button class="btn-ghost" data-action="del" title="Удалить">❌</button>
                </div>
            </div>
        </div>
    `).join('');

    list.querySelectorAll('.template-card').forEach(card => {
        const id = card.dataset.id;
        const niche = niches.find(n => n.id === id);
        card.querySelector('[data-action="edit"]').onclick = async () => {
            const name = await promptModal('Переименовать нишу', { value: niche.name });
            if (!name) return;
            await saveNiche({ ...niche, name });
        };
        card.querySelector('[data-action="del"]').onclick = async () => {
            const ok = await confirmModal('Удалить нишу?', `Все блоки и объявления этой ниши будут скрыты.`);
            if (!ok) return;
            await deleteNiche(id);
            toast('Удалено', 'success');
        };
    });
}

// ==========================================
// SLOTS (редактирование слотов выбранной ниши)
// ==========================================
function renderSlotsTab(container, { getNicheId, setNicheId }) {
    const niches = [...store.state.niches].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!niches.length) {
        container.innerHTML = `<div class="empty"><span class="empty-icon">📂</span>Сначала создайте нишу</div>`;
        return;
    }
    let currentId = getNicheId();
    if (!currentId || !niches.some(n => n.id === currentId)) currentId = niches[0].id;

    container.innerHTML = `
        <div class="input-group" style="margin-bottom:12px;">
            <label>Ниша</label>
            <select id="slot-niche-select">
                ${niches.map(n => `<option value="${n.id}" ${n.id === currentId ? 'selected' : ''}>${escapeHtml(n.name)}</option>`).join('')}
            </select>
        </div>
        <button class="btn btn-primary" id="btn-add-slot" style="align-self:flex-start; margin-bottom:12px;">+ Добавить слот</button>
        <div id="slots-edit"></div>
    `;
    container.querySelector('#slot-niche-select').onchange = e => {
        setNicheId(e.target.value);
        renderSlotsTab(container, { getNicheId, setNicheId });
    };

    const niche = niches.find(n => n.id === currentId);
    const slots = [...(niche.slots || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const list = container.querySelector('#slots-edit');

    const persist = async (newSlots) => {
        await updateNicheSlots(niche.id, newSlots);
    };

    container.querySelector('#btn-add-slot').onclick = async () => {
        const name = await promptModal('Новый слот', { label: 'Название' });
        if (!name) return;
        const key = 'slot_' + uid();
        const newSlots = [...slots, {
            key, name, role: 'body', maxLength: 800, order: slots.length, required: false
        }];
        await persist(newSlots);
        toast('Слот добавлен', 'success');
    };

    if (!slots.length) {
        list.innerHTML = `<div class="empty">Нет слотов</div>`;
        return;
    }

    list.innerHTML = slots.map((s, i) => `
        <details class="collapse">
            <summary>
                ${escapeHtml(s.name)}
                ${s.role === 'title' ? '<span class="role-tag" style="background:var(--primary);color:#fff;padding:1px 6px;border-radius:4px;font-size:0.7rem;margin-left:6px;">ЗАГОЛОВОК</span>' : ''}
                <span class="count-badge">${s.maxLength || '∞'} симв.</span>
            </summary>
            <div class="collapse-body">
                <div class="input-group">
                    <label>Название</label>
                    <input data-field="name" type="text" value="${escapeHtml(s.name)}">
                </div>
                <div class="input-group">
                    <label>Максимум символов (пусто = без лимита)</label>
                    <input data-field="maxLength" type="number" min="1" value="${s.maxLength || ''}">
                </div>
                <div class="input-group">
                    <label>Роль</label>
                    <select data-field="role">
                        <option value="body"  ${s.role === 'body'  ? 'selected' : ''}>Обычный текст</option>
                        <option value="title" ${s.role === 'title' ? 'selected' : ''}>Заголовок объявления</option>
                    </select>
                </div>
                <div class="input-group">
                    <label><input data-field="required" type="checkbox" ${s.required ? 'checked' : ''}> Обязательный слот</label>
                </div>
                <div style="display:flex; gap:8px; margin-top:6px;">
                    <button class="btn btn-sm btn-secondary" data-action="up" ${i === 0 ? 'disabled' : ''}>↑ Выше</button>
                    <button class="btn btn-sm btn-secondary" data-action="down" ${i === slots.length - 1 ? 'disabled' : ''}>↓ Ниже</button>
                    <button class="btn btn-sm btn-danger" data-action="del">Удалить слот</button>
                </div>
            </div>
        </details>
    `).join('');

    // Обработка изменений
    list.querySelectorAll('details.collapse').forEach((el, idx) => {
        const slot = slots[idx];
        const update = async () => {
            const f = k => el.querySelector(`[data-field="${k}"]`);
            const newSlot = {
                ...slot,
                name: f('name').value.trim() || slot.name,
                maxLength: f('maxLength').value ? parseInt(f('maxLength').value) : null,
                role: f('role').value,
                required: f('required').checked
            };
            // защита: если это title и есть другой title — снимаем
            let newSlots = slots.map((s, i) => i === idx ? newSlot : s);
            if (newSlot.role === 'title') {
                newSlots = newSlots.map((s, i) => i !== idx && s.role === 'title' ? { ...s, role: 'body' } : s);
            }
            await persist(newSlots);
        };
        el.querySelectorAll('[data-field]').forEach(input => {
            input.onchange = update;
        });
        el.querySelector('[data-action="up"]').onclick = async () => {
            if (idx === 0) return;
            const arr = [...slots];
            [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
            arr.forEach((s, i) => s.order = i);
            await persist(arr);
        };
        el.querySelector('[data-action="down"]').onclick = async () => {
            if (idx === slots.length - 1) return;
            const arr = [...slots];
            [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
            arr.forEach((s, i) => s.order = i);
            await persist(arr);
        };
        el.querySelector('[data-action="del"]').onclick = async () => {
            const ok = await confirmModal('Удалить слот?', 'Блоки этого слота останутся, но станут недоступны.');
            if (!ok) return;
            await persist(slots.filter((_, i) => i !== idx));
        };
    });
}

// ==========================================
// BLOCKS (обзор и редактирование блоков)
// ==========================================
function renderBlocksTab(container, { getNicheId, setNicheId }) {
    const niches = [...store.state.niches].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!niches.length) {
        container.innerHTML = `<div class="empty"><span class="empty-icon">📂</span>Сначала создайте нишу</div>`;
        return;
    }
    let currentId = getNicheId();
    if (!currentId || !niches.some(n => n.id === currentId)) currentId = niches[0].id;

    container.innerHTML = `
        <div class="filters" style="margin-bottom:12px;">
            <select id="block-niche-select">
                ${niches.map(n => `<option value="${n.id}" ${n.id === currentId ? 'selected' : ''}>${escapeHtml(n.name)}</option>`).join('')}
            </select>
            <input id="block-search" type="text" placeholder="🔍 Поиск по тексту...">
        </div>
        <div id="blocks-edit"></div>
    `;
    container.querySelector('#block-niche-select').onchange = e => setNicheId(e.target.value);

    const niche = niches.find(n => n.id === currentId);
    const slots = [...(niche.slots || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const list = container.querySelector('#blocks-edit');
    const search = container.querySelector('#block-search');

    const render = () => {
        const q = search.value.trim().toLowerCase();
        list.innerHTML = slots.map(slot => {
            const blocks = store.state.blocks.filter(b =>
                b.nicheId === niche.id && b.slotKey === slot.key &&
                (!q || b.text.toLowerCase().includes(q))
            ).sort((a, b) => (a.hidden ? 1 : 0) - (b.hidden ? 1 : 0));
            if (q && blocks.length === 0) return '';
            return `
                <details class="collapse" ${blocks.length && blocks.length < 6 ? 'open' : ''}>
                    <summary>
                        ${escapeHtml(slot.name)}
                        <span class="count-badge">${blocks.length}</span>
                        <button class="btn-ghost" data-add-to="${slot.key}" title="Добавить вариант" style="margin-left:auto;">+</button>
                    </summary>
                    <div class="collapse-body">
                        ${blocks.length === 0 ? '<div class="empty">Пока нет вариантов</div>' : blocks.map(b => `
                            <div class="block-item ${b.hidden ? 'hidden' : ''}" data-id="${b.id}">
                                <span class="block-text" title="${escapeHtml(b.text)}">${escapeHtml(b.text)}</span>
                                <div class="block-actions">
                                    <label class="block-usage"><input type="checkbox" data-action="toggle" ${b.hidden ? '' : 'checked'}> виден</label>
                                    <button class="btn-ghost" data-action="edit" title="Редактировать">✏️</button>
                                    <button class="btn-ghost" data-action="del" title="Удалить">❌</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </details>
            `;
        }).join('');

        // Обработчики
        list.querySelectorAll('[data-add-to]').forEach(btn => {
            btn.onclick = async e => {
                e.preventDefault();
                const slotKey = btn.dataset.addTo;
                const text = await promptModal('Новый вариант', { multiline: true });
                if (!text) return;
                await saveBlock({ nicheId: niche.id, slotKey, text, hidden: false, useCount: 0 });
                toast('Добавлено', 'success');
            };
        });
        list.querySelectorAll('.block-item').forEach(el => {
            const id = el.dataset.id;
            const block = store.state.blocks.find(b => b.id === id);
            el.querySelector('[data-action="toggle"]').onchange = () => toggleBlockHidden(block);
            el.querySelector('[data-action="edit"]').onclick = async () => {
                const text = await promptModal('Редактировать блок', { value: block.text, multiline: true });
                if (!text) return;
                await saveBlock({ ...block, text });
                toast('Сохранено', 'success');
            };
            el.querySelector('[data-action="del"]').onclick = async () => {
                const ok = await confirmModal('Удалить вариант?');
                if (!ok) return;
                await deleteBlock(id);
                toast('Удалено', 'success');
            };
        });
    };

    search.oninput = render;
    render();
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
