/**
 * modal.js — Modal / Bottom Sheet 元件
 */

const Modal = (() => {
  function show(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    overlay.onclick = e => {
      if (e.target === overlay) hide(id);
    };
  }

  function hide(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function confirm(message, { title = '確認', confirmText = '確認', cancelText = '取消', danger = false } = {}) {
    return new Promise(resolve => {
      let overlay = document.getElementById('confirm-modal-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'confirm-modal-overlay';
        overlay.className = 'modal-overlay confirm-modal';
        overlay.innerHTML = `
          <div class="modal-sheet">
            <div class="modal-handle"></div>
            <div class="modal-title" id="confirm-modal-title"></div>
            <div class="confirm-message" id="confirm-modal-message"></div>
            <div class="confirm-actions">
              <button class="btn btn-secondary btn-block" id="confirm-modal-cancel"></button>
              <button class="btn btn-block" id="confirm-modal-ok"></button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
      }

      document.getElementById('confirm-modal-title').textContent   = title;
      document.getElementById('confirm-modal-message').textContent = message;
      document.getElementById('confirm-modal-cancel').textContent  = cancelText;
      const okBtn = document.getElementById('confirm-modal-ok');
      okBtn.textContent = confirmText;
      okBtn.className = `btn btn-block ${danger ? 'btn-danger' : 'btn-primary'}`;

      const cleanup = result => {
        hide('confirm-modal-overlay');
        resolve(result);
      };

      document.getElementById('confirm-modal-cancel').onclick = () => cleanup(false);
      okBtn.onclick = () => cleanup(true);
      overlay.onclick = e => { if (e.target === overlay) cleanup(false); };

      show('confirm-modal-overlay');
    });
  }

  return { show, hide, confirm };
})();
