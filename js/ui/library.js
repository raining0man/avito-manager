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
