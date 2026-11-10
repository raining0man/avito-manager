import { store } from '../store.js';
import { renderBuilder } from './builder.js';
import { renderLibrary } from './library.js';
import { renderTemplates } from './templates.js';
import { renderAccounts } from './accounts.js';
import { renderAnalytics } from './analytics.js';
import { renderSettings } from './settings.js';

const ROUTES = [
    { id: 'builder',   icon: '🏗',  label: 'Конструктор', render: renderBuilder },
    { id: 'library',   icon: '📚', label: 'Библиотека',  render: renderLibrary },
    { id: 'templates', icon: '📦', label: 'Объявления',  render: renderTemplates },
    { id: 'accounts',  icon: '👥', label: 'Аккаунты',    render: renderAccounts },
    { id: 'analytics', icon: '📊', label: 'Аналитика',   render: renderAnalytics },
    { id: 'settings',  icon: '⚙️', label: 'Настройки',   render: renderSettings }
];

let currentCleanup = null;
let currentRoute = null;

export function navigate(routeId) {
    const route = ROUTES.find(r => r.id === routeId) || ROUTES[0];
    if (currentRoute === route.id) return;
    if (typeof currentCleanup === 'function') currentCleanup();
    currentCleanup = null;
    currentRoute = route.id;
    localStorage.setItem('activeTab', route.id);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === route.id);
    });

    const root = document.getElementById('app-main');
    root.innerHTML = '';
    currentCleanup = route.render(root) || null;
}

export function mountLayout() {
    const tabsEl = document.getElementById('main-tabs');
    tabsEl.innerHTML = ROUTES.map(r => `
        <button class="tab-btn" data-tab="${r.id}" role="tab">
            <span class="tab-icon">${r.icon}</span>
            <span class="tab-label">${r.label}</span>
        </button>
    `).join('');
    tabsEl.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => navigate(btn.dataset.tab);
    });

    // синк-пилюля
    const pill = document.getElementById('sync-status');
    const setPill = (status, text) => {
        pill.className = 'sync-pill sync-' + status;
        pill.textContent = text;
    };
    store.subscribe(state => {
        const s = state.sync;
        if (s.status === 'connecting') setPill('connecting', 'Подключение…');
        else if (s.status === 'saving') setPill('saving', 'Сохранение…');
        else if (s.status === 'online') setPill('online', 'Синхронизировано');
        else if (s.status === 'error') setPill('error', 'Ошибка');
    });

    // стартовый таб
    const saved = localStorage.getItem('activeTab') || 'builder';
    navigate(ROUTES.some(r => r.id === saved) ? saved : 'builder');
}
