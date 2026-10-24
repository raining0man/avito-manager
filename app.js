document.addEventListener('DOMContentLoaded', () => {
    if (!window.db || !window.auth) {
        console.error("Firebase не загружен!");
        document.getElementById('sync-status').textContent = "Ошибка Firebase";
        return;
    }

    window.signInAnonymously(window.auth).then(() => {
        startSync();
    }).catch((error) => {
        console.error("Ошибка авторизации:", error);
        document.getElementById('sync-status').textContent = "Ошибка авторизации";
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
                    placements: data.placements || [] // Новый массив для галочек
                };
            } else {
                window.setDoc(docRef, currentData);
            }
            
            statusEl.textContent = "Синхронизировано";
            statusEl.style.color = "#10b981"; 
            
            renderAll();
        }, (error) => {
            document.getElementById('sync-status').textContent = "Локально (нет сети)";
            document.getElementById('sync-status').style.color = "#ef4444";
        });
    }

    function saveData() {
        const docRef = window.doc(window.db, "data/main");
        window.setDoc(docRef, currentData, { merge: true }).then(() => {
            console.log("Сохранено");
        }).catch((err) => console.error("Ошибка:", err));
    }

    function renderAll() {
        renderAccounts();
        renderTemplates();
        renderMatrix(); // Вызов отрисовки матрицы
    }

    function renderAccounts() {
        const container = document.getElementById('accounts-list');
        container.innerHTML = '';
        if (currentData.accounts.length === 0) {
            container.innerHTML = '<p style="color: #888;">Здесь будут аккаунты</p>';
            return;
        }
        currentData.accounts.forEach(acc => {
            const div = document.createElement('div');
            div.className = 'item';
            div.innerHTML = `
                <div class="item-info">
                    <h3>${acc.name}</h3>
                    <p>${acc.platform || 'Без площадки'}</p>
                </div>
                <div class="item-actions">
                    <button onclick="window.deleteAccount('${acc.id}')">❌</button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    function renderTemplates() {
        const container = document.getElementById('templates-list');
        container.innerHTML = '';
        if (currentData.templates.length === 0) {
            container.innerHTML = '<p style="color: #888;">Здесь будут тексты</p>';
            return;
        }
        currentData.templates.forEach(temp => {
            const div = document.createElement('div');
            div.className = 'item';
            div.innerHTML = `
                <div class="item-info">
                    <h3>${temp.title}</h3>
                    <p>${temp.description.substring(0, 40)}...</p>
                </div>
                <div class="item-actions">
                    <button onclick="window.copyTemplate('${temp.id}')">📋</button>
                    <button onclick="window.deleteTemplate('${temp.id}')">❌</button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    // --- ОТРИСОВКА МАТРИЦЫ ---
    function renderMatrix() {
        const container = document.getElementById('matrix-container');
        container.innerHTML = '';

        if (currentData.accounts.length === 0 || currentData.templates.length === 0) {
            container.innerHTML = '<p style="color: #888;">Добавьте хотя бы один аккаунт и один текст, чтобы увидеть матрицу.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'matrix-table';

        // Шапка таблицы (Аккаунты)
        const thead = document.createElement('thead');
        let headerRow = '<tr><th>Текст \\ Аккаунт</th>';
        currentData.accounts.forEach(acc => {
            headerRow += `<th>${acc.name}</th>`;
        });
        headerRow += '</tr>';
        thead.innerHTML = headerRow;
        table.appendChild(thead);

        // Тело таблицы (Шаблоны)
        const tbody = document.createElement('tbody');
        currentData.templates.forEach(temp => {
            const tr = document.createElement('tr');
            // Первая колонка - название текста
            tr.innerHTML = `<td class="row-title">${temp.title}</td>`;

            // Колонки с галочками
            currentData.accounts.forEach(acc => {
                // Ищем, есть ли размещение для этой пары (текст + аккаунт)
                const isPlaced = currentData.placements.find(p => p.templateId === temp.id && p.accountId === acc.id);
                const cell = document.createElement('td');
                cell.className = 'matrix-cell';
                cell.innerHTML = isPlaced ? '<span class="check">✅</span>' : '<span class="empty">—</span>';
                
                // Обработчик клика для установки/снятия галочки
                cell.onclick = () => togglePlacement(temp.id, acc.id);
                
                tr.appendChild(cell);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        container.appendChild(table);
    }

    // --- ЛОГИКА ГАЛОЧЕК ---
    window.togglePlacement = function(templateId, accountId) {
        const existingIndex = currentData.placements.findIndex(
            p => p.templateId === templateId && p.accountId === accountId
        );

        if (existingIndex > -1) {
            // Если галочка есть - удаляем
            currentData.placements.splice(existingIndex, 1);
        } else {
            // Если нет - добавляем
            currentData.placements.push({
                id: 'plc_' + Date.now() + Math.random().toString(36).substr(2, 5),
                templateId: templateId,
                accountId: accountId,
                date: new Date().toISOString()
            });
        }
        saveData(); // Сохраняем изменения
    };

    // --- ФУНКЦИИ ДОБАВЛЕНИЯ/УДАЛЕНИЯ ---
    window.openForm = function(type) {
        if (type === 'account') {
            const name = prompt("Название аккаунта (например, Авито-1):");
            if (!name) return;
            const platform = prompt("Площадка (Авито, Юла):", "Авито");
            currentData.accounts.push({ id: 'acc_' + Date.now(), name, platform });
            saveData();
        }
        if (type === 'template') {
            const title = prompt("Короткое название (например, Пороги - Вариант 1):");
            if (!title) return;
            const description = prompt("Вставьте сам текст объявления:");
            if (!description) return;
            currentData.templates.push({ id: 'temp_' + Date.now(), title, description });
            saveData();
        }
    };

    window.deleteAccount = function(id) {
        if (!confirm("Удалить аккаунт? Все галочки этого аккаунта тоже удалятся.")) return;
        currentData.accounts = currentData.accounts.filter(a => a.id !== id);
        currentData.placements = currentData.placements.filter(p => p.accountId !== id);
        saveData();
    };

    window.deleteTemplate = function(id) {
        if (!confirm("Удалить текст? Все галочки этого текста тоже удалятся.")) return;
        currentData.templates = currentData.templates.filter(t => t.id !== id);
        currentData.placements = currentData.placements.filter(p => p.templateId !== id);
        saveData();
    };

    window.copyTemplate = function(id) {
        const temp = currentData.templates.find(t => t.id === id);
        if (temp) {
            navigator.clipboard.writeText(temp.description).then(() => {
                alert("Текст скопирован! Можно вставлять.");
            });
        }
    };

    document.querySelectorAll('.btn-add')[0].onclick = () => window.openForm('account');
    document.querySelectorAll('.btn-add')[1].onclick = () => window.openForm('template');
});
