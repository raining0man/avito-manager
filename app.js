document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('sync-status');
    
    if (!window.db || !window.auth) {
        statusEl.textContent = "Ошибка: Firebase не загрузился!";
        statusEl.style.color = "#ef4444";
        return;
    }

    statusEl.textContent = "Авторизация...";
    
    window.signInAnonymously(window.auth).then(() => {
        statusEl.textContent = "Синхронизация...";
        startSync();
    }).catch((error) => {
        console.error("Ошибка авторизации:", error);
        statusEl.textContent = error.code === 'auth/network-request-failed' ? "Ошибка сети! Отключите VPN" : "Ошибка входа";
        statusEl.style.color = "#ef4444";
    });

    const initialBlocks = {
        universal: {
            photo: ["Просьба - присылайте фото авто целиком и фото поврежденного участка на удалении и вблизи. Если причиной поломки было ДТП, кратко изложите подробности.", "Для точной оценки скиньте общий вид машины и сам дефект (издалека и крупным планом)."],
            visit: ["А лучше приезжайте на бесплатный осмотр! Покажем фронт работ и проконсультируем.", "Запишитесь на бесплатный осмотр. Мастер всё проверит, а вы уже решите."],
            brands: ["Работаем с авто: Lada, УАЗ, ГАЗ, Toyota, Nissan, VW, BMW, Mercedes, Audi, Mazda, Kia, Hyundai.", "Обслуживаем все популярные марки: BMW, Mercedes-Benz, Audi, Toyota, Kia, Hyundai, Skoda, Lada."],
            location: ["📍 Находимся в 5 минутах от м. Старая Деревня.\nНапишите или позвоните — забронируем место.", "📍 Мы в 5 минутах от м. Старая Деревня.\nОставьте сообщение — ответим и предложим время."]
        },
        niches: {
            "thresholds": {
                name: "Кузовной ремонт / Переварка порогов",
                titles: ["Переварка порогов с лужением", "Сварка порогов с антикором", "Качественный ремонт порогов"],
                problem: ["Хотите забыть о ржавчине навсегда? Используем лужение оловом. Гарантия 12 месяцев.", "Сквозная ржавчина на порогах? Пора варить. Сделаем четко, с гарантией 12 месяцев."],
                process: ["🔧 Что делаем:\n— Демонтаж навесных\n— Изготовление ремвставок\n— Вырезка коррозии\n— Сварка\n— Антикор\n— Лужение оловом\n— Покраска", "Этапы:\n— Подготовка кузова\n— Вырезка гнили\n— Сварка\n— Зачистка швов\n— Антикор\n— Покраска"],
                advantages: ["💡 Почему мы:\n— Лужение оловом — 100% защита\n— Бесплатный осмотр\n— Полный цикл в одном месте", "Наши плюсы:\n— Свои ремвставки вместо «заплаток»\n— Антикор со всех сторон\n— Один сервис на все"],
                top_services: ["🛠 Топ услуг:\n— Переварка 1 или 2 порогов\n— Лужение оловом\n— Переварка арок\n— Переварка стаканов", "Что можем:\n— Полная переварка\n— Сварка с антикором\n— Косметика без сварки\n— Арки и стаканы"],
                cta: ["Напишите — забронируем место в очереди.", "Оставьте заявку — назовём точную стоимость."]
            },
            "painting": {
                name: "Малярные работы / Покраска",
                titles: ["Покраска авто в камере", "Локальная покраска элемента", "Подбор цвета и покраска"],
                problem: ["Царапины, сколы или выгоревшая краска? Вернём заводской вид. Гарантия 12 месяцев.", "Хотите обновить вид авто? Выполним покраску с идеальным подбором цвета."],
                process: ["🔧 Что входит:\n— Подготовка поверхности\n— Грунт и шпатлёвка\n— Подбор цвета\n— Покраска в камере\n— Лакировка и полировка", "Этапы:\n— Мойка и оценка\n— Шлифовка\n— Грунтование\n— Подбор цвета\n— Покраска\n— Полировка"],
                advantages: ["💡 Чем полезны:\n— Своя камера — идеальное покрытие\n— Подбор по спектрофотометру\n— Пробный образец до покраски", "Наши плюсы:\n— Любые марки\n— Качественные материалы\n— Гарантия на ЛКП"],
                top_services: ["🛠 Топ услуг:\n— Покраска элемента\n— Локальная покраска\n— Покраска переходом\n— Полировка", "Что красим:\n— Крылья, двери, бамперы\n— Локальные участки\n— Пластик\n— Полировка"],
                cta: ["Скиньте фото в чат — сориентируем по цене.", "Позвоните — подберём время для визита."]
            }
        }
    };

    let currentData = { accounts: [], templates: [], placements: [], blocks: {} };

    function startSync() {
        const docRef = window.doc(window.db, "data/main");
        window.onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                currentData = {
                    accounts: data.accounts || [],
                    templates: data.templates || [],
                    placements: data.placements || [],
                    blocks: data.blocks || {}
                };
                
                if (!currentData.blocks.universal || !currentData.blocks.niches) {
                    currentData.blocks = JSON.parse(JSON.stringify(initialBlocks));
                    saveData();
                }
            } else {
                currentData.blocks = JSON.parse(JSON.stringify(initialBlocks));
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
        initSelectors();
        renderAccounts();
        renderTemplates();
        renderMatrix();
        window.renderEditorBlocks();
    }

    function initSelectors() {
        const nicheSelect = document.getElementById('niche-select');
        const editNicheSelect = document.getElementById('edit-niche-select');
        
        nicheSelect.innerHTML = '<option value="">-- Выберите нишу --</option>';
        editNicheSelect.innerHTML = '<option value="">-- Выберите нишу --</option>';
        
        for (const key in currentData.blocks.niches) {
            nicheSelect.innerHTML += `<option value="${key}">${currentData.blocks.niches[key].name}</option>`;
            editNicheSelect.innerHTML += `<option value="${key}">${currentData.blocks.niches[key].name}</option>`;
        }
    }

    window.updateBuilderBlocks = function() {
        const nicheKey = document.getElementById('niche-select').value;
        const container = document.getElementById('block-selectors');
        const titleSelect = document.getElementById('title-select');
        
        container.innerHTML = '';
        titleSelect.innerHTML = '<option value="">-- Выбрать из готовых --</option>';

        if (!nicheKey) {
            document.getElementById('ad-preview').value = '';
            window.updateCounters();
            return;
        }

        const titles = currentData.blocks.niches[nicheKey].titles || [];
        titles.forEach(t => {
            titleSelect.innerHTML += `<option value="${t}">${t}</option>`;
        });

        const nicheBlocks = currentData.blocks.niches[nicheKey];
        
        const blockConfig = [
            { key: 'photo', label: '1. Фото', source: 'universal' },
            { key: 'visit', label: '2. Осмотр', source: 'universal' },
            { key: 'problem', label: '3. Проблема', source: 'niche' },
            { key: 'process', label: '4. Что делаем', source: 'niche' },
            { key: 'advantages', label: '5. Преимущества', source: 'niche' },
            { key: 'cta', label: '6. Призыв', source: 'niche' },
            { key: 'top_services', label: '7. Топ услуг', source: 'niche' },
            { key: 'brands', label: '8. Марки', source: 'universal' },
            { key: 'location', label: '9. Адрес', source: 'universal' }
        ];

        blockConfig.forEach(config => {
            const options = config.source === 'universal' ? currentData.blocks.universal[config.key] : nicheBlocks[config.key];
            
            if (options && options.length > 0) {
                let selectHtml = `<div class="input-group">
                    <label>${config.label}</label>
                    <div class="block-row">
                        <select class="block-select" data-key="${config.key}" data-source="${config.source}" onchange="window.assemblePreview()">
                            <option value="">-- Не использовать --</option>`;
                options.forEach((opt, index) => {
                    selectHtml += `<option value="${index}">Вариант ${index + 1}: ${opt.substring(0, 40)}...</option>`;
                });
                selectHtml += `</select>
                        <button class="btn-plus" onclick="window.addNewBlock('${nicheKey}', '${config.key}', '${config.source}')" title="Добавить новый вариант">+</button>
                    </div></div>`;
                container.innerHTML += selectHtml;
            }
        });

        window.assemblePreview();
    };

    window.addNewTitle = function() {
        const nicheKey = document.getElementById('niche-select').value;
        if (!nicheKey) return alert("Сначала выберите нишу!");
        
        const newTitle = prompt("Введите новое название (до 50 символов):");
        if (!newTitle || !newTitle.trim()) return;
        if (newTitle.length > 50) return alert("Название слишком длинное (макс. 50 символов)!");

        if (!currentData.blocks.niches[nicheKey].titles) currentData.blocks.niches[nicheKey].titles = [];
        currentData.blocks.niches[nicheKey].titles.push(newTitle.trim());
        
        saveData();
        window.updateBuilderBlocks();
    };

    window.addNewBlock = function(nicheKey, blockKey, source) {
        const newText = prompt("Введите текст нового варианта для этого блока:");
        if (!newText || !newText.trim()) return;

        if (source === 'universal') {
            if (!currentData.blocks.universal[blockKey]) currentData.blocks.universal[blockKey] = [];
            currentData.blocks.universal[blockKey].push(newText.trim());
        } else {
            if (!currentData.blocks.niches[nicheKey][blockKey]) currentData.blocks.niches[nicheKey][blockKey] = [];
            currentData.blocks.niches[nicheKey][blockKey].push(newText.trim());
        }
        saveData();
        window.updateBuilderBlocks();
    };

    window.assemblePreview = function() {
        const selects = document.querySelectorAll('.block-select');
        const parts = [];
        const nicheKey = document.getElementById('niche-select').value;

        selects.forEach(select => {
            const key = select.dataset.key;
            const source = select.dataset.source;
            const index = select.value;
            if (index !== "") {
                const text = source === 'universal' 
                    ? currentData.blocks.universal[key][index] 
                    : currentData.blocks.niches[nicheKey][key][index];
                parts.push(text);
            }
        });

        document.getElementById('ad-preview').value = parts.join('\n\n---\n\n');
        window.updateCounters();
    };

    window.updateCounters = function() {
        const title = document.getElementById('ad-title').value;
        const desc = document.getElementById('ad-preview').value;
        document.getElementById('title-count').textContent = title.length;
        document.getElementById('title-count').parentElement.className = title.length > 50 ? 'char-counter warning' : 'char-counter';
        document.getElementById('desc-count').textContent = desc.length;
        document.getElementById('desc-count').parentElement.className = desc.length > 3000 ? 'char-counter warning' : 'char-counter';
    };

    window.saveAssembledAd = function() {
        const title = document.getElementById('ad-title').value.trim();
        const description = document.getElementById('ad-preview').value.trim();
        const comment = document.getElementById('ad-comment').value.trim();
        const nicheKey = document.getElementById('niche-select').value;

        if (!title) return alert("Введите название!");
        if (!description) return alert("Выберите блоки!");
        if (!nicheKey) return alert("Выберите нишу!");

        currentData.templates.push({ id: 'temp_' + Date.now(), title, description, comment, niche: nicheKey });
        saveData();
        
        document.getElementById('ad-title').value = '';
        document.getElementById('ad-comment').value = '';
        document.getElementById('ad-preview').value = '';
        document.querySelectorAll('.block-select').forEach(s => s.value = '');
        document.getElementById('title-select').value = '';
        window.updateCounters();
    };

    window.renderEditorBlocks = function() {
        const nicheKey = document.getElementById('edit-niche-select').value;
        const container = document.getElementById('editor-container');
        container.innerHTML = '';

        if (!nicheKey) return;

        let html = `<h4 style="margin: 10px 0 5px; font-size: 0.9rem;">Названия объявлений:</h4>`;
        const titles = currentData.blocks.niches[nicheKey].titles || [];
        titles.forEach((t, i) => {
            html += `<div class="editor-block">
                <p>${t}</p>
                <button onclick="window.editBlock('${nicheKey}', 'titles', 'niche', ${i})">✏️</button>
                <button onclick="window.deleteBlock('${nicheKey}', 'titles', 'niche', ${i})">❌</button>
            </div>`;
        });

        const blockKeys = ['problem', 'process', 'advantages', 'cta', 'top_services'];
        blockKeys.forEach(bKey => {
            if (currentData.blocks.niches[nicheKey][bKey]) {
                html += `<h4 style="margin: 15px 0 5px; font-size: 0.9rem;">Блок: ${bKey}</h4>`;
                currentData.blocks.niches[nicheKey][bKey].forEach((text, i) => {
                    html += `<div class="editor-block">
                        <p>${text}</p>
                        <button onclick="window.editBlock('${nicheKey}', '${bKey}', 'niche', ${i})">✏️</button>
                        <button onclick="window.deleteBlock('${nicheKey}', '${bKey}', 'niche', ${i})">❌</button>
                    </div>`;
                });
            }
        });
        
        container.innerHTML = html;
    };

    // --- ЛОГИКА МОДАЛЬНОГО ОКНА (Аккаунты и Блоки) ---
    window.editAccount = function(id) {
        const acc = currentData.accounts.find(a => a.id === id);
        const modal = document.getElementById('edit-modal');
        
        modal.dataset.type = 'account';
        modal.dataset.id = id;

        document.getElementById('modal-title').textContent = 'Редактировать аккаунт';
        
        // Настраиваем первое поле (Название)
        document.getElementById('group-1').style.display = 'flex';
        document.getElementById('label-1').textContent = 'Название аккаунта';
        document.getElementById('field-1').value = acc.name;
        document.getElementById('field-1').type = 'text';

        // Настраиваем второе поле (Площадка)
        document.getElementById('group-2').style.display = 'flex';
        document.getElementById('label-2').textContent = 'Площадка';
        document.getElementById('field-2').value = acc.platform || '';
        document.getElementById('field-2').rows = 1;

        modal.showModal();
    };

    window.editBlock = function(nicheKey, blockKey, source, index) {
        let text = source === 'universal' ? currentData.blocks.universal[blockKey][index] : currentData.blocks.niches[nicheKey][blockKey][index];
        
        const modal = document.getElementById('edit-modal');
        
        modal.dataset.type = 'block';
        modal.dataset.nicheKey = nicheKey;
        modal.dataset.blockKey = blockKey;
        modal.dataset.source = source;
        modal.dataset.index = index;

        document.getElementById('modal-title').textContent = 'Редактировать текст';

        // Скрываем первое поле, используем только большое текстовое
        document.getElementById('group-1').style.display = 'none';
        
        document.getElementById('group-2').style.display = 'flex';
        document.getElementById('label-2').textContent = 'Текст';
        document.getElementById('field-2').value = text;
        document.getElementById('field-2').rows = 8;

        modal.showModal();
    };

    window.saveModal = function() {
        const modal = document.getElementById('edit-modal');
        const type = modal.dataset.type;

        if (type === 'account') {
            const id = modal.dataset.id;
            const name = document.getElementById('field-1').value.trim();
            const platform = document.getElementById('field-2').value.trim();
            if (!name) return alert("Название не может быть пустым");

            const acc = currentData.accounts.find(a => a.id === id);
            acc.name = name;
            acc.platform = platform;
        } 
        else if (type === 'block') {
            const newText = document.getElementById('field-2').value.trim();
            if (!newText) return alert("Текст не может быть пустым");

            const nicheKey = modal.dataset.nicheKey;
            const blockKey = modal.dataset.blockKey;
            const source = modal.dataset.source;
            const index = modal.dataset.index;
            
            if (source === 'universal') {
                currentData.blocks.universal[blockKey][index] = newText;
            } else {
                currentData.blocks.niches[nicheKey][blockKey][index] = newText;
            }
        }

        saveData();
        modal.close();
    };

    window.deleteBlock = function(nicheKey, blockKey, source, index) {
        if (!confirm("Удалить этот вариант?")) return;
        if (source === 'universal') {
            currentData.blocks.universal[blockKey].splice(index, 1);
        } else {
            currentData.blocks.niches[nicheKey][blockKey].splice(index, 1);
        }
        saveData();
    };

    // --- АККАУНТЫ ---
    window.addAccount = function() {
        const name = prompt("Название аккаунта (например, Авито-1):");
        if (!name) return;
        currentData.accounts.push({ id: 'acc_' + Date.now(), name: name, platform: 'Авито' });
        saveData();
    };

    function renderAccounts() {
        const container = document.getElementById('accounts-list');
        container.innerHTML = currentData.accounts.length ? '' : '<p style="color: #888;">Здесь будут аккаунты</p>';
        currentData.accounts.forEach(acc => {
            const div = document.createElement('div');
            div.className = 'item';
            div.innerHTML = `
                <div class="item-info"><h3>${acc.name}</h3><p>${acc.platform || 'Без площадки'}</p></div>
                <div class="item-actions">
                    <button onclick="window.editAccount('${acc.id}')" title="Редактировать">✏️</button>
                    <button onclick="window.deleteAccount('${acc.id}')" title="Удалить">❌</button>
                </div>`;
            container.appendChild(div);
        });
    }

    window.deleteAccount = function(id) {
        if (!confirm("Удалить аккаунт?")) return;
        currentData.accounts = currentData.accounts.filter(a => a.id !== id);
        currentData.placements = currentData.placements.filter(p => p.accountId !== id);
        saveData();
    };

    // --- ОБЪЯВЛЕНИЯ И МАТРИЦА ---
    function renderTemplates() {
        const container = document.getElementById('templates-list');
        container.innerHTML = currentData.templates.length ? '' : '<p style="color: #888;">Здесь будут ваши объявления</p>';
        currentData.templates.forEach(temp => {
            const div = document.createElement('div');
            div.className = 'item';
            const commentHtml = temp.comment ? `<div class="item-comment">💬 ${temp.comment}</div>` : '';
            div.innerHTML = `
                <div class="item-info">
                    <h3>${temp.title}</h3>${commentHtml}<p style="margin-top:5px;">${temp.description.substring(0, 50)}...</p>
                </div>
                <div class="item-actions">
                    <button onclick="window.copyTemplate('${temp.id}')" title="Скопировать">📋</button>
                    <button onclick="window.deleteTemplate('${temp.id}')" title="Удалить">❌</button>
                </div>`;
            container.appendChild(div);
        });
    }

    function renderMatrix() {
        const container = document.getElementById('matrix-container');
        container.innerHTML = '';
        if (currentData.accounts.length === 0 || currentData.templates.length === 0) {
            container.innerHTML = '<p style="color: #888;">Добавьте аккаунты и объявления.</p>';
            return;
        }
        const table = document.createElement('table');
        table.className = 'matrix-table';
        const thead = document.createElement('thead');
        let headerRow = '<tr><th>Объявление \\ Аккаунт</th>';
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
        if (idx > -1) currentData.placements.splice(idx, 1);
        else currentData.placements.push({ id: 'plc_' + Date.now(), templateId, accountId, date: new Date().toISOString() });
        saveData();
    };

    window.deleteTemplate = function(id) {
        if (!confirm("Удалить объявление?")) return;
        currentData.templates = currentData.templates.filter(t => t.id !== id);
        currentData.placements = currentData.placements.filter(p => p.templateId !== id);
        saveData();
    };

    window.copyTemplate = function(id) {
        const temp = currentData.templates.find(t => t.id === id);
        if (temp) navigator.clipboard.writeText(temp.description).then(() => alert("Текст скопирован!"));
    };
});
