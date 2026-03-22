import React, { useEffect, useMemo, useState } from 'react';
import {
  Layout,
  Search,
  Activity,
  Terminal,
  Monitor,
  User,
  Database,
  RefreshCcw,
  Download,
  ChevronRight,
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { GuidanceEvent, ReasoningEvent, Screenshot, Session } from './types';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// Guard: @supabase/supabase-js v2 throws synchronously if the URL is empty.
// When no credentials are provided the app boots in demo/synthetic mode —
// the existing fallback path in fetchSessionDetails handles this gracefully.
const supabase = SUPABASE_URL
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : {
      from: () => ({
        select: () => ({ order: () => ({ data: [], error: null }) }),
        upsert: () => ({ data: null, error: null }),
        insert: () => ({ data: null, error: null }),
      }),
      channel: () => ({
        on: function () { return this; },
        subscribe: () => ({ unsubscribe: () => {} }),
      }),
      removeChannel: () => {},
      storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    } as any;

type DashboardTab = 'guidance' | 'reasoning' | 'artifacts';

const TABS: Array<{ id: DashboardTab; label: string; hint: string }> = [
  { id: 'guidance', label: 'Guidance', hint: 'Operator instructions and voice guidance' },
  { id: 'reasoning', label: 'Reasoning', hint: 'Live reasoning and execution-state timeline' },
  { id: 'artifacts', label: 'Artifacts', hint: 'Frames, URLs, and generated replay assets' },
];

const STAGE_LABELS: Record<string, string> = {
  capture: 'Capture',
  analyze: 'Analyze',
  rank: 'Rank',
  draft: 'Draft',
  negotiate: 'Negotiate',
  submit: 'Submit',
  verify: 'Verify',
  respond: 'Respond',
};

const ACTOR_LABELS: Record<string, string> = {
  perception: 'Perception',
  planner: 'Planner',
  matcher: 'Matcher',
  outreach: 'Outreach',
  scheduler: 'Scheduler',
  executor: 'Executor',
};

const STATUS_CLASSES: Record<string, string> = {
  queued: 'bg-slate-100 text-slate-600 border-slate-200',
  running: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  blocked: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
};

const buildSyntheticReasoningEvents = (guidance: GuidanceEvent[], screenshots: Screenshot[]): ReasoningEvent[] =>
  guidance
    .map((item, index) => ({
      id: `synthetic-${item.id}`,
      session_id: item.session_id,
      actor: index % 2 === 0 ? 'planner' : 'executor',
      stage: index % 2 === 0 ? 'draft' : 'respond',
      status: 'completed',
      summary: index % 2 === 0
        ? 'Guidance draft synthesized from the latest captured frame.'
        : 'Guidance delivered back to the dashboard and overlay.',
      details: {
        instruction: item.instruction,
        voice_text: item.voice_text,
        screenshot_id: screenshots[index]?.id ?? null,
      },
      confidence: 0.72,
      latency_ms: null,
      artifact_ref: screenshots[index]?.image_url ?? null,
      created_at: item.created_at,
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

const formatLabel = (value: string | undefined, mapping: Record<string, string>) => {
  if (!value) {
    return 'Unknown';
  }
  return mapping[value] || value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatDetails = (details: Record<string, unknown> | null | undefined) => {
  if (!details || Object.keys(details).length === 0) {
    return 'No extra metadata';
  }
  return JSON.stringify(details, null, 2);
};

const App: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [guidance, setGuidance] = useState<GuidanceEvent[]>([]);
  const [reasoningEvents, setReasoningEvents] = useState<ReasoningEvent[]>([]);
  const [activeTab, setActiveTab] = useState<DashboardTab>('reasoning');
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [reasoningAvailable, setReasoningAvailable] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .order('last_seen_at', { ascending: false });

      if (sessionData) {
        setSessions(sessionData);
        if (!selectedSessionId && sessionData.length > 0) {
          setSelectedSessionId(sessionData[0].session_id);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionDetails = async (sessionId: string) => {
    const { data: shotData } = await supabase
      .from('screenshots')
      .select('*')
      .eq('session_id', sessionId)
      .order('captured_at', { ascending: true });

    const { data: guidanceData } = await supabase
      .from('guidance_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    const shots = shotData || [];
    const guides = guidanceData || [];
    setScreenshots(shots);
    setGuidance(guides);

    try {
      const { data: reasoningData, error } = await supabase
        .from('reasoning_events')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      setReasoningAvailable(true);
      setReasoningEvents((reasoningData || []) as ReasoningEvent[]);
    } catch (error) {
      console.warn('reasoning_events unavailable, using synthetic reasoning stream', error);
      setReasoningAvailable(false);
      setReasoningEvents(buildSyntheticReasoningEvents(guides, shots));
    }
  };

  const handleDownloadExtension = async () => {
    setIsExporting(true);
    try {
      const zip = new JSZip();

      zip.file(
        'manifest.json',
        JSON.stringify(
          {
            manifest_version: 3,
            name: 'VisionGuide Assistant',
            version: '1.0.0',
            permissions: ['activeTab', 'storage', 'scripting', 'tabs'],
            host_permissions: ['<all_urls>'],
            background: { service_worker: 'background.js', type: 'module' },
            content_scripts: [
              {
                matches: ['<all_urls>'],
                js: ['content.js'],
                css: ['styles.css'],
              },
            ],
            action: { default_popup: 'popup.html' },
            commands: {
              'capture-screen': {
                suggested_key: { default: 'Ctrl+Shift+S', mac: 'Command+Shift+S' },
                description: 'Capture screen for guidance',
              },
            },
          },
          null,
          2
        )
      );

      zip.file(
        'popup.html',
        `
        <!DOCTYPE html>
        <html>
          <body style="width: 200px; padding: 16px; font-family: sans-serif;">
            <h3 style="margin: 0 0 8px; font-size: 14px;">VisionGuide</h3>
            <p style="font-size: 12px; color: #666;">Press <b>Cmd+Shift+S</b> to capture your screen and get AI guidance.</p>
          </body>
        </html>
      `
      );

      zip.file(
        'styles.css',
        `
        #vision-guide-overlay { position: fixed; bottom: 24px; right: 24px; width: 320px; background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; z-index: 2147483647; font-family: sans-serif; overflow: hidden; }
        .vg-header { padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; }
        .vg-title { font-weight: 600; font-size: 14px; flex-grow: 1; }
        .vg-content { padding: 16px; color: #475569; font-size: 14px; }
        .vg-highlight { outline: 3px solid #6366f1; border-radius: 4px; animation: vg-pulse 2s infinite; }
        @keyframes vg-pulse { 0% { outline-offset: 0; } 50% { outline-offset: 6px; outline-color: transparent; } 100% { outline-offset: 0; } }
      `
      );

      zip.file(
        'background.js',
        `
        console.log('Background Worker Loaded');
        chrome.commands.onCommand.addListener(async (command) => {
          if (command === 'capture-screen') {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
            console.log('Captured screen for tab', tab.id, dataUrl.slice(0, 32));
            chrome.tabs.sendMessage(tab.id, { type: 'RENDER_GUIDANCE', guidance: { overlay: { text: 'Analyzing...' } } });
          }
        });
      `
      );

      zip.file(
        'content.js',
        `
        chrome.runtime.onMessage.addListener((msg) => {
          if (msg.type === 'RENDER_GUIDANCE') {
            let div = document.getElementById('vg-ov');
            if (!div) {
              div = document.createElement('div');
              div.id = 'vg-ov';
              div.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:9999;background:white;padding:20px;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.1);border:1px solid #eee;width:250px;";
              document.body.appendChild(div);
            }
            div.textContent = "Guidance: " + msg.guidance.overlay.text;
          }
        });
      `
      );

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'vision-guide-extension.zip');
    } catch (error) {
      console.error('Export failed', error);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('visionguide-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'screenshots' }, () => {
        fetchData();
        if (selectedSessionId) {
          fetchSessionDetails(selectedSessionId);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guidance_events' }, () => {
        if (selectedSessionId) {
          fetchSessionDetails(selectedSessionId);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reasoning_events' }, () => {
        if (selectedSessionId) {
          fetchSessionDetails(selectedSessionId);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSessionId]);

  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionDetails(selectedSessionId);
    }
  }, [selectedSessionId]);

  const cappedReasoningEvents = useMemo(
    () => [...reasoningEvents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 30),
    [reasoningEvents]
  );

  const currentStage = useMemo(() => {
    const running = cappedReasoningEvents.find((event) => event.status === 'running');
    return running ? formatLabel(running.stage, STAGE_LABELS) : formatLabel(cappedReasoningEvents[0]?.stage, STAGE_LABELS);
  }, [cappedReasoningEvents]);

  const latestLatency = useMemo(() => {
    const withLatency = cappedReasoningEvents.find((event) => typeof event.latency_ms === 'number' && event.latency_ms !== null);
    return withLatency?.latency_ms ? `${Math.round(withLatency.latency_ms)}ms` : '—';
  }, [cappedReasoningEvents]);

  const latestReasoning = cappedReasoningEvents[0];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-sm shadow-indigo-200">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">VisionGuide</h1>
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">Navigator Lab</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search sessions..."
              className="w-full pl-10 pr-4 py-2 bg-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all border-transparent border focus:bg-white"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="flex items-center justify-between mb-2 px-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Sessions</div>
            <button
              onClick={fetchData}
              className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-md hover:bg-slate-100"
            >
              <RefreshCcw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {sessions.length === 0 ? (
            <div className="text-center py-12 opacity-30">
              <Database className="w-10 h-10 mx-auto mb-3" />
              <p className="text-xs font-medium">No sessions detected</p>
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.session_id}
                onClick={() => setSelectedSessionId(session.session_id)}
                className={`w-full text-left p-3 rounded-xl transition-all group ${
                  selectedSessionId === session.session_id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-1.5 rounded-lg ${
                      selectedSessionId === session.session_id ? 'bg-white/20' : 'bg-slate-100 group-hover:bg-white'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{session.session_id}</div>
                    <div
                      className={`text-[10px] ${
                        selectedSessionId === session.session_id ? 'text-indigo-100' : 'text-slate-400'
                      }`}
                    >
                      {new Date(session.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-3 h-3 transition-opacity ${
                      selectedSessionId === session.session_id ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                </div>
              </button>
            ))
          )}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50/50">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Session Insight</h2>
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              REALTIME
            </div>
            {!reasoningAvailable && (
              <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-100">
                SYNTHETIC REASONING
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleDownloadExtension}
              disabled={isExporting}
              className="flex items-center gap-2 text-xs font-bold px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-50"
            >
              {isExporting ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              EXPORT EXTENSION
            </button>
            <div className="h-6 w-px bg-slate-200 mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="text-[10px] text-slate-400 font-mono text-right leading-tight">
                <span className="block opacity-60">CONTEXT_ID</span>
                <span className="font-bold text-slate-600">{selectedSessionId?.slice(0, 12) || '---'}</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                <Terminal className="w-4 h-4 text-slate-500" />
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <StatCard icon={<Monitor className="w-4 h-4" />} label="Frames" value={screenshots.length} color="blue" />
            <StatCard icon={<Activity className="w-4 h-4" />} label="Guidance" value={guidance.length} color="indigo" />
            <StatCard icon={<Terminal className="w-4 h-4" />} label="Reasoning" value={cappedReasoningEvents.length} color="emerald" />
            <StatCard icon={<Database className="w-4 h-4" />} label="Current Stage" value={currentStage} color="orange" />
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl border text-left transition-all ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-700'
                }`}
              >
                <div className="text-sm font-semibold">{tab.label}</div>
                <div className={`text-[11px] ${activeTab === tab.id ? 'text-slate-300' : 'text-slate-400'}`}>{tab.hint}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_420px] gap-8">
            <section>
              {activeTab === 'guidance' && (
                <GuidancePane screenshots={screenshots} guidance={guidance} />
              )}
              {activeTab === 'reasoning' && (
                <ReasoningPane events={cappedReasoningEvents} />
              )}
              {activeTab === 'artifacts' && (
                <ArtifactPane screenshots={screenshots} reasoningEvents={cappedReasoningEvents} />
              )}
            </section>

            <aside className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Live Reasoning & State</div>
                    <div className="text-sm font-semibold text-slate-900 mt-1">Navigator Lab operator feed</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400">Latency</div>
                    <div className="text-sm font-semibold text-slate-900">{latestLatency}</div>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {latestReasoning ? (
                    <>
                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${STATUS_CLASSES[latestReasoning.status] || STATUS_CLASSES.queued}`}>
                            {latestReasoning.status.toUpperCase()}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {formatLabel(latestReasoning.actor, ACTOR_LABELS)} · {formatLabel(latestReasoning.stage, STAGE_LABELS)}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 leading-relaxed">{latestReasoning.summary}</p>
                        <div className="mt-3 text-xs text-slate-500 flex items-center justify-between">
                          <span>{new Date(latestReasoning.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>
                            {typeof latestReasoning.confidence === 'number' ? `${Math.round(latestReasoning.confidence * 100)}% confidence` : 'confidence pending'}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {cappedReasoningEvents.slice(0, 6).map((event) => (
                          <div key={event.id} className="rounded-xl border border-slate-200 px-4 py-3">
                            <div className="flex items-center justify-between gap-3 mb-1">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {formatLabel(event.actor, ACTOR_LABELS)} · {formatLabel(event.stage, STAGE_LABELS)}
                              </div>
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${STATUS_CLASSES[event.status] || STATUS_CLASSES.queued}`}>
                                {event.status}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed">{event.summary}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-400">
                      Structured reasoning will appear here as soon as the next session is captured.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Session Diagnostics</div>
                <div className="space-y-3 text-sm">
                  <DiagnosticRow label="Artifacts persisted" value={`${screenshots.length} frames`} />
                  <DiagnosticRow label="Guidance packets" value={`${guidance.length} events`} />
                  <DiagnosticRow label="Reasoning stream" value={reasoningAvailable ? 'Live Supabase table' : 'Synthetic fallback'} />
                  <DiagnosticRow label="Latest artifact" value={latestReasoning?.artifact_ref ? 'Attached' : 'None'} />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
};

const GuidancePane = ({ screenshots, guidance }: { screenshots: Screenshot[]; guidance: GuidanceEvent[] }) => {
  if (screenshots.length === 0) {
    return (
      <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-32 text-center">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Monitor className="w-10 h-10 text-slate-200" />
        </div>
        <h4 className="text-slate-800 font-bold text-xl">Waiting for Input</h4>
        <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
          Use the Chrome Extension to capture your screen. Press <b>Ctrl+Shift+S</b> on any page to begin the reasoning loop.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {screenshots.map((shot, idx) => (
        <div
          key={shot.id}
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all flex flex-col md:flex-row h-full md:h-80"
        >
          <div className="w-full md:w-2/3 relative bg-slate-100 overflow-hidden group">
            <img src={shot.image_url} alt={shot.page_title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute top-4 left-4 flex gap-2">
              <div className="bg-slate-900 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg">STEP {idx + 1}</div>
              <div className="bg-white/90 backdrop-blur text-slate-900 text-[10px] font-bold px-3 py-1 rounded-full shadow-lg border border-white/20">
                {new Date(shot.captured_at).toLocaleTimeString()}
              </div>
            </div>
          </div>

          <div className="w-full md:w-1/3 p-6 flex flex-col justify-between border-l border-slate-100">
            <div>
              <h4 className="font-bold text-slate-900 text-base leading-tight mb-2 truncate" title={shot.page_title}>
                {shot.page_title}
              </h4>
              <a
                href={shot.page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-indigo-500 hover:underline truncate block mb-6 opacity-70"
              >
                {shot.page_url}
              </a>

              {guidance[idx] ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 relative">
                    <div className="absolute -top-2 -left-2 w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
                      <Terminal className="w-3 h-3 text-white" />
                    </div>
                    <p className="text-sm text-slate-700 font-semibold leading-relaxed">{guidance[idx].instruction}</p>
                  </div>

                  {guidance[idx].voice_text && (
                    <div className="flex items-start gap-2 text-slate-400">
                      <Activity className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <p className="text-[11px] font-medium italic">"{guidance[idx].voice_text}"</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-4 border-2 border-dashed border-slate-100 rounded-xl text-center">
                  <RefreshCcw className="w-4 h-4 text-slate-300 animate-spin mx-auto mb-2" />
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Processing</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Guidance packet</div>
              <button className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">Details</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const ReasoningPane = ({ events }: { events: ReasoningEvent[] }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
      <div>
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Layout className="w-5 h-5 text-indigo-500" />
          Reasoning Timeline
        </h3>
        <p className="text-sm text-slate-500 mt-1">Structured model intent, tool use, and execution state.</p>
      </div>
      <div className="text-[11px] font-medium text-slate-400 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
        Latest {events.length} events
      </div>
    </div>
    <div className="p-6 space-y-4">
      {events.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-400">
          Capture a session to populate the reasoning timeline.
        </div>
      ) : (
        events.map((event) => (
          <div key={event.id} className="rounded-2xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${STATUS_CLASSES[event.status] || STATUS_CLASSES.queued}`}>
                {event.status.toUpperCase()}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {formatLabel(event.actor, ACTOR_LABELS)} · {formatLabel(event.stage, STAGE_LABELS)}
              </span>
              <span className="ml-auto text-[11px] text-slate-400">
                {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-900 leading-relaxed">{event.summary}</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-500">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <div className="uppercase tracking-widest text-[10px] text-slate-400 mb-1">Confidence</div>
                <div className="font-semibold text-slate-700">
                  {typeof event.confidence === 'number' ? `${Math.round(event.confidence * 100)}%` : 'Pending'}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <div className="uppercase tracking-widest text-[10px] text-slate-400 mb-1">Latency</div>
                <div className="font-semibold text-slate-700">
                  {typeof event.latency_ms === 'number' ? `${Math.round(event.latency_ms)}ms` : '—'}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <div className="uppercase tracking-widest text-[10px] text-slate-400 mb-1">Artifact Ref</div>
                <div className="font-semibold text-slate-700 truncate">{event.artifact_ref || 'Not attached'}</div>
              </div>
            </div>
            <pre className="mt-3 bg-slate-950 text-slate-200 text-[11px] p-4 rounded-2xl overflow-x-auto whitespace-pre-wrap">
              {formatDetails(event.details)}
            </pre>
          </div>
        ))
      )}
    </div>
  </div>
);

const ArtifactPane = ({ screenshots, reasoningEvents }: { screenshots: Screenshot[]; reasoningEvents: ReasoningEvent[] }) => (
  <div className="space-y-6">
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-2">Session Artifacts</h3>
      <p className="text-sm text-slate-500">
        Captured frames, related URLs, and reasoning-linked artifacts that can be replayed during the demo.
      </p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {screenshots.map((shot) => (
        <div key={shot.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <img src={shot.image_url} alt={shot.page_title} className="w-full h-48 object-cover" />
          <div className="p-4">
            <h4 className="font-semibold text-slate-900 truncate">{shot.page_title}</h4>
            <a href={shot.page_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline block truncate mt-1">
              {shot.page_url}
            </a>
            <div className="text-xs text-slate-500 mt-3">Captured {new Date(shot.captured_at).toLocaleString()}</div>
          </div>
        </div>
      ))}
      {screenshots.length === 0 && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-400 md:col-span-2">
          No artifacts yet.
        </div>
      )}
    </div>
    {reasoningEvents.length > 0 && (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h4 className="text-base font-semibold text-slate-900 mb-3">Reasoning-linked Artifacts</h4>
        <div className="space-y-3">
          {reasoningEvents
            .filter((event) => !!event.artifact_ref)
            .slice(0, 8)
            .map((event) => (
              <div key={event.id} className="flex items-start justify-between gap-4 border border-slate-100 rounded-xl px-4 py-3">
                <div>
                  <div className="text-xs uppercase tracking-widest font-semibold text-slate-400">
                    {formatLabel(event.actor, ACTOR_LABELS)} · {formatLabel(event.stage, STAGE_LABELS)}
                  </div>
                  <div className="text-sm text-slate-700 mt-1">{event.summary}</div>
                </div>
                <div className="text-xs text-slate-500 truncate max-w-[180px]">{event.artifact_ref}</div>
              </div>
            ))}
        </div>
      </div>
    )}
  </div>
);

const DiagnosticRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4">
    <div className="text-slate-500">{label}</div>
    <div className="font-semibold text-slate-900 text-right">{value}</div>
  </div>
);

const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={`p-3 rounded-xl border ${colors[color]}`}>{icon}</div>
      <div>
        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">{label}</h4>
        <p className="text-2xl font-black text-slate-800 leading-none">{value}</p>
      </div>
    </div>
  );
};

export default App;
