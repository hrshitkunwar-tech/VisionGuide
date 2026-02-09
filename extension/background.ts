
/* global chrome */
// Fix for: Cannot find name 'chrome'
declare const chrome: any;

import { getSessionId } from './session';
import { sendScreenshot } from './api';
import { logger, LogLevel } from './logger';

const CONTEXT = 'BACKGROUND_WORKER';

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'capture-screen') {
    logger.log(LogLevel.INFO, CONTEXT, 'Capture command triggered');
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      logger.log(LogLevel.WARN, CONTEXT, 'No active tab found for capture');
      return;
    }

    try {
      logger.log(LogLevel.INFO, CONTEXT, 'Capturing visible tab...');
      const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
      const sessionId = await getSessionId();
      
      const payload = {
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        page: {
          url: tab.url || '',
          title: tab.title || ''
        },
        image: {
          format: 'png',
          base64: dataUrl.split(',')[1]
        }
      };

      const guidance = await sendScreenshot(payload);
      
      chrome.tabs.sendMessage(tab.id, { 
        type: 'RENDER_GUIDANCE', 
        guidance 
      });

    } catch (err: any) {
      logger.log(LogLevel.ERROR, CONTEXT, 'Failed to complete capture/guidance loop', {
        error: err.message,
        stack: err.stack
      });

      // Notify the content script about the error so it can show a user-friendly message
      chrome.tabs.sendMessage(tab.id, { 
        type: 'RENDER_ERROR', 
        message: 'Guidance service is currently unavailable. Please check your connection.'
      });
    }
  }
});

chrome.runtime.onInstalled.addListener(() => {
  logger.log(LogLevel.INFO, CONTEXT, 'VisionGuide Extension Installed');
});
