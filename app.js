// Глобальный объект для хранения состояния открытых аккордеонов
window.accordionStates = {};

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

    // ПУСТАЯ БАЗА
    const initialBlocks = {
        universal: {
            photo: [],
            visit: [],
            brands: [],
            location: []
        },
        niches: {} // Полностью пустой объект, ниши создаем вручную
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
                saveData();
            }
            statusEl.textContent = "Синхронизировано";
            statusEl.style.color = "#10b981";
            renderAll();
        }, (error) => {
            console.error("Ошибка синхронизации Firebase:", error);
            statusEl.textContent = "Ошибка сети";
            statusEl.style.color = "#ef4444";
        });
    }

    function saveData() {
        const docRef = window.doc(window.db, "data/main");
        window.setDoc(docRef, currentData, { merge: true })
        .then(() => {
            console.log("Данные успешно сохранены в Firebase");
        })
        .catch((error) => {
            console.error("ОШИБКА СОХРАНЕНИЯ:", error);
            alert("Внимание! Данные не сохранились. Проверьте интернет.");
        });
    }

    function renderAll() {
        initSelectors();
        renderAccounts();
        renderTemplates();
        window.renderEditorBlocks();
    }

    function initSelectors() {
        const nicheSelect = document.getElementById('niche-select');
        const editNicheSelect = document.getElementById('edit-niche-select');
        const filterNiche = document.getElementById('filter-niche');
        
        const currentNicheVal = nicheSelect.value;
        const currentEditNicheVal = editNicheSelect.value;
        const currentFilterVal = filterNiche.value;
        
        nicheSelect.innerHTML = '<option value="">-- Выберите нишу --</option>';
        editNicheSelect.innerHTML = '<option value="">-- Выберите --</option><option value="universal">⭐ Общее (все ниши)</option>';
        filterNiche.innerHTML = '<option value="">Все ниши</option>';
        
        for (const key in currentData.blocks.niches) {
            const name = currentData.blocks.niches[key].name;
            nicheSelect.innerHTML += `<option value="${key}">${name}</option>`;
            editNicheSelect.innerHTML += `<option value="${key}">${name}</option>`;
            filterNiche.innerHTML += `<option value="${key}">${name}</option>`;
        }

        nicheSelect.value = currentNicheVal;
        editNicheSelect.value = currentEditNicheVal;
        filterNiche.value = currentFilterVal;
    }

    window.createNiche = function() {
        const name = prompt("Введите название новой ниши (например, Ремонт двигателя):");
        if (!name || !name.trim()) return;
        
        const key = 'niche_' + Date.now();
        currentData.blocks.niches[key] = {
            name: name.trim(),
            titles: [],
            problem: [],
            process: [],
            advantages: [],
            cta: [],
            top_services: []
        };
        
        saveData();
        initSelectors();
        document.getElementById('edit-niche-select').value = key;
        window.renderEditorBlocks();
    };

    window.generateRandomAd = function() {
        const nicheKey = document.getElementById('niche-select').value;
        if (!nicheKey) return alert("Сначала выберите нишу для подбора!");

        const existingTemplates = currentData.templates.filter(t => t.niche === nicheKey && t.status === 'active');
        
        let usedCombinations = [];
        existingTemplates.forEach(t => {
            if (t.comment) {
                const matches = t.comment.match(/:\d+/g);
                if (matches) {
                    const indices = matches.map(m => parseInt(m.slice(1)));
                    if (indices.length === 9) {
                        usedCombinations.push(indices.join('-'));
                    }
                }
            }
        });

        const nicheBlocks = currentData.blocks.niches[nicheKey];
        const blockConfig = [
            { key: 'photo', source: 'universal' },
            { key: 'visit', source: 'universal' },
            { key: 'problem', source: 'niche' },
            { key: 'process', source: 'niche' },
            { key: 'advantages', source: 'niche' },
            { key: 'cta', source: 'niche' },
            { key: 'top_services', source: 'niche' },
            { key: 'brands', source: 'universal' },
            { key: 'location', source: 'universal' }
        ];

        const availableLengths = blockConfig.map(cfg => {
            const arr = cfg.source === 'universal' ? currentData.blocks.universal[cfg.key] : nicheBlocks[cfg.key];
            return arr ? arr.length : 0; 
        });

        if (availableLengths.includes(0)) {
            return alert("Ошибка! В некоторых блоках нет ни одного варианта. Заполните все блоки перед использованием рандомайзера.");
        }

        let found = false;
        let randomIndices = [];
        let attempts = 0;

        while (!found && attempts < 1000) {
            randomIndices = availableLengths.map(len => Math.floor(Math.random() * len));
            const comboString = randomIndices.join('-');
            
            if (!usedCombinations.includes(comboString)) {
                found = true;
            }
            attempts++;
        }

        if (!found) {
            return alert("Все возможные уникальные комбинации для этой ниши уже исчерпаны! Добавьте новые варианты блоков.");
        }

        window.updateBuilderBlocks();
        
        const selects = document.querySelectorAll('.block-select');
        selects.forEach((select, idx) => {
            if (randomIndices[idx] !== undefined) {
                select.value = randomIndices[idx];
            }
        });

        window.assemblePreview();
        document.getElementById('ad-preview').scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    window.updateBuilderBlocks = function() {
        const nicheKey = document.getElementById('niche-select').value;
        const container = document.getElementById('block-selectors');
        const titleSelect = document.getElementById('title-select');
        
        const currentTitleVal = titleSelect.value;
        const blockSelections = {};
        document.querySelectorAll('.block-select').forEach(s => {
            blockSelections[s.dataset.key] = s.value;
        });
        
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
        titleSelect.value = currentTitleVal;

        const nicheBlocks = currentData.blocks.niches[nicheKey];
        
        const blockConfig = [
            { key: 'photo', name: 'Фото', source: 'universal' },
            { key: 'visit', name: 'Осмотр', source: 'universal' },
            { key: 'problem', name: 'Проблема', source: 'niche' },
            { key: 'process', name: 'Что делаем', source: 'niche' },
            { key: 'advantages', name: 'Полезность', source: 'niche' },
            { key: 'cta', name: 'Призыв', source: 'niche' },
            { key: 'top_services', name: 'Топ', source: 'niche' },
            { key: 'brands', name: 'Марки', source: 'universal' },
            { key: 'location', name: 'Адрес', source: 'universal' }
        ];

        blockConfig.forEach((config, idx) => {
            const options = config.source === 'universal' ? currentData.blocks.universal[config.key] : nicheBlocks[config.key];
            
            if (options && options.length > 0) {
                let selectHtml = `<div class="input-group">
                    <label>${idx + 1}. ${config.name}</label>
                    <div class="block-row">
                        <select class="block-select" data-name="${config.name}" data-key="${config.key}" data-source="${config.source}" onchange="window.assemblePreview()">
                            <option value="">-- Не использовать --</option>`;
                options.forEach((opt, index) => {
                    selectHtml += `<option value="${index}">Вариант ${index + 1}: ${opt.substring(0, 40)}...</option>`;
                });
                selectHtml += `</select>
                        <button class="btn-plus" onclick="window.addNewBlock('${nicheKey}', '${config.key}', '${config.source}')" title="Добавить новый вариант">+</button>
                    </div></div>`;
                container.innerHTML += selectHtml;
            } else {
                let selectHtml = `<div class="input-group">
                    <label>${idx + 1}. ${config.name} (пусто)</label>
                    <div class="block-row">
                        <select class="block-select" data-name="${config.name}" data-key="${config.key}" data-source="${config.source}" onchange="window.assemblePreview()" disabled>
                            <option value="">-- Нет вариантов --</option>
                        </select>
                        <button class="btn-plus" onclick="window.addNewBlock('${nicheKey}', '${config.key}', '${config.source}')" title="Добавить новый вариант">+</button>
                    </div></div>`;
                container.innerHTML += selectHtml;
            }
        });

        document.querySelectorAll('.block-select').forEach(s => {
            if (blockSelections[s.dataset.key] !== undefined) {
                s.value = blockSelections[s.dataset.key];
            }
        });

        window.assemblePreview();
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
                if (text) parts.push(text);
            }
        });

        document.getElementById('ad-preview').value = parts.join('\n- - -\n');
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
        const manualComment = document.getElementById('ad-comment').value.trim();
        const nicheKey = document.getElementById('niche-select').value;

        if (!title) return alert("Введите название!");
        if (!description) return alert("Выберите блоки!");
        if (!nicheKey) return alert("Выберите нишу!");

        const selects = document.querySelectorAll('.block-select');
        let autoCommentParts = [];
        
        selects.forEach((select, index) => {
            const name = select.dataset.name;
            const val = select.value;
            if (val !== "") {
                autoCommentParts.push(`${index + 1}.${name}:${parseInt(val) + 1}`);
            }
        });

        const autoComment = autoCommentParts.join(' / ');
        const finalComment = manualComment 
            ? `${manualComment} | Блоки: ${autoComment}` 
            : `Блоки: ${autoComment}`;

        currentData.templates.push({ 
            id: 'temp_' + Date.now(), 
            title, 
            description, 
            comment: finalComment,
            niche: nicheKey,
            status: 'active'
        });
        saveData();
        
        document.getElementById('ad-title').value = '';
        document.getElementById('ad-comment').value = '';
        document.getElementById('ad-preview').value = '';
        document.querySelectorAll('.block-select').forEach(s => s.value = '');
        document.getElementById('title-select').value = '';
        window.updateCounters();
    };

    // --- СОХРАНЕНИЕ СОСТОЯНИЯ АККОРДЕОНОВ ---
    window.toggleAccordion = function(detailsEl) {
        const id = detailsEl.getAttribute('data-id');
        if (id) {
            window.accordionStates[id] = detailsEl.open;
        }
    };

    window.renderEditorBlocks = function() {
        const nicheKey = document.getElementById('edit-niche-select').value;
        const container = document.getElementById('editor-container');
        container.innerHTML = '';

        if (!nicheKey) return;

        let html = '';

        if (nicheKey === 'universal') {
            const universalKeys = ['photo', 'visit', 'brands', 'location'];
            const ruNames = {
                photo: 'Просьба прислать фото', visit: 'Призыв приехать на осмотр',
                brands: 'Марки авто', location: 'Адрес и контакты'
            };
            
            universalKeys.forEach(bKey => {
                const options = currentData.blocks.universal[bKey] || [];
                const accId = `universal_${bKey}`;
                const isOpen = window.accordionStates[accId] ? 'open' : ''; // Проверяем состояние
                
                html += `<details class="block-group" data-id="${accId}" ${isOpen} ontoggle="window.toggleAccordion(this)">
                    <summary>${ruNames[bKey]} <span class="block-count">(${options.length})</span></summary>
                    <div class="block-content">
                        <button class="btn-add" style="margin-bottom: 10px; background:#10b981;" onclick="window.addNewBlock('universal', '${bKey}', 'universal')">+ Добавить вариант</button>`;
                
                if (options.length === 0) {
                    html += `<p style="font-size: 0.85rem; color: #888; text-align: center;">Пока пусто.</p>`;
                } else {
                    options.forEach((text, i) => {
                        html += `<div class="editor-block">
                            <p>${text}</p>
                            <div style="display:flex;">
                                <button onclick="window.editBlock('universal', '${bKey}', 'universal', ${i})">✏️</button>
                                <button onclick="window.deleteBlock('universal', '${bKey}', 'universal', ${i})">❌</button>
                            </div>
                        </div>`;
                    });
                }
                html += `</div></details>`;
            });
        } else {
            const titles = currentData.blocks.niches[nicheKey].titles || [];
            const accTitleId = `${nicheKey}_titles`;
            const isTitleOpen = window.accordionStates[accTitleId] ? 'open' : '';
            
            html += `<details class="block-group" data-id="${accTitleId}" ${isTitleOpen} ontoggle="window.toggleAccordion(this)">
                <summary>Названия объявлений <span class="block-count">(${titles.length})</span></summary>
                <div class="block-content">
                    <button class="btn-add" style="margin-bottom: 10px; background:#10b981;" onclick="window.addNewTitle('${nicheKey}')">+ Добавить название</button>`;
            if (titles.length === 0) {
                html += `<p style="font-size: 0.85rem; color: #888; text-align: center;">Пока пусто.</p>`;
            } else {
                titles.forEach((t, i) => {
                    html += `<div class="editor-block">
                        <p>${t}</p>
                        <div style="display:flex;">
                            <button onclick="window.editBlock('${nicheKey}', 'titles', 'niche', ${i})">✏️</button>
                            <button onclick="window.deleteBlock('${nicheKey}', 'titles', 'niche', ${i})">❌</button>
                        </div>
                    </div>`;
                });
            }
            html += `</div></details>`;

            const blockKeys = ['problem', 'process', 'advantages', 'cta', 'top_services'];
            const blockNames = {
                problem: 'Описание проблемы', process: 'Что делаем', 
                advantages: 'Преимущества', cta: 'Призыв', 
                top_services: 'Топ услуг'
            };
            
            blockKeys.forEach(bKey => {
                const options = currentData.blocks.niches[nicheKey][bKey] || [];
                const accId = `${nicheKey}_${bKey}`;
                const isOpen = window.accordionStates[accId] ? 'open' : '';
                
                html += `<details class="block-group" data-id="${accId}" ${isOpen} ontoggle="window.toggleAccordion(this)">
                    <summary>${blockNames[bKey]} <span class="block-count">(${options.length})</span></summary>
                    <div class="block-content">
                        <button class="btn-add" style="margin-bottom: 10px; background:#10b981;" onclick="window.addNewBlock('${nicheKey}', '${bKey}', 'niche')">+ Добавить вариант</button>`;
                
                if (options.length === 0) {
                    html += `<p style="font-size: 0.85rem; color: #888; text-align: center;">Пока пусто.</p>`;
                } else {
                    options.forEach((text, i) => {
                        html += `<div class="editor-block">
                            <p>${text}</p>
                            <div style="display:flex;">
                                <button onclick="window.editBlock('${nicheKey}', '${bKey}', 'niche', ${i})">✏️</button>
                                <button onclick="window.deleteBlock('${nicheKey}', '${bKey}', 'niche', ${i})">❌</button>
                            </div>
                        </div>`;
                    });
                }
                html += `</div></details>`;
            });
        }
        
        container.innerHTML = html;
    };

    window.addNewTitle = function(forcedNicheKey) {
        const nicheKey = forcedNicheKey || document.getElementById('niche-select').value;
        if (!nicheKey || nicheKey === 'universal') return alert("Сначала выберите конкретную нишу!");
        
        const newTitle = prompt("Введите новое название (до 50 символов):");
        if (!newTitle || !newTitle.trim()) return;
        if (newTitle.length > 50) return alert("Название слишком длинное (макс. 50 символов)!");

        if (!currentData.blocks.niches[nicheKey].titles) currentData.blocks.niches[nicheKey].titles = [];
        currentData.blocks.niches[nicheKey].titles.push(newTitle.trim());
        
        saveData();
        window.updateBuilderBlocks();
        window.renderEditorBlocks();
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
        window.renderEditorBlocks();
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
        document.getElementById('group-1').style.display = 'none';
        document.getElementById('group-2').style.display = 'flex';
        document.getElementById('label-2').textContent = 'Текст';
        document.getElementById('field-2').value = text;
        document.getElementById('field-2').rows = 8;

        modal.showModal();
    };

    window.deleteBlock = function(nicheKey, blockKey, source, index) {
        if (!confirm("Удалить этот вариант?")) return;
        if (source === 'universal') {
            currentData.blocks.universal[blockKey].splice(index, 1);
        } else {
            currentData.blocks.niches[nicheKey][blockKey].splice(index, 1);
        }
        saveData();
        window.updateBuilderBlocks();
        window.renderEditorBlocks();
    };

    window.editAccount = function(id) {
        const acc = currentData.accounts.find(a => a.id === id);
        const modal = document.getElementById('edit-modal');
        
        modal.dataset.type = 'account';
        modal.dataset.id = id;

        document.getElementById('modal-title').textContent = 'Редактировать аккаунт';
        document.getElementById('group-1').style.display = 'flex';
        document.getElementById('label-1').textContent = 'Название аккаунта';
        document.getElementById('field-1').value = acc.name;
        document.getElementById('field-1').type = 'text';

        document.getElementById('group-2').style.display = 'flex';
        document.getElementById('label-2').textContent = 'Площадка';
        document.getElementById('field-2').value = acc.platform || '';
        document.getElementById('field-2').rows = 1;

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
        window.updateBuilderBlocks();
        window.renderEditorBlocks();
    };

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
                <div class="item-main">
                    <div class="item-info"><h3>${acc.name}</h3><p>${acc.platform || 'Без площадки'}</p></div>
                    <div class="item-actions">
                        <button onclick="window.editAccount('${acc.id}')" title="Редактировать">✏️</button>
                        <button onclick="window.deleteAccount('${acc.id}')" title="Удалить">❌</button>
                    </div>
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

    function renderTemplates() {
        const container = document.getElementById('templates-list');
        const searchQuery = document.getElementById('search-templates').value.toLowerCase();
        const nicheFilter = document.getElementById('filter-niche').value;
        
        container.innerHTML = '';

        let filtered = currentData.templates.filter(temp => {
            const matchesSearch = temp.title.toLowerCase().includes(searchQuery) || temp.description.toLowerCase().includes(searchQuery);
            const matchesNiche = nicheFilter === "" || temp.niche === nicheFilter;
            return matchesSearch && matchesNiche;
        });

        if (filtered.length === 0) {
            container.innerHTML = '<p style="color: #888;">Ничего не найдено по вашему запросу.</p>';
            return;
        }

        filtered.forEach(temp => {
            const placedAccounts = currentData.placements
                .filter(p => p.templateId === temp.id)
                .map(p => currentData.accounts.find(a => a.id === p.accountId)?.name)
                .filter(Boolean);

            const badgesHtml = placedAccounts.length > 0 
                ? `<div class="badges-container">${placedAccounts.map(name => `<span class="account-badge">${name}</span>`).join('')}</div>` 
                : '';

            const status = temp.status || 'active';
            const statusClass = `status-${status}`;
            
            const div = document.createElement('div');
            div.className = 'item';
            const commentHtml = temp.comment ? `<div class="item-comment">💬 ${temp.comment}</div>` : '';
            
            div.innerHTML = `
                <div class="item-main">
                    <div class="item-info">
                        <h3>${temp.title}</h3>
                        ${commentHtml}
                        <p style="margin-top:5px;">${temp.description.substring(0, 70)}...</p>
                    </div>
                    <div class="item-actions">
                        <button onclick="window.copyTemplate('${temp.id}')" title="Скопировать текст">📋</button>
                        <button onclick="window.openAccountsModal('${temp.id}')" title="Привязать к аккаунтам">👤</button>
                        <button onclick="window.deleteTemplate('${temp.id}')" title="Удалить">❌</button>
                    </div>
                </div>
                <div class="item-footer">
                    <div>${badgesHtml}</div>
                    <select class="status-select ${statusClass}" onchange="window.updateStatus('${temp.id}', this.value)">
                        <option value="active" ${status === 'active' ? 'selected' : ''}>Активно</option>
                        <option value="blocked" ${status === 'blocked' ? 'selected' : ''}>Заблокировано</option>
                        <option value="archived" ${status === 'archived' ? 'selected' : ''}>Архив</option>
                    </select>
                </div>
            `;
            container.appendChild(div);
        });
    }

    window.updateStatus = function(id, newStatus) {
        const temp = currentData.templates.find(t => t.id === id);
        if (temp) {
            temp.status = newStatus;
            saveData();
        }
    };

    window.openAccountsModal = function(templateId) {
        const modal = document.getElementById('accounts-modal');
        modal.dataset.templateId = templateId;
        
        const container = document.getElementById('accounts-checkboxes');
        container.innerHTML = '';

        if (currentData.accounts.length === 0) {
            container.innerHTML = '<p>У вас пока нет добавленных аккаунтов.</p>';
        } else {
            currentData.accounts.forEach(acc => {
                const isChecked = currentData.placements.some(p => p.templateId === templateId && p.accountId === acc.id);
                container.innerHTML += `
                    <label class="checkbox-row">
                        <input type="checkbox" value="${acc.id}" ${isChecked ? 'checked' : ''}>
                        <span>${acc.name} (${acc.platform})</span>
                    </label>
                `;
            });
        }
        modal.showModal();
    };

    window.saveAccountsLink = function() {
        const modal = document.getElementById('accounts-modal');
        const templateId = modal.dataset.templateId;
        const checkboxes = document.querySelectorAll('#accounts-checkboxes input[type="checkbox"]');
        
        currentData.placements = currentData.placements.filter(p => p.templateId !== templateId);

        checkboxes.forEach(cb => {
            if (cb.checked) {
                currentData.placements.push({
                    id: 'plc_' + Date.now() + Math.random().toString(36).substr(2, 5),
                    templateId: templateId,
                    accountId: cb.value,
                    date: new Date().toISOString()
                });
            }
        });

        saveData();
        modal.close();
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

    window.exportData = function() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "avito_manager_backup_" + new Date().toISOString().slice(0,10) + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    window.importData = function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                if (importedData.accounts && importedData.templates && importedData.blocks) {
                    if(confirm("Вы уверены? Текущие данные будут заменены резервной копией.")) {
                        currentData = importedData;
                        saveData();
                        alert("База успешно восстановлена!");
                    }
                } else {
                    alert("Ошибка: неверный формат файла.");
                }
            } catch (err) {
                alert("Ошибка чтения файла: " + err.message);
            }
        };
        reader.readAsText(file);
    };
});
