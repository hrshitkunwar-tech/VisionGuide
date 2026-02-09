
import { ScreenshotPayload, GuidanceResponse } from '../types';
import { logger, LogLevel } from './logger';

const BACKEND_URL = 'http://localhost:3000/v1'; // Standardized local dev URL

export async function sendScreenshot(payload: ScreenshotPayload): Promise<GuidanceResponse> {
  const context = 'API_SERVICE';
  logger.log(LogLevel.INFO, context, `Sending screenshot for session: ${payload.session_id}`, { url: payload.page.url });

  try {
    const response = await fetch(`${BACKEND_URL}/screenshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.log(LogLevel.ERROR, context, `API request failed with status: ${response.status}`, { error: errorText });
      throw new Error(`Server responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    logger.log(LogLevel.INFO, context, 'Guidance received successfully', { guidance: data });
    return data;
  } catch (error: any) {
    logger.log(LogLevel.ERROR, context, 'Network or API error occurred', { 
      message: error.message,
      stack: error.stack 
    });
    
    // Provide a descriptive fallback or rethrow to be handled by background script
    throw error;
  }
}
