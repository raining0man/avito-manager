document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('sync-status');
    
    // 1. Проверка загрузки Firebase
    if (!window.db || !window.auth) {
        statusEl.textContent = "Ошибка: Firebase не загрузился!";
        statusEl.style.color = "#ef4444";
        return;
    }

    statusEl.textContent = "Авторизация...";
    
    // 2. Попытка входа с обработкой сетевой ошибки
    window.signInAnonymously(window.auth).then(() => {
        statusEl.textContent = "Синхронизация...";
        startSync();
    }).catch((error) => {
        console.error("Ошибка авторизации:", error);
        if (error.code === 'auth/network-request-failed') {
            statusEl.textContent = "Ошибка сети! Отключите VPN/AdBlock";
        } else {
            statusEl.textContent = "Ошибка входа: " + error.message;
        }
        statusEl.style.color = "#ef4444";
    });

    // --- БАЗА БЛОКОВ ---
    const universalBlocks = {
        photo: [
            "Просьба - присылайте фото авто целиком и фото поврежденного участка на удалении и вблизи. Если причиной поломки было ДТП, кратко изложите подробности - это поможет точнее определить характер повреждений.",
            "Для точной оценки скиньте общий вид машины и сам дефект (издалека и крупным планом). Если была авария — напишите пару слов о том, как это произошло."
        ],
        visit: [
            "А лучше приезжайте на бесплатный осмотр! Покажем фронт работ и проконсультируем. Решение всегда останется за вами.",
            "Запишитесь на бесплатный осмотр. Мастер всё проверит, расскажет подробно, а вы уже решите, подходит вам это или нет."
        ],
        brands: [
            "Работаем с авто: Lada, УАЗ, ГАЗ, Toyota, Nissan, Volkswagen, BMW, Mercedes-Benz, Audi, Mazda, Kia, Hyundai и другими.",
            "Обслуживаем все популярные марки: BMW, Mercedes-Benz, Audi, Volkswagen, Toyota, Kia, Hyundai, Skoda, Lada, Mazda и другие."
        ],
        location: [
            "📍 Находимся в 5 минутах от м. Старая Деревня.\nНапишите или позвоните — забронируем место в очереди.",
            "📍 Мы в 5 минутах ходьбы от м. Старая Деревня.\nОставьте сообщение — ответим и предложим удобное время для визита."
        ]
    };

    const nichesData = {
        "thresholds": {
            name: "Кузовной ремонт / Переварка порогов",
            blocks: {
                problem: [
                    "Хотите забыть о ржавчине навсегда? Мы не просто варим металл, мы восстанавливаем его с премиальной защитой. Используем технологию лужения оловом. Гарантия на все швы — 12 месяцев.",
                    "Сквозная ржавчина на порогах? Пора варить. Сделаем всё четко, с гарантией 12 месяцев. Работаем быстро: от 3 до 7 дней в зависимости от объема."
                ],
                process: [
                    "🔧 Что мы делаем:\n— Демонтаж навесных элементов (двери, крылья)\n— Изготовление ремвставок по точным замерам\n— Вырезка пораженного коррозией металла до чистого\n— Сварка полуавтоматом\n— Обработка скрытых полостей антикором\n— Лужение оловом\n— Шпатлевка, грунтовка и покраска",
                    "Этапы работ:\n— Подготовка кузова\n— Подбор деталей по VIN либо изготовление ремвставок\n— Вырезка гнилого металла\n— Сварка полуавтоматом\n— Зачистка швов\n— Обработка антикором\n— Шпатлевка, грунтовка, покраска"
                ],
                advantages: [
                    "💡 Почему автовладельцы выбирают нас:\n— Лужение оловом — это 100% гарантия, что порог не сгниет изнутри\n— Никакого навязывания: смотрим бесплатно\n— Полный цикл в одном месте (сварка + малярка)\n— Прозрачный фотоотчет: всегда покажем, что было под краской",
                    "Почему стоит обратиться к нам:\n— Свои ремвставки вместо дешевых «заплаток»\n— Качественный антикор со всех сторон\n— Один сервис на все: ходовая, двигатель, кузов, малярка\n— Показываем старый металл до того, как его срежем"
                ],
                top_services: [
                    "🛠 Топ услуг:\n— Переварка одного или двух порогов\n— Лужение кузова оловом\n— Переварка арок\n— Переварка стаканов\n— Частичная переварка\n— Переварка с покраской или антикором",
                    "Что можем сделать:\n— Частичный ремонт или полная переварка\n— Сварка порогов с антикором или покраской\n— Косметический ремонт без сварки\n— Переварка арок и стаканов"
                ],
                cta: [
                    "Напишите — забронируем место в очереди на ближайшее время.",
                    "Оставьте заявку — проконсультируем и назовём точную стоимость."
                ]
            }
        },
        "painting": {
            name: "Малярные работы / Покраска",
            blocks: {
                problem: [
                    "Царапины, сколы или выгоревшая краска? Вернём автомобилю заводской вид. Красим в профессиональной камере с точным компьютерным подбором цвета. Гарантия 12 месяцев.",
                    "Хотите обновить внешний вид авто? Выполним локальную или полную покраску с идеальным подбором цвета по коду."
                ],
                process: [
                    "🔧 Что входит в покраску:\n— Подготовка поверхности, шлифовка и обезжиривание\n— Нанесение грунта и шпатлёвка (при необходимости)\n— Компьютерный подбор цвета по коду (спектрофотометр)\n— Покраска в камере (без пыли и подтёков)\n— Нанесение лака и финишная полировка",
                    "Этапы работ:\n— Мойка и оценка ЛКП\n— Шлифовка и обезжиривание\n— Грунтование\n— Подбор цвета\n— Покраска в камере\n— Полировка"
                ],
                advantages: [
                    "💡 Чем мы полезны:\n— Собственная покрасочная камера — идеальное покрытие\n— Подбираем цвет по коду и спектрофотометру — границу не видно\n— Показываем пробный образец до начала покраски\n— Все работы под одной крышей",
                    "Наши плюсы:\n— Работаем с любыми марками авто\n— Используем качественные материалы\n— Даем гарантию на ЛКП\n— Прозрачный фотоотчет до и после"
                ],
                top_services: [
                    "🛠 Топ услуг:\n— Покраска одного элемента\n— Локальная покраска\n— Покраска переходом\n— Покраска нескольких элементов\n— Полировка кузова\n— Удаление царапин и сколов",
                    "Что мы красим:\n— Крылья, двери, бамперы, капот\n— Локальные участки\n— Пластик и молдинги\n— Полировка после покраски"
                ],
                cta: [
                    "Скиньте фото повреждения в чат — сориентируем по цене и срокам.",
                    "Позвоните — подберём удобное время для визита в малярный цех."
                ]
            }
        }
    };

    let currentData = { accounts: [], templates: [], placements: [] };

    function startSync() {
        const docRef = window.doc(window.db, "data/main");
        window.onSnapshot(docRef, (docSnap) => {
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

    function initBuilder() {
        const nicheSelect = document.getElementById('niche-select');
        nicheSelect.innerHTML = '<option value="">-- Выберите нишу --</option>';
        for (const key in nichesData) {
            nicheSelect.innerHTML += `<option value="${key}">${nichesData[key].name}</option>`;
        }
    }

    window.updateBuilderBlocks = function() {
        const nicheKey = document.getElementById('niche-select').value;
        const container = document.getElementById('block-selectors');
        container.innerHTML = '';

        if (!nicheKey) {
            document.getElementById('ad-preview').value = '';
            window.updateCounters();
            return;
        }

        const nicheBlocks = nichesData[nicheKey].blocks;
        const blockConfig = [
            { key: 'photo', label: '1. Просьба прислать фото', source: 'universal' },
            { key: 'visit', label: '2. Призыв приехать на осмотр', source: 'universal' },
            { key: 'problem', label: '3. Описание проблемы', source: 'niche' },
            { key: 'process', label: '4. Что мы делаем', source: 'niche' },
            { key: 'advantages', label: '5. Почему выбирают нас', source: 'niche' },
            { key: 'cta', label: '6. Призыв', source: 'niche' },
            { key: 'top_services', label: '7. Топ услуг', source: 'niche' },
            { key: 'brands', label: '8. Работаем с марками', source: 'universal' },
            { key: 'location', label: '9. Находимся', source: 'universal' }
        ];

        blockConfig.forEach(config => {
            const options = config.source === 'universal' ? universalBlocks[config.key] : nicheBlocks[config.key];
            if (options && options.length > 0) {
                let selectHtml = `<div class="input-group"><label>${config.label}</label><select class="block-select" data-key="${config.key}" onchange="window.assemblePreview()"><option value="">-- Не использовать --</option>`;
                options.forEach((opt, index) => {
                    selectHtml += `<option value="${index}">Вариант ${index + 1}: ${opt.substring(0, 50)}...</option>`;
                });
                selectHtml += `</select></div>`;
                container.innerHTML += selectHtml;
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
            const index = select.value;
            if (index !== "") {
                const isUniversal = universalBlocks[key] !== undefined;
                const text = isUniversal ? universalBlocks[key][index] : nichesData[nicheKey].blocks[key][index];
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

        if (!title) return alert("Введите название объявления!");
        if (!description) return alert("Выберите хотя бы один блок!");
        if (!nicheKey) return alert("Выберите нишу!");

        currentData.templates.push({ id: 'temp_' + Date.now(), title, description, comment, niche: nicheKey });
        saveData();
        
        document.getElementById('ad-title').value = '';
        document.getElementById('ad-comment').value = '';
        document.getElementById('ad-preview').value = '';
        document.querySelectorAll('.block-select').forEach(s => s.value = '');
        window.updateCounters();
        alert("Объявление сохранено!");
    };

    function renderAll() {
        renderAccounts();
        renderTemplates();
        renderMatrix();
    }

    function renderAccounts() {
        const container = document.getElementById('accounts-list');
        container.innerHTML = currentData.accounts.length ? '' : '<p style="color: #888;">Здесь будут аккаунты</p>';
        currentData.accounts.forEach(acc => {
            const div = document.createElement('div');
            div.className = 'item';
            div.innerHTML = `
                <div class="item-info"><h3>${acc.name}</h3><p>${acc.platform || 'Без площадки'}</p></div>
                <div class="item-actions">
                    <button onclick="window.openModal('account', '${acc.id}')" title="Редактировать">✏️</button>
                    <button onclick="window.deleteAccount('${acc.id}')" title="Удалить">❌</button>
                </div>`;
            container.appendChild(div);
        });
    }

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

    window.openModal = function(type, id = null) {
        const modal = document.getElementById('edit-modal');
        modal.dataset.type = type;
        modal.dataset.id = id || '';
        document.getElementById('modal-title').textContent = id ? 'Редактировать' : 'Новый аккаунт';
        document.getElementById('label-1').textContent = 'Название аккаунта';
        document.getElementById('label-2').textContent = 'Площадка';
        
        if (id) {
            const acc = currentData.accounts.find(a => a.id === id);
            document.getElementById('field-1').value = acc.name;
            document.getElementById('field-2').value = acc.platform || '';
        } else {
            document.getElementById('field-1').value = '';
            document.getElementById('field-2').value = 'Авито';
        }
        modal.showModal();
    };

    window.saveModal = function() {
        const modal = document.getElementById('edit-modal');
        const id = modal.dataset.id;
        const val1 = document.getElementById('field-1').value.trim();
        const val2 = document.getElementById('field-2').value.trim();
        if (!val1) return alert("Заполните название");

        if (id) {
            const acc = currentData.accounts.find(a => a.id === id);
            acc.name = val1; acc.platform = val2;
        } else {
            currentData.accounts.push({ id: 'acc_' + Date.now(), name: val1, platform: val2 });
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
        if (!confirm("Удалить объявление?")) return;
        currentData.templates = currentData.templates.filter(t => t.id !== id);
        currentData.placements = currentData.placements.filter(p => p.templateId !== id);
        saveData();
    };

    window.copyTemplate = function(id) {
        const temp = currentData.templates.find(t => t.id === id);
        if (temp) navigator.clipboard.writeText(temp.description).then(() => alert("Текст скопирован!"));
    };

    initBuilder();
    document.querySelectorAll('.btn-add')[0].onclick = () => window.openModal('account');
});
