document.addEventListener('DOMContentLoaded', () => {
    // Проверяем, загрузился ли Firebase из index.html
    if (!window.db || !window.auth) {
        console.error("Firebase не загружен!");
        document.getElementById('sync-status').textContent = "Ошибка Firebase";
        return;
    }

    // 1. Авторизация
    window.signInAnonymously(window.auth).then(() => {
        console.log("Авторизация успешна");
        startSync();
    }).catch((error) => {
        console.error("Ошибка авторизации:", error);
        document.getElementById('sync-status').textContent = "Ошибка авторизации";
    });

    let currentData = { accounts: [], templates: [] };

    // 2. Синхронизация с Firestore
    function startSync() {
        const docRef = window.doc(window.db, "data/main");
        
        window.onSnapshot(docRef, (docSnap) => {
            const statusEl = document.getElementById('sync-status');
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                currentData = {
                    accounts: data.accounts || [],
                    templates: data.templates || []
                };
            } else {
                // Если базы еще нет, создаем пустую
                window.setDoc(docRef, currentData);
            }
            
            // Обновляем статус (зеленый = синхронизировано)
            statusEl.textContent = "Синхронизировано";
            statusEl.style.color = "#10b981"; 
            
            renderAll();
        }, (error) => {
            console.error("Ошибка синхронизации:", error);
            document.getElementById('sync-status').textContent = "Локально (нет сети)";
            document.getElementById('sync-status').style.color = "#ef4444"; // Красный
        });
    }

    // 3. Сохранение данных
    function saveData() {
        const docRef = window.doc(window.db, "data/main");
        window.setDoc(docRef, currentData, { merge: true }).then(() => {
            console.log("Данные успешно сохранены в Firebase");
        }).catch((err) => {
            console.error("Ошибка сохранения:", err);
            alert("Ошибка при сохранении. Проверьте интернет.");
        });
    }

    // 4. Отрисовка интерфейса
    function renderAll() {
        renderAccounts();
        renderTemplates();
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
                    <p>Площадка: ${acc.platform || 'Не указана'}</p>
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
                    <p>${temp.description.substring(0, 60)}...</p>
                </div>
                <div class="item-actions">
                    <button onclick="window.copyTemplate('${temp.id}')" title="Скопировать текст">📋</button>
                    <button onclick="window.deleteTemplate('${temp.id}')" title="Удалить">❌</button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    // 5. Глобальные функции для кнопок
    window.openForm = function(type) {
        if (type === 'account') {
            const name = prompt("Название аккаунта (например, Авито Аккаунт 1):");
            if (!name) return;
            const platform = prompt("Площадка (Авито, Юла и т.д.):", "Авито");
            
            const newAccount = { id: 'acc_' + Date.now(), name, platform };
            currentData.accounts.push(newAccount);
            saveData();
        }
        
        if (type === 'template') {
            const title = prompt("Короткое название (например, Пороги - Вариант 1):");
            if (!title) return;
            const description = prompt("Вставьте сам текст объявления:");
            if (!description) return;
            
            const newTemplate = { id: 'temp_' + Date.now(), title, description };
            currentData.templates.push(newTemplate);
            saveData();
        }
    };

    window.deleteAccount = function(id) {
        if (!confirm("Удалить этот аккаунт?")) return;
        currentData.accounts = currentData.accounts.filter(a => a.id !== id);
        saveData();
    };

    window.deleteTemplate = function(id) {
        if (!confirm("Удалить этот текст?")) return;
        currentData.templates = currentData.templates.filter(t => t.id !== id);
        saveData();
    };

    window.copyTemplate = function(id) {
        const temp = currentData.templates.find(t => t.id === id);
        if (temp) {
            navigator.clipboard.writeText(temp.description).then(() => {
                alert("Текст скопирован в буфер обмена! Можно вставлять на Авито.");
            }).catch(err => {
                console.error('Ошибка копирования: ', err);
            });
        }
    };

    // Привязка кнопок "+ Добавить" из HTML к нашим функциям
    document.querySelectorAll('.btn-add')[0].onclick = () => window.openForm('account');
    document.querySelectorAll('.btn-add')[1].onclick = () => window.openForm('template');
});
