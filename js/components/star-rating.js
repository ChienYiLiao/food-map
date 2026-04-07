/**
 * star-rating.js — 1~5 顆星評分元件
 */

const StarRating = {
  /**
   * 渲染互動式星級評分
   * @param {HTMLElement} container
   * @param {object} options
   *   - value: 目前值（1~5，0 = 未評）
   *   - onChange: (newValue) => void
   *   - size: 'sm' | 'md' | 'lg'（預設 md）
   *   - readOnly: boolean
   */
  render(container, options = {}) {
    const { value = 0, onChange, size = 'md', readOnly = false } = options;
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = `star-rating ${size} ${readOnly ? 'readonly' : ''}`;

    let currentValue = value;

    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.className = 'star';
      star.dataset.value = i;
      star.textContent = i <= currentValue ? '⭐' : '☆';

      if (!readOnly) {
        star.addEventListener('click', () => {
          currentValue = i;
          _updateStars(wrap, currentValue);
          if (onChange) onChange(currentValue);
        });
        star.addEventListener('mouseenter', () => _updateStars(wrap, i));
        star.addEventListener('mouseleave', () => _updateStars(wrap, currentValue));
        // 觸控
        star.addEventListener('touchstart', e => {
          e.preventDefault();
          currentValue = i;
          _updateStars(wrap, currentValue);
          if (onChange) onChange(currentValue);
        }, { passive: false });
      }

      wrap.appendChild(star);
    }

    container.appendChild(wrap);
    return {
      getValue: () => currentValue,
      setValue: v => {
        currentValue = v;
        _updateStars(wrap, v);
      }
    };
  },

  /**
   * 渲染靜態星級（唯讀）
   */
  renderStatic(container, value, size = 'sm') {
    return StarRating.render(container, { value, size, readOnly: true });
  }
};

function _updateStars(wrap, hoverValue) {
  wrap.querySelectorAll('.star').forEach((star, idx) => {
    star.textContent = (idx + 1) <= hoverValue ? '⭐' : '☆';
  });
}
