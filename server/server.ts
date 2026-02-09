
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { ScreenshotPayload, GuidanceResponse } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { ServerLogger, LogLevel } from './logger';
// Fix for: Cannot find name 'Buffer'. Explicitly importing it from the buffer module.
import { Buffer } from 'buffer';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const CONTEXT = 'SERVER_ROOT';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

// Initialize Gemini
// Always use process.env.API_KEY directly as per guidelines. 
// Do not define a local constant or request key management UI.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Perception Endpoint
 * Orchestrates: Supabase Storage -> Supabase DB -> Gemini Reasoning -> UI Feedback
 */
app.post('/v1/screenshot', async (req: Request, res: Response, next: NextFunction) => {
  const payload: ScreenshotPayload = req.body;
  const requestId = uuidv4();

  try {
    if (!payload.session_id || !payload.image?.base64) {
      ServerLogger.log(LogLevel.WARN, 'API_HANDLER', 'Invalid payload received', { requestId });
      return res.status(400).json({ error: 'Missing session_id or image data' });
    }

    ServerLogger.log(LogLevel.INFO, 'API_HANDLER', `Processing perception for ${payload.session_id}`, { requestId });

    // 1. Persist/Update Session
    await supabase.from('sessions').upsert({
      session_id: payload.session_id,
      last_seen_at: new Date().toISOString(),
      user_agent: req.headers['user-agent']
    }, { onConflict: 'session_id' });

    // 2. Upload Image to Supabase Storage
    // Using Buffer.from to convert base64 image data. Buffer is now imported from 'buffer'.
    const imageBuffer = Buffer.from(payload.image.base64, 'base64');
    const fileName = `${payload.session_id}/${requestId}.png`;
    
    const { error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // 3. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('screenshots')
      .getPublicUrl(fileName);

    // 4. Save Screenshot Record
    await supabase.from('screenshots').insert({
      id: requestId,
      session_id: payload.session_id,
      image_url: publicUrl,
      page_url: payload.page.url,
      page_title: payload.page.title,
      captured_at: new Date().toISOString()
    });

    // 5. Get AI Guidance
    const guidance = await getGeminiGuidance(payload, requestId);

    // 6. Save Guidance Event
    await supabase.from('guidance_events').insert({
      id: uuidv4(),
      session_id: payload.session_id,
      instruction: guidance.overlay.text,
      highlighted_text: guidance.overlay.highlight?.textMatch,
      voice_text: guidance.voice?.text,
      created_at: new Date().toISOString()
    });

    return res.status(200).json(guidance);
  } catch (error: any) {
    ServerLogger.log(LogLevel.ERROR, 'API_HANDLER', 'Perception loop failed', { 
      requestId, 
      error: error.message 
    });
    next(error);
  }
});

/**
 * Global Error Middleware
 */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  ServerLogger.log(LogLevel.ERROR, 'SERVER_ERROR', err.message, { stack: err.stack });
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

async function getGeminiGuidance(payload: ScreenshotPayload, requestId: string): Promise<GuidanceResponse> {
  // Using ai.models.generateContent to query GenAI with both model and prompt.
  // Using 'gemini-3-flash-preview' for basic text tasks including UI summarization/instruction.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: payload.image.base64,
            },
          },
          {
            text: `You are a screen-aware procedural assistant.
            The user is on: ${payload.page.title} (${payload.page.url}).
            Current Timestamp: ${payload.timestamp}.
            
            Instruction:
            1. Analyze the UI.
            2. Suggest EXACTLY ONE procedural next step.
            3. If a specific UI element is key, provide the textMatch for highlighting.
            4. Provide concise voice guidance for the user.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overlay: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              highlight: {
                type: Type.OBJECT,
                properties: {
                  textMatch: { type: Type.STRING },
                  style: { type: Type.STRING, enum: ['pulse', 'static', 'outline'] }
                },
                required: ['textMatch', 'style']
              }
            },
            required: ['text']
          },
          voice: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING }
            },
            required: ['text']
          }
        },
        required: ['overlay']
      }
    }
  });

  // Accessing response.text directly (property, not a method).
  const jsonStr = response.text?.trim() || '{}';
  return JSON.parse(jsonStr);
}

const PORT = 3000;
app.listen(PORT, () => {
  ServerLogger.log(LogLevel.INFO, CONTEXT, `VisionGuide Orchestrator running on port ${PORT}`);
});
