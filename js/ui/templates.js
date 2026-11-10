import { store } from '../store.js';
import { updateTemplateStatus, deleteTemplate, setTemplateAccounts } from '../actions.js';
import { toast } from './toast.js';
import { confirmModal, openModal, closeModal } from './modal.js';

export function renderTemplates(root) {
    root.innerHTML = `
        <section class="card">
            <div class="card-header">
                <h2>📦 Объявления</h2>
                <span class="count-badge" id="templates-count"></span>
            </div>
            <div class="card-body">
                <div class="filters">
                    <input id="search" type="text" placeholder="🔍 Поиск по названию/описанию">
                    <select id="filter-niche"><option value="">Все ниши</option></select>
                    <select id="filter-status">
                        <option value="">Все статусы</option>
                        <option value="active">Активно</option>
                        <option value="blocked">Заблокировано</option>
                        <option value="archived">Архив</option>
                    </select>
                </div>
            </div>
            <div class="card-body" id="list"></div>
        </section>
    `;

    const els = {
        search: root.querySelector('#search'),
        filterNiche: root.querySelector('#filter-niche'),
        filterStatus: root.querySelector('#filter-status'),
        list: root.querySelector('#list'),
        count: root.querySelector('#templates-count')
    };

    function fillNicheFilter() {
        const prev = els.filterNiche.value;
        els.filterNiche.innerHTML = '<option value="">Все ниши</option>' +
            store.state.niches.map(n => `<option value="${n.id}">${escapeHtml(n.name)}</option>`).join('');
        els.filterNiche.value = prev;
    }

    function render() {
        const q = els.search.value.trim().toLowerCase();
        const nicheId = els.filterNiche.value;
        const status = els.filterStatus.value;
        const list = store.state.templates
            .filter(t =>
                (!q || (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)) &&
                (!nicheId || t.nicheId === nicheId) &&
                (!status || (t.status || 'active') === status)
            )
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        els.count.textContent = `${list.length} / ${store.state.templates.length}`;

        if (!list.length) {
            els.list.innerHTML = `<div class="empty"><span class="empty-icon">📭</span>Объявлений нет</div>`;
            return;
        }

        els.list.innerHTML = list.map(t => {
            const accounts = store.state.placements
                .filter(p => p.templateId === t.id && !p.deletedAt)
                .map(p => store.state.accounts.find(a => a.id === p.accountId))
                .filter(Boolean);

            const status = t.status || 'active';
            const badges = accounts.map(a => `<span class="badge">${escapeHtml(a.name)}</span>`).join('');
            const niche = store.state.niches.find(n => n.id === t.nicheId);

            return `
                <div class="template-card" data-id="${t.id}">
                    <div class="template-main">
                        <div class="template-info">
                            <div class="template-title">${escapeHtml(t.title || 'Без названия')}</div>
                            <div class="template-desc">${escapeHtml(t.description || '')}</div>
                            ${t.comment ? `<div class="template-desc" style="margin-top:6px;">💬 ${escapeHtml(t.comment)}</div>` : ''}
                        </div>
                        <div class="template-actions">
                            <button class="btn-ghost" data-action="copy" title="Копировать описание">📋</button>
                            <button class="btn-ghost" data-action="accounts" title="Привязать аккаунты">👤</button>
                            <button class="btn-ghost" data-action="del" title="Удалить">❌</button>
                        </div>
                    </div>
                    <div class="template-footer">
                        <div class="badges">
                            ${niche ? `<span class="badge" style="background:transparent;border:1px solid var(--border);">${escapeHtml(niche.name)}</span>` : ''}
                            ${badges}
                        </div>
                        <select class="status-select status-${status}" data-action="status">
                            <option value="active"   ${status === 'active'   ? 'selected' : ''}>Активно</option>
                            <option value="blocked"  ${status === 'blocked'  ? 'selected' : ''}>Заблокировано</option>
                            <option value="archived" ${status === 'archived' ? 'selected' : ''}>Архив</option>
                        </select>
                    </div>
                </div>
            `;
        }).join('');

        els.list.querySelectorAll('.template-card').forEach(card => {
            const id = card.dataset.id;
            card.querySelector('[data-action="copy"]').onclick = () => {
                const t = store.state.templates.find(x => x.id === id);
                if (t) navigator.clipboard.writeText(t.description || '').then(() => toast('Скопировано', 'success'));
            };
            card.querySelector('[data-action="accounts"]').onclick = () => openAccounts(id);
            card.querySelector('[data-action="del"]').onclick = async () => {
                const ok = await confirmModal('Удалить объявление?');
                if (!ok) return;
                await deleteTemplate(id);
                toast('Удалено', 'success');
            };
            card.querySelector('[data-action="status"]').onchange = e => {
                updateTemplateStatus(id, e.target.value);
            };
        });
    }

    function openAccounts(templateId) {
        const t = store.state.templates.find(x => x.id === templateId);
        if (!t) return;
        const assignedIds = new Set(
            store.state.placements.filter(p => p.templateId === templateId && !p.deletedAt).map(p => p.accountId)
        );
        const dialog = openModal(`
            <div class="modal-title">Привязать к аккаунтам</div>
            <div class="modal-body">
                <p style="font-size:0.85rem; color:var(--text-muted);">Отметьте аккаунты, где размещено это объявление.</p>
                <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
                    ${store.state.accounts.length ? store.state.accounts.map(a => `
                        <label style="display:flex; gap:8px; align-items:center; cursor:pointer;">
                            <input type="checkbox" value="${a.id}" ${assignedIds.has(a.id) ? 'checked' : ''}>
                            <span>${escapeHtml(a.name)}</span>
                        </label>
                    `).join('') : '<p>Нет аккаунтов.</p>'}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-action="cancel">Отмена</button>
                <button class="btn btn-primary" data-action="confirm">Сохранить</button>
            </div>
        `);
        dialog.querySelector('[data-action="cancel"]').onclick = () => closeModal();
        dialog.querySelector('[data-action="confirm"]').onclick = async () => {
            const ids = [...dialog.querySelectorAll('input[type="checkbox"]:checked')].map(i => i.value);
            await setTemplateAccounts(templateId, ids);
            closeModal();
            toast('Привязки сохранены', 'success');
        };
    }

    els.search.oninput = render;
    els.filterNiche.onchange = render;
    els.filterStatus.onchange = render;

    fillNicheFilter();
    render();

    return store.subscribe((state) => {
        // перерисовываем на любые изменения
        fillNicheFilter();
        render();
    });
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
