export function openModal(html, setup) {
    const dialog = document.getElementById('modal');
    dialog.innerHTML = `<div class="modal-inner">${html}</div>`;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    if (setup) setup(dialog);
    return dialog;
}

export function closeModal() {
    const dialog = document.getElementById('modal');
    if (dialog.open) dialog.close();
    else dialog.removeAttribute('open');
}

/**
 * Универсальный confirm через модалку.
 */
export function confirmModal(title, bodyHtml = '') {
    return new Promise(resolve => {
        const dialog = openModal(`
            <div class="modal-title">${title}</div>
            ${bodyHtml ? `<div class="modal-body">${bodyHtml}</div>` : ''}
            <div class="modal-footer">
                <button class="btn btn-secondary" data-action="cancel">Отмена</button>
                <button class="btn btn-danger" data-action="confirm">Подтвердить</button>
            </div>
        `);
        dialog.querySelector('[data-action="cancel"]').onclick = () => { closeModal(); resolve(false); };
        dialog.querySelector('[data-action="confirm"]').onclick = () => { closeModal(); resolve(true); };
        dialog.addEventListener('close', () => resolve(false), { once: true });
    });
}

/**
 * Универсальный prompt через модалку.
 * Возвращает строку или null.
 */
export function promptModal(title, { placeholder = '', value = '', label = '', multiline = false } = {}) {
    return new Promise(resolve => {
        const dialog = openModal(`
            <div class="modal-title">${title}</div>
            <div class="modal-body">
                ${label ? `<label style="font-weight:600;font-size:0.85rem;">${label}</label>` : ''}
                ${multiline
                    ? `<textarea data-field rows="5" placeholder="${placeholder}">${value}</textarea>`
                    : `<input data-field type="text" placeholder="${placeholder}" value="${value}">`}
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-action="cancel">Отмена</button>
                <button class="btn btn-primary" data-action="confirm">Готово</button>
            </div>
        `, d => {
            const f = d.querySelector('[data-field]');
            f.focus();
            f.onkeydown = e => {
                if (!multiline && e.key === 'Enter') d.querySelector('[data-action="confirm"]').click();
            };
        });
        dialog.querySelector('[data-action="cancel"]').onclick = () => { closeModal(); resolve(null); };
        dialog.querySelector('[data-action="confirm"]').onclick = () => {
            const v = dialog.querySelector('[data-field]').value.trim();
            closeModal();
            resolve(v || null);
        };
        dialog.addEventListener('close', () => resolve(null), { once: true });
    });
}
