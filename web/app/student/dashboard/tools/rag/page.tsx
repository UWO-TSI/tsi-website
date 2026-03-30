"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send, Bot, User } from "lucide-react";
import Link from "next/link";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Welcome, agent. I have access to TSI's internal knowledge base. Ask me anything about operations, projects, or procedures.",
  timestamp: new Date(),
};

const CANNED_RESPONSE =
  "RAG system integration pending. This interface will be connected to the TSI knowledge base.";

export default function RAGPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate typing delay
    setTimeout(() => {
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: CANNED_RESPONSE,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* Header */}
      <div className="mb-4 shrink-0">
        <Link
          href="/student/dashboard/tools"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-brand-blue)] transition-colors mb-3"
        >
          <ArrowLeft size={12} />
          Back to Tools
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-blue)]/10 border border-[var(--color-brand-blue)]/20 flex items-center justify-center">
            <Bot size={16} className="text-[var(--color-brand-blue)]" />
          </div>
          <div>
            <h1 className="text-lg font-heading font-bold text-[var(--color-text-primary)]">
              TETHOS RAG
            </h1>
            <p className="text-[0.6rem] font-mono text-[var(--color-text-muted)]">
              AI Assistant &middot; TSI Knowledge Base
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[var(--color-brand-yellow)] animate-pulse" />
            <span className="text-[0.6rem] font-mono text-[var(--color-brand-yellow)]">
              STANDBY
            </span>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-hidden flex flex-col">
        {/* Terminal Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--glass-border)] bg-[var(--color-bg-main)]">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          </div>
          <span className="text-[0.6rem] font-mono text-[var(--color-text-muted)] ml-2">
            tethos-rag@tsi ~ /knowledge-base
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`flex items-start gap-2.5 max-w-[80%] ${
                  msg.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <div
                  className={`w-6 h-6 rounded shrink-0 flex items-center justify-center ${
                    msg.role === "assistant"
                      ? "bg-[var(--color-accent-cyan)]/10 border border-[var(--color-accent-cyan)]/20"
                      : "bg-[var(--color-brand-blue)]/10 border border-[var(--color-brand-blue)]/20"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <Bot size={12} className="text-[var(--color-accent-cyan)]" />
                  ) : (
                    <User size={12} className="text-[var(--color-brand-blue)]" />
                  )}
                </div>

                <div>
                  <div
                    className={`rounded-lg px-3.5 py-2.5 ${
                      msg.role === "assistant"
                        ? "bg-[var(--color-bg-main)] border border-[var(--color-accent-cyan)]/10"
                        : "bg-[var(--color-brand-blue)]/10 border border-[var(--color-brand-blue)]/20"
                    }`}
                  >
                    <p
                      className={`text-sm font-mono leading-relaxed ${
                        msg.role === "assistant"
                          ? "text-[var(--color-accent-cyan)]"
                          : "text-[var(--color-text-primary)]"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <span className="text-[var(--color-text-muted)]">&gt; </span>
                      )}
                      {msg.content}
                    </p>
                  </div>
                  <span className="text-[0.55rem] font-mono text-[var(--color-text-muted)] mt-1 block px-1">
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded shrink-0 flex items-center justify-center bg-[var(--color-accent-cyan)]/10 border border-[var(--color-accent-cyan)]/20">
                  <Bot size={12} className="text-[var(--color-accent-cyan)]" />
                </div>
                <div className="bg-[var(--color-bg-main)] border border-[var(--color-accent-cyan)]/10 rounded-lg px-3.5 py-2.5">
                  <span className="text-sm font-mono text-[var(--color-accent-cyan)] animate-pulse">
                    &gt; processing query...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[var(--glass-border)] p-3 bg-[var(--color-bg-main)]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-[var(--color-accent-cyan)] shrink-0">$</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Enter query..."
              disabled={isTyping}
              className="flex-1 bg-transparent font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none caret-[var(--color-accent-cyan)] disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="p-2 rounded-md bg-[var(--color-brand-blue)] text-white hover:bg-[var(--color-brand-blue)]/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
