import { store } from '../store.js';
import { saveAccount, deleteAccount } from '../actions.js';
import { toast } from './toast.js';
import { promptModal, confirmModal } from './modal.js';

export function renderAccounts(root) {
    root.innerHTML = `
        <section class="card">
            <div class="card-header">
                <h2>👥 Аккаунты</h2>
                <button class="btn btn-primary" id="btn-add">+ Добавить</button>
            </div>
            <div class="card-body" id="list"></div>
        </section>
    `;
    const list = root.querySelector('#list');
    root.querySelector('#btn-add').onclick = async () => {
        const name = await promptModal('Новый аккаунт', { label: 'Название' });
        if (!name) return;
        const platform = await promptModal('Платформа', { label: 'Авито / Юла / другое', value: 'Авито' });
        await saveAccount({ name, platform: platform || 'Авито', archived: false });
        toast('Добавлено', 'success');
    };

    const render = () => {
        if (!store.state.accounts.length) {
            list.innerHTML = `<div class="empty"><span class="empty-icon">👤</span>Аккаунты появятся здесь</div>`;
            return;
        }
        list.innerHTML = store.state.accounts.map(acc => {
            const count = store.state.placements.filter(p => p.accountId === acc.id && !p.deletedAt).length;
            return `
                <div class="template-card" data-id="${acc.id}">
                    <div class="template-main">
                        <div class="template-info">
                            <div class="template-title">${escapeHtml(acc.name)}</div>
                            <div class="template-desc">${escapeHtml(acc.platform || '')} · ${count} объявлений</div>
                        </div>
                        <div class="template-actions">
                            <button class="btn-ghost" data-action="edit">✏️</button>
                            <button class="btn-ghost" data-action="del">❌</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        list.querySelectorAll('.template-card').forEach(card => {
            const id = card.dataset.id;
            const acc = store.state.accounts.find(a => a.id === id);
            card.querySelector('[data-action="edit"]').onclick = async () => {
                const name = await promptModal('Переименовать', { value: acc.name });
                if (!name) return;
                const platform = await promptModal('Платформа', { value: acc.platform || 'Авито' });
                await saveAccount({ ...acc, name, platform: platform || 'Авито' });
            };
            card.querySelector('[data-action="del"]').onclick = async () => {
                const ok = await confirmModal('Удалить аккаунт?', 'Привязки к объявлениям тоже будут скрыты.');
                if (!ok) return;
                await deleteAccount(id);
                toast('Удалено', 'success');
            };
        });
    };
    render();
    return store.subscribe(render);
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
