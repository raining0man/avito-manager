document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('sync-status');
    
    if (!window.db || !window.auth) {
        statusEl.textContent = "Ошибка: Firebase не загрузился!";
        statusEl.style.color = "#ef4444";
        return;
    }

    let isReady = false;
    let isSaving = false;
    let dataVersion = 0;
    let firstSnapshot = false;
    
    let currentData = { 
        accounts: [], 
        templates: [], 
        placements: [], 
        blocks: { universal: {}, niches: {} } 
    };

    // ==========================================
    // МИГРАЦИЯ ДАННЫХ
    // ==========================================
    function migrateBlockData() {
        if (!currentData.blocks) return;
        
        const processArr = (arr) => {
            if (!Array.isArray(arr)) return [];
            return arr.map(item => {
                if (typeof item === 'string') {
                    return { id: 'blk_' + Math.random().toString(36).slice(2, 9), text: item, hidden: false };
                }
                if (!item.id) item.id = 'blk_' + Math.random().toString(36).slice(2, 9);
                if (item.hidden === undefined) item.hidden = false;
                return item;
            });
        };

        for (let key in currentData.blocks.universal) {
            currentData.blocks.universal[key] = processArr(currentData.blocks.universal[key]);
        }
        for (let nKey in currentData.blocks.niches) {
            for (let bKey in currentData.blocks.niches[nKey]) {
                if (Array.isArray(currentData.blocks.niches[nKey][bKey])) {
                    currentData.blocks.niches[nKey][bKey] = processArr(currentData.blocks.niches[nKey][bKey]);
                }
            }
        }
    }

    // ==========================================
    // ЛОКАЛЬНЫЙ КЭШ
    // ==========================================
    function saveToLocalCache() {
        try {
            localStorage.setItem('avito_manager_cache', JSON.stringify({
                ...currentData, version: dataVersion, updatedAt: new Date().toISOString()
            }));
        } catch (e) { console.warn("Ошибка кэша:", e); }
    }

    function loadFromLocalCache() {
        try {
            const saved = localStorage.getItem('avito_manager_cache');
            if (saved) {
                const parsed = JSON.parse(saved);
                currentData = {
                    accounts: parsed.accounts || [],
                    templates: parsed.templates || [],
                    placements: parsed.placements || [],
                    blocks: parsed.blocks || currentData.blocks
                };
                dataVersion = parsed.version || 0;
                migrateBlockData();
                return true;
            }
        } catch (e) { console.warn("Ошибка кэша:", e); }
        return false;
    }

    // ==========================================
    // СИНХРОНИЗАЦИЯ
    // ==========================================
    function startSync() {
        const docRef = window.doc(window.db, "data/main");
        
        window.onSnapshot(docRef, (docSnap) => {
            if (isSaving) return; 
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                const newVersion = data.version || 0;
                
                if (!firstSnapshot) {
                    firstSnapshot = true;
                    currentData = {
                        accounts: data.accounts || [],
                        templates: data.templates || [],
                        placements: data.placements || [],
                        blocks: data.blocks || currentData.blocks
                    };
                    dataVersion = newVersion;
                    migrateBlockData();
                    isReady = true;
                    saveToLocalCache();
                    renderAll();
                    statusEl.textContent = "Синхронизировано";
                    statusEl.style.color = "#10b981";
                } 
                else if (newVersion !== dataVersion) {
                    currentData = {
                        accounts: data.accounts || [],
                        templates: data.templates || [],
                        placements: data.placements || [],
                        blocks: data.blocks || currentData.blocks
                    };
                    dataVersion = newVersion;
                    migrateBlockData();
                    saveToLocalCache();
                    renderAll();
                    statusEl.textContent = "Обновлено из облака";
                    statusEl.style.color = "#10b981";
                }
            } else {
                if (!firstSnapshot) {
                    firstSnapshot = true;
                    isReady = true;
                    saveData();
                    statusEl.textContent = "Готово к работе";
                    statusEl.style.color = "#10b981";
                }
            }
        }, (error) => {
            console.error("Ошибка синхронизации:", error);
            statusEl.textContent = "Ошибка сети (Локально)";
            statusEl.style.color = "#ef4444";
            isReady = true;
        });
    }

    async function saveData() {
        saveToLocalCache();
        if (!isReady) return;
        
        isSaving = true;
        dataVersion++;
        statusEl.textContent = "Сохранение...";
        statusEl.style.color = "#f59e0b";

        try {
            const docRef = window.doc(window.db, "data/main");
            await window.setDoc(docRef, {
                ...currentData, version: dataVersion, updatedAt: new Date().toISOString()
            });
            statusEl.textContent = "Синхронизировано";
            statusEl.style.color = "#10b981";
        } catch (error) {
            console.error("ОШИБКА СОХРАНЕНИЯ:", error);
            statusEl.textContent = "Ошибка сети (Локально)";
            statusEl.style.color = "#ef4444";
            alert("Данные сохранены локально, но не ушли в облако.");
        } finally {
            isSaving = false;
        }
    }

    // ==========================================
    // ИНИЦИАЛИЗАЦИЯ
    // ==========================================
    async function init() {
        if (loadFromLocalCache()) {
            renderAll();
            statusEl.textContent = "Локальные данные. Подключение...";
        } else {
            statusEl.textContent = "Подключение...";
        }

        try {
            await window.signInAnonymously(window.auth);
            startSync();
        } catch (error) {
            console.error("Ошибка авторизации:", error);
            statusEl.textContent = "Ошибка сети! Отключите VPN";
            statusEl.style.color = "#ef4444";
            isReady = true; 
        }
    }

    // ==========================================
    // UI И ЛОГИКА
    // ==========================================
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
        const name = prompt("Введите название новой ниши:");
        if (!name || !name.trim()) return;
        const key = 'niche_' + Date.now();
        currentData.blocks.niches[key] = {
            name: name.trim(), titles: [], problem: [], process: [], advantages: [], cta: [], top_services: []
        };
        saveData();
        initSelectors();
        document.getElementById('edit-niche-select').value = key;
        window.renderEditorBlocks();
    };

    // НОВАЯ ФУНКЦИЯ: Переименование ниши
    window.editNicheName = function() {
        const nicheKey = document.getElementById('edit-niche-select').value;
        if (!nicheKey) return alert("Выберите нишу!");
        if (nicheKey === 'universal') return alert("Нельзя переименовать системную нишу 'Общее'");
        
        const currentName = currentData.blocks.niches[nicheKey].name;
        const newName = prompt("Введите новое название ниши:", currentName);
        
        if (newName && newName.trim() && newName !== currentName) {
            currentData.blocks.niches[nicheKey].name = newName.trim();
            saveData();
            initSelectors();
            document.getElementById('edit-niche-select').value = nicheKey;
            document.getElementById('niche-select').value = nicheKey;
            window.renderEditorBlocks();
        }
    };

    window.toggleBlockVisibility = function(source, nicheKey, blockKey, id, checkboxEl) {
        const arr = source === 'universal' ? currentData.blocks.universal[blockKey] : currentData.blocks.niches[nicheKey][blockKey];
        const item = arr.find(x => x.id === id);
        if (item) {
            item.hidden = checkboxEl.checked;
            
            const parentDiv = checkboxEl.closest('.editor-block');
            if (item.hidden) parentDiv.classList.add('hidden-block');
            else parentDiv.classList.remove('hidden-block');
            
            saveData();
            window.updateBuilderBlocks();
        }
    };

    // ОБНОВЛЕННЫЙ РАНДОМАЙЗЕР (Включает названия)
    window.generateRandomAd = function() {
        const nicheKey = document.getElementById('niche-select').value;
        if (!nicheKey) return alert("Сначала выберите нишу!");

        const nicheBlocks = currentData.blocks.niches[nicheKey];
        const visibleTitles = (nicheBlocks.titles || []).filter(t => !t.hidden);
        
        if (visibleTitles.length === 0) {
            return alert("Нет доступных названий для этой ниши. Добавьте или включите хотя бы одно.");
        }

        const existingTemplates = currentData.templates.filter(t => t.niche === nicheKey && t.status === 'active');
        let usedCombinations = [];
        
        existingTemplates.forEach(t => {
            if (t.comment) {
                // Парсим индексы из комментария: "0.Название:1 / 1.Фото:2..."
                const matches = t.comment.match(/\d+\.[^:]+:\d+/g);
                if (matches) {
                    const indices = matches.map(m => parseInt(m.split(':')[1]));
                    // Ожидаем 10 элементов: 1 название + 9 блоков
                    if (indices.length === 10) usedCombinations.push(indices.join('-'));
                }
            }
        });

        const blockConfig = [
            { key: 'photo', source: 'universal' }, { key: 'visit', source: 'universal' },
            { key: 'problem', source: 'niche' }, { key: 'process', source: 'niche' },
            { key: 'advantages', source: 'niche' }, { key: 'cta', source: 'niche' },
            { key: 'top_services', source: 'niche' }, { key: 'brands', source: 'universal' },
            { key: 'location', source: 'universal' }
        ];

        const availableIds = blockConfig.map(cfg => {
            const arr = cfg.source === 'universal' ? currentData.blocks.universal[cfg.key] : nicheBlocks[cfg.key];
            return (arr || []).filter(x => !x.hidden).map(x => x.id);
        });

        if (availableIds.some(ids => ids.length === 0)) {
            return alert("Ошибка! В некоторых блоках скрыты все варианты. Включите хотя бы по одному.");
        }

        let found = false;
        let randomTitleId = null;
        let randomIds = [];
        let attempts = 0;

        while (!found && attempts < 1000) {
            // Выбираем случайное название
            randomTitleId = visibleTitles[Math.floor(Math.random() * visibleTitles.length)].id;
            
            // Выбираем случайные блоки
            randomIds = availableIds.map(ids => ids[Math.floor(Math.random() * ids.length)]);
            
            // Переводим в индексы для проверки дублей
            const titleIdx = nicheBlocks.titles.findIndex(t => t.id === randomTitleId);
            const randomIndices = randomIds.map((id, idx) => {
                const arr = blockConfig[idx].source === 'universal' ? currentData.blocks.universal[blockConfig[idx].key] : nicheBlocks[blockConfig[idx].key];
                return arr.findIndex(x => x.id === id);
            });
            
            const comboString = [titleIdx + 1, ...randomIndices.map(i => i + 1)].join('-');
            if (!usedCombinations.includes(comboString)) found = true;
            attempts++;
        }

        if (!found) return alert("Все возможные уникальные комбинации исчерпаны!");

        window.updateBuilderBlocks();
        
        // Подставляем название
        document.getElementById('title-select').value = randomTitleId;
        document.getElementById('ad-title').value = visibleTitles.find(t => t.id === randomTitleId).text;
        window.updateCounters();

        // Подставляем блоки
        const selects = document.querySelectorAll('.block-select');
        selects.forEach((select, idx) => { if (randomIds[idx] !== undefined) select.value = randomIds[idx]; });
        
        window.assemblePreview();
        document.getElementById('ad-preview').scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    window.updateBuilderBlocks = function() {
        const nicheKey = document.getElementById('niche-select').value;
        const container = document.getElementById('block-selectors');
        const titleSelect = document.getElementById('title-select');
        
        const currentTitleVal = titleSelect.value;
        const blockSelections = {};
        document.querySelectorAll('.block-select').forEach(s => blockSelections[s.dataset.key] = s.value);
        
        container.innerHTML = '';
        titleSelect.innerHTML = '<option value="">-- Выбрать из готовых --</option>';

        if (!nicheKey) {
            document.getElementById('ad-preview').value = '';
            window.updateCounters();
            return;
        }

        const titles = (currentData.blocks.niches[nicheKey].titles || []).filter(t => !t.hidden);
        titles.forEach(t => titleSelect.innerHTML += `<option value="${t.id}">${t.text}</option>`);
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
            const allOptions = config.source === 'universal' ? currentData.blocks.universal[config.key] : nicheBlocks[config.key];
            const visibleOptions = (allOptions || []).filter(x => !x.hidden);
            
            if (visibleOptions.length > 0) {
                let selectHtml = `<div class="input-group"><label>${idx + 1}. ${config.name}</label><div class="block-row"><select class="block-select" data-name="${config.name}" data-key="${config.key}" data-source="${config.source}" onchange="window.assemblePreview()"><option value="">-- Не использовать --</option>`;
                visibleOptions.forEach(item => {
                    selectHtml += `<option value="${item.id}">Вариант: ${item.text.substring(0, 40)}...</option>`;
                });
                selectHtml += `</select><button class="btn-plus" onclick="window.addNewBlock('${nicheKey}', '${config.key}', '${config.source}')" title="Добавить">+</button></div></div>`;
                container.innerHTML += selectHtml;
            } else {
                let selectHtml = `<div class="input-group"><label>${idx + 1}. ${config.name} (пусто)</label><div class="block-row"><select class="block-select" disabled><option value="">-- Все скрыты --</option></select><button class="btn-plus" onclick="window.addNewBlock('${nicheKey}', '${config.key}', '${config.source}')" title="Добавить">+</button></div></div>`;
                container.innerHTML += selectHtml;
            }
        });

        document.querySelectorAll('.block-select').forEach(s => {
            if (blockSelections[s.dataset.key] !== undefined) s.value = blockSelections[s.dataset.key];
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
            const valId = select.value;
            
            if (valId !== "") {
                const arr = source === 'universal' ? currentData.blocks.universal[key] : currentData.blocks.niches[nicheKey][key];
                const item = arr.find(x => x.id === valId);
                if (item) parts.push(item.text);
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

        let autoCommentParts = [];
        
        // Добавляем название в комментарий (для рандомайзера)
        const selectedTitleId = document.getElementById('title-select').value;
        if (selectedTitleId) {
            const titles = currentData.blocks.niches[nicheKey].titles || [];
            const titleIdx = titles.findIndex(t => t.id === selectedTitleId);
            if (titleIdx !== -1) {
                autoCommentParts.push(`0.Название:${titleIdx + 1}`);
            }
        }

        const selects = document.querySelectorAll('.block-select');
        
        selects.forEach((select, index) => {
            const name = select.dataset.name;
            const valId = select.value;
            
            if (valId !== "") {
                const arr = select.dataset.source === 'universal' ? currentData.blocks.universal[select.dataset.key] : currentData.blocks.niches[nicheKey][select.dataset.key];
                const originalIndex = arr.findIndex(x => x.id === valId);
                if (originalIndex !== -1) {
                    autoCommentParts.push(`${index + 1}.${name}:${originalIndex + 1}`);
                }
            }
        });

        const finalComment = manualComment ? `${manualComment} | Блоки: ${autoCommentParts.join(' / ')}` : `Блоки: ${autoCommentParts.join(' / ')}`;

        currentData.templates.push({ 
            id: 'temp_' + Date.now(), title, description, comment: finalComment, niche: nicheKey, status: 'active'
        });
        
        saveData();
        
        document.getElementById('ad-title').value = '';
        document.getElementById('ad-comment').value = '';
        document.getElementById('ad-preview').value = '';
        document.querySelectorAll('.block-select').forEach(s => s.value = '');
        document.getElementById('title-select').value = '';
        window.updateCounters();
    };

    window.accordionStates = {};

    window.toggleAccordion = function(detailsEl) {
        const id = detailsEl.getAttribute('data-id');
        if (id) window.accordionStates[id] = detailsEl.open;
    };

    window.renderEditorBlocks = function() {
        const nicheKey = document.getElementById('edit-niche-select').value;
        const container = document.getElementById('editor-container');
        container.innerHTML = '';
        if (!nicheKey) return;

        let html = '';

        if (nicheKey === 'universal') {
            const universalKeys = ['photo', 'visit', 'brands', 'location'];
            const ruNames = { photo: 'Просьба прислать фото', visit: 'Призыв на осмотр', brands: 'Марки авто', location: 'Адрес и контакты' };
            
            universalKeys.forEach(bKey => {
                const options = currentData.blocks.universal[bKey] || [];
                const accId = `universal_${bKey}`;
                const isOpen = window.accordionStates[accId] ? 'open' : '';
                
                html += `<details class="block-group" data-id="${accId}" ${isOpen} ontoggle="window.toggleAccordion(this)">
                    <summary>${ruNames[bKey]} <span class="block-count">(${options.length})</span></summary>
                    <div class="block-content">
                        <button class="btn-add" style="margin-bottom: 10px; background:#10b981;" onclick="window.addNewBlock('universal', '${bKey}', 'universal')">+ Добавить вариант</button>`;
                
                if (options.length === 0) html += `<p style="font-size: 0.85rem; color: #888; text-align: center;">Пока пусто.</p>`;
                else {
                    options.forEach((item) => {
                        html += `<div class="editor-block ${item.hidden ? 'hidden-block' : ''}">
                            <p>${item.text}</p>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <label class="hide-checkbox" title="Скрыть из конструктора">
                                    <input type="checkbox" ${item.hidden ? 'checked' : ''} onchange="window.toggleBlockVisibility('universal', '${nicheKey}', '${bKey}', '${item.id}', this)"> Скрыть
                                </label>
                                <button onclick="window.editBlock('universal', '${bKey}', 'universal', '${item.id}')">✏️</button>
                                <button onclick="window.deleteBlock('universal', '${bKey}', 'universal', '${item.id}')">❌</button>
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
            if (titles.length === 0) html += `<p style="font-size: 0.85rem; color: #888; text-align: center;">Пока пусто.</p>`;
            else {
                titles.forEach((item) => {
                    html += `<div class="editor-block ${item.hidden ? 'hidden-block' : ''}">
                        <p>${item.text}</p>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <label class="hide-checkbox" title="Скрыть из конструктора">
                                <input type="checkbox" ${item.hidden ? 'checked' : ''} onchange="window.toggleBlockVisibility('niche', '${nicheKey}', 'titles', '${item.id}', this)"> Скрыть
                            </label>
                            <button onclick="window.editBlock('${nicheKey}', 'titles', 'niche', '${item.id}')">✏️</button>
                            <button onclick="window.deleteBlock('${nicheKey}', 'titles', 'niche', '${item.id}')">❌</button>
                        </div>
                    </div>`;
                });
            }
            html += `</div></details>`;

            const blockKeys = ['problem', 'process', 'advantages', 'cta', 'top_services'];
            const blockNames = { problem: 'Проблема', process: 'Что делаем', advantages: 'Преимущества', cta: 'Призыв', top_services: 'Топ услуг' };
            
            blockKeys.forEach(bKey => {
                const options = currentData.blocks.niches[nicheKey][bKey] || [];
                const accId = `${nicheKey}_${bKey}`;
                const isOpen = window.accordionStates[accId] ? 'open' : '';
                
                html += `<details class="block-group" data-id="${accId}" ${isOpen} ontoggle="window.toggleAccordion(this)">
                    <summary>${blockNames[bKey]} <span class="block-count">(${options.length})</span></summary>
                    <div class="block-content">
                        <button class="btn-add" style="margin-bottom: 10px; background:#10b981;" onclick="window.addNewBlock('${nicheKey}', '${bKey}', 'niche')">+ Добавить вариант</button>`;
                
                if (options.length === 0) html += `<p style="font-size: 0.85rem; color: #888; text-align: center;">Пока пусто.</p>`;
                else {
                    options.forEach((item) => {
                        html += `<div class="editor-block ${item.hidden ? 'hidden-block' : ''}">
                            <p>${item.text}</p>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <label class="hide-checkbox" title="Скрыть из конструктора">
                                    <input type="checkbox" ${item.hidden ? 'checked' : ''} onchange="window.toggleBlockVisibility('niche', '${nicheKey}', '${bKey}', '${item.id}', this)"> Скрыть
                                </label>
                                <button onclick="window.editBlock('${nicheKey}', '${bKey}', 'niche', '${item.id}')">✏️</button>
                                <button onclick="window.deleteBlock('${nicheKey}', '${bKey}', 'niche', '${item.id}')">❌</button>
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
        if (!nicheKey || nicheKey === 'universal') return alert("Выберите нишу!");
        const newTitle = prompt("Введите название (до 50 символов):");
        if (!newTitle || newTitle.length > 50) return alert("Название пустое или длиннее 50 символов!");
        currentData.blocks.niches[nicheKey].titles.push({ id: 'blk_' + Date.now(), text: newTitle.trim(), hidden: false });
        saveData();
        window.updateBuilderBlocks();
        window.renderEditorBlocks();
    };

    window.addNewBlock = function(nicheKey, blockKey, source) {
        const newText = prompt("Введите текст варианта:");
        if (!newText || !newText.trim()) return;
        const newItem = { id: 'blk_' + Date.now(), text: newText.trim(), hidden: false };
        
        if (source === 'universal') currentData.blocks.universal[blockKey].push(newItem);
        else currentData.blocks.niches[nicheKey][blockKey].push(newItem);
        
        saveData();
        window.updateBuilderBlocks();
        window.renderEditorBlocks();
    };

    window.editBlock = function(nicheKey, blockKey, source, id) {
        const arr = source === 'universal' ? currentData.blocks.universal[blockKey] : currentData.blocks.niches[nicheKey][blockKey];
        const item = arr.find(x => x.id === id);
        if (!item) return;

        const modal = document.getElementById('edit-modal');
        modal.dataset.type = 'block'; modal.dataset.nicheKey = nicheKey; modal.dataset.blockKey = blockKey; modal.dataset.source = source; modal.dataset.id = id;
        document.getElementById('modal-title').textContent = 'Редактировать';
        document.getElementById('group-1').style.display = 'none';
        document.getElementById('group-2').style.display = 'flex';
        document.getElementById('field-2').value = item.text;
        modal.showModal();
    };

    window.deleteBlock = function(nicheKey, blockKey, source, id) {
        if (!confirm("Удалить вариант?")) return;
        if (source === 'universal') {
            currentData.blocks.universal[blockKey] = currentData.blocks.universal[blockKey].filter(x => x.id !== id);
        } else {
            currentData.blocks.niches[nicheKey][blockKey] = currentData.blocks.niches[nicheKey][blockKey].filter(x => x.id !== id);
        }
        saveData();
        window.updateBuilderBlocks();
        window.renderEditorBlocks();
    };

    window.editAccount = function(id) {
        const acc = currentData.accounts.find(a => a.id === id);
        const modal = document.getElementById('edit-modal');
        modal.dataset.type = 'account'; modal.dataset.id = id;
        document.getElementById('modal-title').textContent = 'Редактировать аккаунт';
        document.getElementById('group-1').style.display = 'flex';
        document.getElementById('label-1').textContent = 'Название';
        document.getElementById('field-1').value = acc.name;
        document.getElementById('group-2').style.display = 'flex';
        document.getElementById('label-2').textContent = 'Площадка';
        document.getElementById('field-2').value = acc.platform || '';
        modal.showModal();
    };

    window.saveModal = function() {
        const modal = document.getElementById('edit-modal');
        const type = modal.dataset.type;

        if (type === 'account') {
            const name = document.getElementById('field-1').value.trim();
            const platform = document.getElementById('field-2').value.trim();
            if (!name) return alert("Введите название");
            const acc = currentData.accounts.find(a => a.id === modal.dataset.id);
            acc.name = name; acc.platform = platform;
        } else {
            const newText = document.getElementById('field-2').value.trim();
            if (!newText) return alert("Текст не может быть пустым");
            const nicheKey = modal.dataset.nicheKey, blockKey = modal.dataset.blockKey, source = modal.dataset.source, id = modal.dataset.id;
            const arr = source === 'universal' ? currentData.blocks.universal[blockKey] : currentData.blocks.niches[nicheKey][blockKey];
            const item = arr.find(x => x.id === id);
            if (item) item.text = newText;
        }
        saveData();
        modal.close();
        window.updateBuilderBlocks();
        window.renderEditorBlocks();
    };

    window.addAccount = function() {
        const name = prompt("Название аккаунта:");
        if (!name) return;
        currentData.accounts.push({ id: 'acc_' + Date.now(), name: name, platform: 'Авито' });
        saveData();
    };

    function renderAccounts() {
        const container = document.getElementById('accounts-list');
        container.innerHTML = currentData.accounts.length ? '' : '<p style="color: #888;">Здесь будут аккаунты</p>';
        currentData.accounts.forEach(acc => {
            const div = document.createElement('div'); div.className = 'item';
            div.innerHTML = `<div class="item-main"><div class="item-info"><h3>${acc.name}</h3><p>${acc.platform || ''}</p></div><div class="item-actions"><button onclick="window.editAccount('${acc.id}')">✏️</button><button onclick="window.deleteAccount('${acc.id}')">❌</button></div></div>`;
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
        if (filtered.length === 0) { container.innerHTML = '<p style="color: #888;">Ничего не найдено.</p>'; return; }
        
        filtered.forEach(temp => {
            const placedAccounts = currentData.placements.filter(p => p.templateId === temp.id).map(p => currentData.accounts.find(a => a.id === p.accountId)?.name).filter(Boolean);
            const badgesHtml = placedAccounts.length > 0 ? `<div class="badges-container">${placedAccounts.map(name => `<span class="account-badge">${name}</span>`).join('')}</div>` : '';
            const status = temp.status || 'active';
            const statusClass = `status-${status}`;
            const div = document.createElement('div'); div.className = 'item';
            const commentHtml = temp.comment ? `<div class="item-comment">💬 ${temp.comment}</div>` : '';
            div.innerHTML = `<div class="item-main"><div class="item-info"><h3>${temp.title}</h3>${commentHtml}<p style="margin-top:5px;">${temp.description.substring(0, 70)}...</p></div><div class="item-actions"><button onclick="window.copyTemplate('${temp.id}')">📋</button><button onclick="window.openAccountsModal('${temp.id}')">👤</button><button onclick="window.deleteTemplate('${temp.id}')">❌</button></div></div><div class="item-footer"><div>${badgesHtml}</div><select class="status-select ${statusClass}" onchange="window.updateStatus('${temp.id}', this.value)"><option value="active" ${status === 'active' ? 'selected' : ''}>Активно</option><option value="blocked" ${status === 'blocked' ? 'selected' : ''}>Заблокировано</option><option value="archived" ${status === 'archived' ? 'selected' : ''}>Архив</option></select></div>`;
            container.appendChild(div);
        });
    }

    window.updateStatus = function(id, newStatus) {
        const temp = currentData.templates.find(t => t.id === id);
        if (temp) { temp.status = newStatus; saveData(); }
    };

    window.openAccountsModal = function(templateId) {
        const modal = document.getElementById('accounts-modal');
        modal.dataset.templateId = templateId;
        const container = document.getElementById('accounts-checkboxes');
        container.innerHTML = '';
        if (currentData.accounts.length === 0) container.innerHTML = '<p>Нет аккаунтов.</p>';
        else {
            currentData.accounts.forEach(acc => {
                const isChecked = currentData.placements.some(p => p.templateId === templateId && p.accountId === acc.id);
                container.innerHTML += `<label class="checkbox-row"><input type="checkbox" value="${acc.id}" ${isChecked ? 'checked' : ''}><span>${acc.name}</span></label>`;
            });
        }
        modal.showModal();
    };

    window.saveAccountsLink = function() {
        const modal = document.getElementById('accounts-modal');
        const templateId = modal.dataset.templateId;
        const checkboxes = document.querySelectorAll('#accounts-checkboxes input[type="checkbox"]');
        currentData.placements = currentData.placements.filter(p => p.templateId !== templateId);
        checkboxes.forEach(cb => { if (cb.checked) currentData.placements.push({ id: 'plc_' + Date.now(), templateId, accountId: cb.value, date: new Date().toISOString() }); });
        saveData(); modal.close();
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
                    if(confirm("Вы уверены? Текущие данные будут заменены.")) {
                        currentData = importedData;
                        migrateBlockData();
                        saveData();
                        alert("База восстановлена!");
                    }
                } else { alert("Неверный формат."); }
            } catch (err) { alert("Ошибка чтения."); }
        };
        reader.readAsText(file);
    };

    init();
});
