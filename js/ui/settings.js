import { store } from '../store.js';
import {
    downloadBackup, exportAll, validateBackup, applyBackup,
    listSnapshots, restoreSnapshot, maybeAutoSnapshot,
    persistCache, clearCache
} from '../backup.js';
import { toast } from './toast.js';
import { confirmModal, openModal, closeModal } from './modal.js';

export function renderSettings(root) {
    function render() {
        const sync = store.state.sync;
        root.innerHTML = `
            <section class="card">
                <div class="card-header"><h2>⚙️ Настройки</h2></div>
                <div class="card-body">
                    <div class="input-group">
                        <label>Статус синхронизации</label>
                        <div style="font-size:0.9rem;">
                            <b>${sync.status}</b>
                            · не отправлено: ${sync.pendingWrites}
                            ${sync.error ? `<br><span style="color:var(--danger);">${escapeHtml(sync.error)}</span>` : ''}
                        </div>
                    </div>
                </div>
            </section>

            <section class="card">
                <div class="card-header"><h2>💾 Бэкап</h2></div>
                <div class="card-body">
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="btn btn-primary" id="btn-download">📥 Скачать JSON</button>
                        <button class="btn btn-secondary" id="btn-snapshot">☁️ Сделать снапшот в облако</button>
                        <button class="btn btn-secondary" id="btn-restore">📂 Восстановить из снапшота</button>
                        <button class="btn btn-secondary" id="btn-cache">🗃 Сохранить кэш</button>
                        <button class="btn btn-danger" id="btn-clear-cache">🧹 Очистить кэш</button>
                    </div>
                    <p style="font-size:0.8rem; color:var(--text-muted); margin-top:10px;">
                        Автоматически создаётся один снапшот в сутки (хранятся последние 7).
                    </p>
                </div>
            </section>

            <section class="card">
                <div class="card-header"><h2>🎨 Тема</h2></div>
                <div class="card-body">
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="btn btn-secondary" data-theme="light">☀️ Светлая</button>
                        <button class="btn btn-secondary" data-theme="dark">🌙 Тёмная</button>
                        <button class="btn btn-secondary" data-theme="auto">🖥 Системная</button>
                    </div>
                </div>
            </section>

            <section class="card">
                <div class="card-header"><h2>⚠️ Опасная зона</h2></div>
                <div class="card-body">
                    <p style="font-size:0.85rem; color:var(--text-muted);">
                        Импорт заменит все текущие данные содержимым файла. Перед импортом сделайте экспорт.
                    </p>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <label class="btn btn-danger">
                            📤 Импорт JSON
                            <input type="file" id="import-file-2" accept=".json" hidden>
                        </label>
                    </div>
                </div>
            </section>
        `;

        root.querySelector('#btn-download').onclick = async () => {
            try { await downloadBackup(); toast('Экспорт готов', 'success'); }
            catch (e) { toast('Ошибка: ' + e.message, 'error'); }
        };
        root.querySelector('#btn-snapshot').onclick = async () => {
            try {
                // ручной снапшот (не через maybeAutoSnapshot, чтобы создать принудительно)
                const data = await exportAll();
                const { db, doc, setDoc } = await import('../firebase.js');
                const date = new Date().toISOString().slice(0, 10) + '_manual_' + Date.now();
                await setDoc(doc(db, 'backups', date), {
                    createdAt: Date.now(),
                    manual: true,
                    collections: {
                        niches: data.niches, blocks: data.blocks, templates: data.templates,
                        accounts: data.accounts, placements: data.placements
                    }
                });
                toast('Снапшот создан', 'success');
            } catch (e) { toast('Ошибка: ' + e.message, 'error'); }
        };
        root.querySelector('#btn-restore').onclick = () => openRestoreDialog();
        root.querySelector('#btn-cache').onclick = () => {
            persistCache();
            toast('Кэш сохранён', 'success');
        };
        root.querySelector('#btn-clear-cache').onclick = async () => {
            const ok = await confirmModal('Очистить локальный кэш?', 'Данные в облаке не пострадают.');
            if (!ok) return;
            clearCache();
            toast('Кэш очищен', 'info');
        };

        root.querySelectorAll('[data-theme]').forEach(btn => {
            btn.onclick = () => applyTheme(btn.dataset.theme);
        });
        root.querySelector('#import-file-2').onchange = async e => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                const { ok, error, data } = validateBackup(parsed);
                if (!ok) return toast('Неверный файл: ' + error, 'error');
                const confirm = await confirmModal('Заменить всё содержимое?', 'Текущие данные будут скрыты, импорт станет активным.');
                if (!confirm) return;
                await applyBackup(data, { mode: 'replace' });
                toast('Импорт выполнен', 'success');
            } catch (err) {
                toast('Ошибка: ' + err.message, 'error');
            } finally {
                e.target.value = '';
            }
        };
    }

    async function openRestoreDialog() {
        const snaps = await listSnapshots();
        if (!snaps.length) return toast('Нет снапшотов', 'warning');
        const dialog = openModal(`
            <div class="modal-title">Восстановить из снапшота</div>
            <div class="modal-body">
                ${snaps.map(s => `
                    <div class="block-item">
                        <span class="block-text">${s.id}</span>
                        <button class="btn btn-sm btn-secondary" data-snap="${s.id}">Восстановить</button>
                    </div>
                `).join('')}
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-action="close">Закрыть</button>
            </div>
        `);
        dialog.querySelector('[data-action="close"]').onclick = () => closeModal();
        dialog.querySelectorAll('[data-snap]').forEach(btn => {
            btn.onclick = async () => {
                const ok = await confirmModal('Восстановить?', 'Текущие данные будут заменены.');
                if (!ok) return;
                await restoreSnapshot(btn.dataset.snap);
                closeModal();
                toast('Восстановлено', 'success');
            };
        });
    }

    render();
    return store.subscribe(render);
}

// ==========================================
// Тема
// ==========================================
export function applyTheme(mode) {
    let resolved = mode;
    if (mode === 'auto') {
        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', resolved);
    localStorage.setItem('theme', mode);
}

export function initTheme() {
    const saved = localStorage.getItem('theme') || 'auto';
    applyTheme(saved);
    // переключатель в хедере
    const btn = document.getElementById('btn-theme');
    if (btn) btn.onclick = () => {
        const cur = localStorage.getItem('theme') || 'auto';
        const next = cur === 'auto' ? 'light' : cur === 'light' ? 'dark' : 'auto';
        applyTheme(next);
    };
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
