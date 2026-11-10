import { auth, signInAnonymously, onAuthStateChanged } from './firebase.js';
import { store } from './store.js';
import { startSync, migrateIfNeeded } from './sync.js';
import { mountLayout } from './ui/layout.js';
import { initTheme } from './ui/settings.js';
import { loadCache, persistCache, maybeAutoSnapshot } from './backup.js';
import { toast } from './ui/toast.js';
import { downloadBackup } from './backup.js';

async function init() {
    initTheme();
    mountLayout();

    // Кэш из localStorage (быстрый старт)
    loadCache();
    store.setState({
        sync: { ...store.state.sync, status: 'connecting' }
    });

    // Экспорт/импорт из хедера
    document.getElementById('btn-export').onclick = async () => {
        try { await downloadBackup(); toast('Скачано', 'success'); }
        catch (e) { toast('Ошибка: ' + e.message, 'error'); }
    };
    document.getElementById('import-file').onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        const { validateBackup, applyBackup } = await import('./backup.js');
        const { confirmModal } = await import('./ui/modal.js');
        try {
            const parsed = JSON.parse(await file.text());
            const { ok, error, data } = validateBackup(parsed);
            if (!ok) return toast('Неверный файл: ' + error, 'error');
            const confirm = await confirmModal('Импортировать базу?', 'Текущие данные будут заменены.');
            if (!confirm) return;
            await applyBackup(data);
            toast('Импорт выполнен', 'success');
        } catch (err) {
            toast('Ошибка: ' + err.message, 'error');
        } finally {
            e.target.value = '';
        }
    };

    // Авторизация
    try {
        await signInAnonymously(auth);
    } catch (e) {
        console.error('auth:', e);
        store.setState({
            sync: { ...store.state.sync, status: 'error', error: e.message }
        });
        toast('Ошибка авторизации: ' + e.message, 'error', 10000);
        return;
    }

    onAuthStateChanged(auth, async user => {
        if (!user) return;
        await migrateIfNeeded();
        startSync();

        // периодически сохраняем кэш и делаем авто-снапшот
        setTimeout(() => { persistCache(); maybeAutoSnapshot(); }, 4000);
        setInterval(() => persistCache(), 30000);

        // оффлайн/онлайн индикатор
        window.addEventListener('offline', () => {
            store.setState({ sync: { ...store.state.sync, status: 'error', error: 'offline' } });
        });
        window.addEventListener('online', () => {
            store.setState({ sync: { ...store.state.sync, status: 'saving' } });
        });
    });
}

init();
