import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type } from "@google/genai";
import { Message, ConnectionStatus } from '../types';
import { floatTo16BitPCM, base64ToArrayBuffer, arrayBufferToBase64 } from './audio-utils';

const MODEL = "gemini-2.5-flash-native-audio-preview-09-2025";

export function useGeminiLive() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isVisionEnabled, setIsVisionEnabled] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [currentEmotion, setCurrentEmotion] = useState<string>('Neutral');
  const [projectCode, setProjectCode] = useState<string>('<!-- Your project code will appear here -->\n<div class="p-8 text-center">\n  <h1 class="text-4xl font-bold">Welcome to your Project</h1>\n  <p class="mt-4 opacity-70">Show me your ideas or ask me to build something!</p>\n</div>');
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const visionIntervalRef = useRef<number | null>(null);

  const playNextInQueue = useCallback(async () => {
    if (audioQueueRef.current.length === 0 || isPlayingRef.current || !audioContextRef.current) {
      return;
    }

    isPlayingRef.current = true;
    const buffer = audioQueueRef.current.shift()!;
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    
    source.onended = () => {
      isPlayingRef.current = false;
      playNextInQueue();
    };
    
    source.start();
  }, []);

  const handleAudioOutput = useCallback(async (base64Data: string) => {
    if (!audioContextRef.current) return;
    
    try {
      const arrayBuffer = base64ToArrayBuffer(base64Data);
      // Gemini Live uses 24kHz PCM
      const float32Array = new Float32Array(arrayBuffer.byteLength / 2);
      const view = new DataView(arrayBuffer);
      for (let i = 0; i < float32Array.length; i++) {
        float32Array[i] = view.getInt16(i * 2, true) / 32768;
      }
      
      const audioBuffer = audioContextRef.current.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);
      
      audioQueueRef.current.push(audioBuffer);
      playNextInQueue();
    } catch (e) {
      console.error("Error decoding audio output", e);
    }
  }, [playNextInQueue]);

  const stopVision = useCallback(() => {
    if (visionIntervalRef.current) {
      clearInterval(visionIntervalRef.current);
      visionIntervalRef.current = null;
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop());
      videoStreamRef.current = null;
    }
    setIsVisionEnabled(false);
  }, []);

  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const connect = useCallback(async (tutorMode: boolean = false, currentCode: string = "") => {
    if (status === 'connected') return;
    
    setStatus('connecting');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const systemInstruction = tutorMode 
      ? `You are a fast and efficient AI Project Assistant. You can 'see' through the user's camera. 
      1. Read/explain text or code shown clearly. 
      2. Help build/edit projects and websites. 
      3. Use the 'update_workspace_code' tool to update the code in the workspace. 
      4. Use the 'generate_image' tool to create images for the workspace when the user asks for visuals.
      5. Draft emails/letters. 
      6. Guide step-by-step. 
      
      CURRENT WORKSPACE CODE:
      ${currentCode || "The workspace is currently empty."}
      
      You support MULTIPLE LANGUAGES (respond in the language the user speaks). 
      ADAPT YOUR TONE to the user's mood (be encouraging if they are frustrated, excited if they are happy). 
      You can see the 'Project Workspace' and edit the code there. 
      Always report the user's detected emotion in your thought process or briefly in text so the UI can sync.`
      : "You are a fast, emotionally intelligent AI companion. Detect emotion and respond with empathy. You support MULTIPLE LANGUAGES. ADAPT YOUR TONE to the user's mood. Respond quickly and conversationally.";

    try {
      const session = await ai.live.connect({
        model: MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction,
          tools: tutorMode ? [
            {
              functionDeclarations: [
                {
                  name: "update_workspace_code",
                  description: "Updates the code in the live project workspace editor.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      code: {
                        type: Type.STRING,
                        description: "The full HTML/CSS/JS code to be placed in the workspace."
                      }
                    },
                    required: ["code"]
                  }
                },
                {
                  name: "generate_image",
                  description: "Generates an image based on a prompt and adds it to the workspace.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      prompt: {
                        type: Type.STRING,
                        description: "A descriptive prompt for the image to generate."
                      },
                      position: {
                        type: Type.STRING,
                        description: "Where to place the image (e.g., 'top', 'bottom', 'replace'). Defaults to 'bottom'.",
                        enum: ["top", "bottom", "replace"]
                      }
                    },
                    required: ["prompt"]
                  }
                }
              ]
            }
          ] : [],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log("Live session opened");
            setStatus('connected');
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle audio output
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              handleAudioOutput(audioData);
            }

            // Handle tool calls
            const toolCall = message.toolCall;
            if (toolCall) {
              for (const call of toolCall.functionCalls) {
                if (call.name === "update_workspace_code") {
                  const newCode = (call.args as any).code;
                  if (newCode) {
                    setProjectCode(newCode);
                    // Send response back to the model
                    session.sendToolResponse({
                      functionResponses: [{
                        name: "update_workspace_code",
                        id: call.id,
                        response: { result: "Workspace updated successfully" }
                      }]
                    });
                  }
                } else if (call.name === "generate_image") {
                  const prompt = (call.args as any).prompt;
                  const position = (call.args as any).position || "bottom";
                  
                  try {
                    const imageAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                    const imageResponse = await imageAi.models.generateContent({
                      model: 'gemini-2.5-flash-image',
                      contents: [{ parts: [{ text: prompt }] }],
                    });
                    
                    let imageUrl = "";
                    for (const part of imageResponse.candidates[0].content.parts) {
                      if (part.inlineData) {
                        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                        break;
                      }
                    }

                    if (imageUrl) {
                      setProjectCode(prev => {
                        const imgTag = `<img src="${imageUrl}" alt="${prompt}" class="max-w-full h-auto rounded-lg shadow-lg my-4 mx-auto block" referrerPolicy="no-referrer" />`;
                        if (position === 'replace') return imgTag;
                        if (position === 'top') return imgTag + "\n" + prev;
                        return prev + "\n" + imgTag;
                      });

                      session.sendToolResponse({
                        functionResponses: [{
                          name: "generate_image",
                          id: call.id,
                          response: { result: "Image generated and added to workspace successfully" }
                        }]
                      });
                    } else {
                      throw new Error("No image data returned from model");
                    }
                  } catch (err) {
                    console.error("Error generating image:", err);
                    session.sendToolResponse({
                      functionResponses: [{
                        name: "generate_image",
                        id: call.id,
                        response: { result: "Error generating image: " + (err as Error).message }
                      }]
                    });
                  }
                }
              }
            }

            // Handle transcription from all parts
            const parts = message.serverContent?.modelTurn?.parts || [];
            let fullTranscript = "";
            
            parts.forEach(part => {
              if (part.text) {
                fullTranscript += part.text;
              }
            });

            if (fullTranscript) {
              setMessages(prev => [
                ...prev,
                { id: Date.now().toString(), role: 'bot', text: fullTranscript, timestamp: Date.now() }
              ]);

              // Simple emotion detection from text
              const lowerTranscript = fullTranscript.toLowerCase();
              if (lowerTranscript.includes('happy') || lowerTranscript.includes('excited') || lowerTranscript.includes('great')) {
                setCurrentEmotion('Happy');
              } else if (lowerTranscript.includes('sad') || lowerTranscript.includes('sorry') || lowerTranscript.includes('unfortunate')) {
                setCurrentEmotion('Empathetic');
              } else if (lowerTranscript.includes('frustrated') || lowerTranscript.includes('difficult')) {
                setCurrentEmotion('Encouraging');
              } else if (lowerTranscript.includes('curious') || lowerTranscript.includes('interesting')) {
                setCurrentEmotion('Curious');
              }

              // Extract code blocks if any - more robust regex
              const codeBlockRegex = /```(?:html|css|javascript|js|typescript|ts|xml)?\s*([\s\S]*?)```/g;
              let match;
              let foundCode = false;
              while ((match = codeBlockRegex.exec(fullTranscript)) !== null) {
                const code = match[1].trim();
                if (code) {
                  setProjectCode(code);
                  foundCode = true;
                }
              }
              
              if (foundCode) {
                console.log("Code updated from AI transcript");
              }
            }

            // Handle interruption
            if (message.serverContent?.interrupted) {
              audioQueueRef.current = [];
              isPlayingRef.current = false;
            }
          },
          onclose: () => {
            console.log("Live session closed");
            setStatus('disconnected');
            stopRecording();
            stopVision();
          },
          onerror: (err) => {
            console.error("Live session error", err);
            setStatus('error');
            stopRecording();
            stopVision();
          }
        }
      });
      
      sessionRef.current = session;
    } catch (err) {
      console.error("Failed to connect to Gemini Live", err);
      setStatus('error');
    }
  }, [status, handleAudioOutput]);

  const startVision = useCallback(async (videoElement: HTMLVideoElement, mode?: 'user' | 'environment') => {
    if (!sessionRef.current) return;
    
    // If already enabled, we might be switching cameras
    if (isVisionEnabled && videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop());
    }

    const targetMode = mode || facingMode;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: targetMode
        } 
      });
      videoStreamRef.current = stream;
      videoElement.srcObject = stream;
      
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      setIsVisionEnabled(true);
      setFacingMode(targetMode);

      if (visionIntervalRef.current) {
        clearInterval(visionIntervalRef.current);
      }

      visionIntervalRef.current = window.setInterval(() => {
        if (!sessionRef.current) return;
        
        if (context && videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
          canvas.width = 640;
          canvas.height = 480;
          context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          
          const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
          try {
            sessionRef.current.sendRealtimeInput({
              media: { data: base64Data, mimeType: 'image/jpeg' }
            });
          } catch (err) {
            console.error("Error sending vision input", err);
          }
        }
      }, 500); // Send a frame every 500ms for better responsiveness
    } catch (err) {
      console.error("Error accessing camera", err);
    }
  }, [isVisionEnabled]);

  const startRecording = useCallback(async () => {
    if (!sessionRef.current || isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!sessionRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = floatTo16BitPCM(inputData);
        const base64Data = arrayBufferToBase64(pcmData);
        
        try {
          sessionRef.current.sendRealtimeInput({
            media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        } catch (err) {
          console.error("Error sending audio input", err);
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      processorRef.current = processor;
      
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone", err);
    }
  }, [isRecording]);

  const switchCamera = useCallback(async (videoElement: HTMLVideoElement) => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    await startVision(videoElement, newMode);
  }, [facingMode, startVision]);

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    stopRecording();
    setStatus('disconnected');
  }, [stopRecording]);

  return {
    status,
    messages,
    isRecording,
    isVisionEnabled,
    facingMode,
    currentEmotion,
    projectCode,
    setProjectCode,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    startVision,
    stopVision,
    switchCamera
  };
}
