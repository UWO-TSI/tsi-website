"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send, Bot, User } from "lucide-react";
import Link from "next/link";
import { Banner, Card, IconButton, Loading } from "@/components/gui";

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
    "Hi! Ask me about TSI's operations, projects or procedures. I'll answer from the club's knowledge base once I'm connected to it.",
  timestamp: new Date(),
};

const CANNED_RESPONSE =
  "I'm not connected to the TSI knowledge base yet, so I can't answer that one. This chat will hook up to it soon.";

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
    <div className="flex h-full flex-col" style={{ padding: "24px 20px" }}>
      <div className="flex min-h-0 w-full flex-1 flex-col" style={{ maxWidth: 820, margin: "0 auto" }}>
        <div className="shrink-0">
          <Link
            href="/student/dashboard/tools"
            className="inline-flex items-center gap-1.5 mb-3 text-sm transition-colors text-[var(--gui-ink-2)] hover:text-[var(--gui-sage)]"
            style={{ fontWeight: 800, minHeight: 32 }}
          >
            <ArrowLeft size={16} aria-hidden />
            Back to tools
          </Link>
          <Banner title="Tethos RAG" icon={<Bot size={26} />} tone="sage" ribbon="Not connected yet">
            An AI assistant with the TSI knowledge base.
          </Banner>
        </div>

        {/* Chat */}
        <Card className="flex min-h-0 flex-1 flex-col" style={{ padding: 0, overflow: "hidden", minHeight: 360 }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-label="Conversation">
            {messages.map((msg) => {
              const mine = msg.role === "user";
              return (
                <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`flex items-start gap-2.5 max-w-[85%] ${mine ? "flex-row-reverse" : ""}`}>
                    <Avatar mine={mine} />
                    <div className="min-w-0">
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: mine ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
                          background: mine ? "var(--gui-butter)" : "var(--gui-paper-warm)",
                          color: "var(--gui-ink)",
                          boxShadow: "var(--gui-shadow-sm)",
                        }}
                      >
                        <p className="text-sm leading-relaxed" style={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                          {msg.content}
                        </p>
                      </div>
                      <span className={`block mt-1 px-1 text-xs ${mine ? "text-right" : ""}`} style={{ color: "var(--gui-muted)", fontWeight: 700 }}>
                        {msg.timestamp.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2.5">
                  <Avatar mine={false} />
                  <Loading label="Thinking…" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 p-3" style={{ borderTop: "2px dashed var(--gui-paper-edge)", background: "var(--gui-paper-warm)" }}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask a question…"
                aria-label="Your question"
                disabled={isTyping}
                className="flex-1 min-w-0 transition-colors border-2 border-[var(--gui-paper-line)] focus:border-[var(--gui-sage)] bg-[var(--gui-paper-hi)] text-[var(--gui-ink)] placeholder:text-[var(--gui-muted)] disabled:opacity-60"
                style={{ height: 46, padding: "0 16px", borderRadius: "18px 15px 17px 16px", fontSize: 15, fontWeight: 600 }}
              />
              <IconButton label="Send" tone="sage" onClick={handleSend} disabled={!input.trim() || isTyping}>
                <Send size={18} aria-hidden />
              </IconButton>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Avatar({ mine }: { mine: boolean }) {
  return (
    <span
      aria-hidden
      className="grid place-items-center shrink-0"
      style={{
        width: 32,
        height: 32,
        borderRadius: "var(--gui-r-blob)",
        background: mine ? "var(--gui-butter)" : "var(--gui-sage-soft)",
        color: mine ? "var(--gui-ink-strong)" : "var(--gui-sage)",
      }}
    >
      {mine ? <User size={16} /> : <Bot size={16} />}
    </span>
  );
}
