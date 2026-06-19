const ICONS = {
  success: '<ion-icon name="checkmark-outline" class="text-green-500 w-5 h-5"></ion-icon>',
  error: '<ion-icon name="close-outline" class="text-red-500 w-5 h-5"></ion-icon>',
  info: '<ion-icon name="information-outline" class="text-yellow-500 w-5 h-5"></ion-icon>',
};

const DURATION = 5000;

const dismissToast = (toastEl) => {
  toastEl.classList.remove('opacity-100', 'translate-x-0');
  toastEl.classList.add('opacity-0', 'translate-x-4');
  toastEl.addEventListener('transitionend', () => toastEl.remove(), { once: true });
};

/**
 * @param {Object} props
 * @param {'error' | 'success' | 'info'} props.type
 * @param {string} props.text
 */
export const showToast = ({ type, text }) => {
  const container = document.querySelector('#toast-container');
  if (!container) return;

  const toastEl = document.createElement('div');
  toastEl.setAttribute('role', 'alert');
  toastEl.className =
    'flex items-center w-full max-w-sm p-2 rounded shadow-xs border border-gray-400 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 ' +
    'opacity-0 translate-x-4 transition-all duration-300 ease-in-out';

  const iconDiv = document.createElement('div');
  iconDiv.className = 'inline-flex items-center justify-center shrink-0 w-7 h-7 rounded';
  iconDiv.innerHTML = ICONS[type] ?? '';

  const textDiv = document.createElement('div');
  textDiv.className = 'ms-3 text-sm font-normal';
  textDiv.textContent = text;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.className =
    'ms-auto flex items-center justify-center hover:text-heading bg-transparent ' +
    'border border-transparent hover:bg-neutral-secondary-medium focus:ring-4 ' +
    'focus:ring-neutral-tertiary rounded text-sm h-8 w-8 focus:outline-none';
  closeBtn.innerHTML = '<ion-icon name="close-outline" class="w-5 h-5"></ion-icon>';

  toastEl.appendChild(iconDiv);
  toastEl.appendChild(textDiv);
  toastEl.appendChild(closeBtn);
  container.appendChild(toastEl);

  // Trigger enter animation on next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toastEl.classList.remove('opacity-0', 'translate-x-4');
      toastEl.classList.add('opacity-100', 'translate-x-0');
    });
  });

  const timerId = setTimeout(() => dismissToast(toastEl), DURATION);

  closeBtn.addEventListener('click', () => {
    clearTimeout(timerId);
    dismissToast(toastEl);
  });
};
