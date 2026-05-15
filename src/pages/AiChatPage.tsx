import React, { useState, useEffect, useRef } from 'react';
import { Home, Image as ImageIcon, Send, Loader2, Bot, User, CornerDownLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase-setup';

interface Message {
  role: 'user' | 'model';
  content: string;
}

export default function AiChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: 'Hello! I am the India Post AI Assistant. I have read the latest circulars and updates. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [circularContext, setCircularContext] = useState('');
  
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    async function fetchContext() {
      try {
        const q = query(
          collection(db, 'uploaded_files'),
          where('isPublic', '==', true)
        );
        const snapshot = await getDocs(q);
        
        let allText = '';
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          allText += `CIRCULAR NAME: ${data.name}\nCATEGORY: ${data.category}\nDATE: ${new Date(data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now()).toLocaleDateString()}\nCONTENT: ${data.textContent || 'No text content available for this file.'}\n---\n`;
        });
        
        setCircularContext(allText);
      } catch (err) {
        console.error('Failed to load circulars for AI context', err);
      }
    }
    fetchContext();
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsLoading(true);

    try {
      // Map to Gemini expected format: { role: 'user' | 'model', parts: [{ text: ... }] }
      const geminiMessages = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));
      geminiMessages.push({ role: 'user', parts: [{ text: userMessage }] });

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: geminiMessages,
          context: circularContext.substring(0, 500000) // limit characters to avoid large token hits on free tier
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch response');
      }

      setMessages(prev => [...prev, { role: 'model', content: json.text }]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', content: `Error: ${err.message || 'Sorry, I encountered an error while trying to process your request.'}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f5ed] flex flex-col font-sans">
      <header className="bg-[#4d161a] border-b border-[#3b1114] text-white shrink-0">
        <div 
          className="px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{
            backgroundImage: `radial-gradient(#ffffff15 1px, transparent 1px)`,
            backgroundSize: `20px 20px`
          }}
        >
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center p-1 shrink-0 shadow-sm">
              <img 
                src="https://upload.wikimedia.org/wikipedia/en/3/32/India_Post.svg" 
                alt="India Post" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white mb-0.5">Department of Posts</h1>
              <p className="text-sm text-yellow-400 font-medium flex items-center gap-1.5">
                <span className="text-lg">✨</span> AI circulars Assistant
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 self-end md:self-center w-full md:w-auto justify-end">
            <Link 
              to="/" 
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Public Portal</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-6 flex flex-col h-[calc(100vh-110px)] max-h-screen">
        <div className="flex-1 bg-white border border-gray-200 rounded-[16px] shadow-sm flex flex-col overflow-hidden">
          
          <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'model' && (
                  <div className="w-10 h-10 rounded-full bg-[#fae8e9] border border-[#f0c2c5] flex items-center justify-center shrink-0">
                    <Bot className="w-6 h-6 text-[#cc2128]" />
                  </div>
                )}
                
                <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 ${
                  msg.role === 'user' 
                    ? 'bg-[#4d161a] text-white rounded-br-none' 
                    : 'bg-gray-50 text-gray-800 border border-gray-100 rounded-bl-none shadow-sm'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="prose prose-sm prose-p:leading-relaxed max-w-none text-gray-800">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-10 h-10 rounded-full bg-gray-200 border flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-gray-500" />
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-4 justify-start">
                 <div className="w-10 h-10 rounded-full bg-[#fae8e9] border border-[#f0c2c5] flex items-center justify-center shrink-0">
                  <Bot className="w-6 h-6 text-[#cc2128]" />
                </div>
                <div className="bg-gray-50 text-gray-800 border border-gray-100 px-5 py-4 rounded-2xl rounded-bl-none flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#cc2128] rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-[#cc2128] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  <span className="w-2 h-2 bg-[#cc2128] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                </div>
              </div>
            )}
            <div ref={endOfMessagesRef} />
          </div>

          <div className="p-4 border-t bg-gray-50">
            <form onSubmit={handleSend} className="relative flex items-center max-w-3xl mx-auto w-full">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about updates, circulars, new roles..."
                className="w-full bg-white border border-gray-300 rounded-full pl-6 pr-14 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#cc2128] focus:border-transparent text-gray-900 shadow-sm"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || !circularContext}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#cc2128] text-white p-2 rounded-full hover:bg-[#a61a20] disabled:opacity-50 disabled:hover:bg-[#cc2128] transition-colors"
              >
                <CornerDownLeft className="w-5 h-5" />
              </button>
            </form>
            {!circularContext && (
               <p className="text-xs text-center text-gray-500 mt-2 font-medium">Loading circular knowledge base...</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
