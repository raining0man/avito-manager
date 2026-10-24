document.addEventListener('DOMContentLoaded', () => {
    if (!window.db || !window.auth) return;

    window.signInAnonymously(window.auth).then(() => {
        startSync();
    });

    let currentData = { accounts: [], templates: [], placements: [] };

    function startSync() {
        const docRef = window.doc(window.db, "data/main");
        window.onSnapshot(docRef, (docSnap) => {
            const statusEl = document.getElementById('sync-status');
            if (docSnap.exists()) {
                const data = docSnap.data();
                currentData = {
                    accounts: data.accounts || [],
                    templates: data.templates || [],
                    placements: data.placements || []
                };
            } else {
                window.setDoc(docRef, currentData);
            }
            statusEl.textContent = "Синхронизировано";
            statusEl.style.color = "#10b981";
            renderAll();
        });
    }

    function saveData() {
        const docRef = window.doc(window.db, "data/main");
        window.setDoc(docRef, currentData, { merge: true });
    }

    function renderAll() {
        renderAccounts();
        renderTemplates();
        renderMatrix();
    }

    // --- ОТРИСОВКА СПИСКОВ ---
    function renderAccounts() {
        const container = document.getElementById('accounts-list');
        container.innerHTML = currentData.accounts.length ? '' : '<p style="color: #888;">Здесь будут аккаунты</p>';
        
        currentData.accounts.forEach(acc => {
            const div = document.createElement('div');
            div.className = 'item';
            div.innerHTML = `
                <div class="item-info">
                    <h3>${acc.name}</h3>
                    <p>${acc.platform || 'Без площадки'}</p>
                </div>
                <div class="item-actions">
                    <button onclick="window.openModal('account', '${acc.id}')" title="Редактировать">✏️</button>
                    <button onclick="window.deleteAccount('${acc.id}')" title="Удалить">❌</button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    function renderTemplates() {
        const container = document.getElementById('templates-list');
        container.innerHTML = currentData.templates.length ? '' : '<p style="color: #888;">Здесь будут тексты</p>';
        
        currentData.templates.forEach(temp => {
            const div = document.createElement('div');
            div.className = 'item';
            div.innerHTML = `
                <div class="item-info">
                    <h3>${temp.title}</h3>
                    <p>${temp.description.substring(0, 40)}...</p>
                </div>
                <div class="item-actions">
                    <button onclick="window.copyTemplate('${temp.id}')" title="Скопировать">📋</button>
                    <button onclick="window.openModal('template', '${temp.id}')" title="Редактировать">✏️</button>
                    <button onclick="window.deleteTemplate('${temp.id}')" title="Удалить">❌</button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    // --- МАТРИЦА (Осталась без изменений) ---
    function renderMatrix() {
        const container = document.getElementById('matrix-container');
        container.innerHTML = '';

        if (currentData.accounts.length === 0 || currentData.templates.length === 0) {
            container.innerHTML = '<p style="color: #888;">Добавьте аккаунты и тексты.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'matrix-table';

        const thead = document.createElement('thead');
        let headerRow = '<tr><th>Текст \\ Аккаунт</th>';
        currentData.accounts.forEach(acc => headerRow += `<th>${acc.name}</th>`);
        headerRow += '</tr>';
        thead.innerHTML = headerRow;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        currentData.templates.forEach(temp => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="row-title">${temp.title}</td>`;
            currentData.accounts.forEach(acc => {
                const isPlaced = currentData.placements.find(p => p.templateId === temp.id && p.accountId === acc.id);
                const cell = document.createElement('td');
                cell.className = 'matrix-cell';
                cell.innerHTML = isPlaced ? '<span class="check">✅</span>' : '<span class="empty">—</span>';
                cell.onclick = () => window.togglePlacement(temp.id, acc.id);
                tr.appendChild(cell);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        container.appendChild(table);
    }

    window.togglePlacement = function(templateId, accountId) {
        const idx = currentData.placements.findIndex(p => p.templateId === templateId && p.accountId === accountId);
        if (idx > -1) {
            currentData.placements.splice(idx, 1);
        } else {
            currentData.placements.push({ id: 'plc_' + Date.now(), templateId, accountId, date: new Date().toISOString() });
        }
        saveData();
    };

    // --- УПРАВЛЕНИЕ МОДАЛЬНЫМ ОКНОМ ---
    window.openModal = function(type, id = null) {
        const modal = document.getElementById('edit-modal');
        const title = document.getElementById('modal-title');
        const f1 = document.getElementById('field-1');
        const f2 = document.getElementById('field-2');
        const l1 = document.getElementById('label-1');
        const l2 = document.getElementById('label-2');
        
        modal.dataset.type = type;
        modal.dataset.id = id || '';

        if (type === 'account') {
            title.textContent = id ? 'Редактировать аккаунт' : 'Новый аккаунт';
            l1.textContent = 'Название аккаунта';
            l2.textContent = 'Площадка (Авито, Юла и т.д.)';
            f2.rows = 1; // Уменьшаем поле для аккаунта
            
            if (id) {
                const acc = currentData.accounts.find(a => a.id === id);
                f1.value = acc.name;
                f2.value = acc.platform || '';
            } else {
                f1.value = '';
                f2.value = 'Авито';
            }
        } 
        else if (type === 'template') {
            title.textContent = id ? 'Редактировать текст' : 'Новый текст';
            l1.textContent = 'Название (для себя)';
            l2.textContent = 'Текст объявления';
            f2.rows = 12; // Возвращаем большое поле для текста
            
            if (id) {
                const temp = currentData.templates.find(t => t.id === id);
                f1.value = temp.title;
                f2.value = temp.description;
            } else {
                f1.value = '';
                f2.value = '';
            }
        }
        modal.showModal();
    };

    window.saveModal = function() {
        const modal = document.getElementById('edit-modal');
        const type = modal.dataset.type;
        const id = modal.dataset.id;
        const val1 = document.getElementById('field-1').value.trim();
        const val2 = document.getElementById('field-2').value.trim();

        if (!val1) return alert("Заполните название");

        if (type === 'account') {
            if (id) {
                const acc = currentData.accounts.find(a => a.id === id);
                acc.name = val1;
                acc.platform = val2;
            } else {
                currentData.accounts.push({ id: 'acc_' + Date.now(), name: val1, platform: val2 });
            }
        } 
        else if (type === 'template') {
            if (!val2) return alert("Вставьте текст объявления");
            if (id) {
                const temp = currentData.templates.find(t => t.id === id);
                temp.title = val1;
                temp.description = val2;
            } else {
                currentData.templates.push({ id: 'temp_' + Date.now(), title: val1, description: val2 });
            }
        }

        saveData();
        modal.close();
    };

    window.deleteAccount = function(id) {
        if (!confirm("Удалить аккаунт?")) return;
        currentData.accounts = currentData.accounts.filter(a => a.id !== id);
        currentData.placements = currentData.placements.filter(p => p.accountId !== id);
        saveData();
    };

    window.deleteTemplate = function(id) {
        if (!confirm("Удалить текст?")) return;
        currentData.templates = currentData.templates.filter(t => t.id !== id);
        currentData.placements = currentData.placements.filter(p => p.templateId !== id);
        saveData();
    };

    window.copyTemplate = function(id) {
        const temp = currentData.templates.find(t => t.id === id);
        if (temp) navigator.clipboard.writeText(temp.description).then(() => alert("Скопировано!"));
    };

    // Привязка кнопок
    document.querySelectorAll('.btn-add')[0].onclick = () => window.openModal('account');
    document.querySelectorAll('.btn-add')[1].onclick = () => window.openModal('template');
});
