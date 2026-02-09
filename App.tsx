
import React, { useState, useEffect } from 'react';
import { Layout, Search, Activity, Box, Terminal, Monitor, User, Database, RefreshCcw, Download, ChevronRight } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Session, Screenshot, GuidanceEvent } from './types';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

const App: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [guidance, setGuidance] = useState<GuidanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: sessData } = await supabase
        .from('sessions')
        .select('*')
        .order('last_seen_at', { ascending: false });
      
      if (sessData) {
        setSessions(sessData);
        if (!selectedSessionId && sessData.length > 0) {
          setSelectedSessionId(sessData[0].session_id);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExtension = async () => {
    setIsExporting(true);
    try {
      const zip = new JSZip();
      
      // Manifest
      zip.file("manifest.json", JSON.stringify({
        "manifest_version": 3,
        "name": "VisionGuide Assistant",
        "version": "1.0.0",
        "permissions": ["activeTab", "storage", "scripting", "tabs"],
        "host_permissions": ["<all_urls>"],
        "background": { "service_worker": "background.js", "type": "module" },
        "content_scripts": [{
          "matches": ["<all_urls>"],
          "js": ["content.js"],
          "css": ["styles.css"]
        }],
        "action": { "default_popup": "popup.html" },
        "commands": {
          "capture-screen": {
            "suggested_key": { "default": "Ctrl+Shift+S", "mac": "Command+Shift+S" },
            "description": "Capture screen for guidance"
          }
        }
      }, null, 2));

      // Simple Popup
      zip.file("popup.html", `
        <!DOCTYPE html>
        <html>
          <body style="width: 200px; padding: 16px; font-family: sans-serif;">
            <h3 style="margin: 0 0 8px; font-size: 14px;">VisionGuide</h3>
            <p style="font-size: 12px; color: #666;">Press <b>Cmd+Shift+S</b> to capture your screen and get AI guidance.</p>
          </body>
        </html>
      `);

      // We'll package the core logic into files.
      // In a real build step we'd transpile, but for this utility we bundle the source as ESM.
      zip.file("styles.css", `
        #vision-guide-overlay { position: fixed; bottom: 24px; right: 24px; width: 320px; background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; z-index: 2147483647; font-family: sans-serif; overflow: hidden; }
        .vg-header { padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; }
        .vg-title { font-weight: 600; font-size: 14px; flex-grow: 1; }
        .vg-content { padding: 16px; color: #475569; font-size: 14px; }
        .vg-highlight { outline: 3px solid #6366f1; border-radius: 4px; animation: vg-pulse 2s infinite; }
        @keyframes vg-pulse { 0% { outline-offset: 0; } 50% { outline-offset: 6px; outline-color: transparent; } 100% { outline-offset: 0; } }
      `);

      // For simplicity in this demo, we provide a single bundled background and content script string
      // normally you'd fetch the actual files from the project.
      zip.file("background.js", `
        console.log('Background Worker Loaded');
        chrome.commands.onCommand.addListener(async (command) => {
          if (command === 'capture-screen') {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
            // API call logic would go here
            console.log('Captured screen for tab', tab.id);
            chrome.tabs.sendMessage(tab.id, { type: 'RENDER_GUIDANCE', guidance: { overlay: { text: 'Analyzing...' } } });
          }
        });
      `);

      zip.file("content.js", `
        chrome.runtime.onMessage.addListener((msg) => {
          if (msg.type === 'RENDER_GUIDANCE') {
            let div = document.getElementById('vg-ov');
            if (!div) {
              div = document.createElement('div');
              div.id = 'vg-ov';
              div.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:9999;background:white;padding:20px;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.1);border:1px solid #eee;width:250px;";
              document.body.appendChild(div);
            }
            div.innerHTML = "<b>Guidance:</b><br/>" + msg.guidance.overlay.text;
          }
        });
      `);

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "vision-guide-extension.zip");
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'screenshots' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      const fetchSessionDetails = async () => {
        const { data: shots } = await supabase
          .from('screenshots')
          .select('*')
          .eq('session_id', selectedSessionId)
          .order('captured_at', { ascending: true });
        
        const { data: guides } = await supabase
          .from('guidance_events')
          .select('*')
          .eq('session_id', selectedSessionId)
          .order('created_at', { ascending: true });

        if (shots) setScreenshots(shots);
        if (guides) setGuidance(guides);
      };
      fetchSessionDetails();
    }
  }, [selectedSessionId]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-sm shadow-indigo-200">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">VisionGuide</h1>
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
            <button onClick={fetchData} className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-md hover:bg-slate-100">
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
                  <div className={`p-1.5 rounded-lg ${selectedSessionId === session.session_id ? 'bg-white/20' : 'bg-slate-100 group-hover:bg-white'}`}>
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{session.session_id}</div>
                    <div className={`text-[10px] ${selectedSessionId === session.session_id ? 'text-indigo-100' : 'text-slate-400'}`}>
                      {new Date(session.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <ChevronRight className={`w-3 h-3 transition-opacity ${selectedSessionId === session.session_id ? 'opacity-100' : 'opacity-0'}`} />
                </div>
              </button>
            ))
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50/50">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Session Insight</h2>
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              REALTIME
            </div>
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
          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <StatCard icon={<Monitor className="w-4 h-4" />} label="Frames" value={screenshots.length} color="blue" />
            <StatCard icon={<Activity className="w-4 h-4" />} label="Guidance" value={guidance.length} color="indigo" />
            <StatCard icon={<Terminal className="w-4 h-4" />} label="Latency" value="42ms" color="emerald" />
            <StatCard icon={<Database className="w-4 h-4" />} label="Storage" value="Supabase" color="orange" />
          </div>

          <section>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Layout className="w-5 h-5 text-indigo-500" />
                Perception Stream
              </h3>
              <div className="text-[11px] font-medium text-slate-400 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
                Showing {screenshots.length} interaction steps
              </div>
            </div>

            {screenshots.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-32 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Monitor className="w-10 h-10 text-slate-200" />
                </div>
                <h4 className="text-slate-800 font-bold text-xl">Waiting for Input</h4>
                <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
                  Use the Chrome Extension to capture your screen. Press <b>Ctrl+Shift+S</b> on any page to begin the guidance loop.
                </p>
                <div className="mt-8 flex justify-center gap-3">
                   <div className="px-3 py-1.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500">1. CAPTURE</div>
                   <div className="px-3 py-1.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500">2. REASON</div>
                   <div className="px-3 py-1.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500">3. GUIDE</div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {screenshots.map((shot, idx) => (
                  <div key={shot.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all flex flex-col md:flex-row h-full md:h-80">
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
                        <a href={shot.page_url} target="_blank" className="text-[11px] text-indigo-500 hover:underline truncate block mb-6 opacity-70">
                          {shot.page_url}
                        </a>

                        {guidance[idx] ? (
                          <div className="space-y-4">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 relative">
                              <div className="absolute -top-2 -left-2 w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
                                <Terminal className="w-3 h-3 text-white" />
                              </div>
                              <p className="text-sm text-slate-700 font-semibold leading-relaxed">
                                {guidance[idx].instruction}
                              </p>
                            </div>
                            
                            {guidance[idx].voice_text && (
                              <div className="flex items-start gap-2 text-slate-400">
                                <Activity className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                <p className="text-[11px] font-medium italic italic">
                                  "{guidance[idx].voice_text}"
                                </p>
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
                        <div className="flex -space-x-1.5">
                          <div className="w-5 h-5 rounded-full bg-blue-400 border-2 border-white"></div>
                          <div className="w-5 h-5 rounded-full bg-indigo-400 border-2 border-white"></div>
                          <div className="w-5 h-5 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[8px] font-bold">+2</div>
                        </div>
                        <button className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">Details</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }: { icon: any, label: string, value: any, color: string }) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
  };
  
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={`p-3 rounded-xl border ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">{label}</h4>
        <p className="text-2xl font-black text-slate-800 leading-none">{value}</p>
      </div>
    </div>
  );
};

export default App;
