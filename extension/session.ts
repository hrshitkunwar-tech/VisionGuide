
/* global chrome */
// Fix for: Cannot find name 'chrome'
declare const chrome: any;

import { v4 as uuidv4 } from 'uuid';

export async function getSessionId(): Promise<string> {
  const result = await chrome.storage.local.get(['session_id']);
  if (result.session_id) {
    return result.session_id;
  }
  
  const newSessionId = `sess_${uuidv4().split('-')[0]}`;
  await chrome.storage.local.set({ session_id: newSessionId });
  return newSessionId;
}
