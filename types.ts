
export interface Session {
  session_id: string;
  created_at: string;
  last_seen_at: string;
  user_agent: string;
}

export interface Screenshot {
  id: string;
  session_id: string;
  image_url: string;
  page_url: string;
  page_title: string;
  captured_at: string;
}

export interface GuidanceEvent {
  id: string;
  session_id: string;
  instruction: string;
  highlighted_text?: string;
  voice_text?: string;
  created_at: string;
}

export interface GuidanceResponse {
  overlay: {
    text: string;
    highlight?: {
      textMatch: string;
      style: 'pulse' | 'static' | 'outline';
    };
  };
  voice?: {
    text: string;
  };
}

export interface ScreenshotPayload {
  session_id: string;
  timestamp: string;
  page: {
    url: string;
    title: string;
  };
  image: {
    format: string;
    base64: string;
  };
}
