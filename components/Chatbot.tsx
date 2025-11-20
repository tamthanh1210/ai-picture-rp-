// Fix: Add missing Web Speech API types to resolve TypeScript errors. These interfaces and the global declaration make the browser-specific SpeechRecognition API available to TypeScript.
interface SpeechRecognitionResult {
    [index: number]: SpeechRecognitionAlternative;
    length: number;
    isFinal: boolean;
}
interface SpeechRecognitionAlternative {
    transcript: string;
}
interface SpeechRecognitionResultList {
    [index: number]: SpeechRecognitionResult;
    length: number;
}
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
    error: string;
}
interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onend: () => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    onstart: () => void;
}
declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

import React, { useState, useEffect, useRef } from 'react';
import { getChatResponseStream, ChatMessage } from '../services/geminiService';
import { XIcon, CopyIcon, CheckIcon, BroomIcon, MicrophoneIcon } from './Icons';
import Spinner from './Spinner';

interface ChatbotProps {
    onClose: () => void;
}

interface Message {
    sender: 'user' | 'ai';
    text: string;
    groundingChunks?: any[];
}

const Chatbot: React.FC<ChatbotProps> = ({ onClose }) => {
    const initialMessage: Message = { sender: 'ai', text: 'Chào bạn! Tôi là AI Stylist. Tôi có thể giúp gì cho bạn về thời trang hôm nay?' };
    
    const [messages, setMessages] = useState<Message[]>(() => {
        try {
            const savedHistory = localStorage.getItem('aiStylistChatHistory');
            return savedHistory ? JSON.parse(savedHistory) : [initialMessage];
        } catch (error) {
            console.error("Không thể phân tích lịch sử chat:", error);
            return [initialMessage];
        }
    });

    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isSpeechSupported, setIsSpeechSupported] = useState(true);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const textBeforeRecording = useRef<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
            },
            (err) => {
                console.warn(`Không thể lấy vị trí: ${err.message}`);
            }
        );
    }, []);

    useEffect(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
            console.warn("Web Speech API không được trình duyệt này hỗ trợ trong chatbot.");
            setIsSpeechSupported(false);
            return;
        }

        recognitionRef.current = new SpeechRecognitionAPI();
        const recognition = recognitionRef.current;
        recognition.lang = 'vi-VN';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => setIsRecording(true);
        recognition.onend = () => setIsRecording(false);
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Lỗi nhận dạng giọng nói (chatbot):', event.error);
            setIsRecording(false);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interimTranscript = '';
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            setInput(textBeforeRecording.current + finalTranscript + interimTranscript);
        };

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('aiStylistChatHistory', JSON.stringify(messages));
        } catch (error) {
            console.error("Không thể lưu lịch sử chat:", error);
        }
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleToggleRecording = () => {
        if (!recognitionRef.current) return;
        if (isRecording) {
            recognitionRef.current.stop();
        } else {
            textBeforeRecording.current = input;
            recognitionRef.current.start();
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isStreaming) return;

        const newUserMessage: Message = { sender: 'user', text: input };
        setMessages(prev => [...prev, newUserMessage]);
        setInput('');
        setIsStreaming(true);
        setError(null);

        const chatHistory = messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
        } as ChatMessage));

        try {
            const stream = await getChatResponseStream(chatHistory, input, location);
            let aiResponseText = '';
            let groundingChunks: any[] = [];
            
            setMessages(prev => [...prev, { sender: 'ai', text: '' }]);

            for await (const chunk of stream) {
                const chunkText = chunk.text;
                if (chunkText) {
                    aiResponseText += chunkText;
                    setMessages(prev => {
                        const newMessages = [...prev];
                        newMessages[newMessages.length - 1].text = aiResponseText;
                        return newMessages;
                    });
                }
                
                const chunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
                if (chunks) {
                    groundingChunks.push(...chunks);
                }
            }

            setMessages(prev => {
                const newMessages = [...prev];
                if (newMessages.length > 0) {
                   newMessages[newMessages.length - 1].groundingChunks = groundingChunks;
                }
                return newMessages;
            });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định.';
            setError(errorMessage);
            setMessages(prev => [...prev, { sender: 'ai', text: `Xin lỗi, đã có lỗi xảy ra: ${errorMessage}` }]);
        } finally {
            setIsStreaming(false);
        }
    };

    const renderTextWithLineBreaks = (text: string) => {
        return text.split('\n').map((line, index) => (
            <React.Fragment key={index}>
                {line}
                <br />
            </React.Fragment>
        ));
    };

    const handleCopy = async (text: string, index: number) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedMessageIndex(index);
            setTimeout(() => setCopiedMessageIndex(null), 2000);
        } catch (err) {
            console.error('Không thể sao chép:', err);
        }
    };

    const handleClearHistory = () => {
        setMessages([initialMessage]);
    };
    
    return (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100%-2rem)] sm:w-96 h-[70vh] max-h-[550px] bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 dark:border-slate-700 animate-[slide-up-fade_0.3s_ease-out]">
            <header className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
                <h2 className="text-xl font-bold">AI Stylist Chat</h2>
                <div className="flex items-center gap-2">
                    <button onClick={handleClearHistory} title="Xóa lịch sử" className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700"><BroomIcon /></button>
                    <button onClick={onClose} aria-label="Đóng" className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700"><XIcon /></button>
                </div>
            </header>
            <div className="flex-grow p-4 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-slate-900/50">
                {messages.map((msg, index) => (
                    <div key={index} className={`mb-4 flex flex-col group ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`relative p-3 rounded-2xl max-w-sm md:max-w-md ${msg.sender === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 rounded-bl-none'}`}>
                            <div>{renderTextWithLineBreaks(msg.text)}</div>
                             {msg.sender === 'ai' && msg.text && (
                                <button
                                    onClick={() => handleCopy(msg.text, index)}
                                    className="absolute -bottom-3 -right-3 p-1.5 bg-white dark:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity border border-gray-200 dark:border-slate-500"
                                    title="Sao chép"
                                >
                                    {copiedMessageIndex === index ? <CheckIcon /> : <CopyIcon />}
                                </button>
                            )}
                            {msg.sender === 'ai' && msg.groundingChunks && msg.groundingChunks.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-300 dark:border-slate-600">
                                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Nguồn:</p>
                                    <ul className="text-xs list-none space-y-1">
                                        {msg.groundingChunks.map((chunk, i) => (
                                            chunk.maps ? (
                                                <li key={i}>
                                                    <a href={chunk.maps.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400 bg-blue-100 dark:bg-slate-800/50 px-2 py-1 rounded">
                                                        📍 {chunk.maps.title}
                                                    </a>
                                                </li>
                                            ) : null
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
             {error && (
                <div className="p-4 text-center text-sm text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30">
                    <p>{error}</p>
                </div>
            )}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-slate-700 flex-shrink-0">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Hỏi AI Stylist điều gì đó..."
                        disabled={isStreaming}
                        className="w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-full py-3 pl-4 pr-28 text-slate-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                    <div className="absolute inset-y-1.5 right-1.5 flex items-center gap-1">
                        {isSpeechSupported && (
                             <button
                                type="button"
                                onClick={handleToggleRecording}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 text-gray-600 dark:text-gray-300'}`}
                                aria-label={isRecording ? "Dừng ghi âm" : "Bắt đầu ghi âm"}
                            >
                                <MicrophoneIcon />
                            </button>
                        )}
                        <button type="submit" disabled={isStreaming || !input.trim()} className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors transform hover:scale-110">
                            {isStreaming ? <Spinner /> : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white w-5 h-5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default Chatbot;