
import { GuidanceResponse } from '../types';

let currentOverlay: HTMLElement | null = null;

export function renderGuidance(guidance: GuidanceResponse) {
  setupBaseOverlay();
  if (!currentOverlay) return;

  currentOverlay.classList.remove('vg-error');
  currentOverlay.classList.add('vg-active');
  const contentEl = currentOverlay.querySelector('.vg-content');
  if (contentEl) contentEl.innerHTML = guidance.overlay.text;

  // Highlighting Logic
  if (guidance.overlay.highlight) {
    applyHighlight(guidance.overlay.highlight.textMatch, guidance.overlay.highlight.style);
  }

  // Voice Logic
  if (guidance.voice?.text) {
    const utterance = new SpeechSynthesisUtterance(guidance.voice.text);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }
}

export function renderErrorMessage(message: string) {
  setupBaseOverlay();
  if (!currentOverlay) return;

  currentOverlay.classList.remove('vg-active');
  currentOverlay.classList.add('vg-error');
  const contentEl = currentOverlay.querySelector('.vg-content');
  if (contentEl) {
    contentEl.innerHTML = `<span style="color: #ef4444; font-weight: 600;">⚠️ Error</span><br/><span style="font-size: 13px;">${message}</span>`;
  }
}

function setupBaseOverlay() {
  if (currentOverlay) return;

  const overlay = document.createElement('div');
  overlay.id = 'vision-guide-overlay';
  overlay.innerHTML = `
    <div class="vg-header">
      <span class="vg-icon">✨</span>
      <span class="vg-title">Guidance</span>
      <button class="vg-close">&times;</button>
    </div>
    <div class="vg-content"></div>
  `;

  document.body.appendChild(overlay);
  currentOverlay = overlay;

  overlay.querySelector('.vg-close')?.addEventListener('click', () => {
    removeCurrentOverlay();
  });
}

function applyHighlight(text: string, style: string) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  let node;
  while (node = walker.nextNode()) {
    if (node.textContent?.includes(text)) {
      const parent = node.parentElement;
      if (parent) {
        parent.classList.add('vg-highlight', `vg-style-${style}`);
        parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
    }
  }
}

function removeCurrentOverlay() {
  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
  }
  document.querySelectorAll('.vg-highlight').forEach(el => {
    el.classList.remove('vg-highlight', 'vg-style-pulse', 'vg-style-static', 'vg-style-outline');
  });
}
