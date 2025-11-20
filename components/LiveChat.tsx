import React, { useState, useEffect, useRef, useCallback } from 'react';
// Fix: Removed non-exported member 'LiveSession'. The type will be inferred.
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from "@google/genai";
import { decode, encode, decodeAudioData } from '../utils/audioUtils';
import { MicrophoneIcon, StopCircleIcon, XIcon } from './Icons';
import Spinner from './Spinner';

interface LiveChatProps {
    onClose: () => void;
    onComplete: (finalTranscript: string) => void;
}

type Status = 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'LISTENING' | 'ERROR' | 'CLOSING';

const API_KEY = process.env.API_KEY;

// Fix: Moved AI client initialization outside of the component for performance and to infer the session type.
if (!API_KEY) {
    throw new Error("API_KEY is not defined in environment variables");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Fix: Inferred the LiveSession type from the SDK method's return type.
type LiveSession = Awaited<ReturnType<typeof ai.live.connect>>;


const LiveChat: React.FC<LiveChatProps> = ({ onClose, onComplete }) => {
    const [status, setStatus] = useState<Status>('IDLE');
    const [transcript, setTranscript] = useState<{ user: string, ai: string }[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [currentOutput, setCurrentOutput] = useState('');
    
    const sessionRef = useRef<LiveSession | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const transcriptEndRef = useRef<HTMLDivElement>(null);
    
    const scrollToBottom = () => {
        transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [transcript, currentInput, currentOutput]);

    const cleanup = useCallback(() => {
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
             outputAudioContextRef.current.close();
             outputAudioContextRef.current = null;
        }
        sourcesRef.current.forEach(source => source.stop());
        sourcesRef.current.clear();
    }, []);


    const startSession = useCallback(async () => {
        setStatus('CONNECTING');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // FIX: Cast window to `any` to allow access to vendor-prefixed `webkitAudioContext` for older browsers.
            const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = inputAudioContext;
            
            // FIX: Cast window to `any` to allow access to vendor-prefixed `webkitAudioContext` for older browsers.
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setStatus('CONNECTED');
                        const source = inputAudioContext.createMediaStreamSource(stream);
                        mediaStreamSourceRef.current = source;

                        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob: Blob = {
                                data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromise.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContext.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            setCurrentInput(prev => prev + message.serverContent.inputTranscription.text);
                        }
                        if (message.serverContent?.outputTranscription) {
                            setCurrentOutput(prev => prev + message.serverContent.outputTranscription.text);
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            const outputCtx = outputAudioContextRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                            
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputCtx.destination);
                            
                            source.addEventListener('ended', () => {
                                sourcesRef.current.delete(source);
                            });

                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            sourcesRef.current.add(source);
                        }

                        if (message.serverContent?.turnComplete) {
                            setTranscript(prev => [...prev, { user: currentInput, ai: currentOutput }]);
                            setCurrentInput('');
                            setCurrentOutput('');
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Session Error:', e);
                        setStatus('ERROR');
                        cleanup();
                    },
                    onclose: () => {
                        cleanup();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                    },
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
            });
            
            sessionRef.current = await sessionPromise;
            
        } catch (err) {
            console.error("Failed to start session:", err);
            setStatus('ERROR');
        }
    }, [cleanup, currentInput, currentOutput]);

    const endSession = useCallback(() => {
        setStatus('CLOSING');
        if (sessionRef.current) {
            sessionRef.current.close();
            sessionRef.current = null;
        }
        cleanup();
        const lastAiResponse = transcript[transcript.length - 1]?.ai || currentOutput;
        onComplete(lastAiResponse);
        onClose();
    }, [cleanup, transcript, currentOutput, onComplete, onClose]);

    useEffect(() => {
        startSession();
        return () => {
            if (sessionRef.current) {
                sessionRef.current.close();
            }
            cleanup();
        };
    }, [startSession, cleanup]);

    const getStatusMessage = () => {
        switch (status) {
            case 'CONNECTING': return "Đang kết nối với AI Stylist...";
            case 'CONNECTED': return "Đã kết nối! Hãy bắt đầu trò chuyện.";
            case 'ERROR': return "Lỗi mạng. Vui lòng đóng và thử lại.";
            default: return "AI Stylist đang lắng nghe...";
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-md animate-[fade-in_0.3s_ease-in-out]">
            <div className="bg-gradient-to-br from-slate-900 via-purple-950 to-slate-800 w-full max-w-2xl h-[90vh] max-h-[700px] rounded-2xl shadow-2xl flex flex-col p-6 text-white border border-white/20">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <MicrophoneIcon />
                        <span>Trò chuyện với AI Stylist</span>
                    </h2>
                    <button onClick={onClose} aria-label="Đóng">
                        <XIcon />
                    </button>
                </div>
                
                <div className="flex-grow bg-black/20 rounded-lg p-4 overflow-y-auto mb-4 custom-scrollbar">
                    {transcript.map((turn, index) => (
                        <div key={index} className="mb-4">
                            <p className="font-semibold text-violet-300">Bạn:</p>
                            <p className="text-gray-200">{turn.user}</p>
                            <p className="font-semibold text-green-300 mt-2">AI:</p>
                            <p className="text-gray-200">{turn.ai}</p>
                        </div>
                    ))}
                     {currentInput && (
                        <div className="mb-4">
                            <p className="font-semibold text-violet-300">Bạn:</p>
                            <p className="text-gray-400 italic">{currentInput}</p>
                        </div>
                    )}
                    {currentOutput && (
                        <div>
                           <p className="font-semibold text-green-300">AI:</p>
                           <p className="text-gray-400 italic">{currentOutput}</p>
                        </div>
                    )}
                    <div ref={transcriptEndRef} />
                </div>

                <div className="text-center">
                    <div className="flex items-center justify-center gap-3 text-gray-300 mb-4">
                        {status === 'CONNECTING' && <Spinner />}
                        <p>{getStatusMessage()}</p>
                        {status === 'CONNECTED' && <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>}
                    </div>
                    <button
                        onClick={endSession}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-full flex items-center justify-center gap-2 mx-auto transition-colors"
                    >
                        <StopCircleIcon/>
                        Kết thúc cuộc trò chuyện
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LiveChat;