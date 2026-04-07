/**
 * avatar-cropper.js — 頭像裁切元件（延用 family-budget）
 */

const AvatarCropper = (() => {
  let _cropper = null;
  let _onDone = null;
  const _overlayId = 'avatar-cropper-overlay';

  function _buildOverlay() {
    if (document.getElementById(_overlayId)) return;
    const overlay = document.createElement('div');
    overlay.id = _overlayId;
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-sheet" style="max-height:95vh;">
        <div class="modal-handle"></div>
        <div class="modal-title">裁切頭像</div>
        <div style="position:relative;width:100%;height:300px;overflow:hidden;border-radius:12px;background:#000;">
          <img id="avatar-crop-img" style="max-width:100%;">
        </div>
        <p style="font-size:13px;color:var(--color-text-muted);text-align:center;margin:12px 0;">拖曳調整範圍，滾動縮放</p>
        <div style="display:flex;gap:12px;margin-top:8px;">
          <button class="btn btn-secondary btn-block" id="avatar-crop-cancel">取消</button>
          <button class="btn btn-primary btn-block" id="avatar-crop-confirm">使用此頭像</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('avatar-crop-cancel').onclick = () => {
      _destroy();
      Modal.hide(_overlayId);
    };
    document.getElementById('avatar-crop-confirm').onclick = () => {
      _getCroppedImage();
    };
  }

  function _destroy() {
    if (_cropper) { _cropper.destroy(); _cropper = null; }
  }

  function _getCroppedImage() {
    if (!_cropper) return;
    const canvas = _cropper.getCroppedCanvas({ width: 300, height: 300 });
    const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
    _destroy();
    Modal.hide(_overlayId);
    if (_onDone) _onDone({ base64, mimeType: 'image/jpeg', dataUrl: `data:image/jpeg;base64,${base64}` });
  }

  function open(src, onDone) {
    _buildOverlay();
    _onDone = onDone;
    const img = document.getElementById('avatar-crop-img');
    _destroy();
    img.src = src;
    Modal.show(_overlayId);
    setTimeout(() => {
      if (typeof Cropper !== 'undefined') {
        _cropper = new Cropper(img, {
          aspectRatio: 1, viewMode: 1, dragMode: 'move',
          autoCropArea: 0.9, restore: false, guides: false,
          center: false, highlight: false,
          cropBoxMovable: false, cropBoxResizable: false,
          toggleDragModeOnDblclick: false,
        });
      } else {
        Utils.compressImage(_dataUrlToFile(src, 'avatar.jpg'), 300, 0.9)
          .then(result => {
            _destroy();
            Modal.hide(_overlayId);
            if (onDone) onDone(result);
          });
      }
    }, 200);
  }

  function _dataUrlToFile(dataUrl, filename) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8 = new Uint8Array(n);
    while (n--) u8[n] = bstr.charCodeAt(n);
    return new File([u8], filename, { type: mime });
  }

  function pick(source, onDone) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') input.capture = 'user';
    input.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => open(ev.target.result, onDone);
      reader.readAsDataURL(file);
    };
    input.click();
  }

  return { open, pick };
})();
