import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, MessageSquare, Power, Activity, Heart, Sparkles, Camera, CameraOff, GraduationCap, Code, Eye, Monitor, Terminal, User, Send, RefreshCcw, Image as ImageIcon } from 'lucide-react';
import { useGeminiLive } from './lib/useGeminiLive';
import { cn } from './lib/utils';
import ReactMarkdown from 'react-markdown';

const AIAvatar = ({ isSpeaking, emotion, tutorMode }: { isSpeaking: boolean, emotion: string, tutorMode: boolean }) => {
  const getEmotionColor = () => {
    switch (emotion.toLowerCase()) {
      case 'happy': return 'bg-yellow-400';
      case 'empathetic': return 'bg-pink-400';
      case 'encouraging': return 'bg-emerald-400';
      case 'curious': return 'bg-purple-400';
      default: return tutorMode ? 'bg-blue-500' : 'bg-pink-500';
    }
  };

  const getHairFill = () => {
    switch (emotion.toLowerCase()) {
      case 'happy': return '#facc15';
      case 'empathetic': return '#f472b6';
      case 'encouraging': return '#34d399';
      case 'curious': return '#a855f7';
      default: return tutorMode ? "#1e3a8a" : "#831843";
    }
  };

  return (
    <div className="relative w-32 h-32 md:w-48 md:h-48 flex items-center justify-center">
      {/* Glow effect */}
      <motion.div
        animate={{
          scale: isSpeaking ? [1, 1.2, 1] : 1,
          opacity: isSpeaking ? [0.2, 0.4, 0.2] : 0.1,
        }}
        transition={{ duration: 2, repeat: Infinity }}
        className={cn(
          "absolute inset-0 rounded-full blur-3xl transition-colors duration-500",
          getEmotionColor()
        )}
      />
      
      {/* Character SVG */}
      <motion.div
        animate={{
          y: isSpeaking ? [0, -10, 0] : 0,
          rotate: isSpeaking ? [-2, 2, -2] : 0,
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10 w-full h-full"
      >
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
          {/* Hair */}
          <path d="M40,100 Q40,40 100,40 Q160,40 160,100" fill={getHairFill()} className="transition-colors duration-500" />
          <path d="M40,100 L30,140 Q60,130 80,140 L120,140 Q140,130 170,140 L160,100" fill={getHairFill()} opacity="0.8" className="transition-colors duration-500" />
          
          {/* Face */}
          <circle cx="100" cy="100" r="50" fill="#fecaca" />
          
          {/* Eyes */}
          <motion.g
            animate={{ scaleY: [1, 0.1, 1] }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.05, 0.1] }}
          >
            <circle cx="80" cy="95" r="5" fill="#1e293b" />
            <circle cx="120" cy="95" r="5" fill="#1e293b" />
          </motion.g>
          
          {/* Mouth */}
          <motion.path
            d={isSpeaking ? "M85,120 Q100,135 115,120" : "M90,125 Q100,130 110,125"}
            stroke="#1e293b"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            animate={isSpeaking ? { d: ["M85,120 Q100,135 115,120", "M85,120 Q100,110 115,120", "M85,120 Q100,135 115,120"] } : {}}
            transition={{ duration: 0.2, repeat: Infinity }}
          />
          
          {/* Blush */}
          <circle cx="70" cy="110" r="6" fill="#fca5a5" opacity="0.4" />
          <circle cx="130" cy="110" r="6" fill="#fca5a5" opacity="0.4" />
        </svg>
      </motion.div>
      
      {/* Speaking Indicator */}
      {isSpeaking && (
        <div className="absolute -top-4 -right-4 flex gap-1">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              animate={{ height: [4, 16, 4] }}
              transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
              className={cn("w-1 rounded-full", getEmotionColor())}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const {
    status,
    messages,
    isRecording,
    isVisionEnabled,
    currentEmotion,
    projectCode,
    setProjectCode,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    startVision,
    stopVision,
    switchCamera,
    facingMode
  } = useGeminiLive();

  const [showTranscript, setShowTranscript] = useState(true);
  const [tutorMode, setTutorMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isSpeaking = useMemo(() => {
    if (messages.length === 0) return false;
    const lastMsg = messages[messages.length - 1];
    return lastMsg.role === 'bot' && Date.now() - lastMsg.timestamp < 5000;
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const toggleConnection = () => {
    if (status === 'connected') {
      disconnect();
    } else {
      connect(tutorMode, projectCode);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const toggleVision = () => {
    if (isVisionEnabled) {
      stopVision();
    } else if (videoRef.current) {
      startVision(videoRef.current);
    }
  };

  const [isWorkspaceUpdating, setIsWorkspaceUpdating] = useState(false);

  // Highlight workspace when code changes externally
  useEffect(() => {
    if (projectCode) {
      setIsWorkspaceUpdating(true);
      const timer = setTimeout(() => setIsWorkspaceUpdating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [projectCode]);

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center p-4 md:p-8">
      {/* Atmospheric Background */}
      <div className="fixed inset-0 -z-10 atmosphere" />
      
      {/* Header */}
      <header className="sticky top-0 left-0 right-0 p-6 flex items-center justify-between z-20 bg-black/20 backdrop-blur-md rounded-b-2xl mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center border transition-colors duration-500",
            tutorMode ? "bg-blue-500/20 border-blue-500/30" : "bg-orange-500/20 border-orange-500/30"
          )}>
            {tutorMode ? <GraduationCap className="w-5 h-5 text-blue-500" /> : <Sparkles className="w-5 h-5 text-orange-500" />}
          </div>
          <div>
            <h1 className="text-lg font-medium tracking-tight">
              {tutorMode ? "AI Project Assistant" : "AI Emotional Companion"}
            </h1>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                status === 'connected' ? "bg-emerald-500" : "bg-red-500"
              )} />
              <span className="text-[10px] uppercase tracking-widest opacity-50 font-mono">
                {status}
              </span>
              {status === 'error' && (
                <button 
                  onClick={() => {
                    disconnect();
                    setTimeout(() => connect(tutorMode), 500);
                  }}
                  className="text-[10px] uppercase tracking-widest text-red-500 underline ml-2"
                >
                  Reconnect
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (status !== 'connected') {
                setTutorMode(!tutorMode);
              }
            }}
            disabled={status === 'connected'}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all border",
              tutorMode 
                ? "bg-blue-500/10 border-blue-500/30 text-blue-500" 
                : "bg-white/5 border-white/10 text-white/60",
              status === 'connected' && "opacity-50 cursor-not-allowed"
            )}
          >
            {tutorMode ? "Assistant Mode On" : "Assistant Mode Off"}
          </button>
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="p-3 rounded-full hover:bg-white/5 transition-colors border border-white/10"
            title="Toggle Transcript"
          >
            <MessageSquare className="w-5 h-5 opacity-70" />
          </button>
          <button
            onClick={toggleConnection}
            className={cn(
              "p-3 rounded-full transition-all border",
              status === 'connected' 
                ? "bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20" 
                : "bg-white/5 border-white/10 text-white hover:bg-white/10"
            )}
          >
            <Power className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Interaction Area */}
      <main className={cn(
        "flex-1 w-full max-w-[1600px] flex flex-col lg:flex-row items-stretch justify-center gap-6 z-10 pt-8 pb-24 px-6",
        tutorMode ? "lg:items-start" : "items-center"
      )}>
        
        {/* Left/Center Side: AI Character & Controls */}
        <div className={cn(
          "flex flex-col items-center gap-8 transition-all duration-500",
          tutorMode ? "w-full lg:w-1/3" : "w-full"
        )}>
          {/* Character Avatar */}
          <div className="relative group">
            <AIAvatar isSpeaking={isSpeaking} emotion={currentEmotion} tutorMode={tutorMode} />
            
            {/* Emotion Tag */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10px] uppercase tracking-widest font-bold"
            >
              {currentEmotion}
            </motion.div>
          </div>

          {/* Voice Control - Moved Up */}
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              {/* Visualizer / Pulse */}
              <AnimatePresence>
                {isRecording && (
                  <>
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1.5, opacity: 0.2 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className={cn(
                        "absolute inset-0 rounded-full blur-2xl",
                        tutorMode ? "bg-blue-500" : "bg-pink-500"
                      )}
                    />
                  </>
                )}
              </AnimatePresence>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleRecording}
                disabled={status !== 'connected'}
                className={cn(
                  "relative w-32 h-32 md:w-40 md:h-40 rounded-full flex flex-col items-center justify-center gap-3 transition-all duration-500 shadow-2xl overflow-hidden",
                  status !== 'connected' && "opacity-50 cursor-not-allowed grayscale",
                  isRecording 
                    ? (tutorMode ? "bg-blue-500 text-white" : "bg-pink-500 text-white")
                    : "bg-white/5 backdrop-blur-xl border border-white/10 text-white hover:bg-white/10"
                )}
              >
                {isRecording ? (
                  <>
                    <MicOff className="w-8 h-8 md:w-10 md:h-10" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Listening</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-8 h-8 md:w-10 md:h-10" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Speak</span>
                  </>
                )}
              </motion.button>
            </div>

            {/* Status Indicator */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm opacity-40 italic text-center max-w-xs">
                {status === 'connected' 
                  ? (isRecording 
                      ? (tutorMode ? "Show me your project or ask me to build something!" : "I'm listening to you...") 
                      : "Tap to start talking") 
                  : "Connect to start the session"}
              </p>
            </div>
          </div>

          {/* Camera Preview (if enabled) - Moved Down */}
          <AnimatePresence>
            {tutorMode && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm aspect-video glass-panel overflow-hidden group"
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn(
                    "w-full h-full object-cover transition-opacity duration-500",
                    isVisionEnabled ? "opacity-100" : "opacity-20"
                  )}
                />
                {!isVisionEnabled && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <CameraOff className="w-8 h-8 opacity-20" />
                    <p className="text-xs opacity-40 font-mono uppercase tracking-widest">Vision Offline</p>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={toggleVision}
                    disabled={status !== 'connected'}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[8px] font-bold uppercase tracking-widest backdrop-blur-md border transition-all",
                      isVisionEnabled 
                        ? "bg-red-500/20 border-red-500/30 text-red-400" 
                        : "bg-white/10 border-white/20 text-white"
                    )}
                  >
                    {isVisionEnabled ? "Stop Seeing" : "Start Seeing"}
                  </button>
                  
                  {isVisionEnabled && (
                    <button
                      onClick={() => switchCamera(videoRef.current!)}
                      className="p-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-all"
                      title="Switch Camera"
                    >
                      <RefreshCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side: Project Workspace (Only in Tutor/Assistant Mode) */}
        <AnimatePresence>
          {tutorMode && (
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ 
                opacity: 1, 
                x: 0,
                boxShadow: isWorkspaceUpdating ? "0 0 40px rgba(59, 130, 246, 0.5)" : "0 0 0px rgba(59, 130, 246, 0)"
              }}
              exit={{ opacity: 0, x: 50 }}
              className={cn(
                "flex-1 flex flex-col glass-panel overflow-hidden min-h-[500px] transition-all duration-500",
                isWorkspaceUpdating && "border-blue-500/50 bg-blue-500/5"
              )}
            >
              {/* Workspace Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-blue-400" />
                  <h2 className="text-xs font-bold uppercase tracking-widest">Live Workspace</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 opacity-30" />
                  <span className="text-[10px] uppercase tracking-widest opacity-30 font-mono">Real-time Preview</span>
                </div>
              </div>

              {/* Workspace Content - Side by Side */}
              <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden bg-black/20">
                {/* Code Editor Pane */}
                <div className="flex-1 border-b md:border-b-0 md:border-r border-white/10 flex flex-col">
                  <div className="px-4 py-1 bg-white/5 border-b border-white/10 flex items-center gap-2">
                    <Terminal className="w-3 h-3 opacity-40" />
                    <span className="text-[9px] uppercase tracking-widest opacity-40 font-mono">Editor</span>
                  </div>
                  <textarea
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    className="flex-1 w-full p-6 bg-transparent font-mono text-sm text-blue-100/80 resize-none focus:outline-none selection:bg-blue-500/30"
                    spellCheck={false}
                    placeholder="Enter HTML/CSS here..."
                  />
                </div>

                {/* Preview Pane */}
                <div className="flex-1 flex flex-col bg-white">
                  <div className="px-4 py-1 bg-gray-100 border-b border-gray-200 flex items-center gap-2">
                    <Eye className="w-3 h-3 text-gray-400" />
                    <span className="text-[9px] uppercase tracking-widest text-gray-400 font-mono">Live Preview</span>
                  </div>
                  <div className="flex-1 relative overflow-auto">
                    <iframe
                      title="Project Preview"
                      srcDoc={`
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <script src="https://unpkg.com/@tailwindcss/browser@4"></script>
                            <style>
                              body { margin: 0; font-family: sans-serif; min-height: 100vh; }
                              /* Hide scrollbars for a cleaner look in the pane */
                              ::-webkit-scrollbar { width: 6px; }
                              ::-webkit-scrollbar-track { background: #f1f1f1; }
                              ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 10px; }
                            </style>
                          </head>
                          <body>${projectCode}</body>
                        </html>
                      `}
                      className="w-full h-full border-none"
                    />
                  </div>
                </div>
              </div>
              
              {/* Workspace Footer */}
              <div className="p-3 border-t border-white/10 bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3 h-3 opacity-40" />
                    <span className="text-[9px] uppercase tracking-widest opacity-40 font-mono">Auto-sync enabled</span>
                  </div>
                  <button 
                    onClick={() => setProjectCode('')}
                    className="text-[9px] uppercase tracking-widest font-bold opacity-40 hover:opacity-100 transition-opacity"
                  >
                    Clear Code
                  </button>
                  <div className="w-px h-3 bg-white/10" />
                  <div className="flex items-center gap-1 opacity-40">
                    <ImageIcon className="w-3 h-3" />
                    <span className="text-[9px] uppercase tracking-widest font-mono">AI Images Enabled</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Transcript Sidebar/Overlay */}
      <AnimatePresence>
        {showTranscript && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            className="fixed right-6 top-24 bottom-24 w-full max-w-sm glass-panel z-20 flex flex-col"
          >
            <div className="p-4 border-bottom border-white/10 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest opacity-60 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Live Transcript
              </h2>
            </div>
            
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 lyric-viewport scroll-smooth"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 text-center space-y-4">
                  <MessageSquare className="w-12 h-12" />
                  <p className="text-sm">No conversation history yet</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex flex-col gap-1",
                      msg.role === 'user' ? "items-end" : "items-start"
                    )}
                  >
                    <span className="text-[10px] uppercase tracking-widest opacity-40 font-mono">
                      {msg.role}
                    </span>
                    <div className={cn(
                      "max-w-[90%] p-3 rounded-2xl text-sm leading-relaxed",
                      msg.role === 'user' 
                        ? "bg-white/10 text-white rounded-tr-none" 
                        : cn(
                            "rounded-tl-none font-serif text-base border",
                            tutorMode ? "bg-blue-500/10 text-blue-100 border-blue-500/20" : "bg-orange-500/10 text-orange-100 border-orange-500/20"
                          )
                    )}>
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer / Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 p-6 flex justify-center pointer-events-none">
        <div className="px-6 py-3 rounded-full bg-black/40 backdrop-blur-md border border-white/5 flex items-center gap-6 pointer-events-auto">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] uppercase tracking-widest opacity-60">Gemini 2.5 Flash</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 opacity-60" />
            <span className="text-[10px] uppercase tracking-widest opacity-60">Real-time Audio & Vision</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

