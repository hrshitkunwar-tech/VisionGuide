
/* global chrome */
// Fix for: Cannot find name 'chrome'
declare const chrome: any;

import { renderGuidance, renderErrorMessage } from './overlay';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RENDER_GUIDANCE') {
    renderGuidance(message.guidance);
  } else if (message.type === 'RENDER_ERROR') {
    renderErrorMessage(message.message);
  }
});

console.log('VisionGuide Assistant Content Script Loaded');
