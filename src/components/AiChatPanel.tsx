import { useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, AiSettings, DatabaseSchema } from "../types";
import { buildSystemPrompt, buildSystemPromptFromMd } from "../utils/schemaContext";

type AiChatPanelProps = {
  schema: DatabaseSchema;
  dbType: string;
  settings: AiSettings;
  onApplyToEditor: (sql: string) => void;
  onOpenSettings: () => void;
  schemaMarkdown: string;
  messages: ChatMessage[];
  onMessagesChange: (msgs: ChatMessage[]) => void;
};

function extractSqlBlocks(text: string): string[] {
  const regex = /```sql\s*\n?([\s\S]*?)```/gi;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

export default function AiChatPanel({
  schema,
  dbType,
  settings,
  onApplyToEditor,
  onOpenSettings,
  schemaMarkdown,
  messages,
  onMessagesChange,
}: AiChatPanelProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const setMessages = useCallback((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    if (typeof updater === "function") {
      onMessagesChange(updater(messages));
    } else {
      onMessagesChange(updater);
    }
  }, [messages, onMessagesChange]);

  const isConfigured =
    settings.baseUrl.trim() !== "" && settings.model.trim() !== "";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setError("");
    setLoading(true);

    try {
      // Use MD-based context if available, fallback to basic schema
      const systemPrompt = schemaMarkdown
        ? buildSystemPromptFromMd(schemaMarkdown, dbType)
        : buildSystemPrompt(schema, dbType);

      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: trimmed },
      ];

      const response = await invoke<string>("ai_chat", {
        request: {
          baseUrl: settings.baseUrl,
          apiKey: settings.apiKey,
          model: settings.model,
          messages: apiMessages,
        },
      });

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response,
        timestamp: Date.now(),
        sqlBlocks: extractSqlBlocks(response),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const msg = String(err);
      const clean = msg.replace(/^.*?Error invoking.*?:\s*/i, "");
      setError(clean || msg);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, schema, dbType, settings, schemaMarkdown]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError("");
  };

  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.role === "user") {
      return <div className="chatMsgText">{msg.content}</div>;
    }

    const parts = msg.content.split(/```sql\s*\n?[\s\S]*?```/gi);
    const sqlBlocks = msg.sqlBlocks ?? [];
    const elements: React.ReactNode[] = [];

    parts.forEach((textPart, i) => {
      if (textPart.trim()) {
        elements.push(
          <div key={`text-${i}`} className="chatMsgText">
            {textPart.trim()}
          </div>
        );
      }
      if (i < sqlBlocks.length) {
        elements.push(
          <div key={`sql-${i}`} className="chatSqlBlock">
            <pre className="chatSqlCode">{sqlBlocks[i]}</pre>
            <button
              type="button"
              className="chatApplyBtn"
              onClick={() => onApplyToEditor(sqlBlocks[i])}
            >
              Apply to Editor
            </button>
          </div>
        );
      }
    });

    return <>{elements}</>;
  };

  if (!isConfigured) {
    return (
      <aside className="aiChatPanel">
        <div className="aiChatHeader">
          <span className="aiChatTitle">AI Assistant</span>
        </div>
        <div className="aiChatUnconfigured">
          <svg className="emptyStateIcon" viewBox="0 0 48 48" width="36" height="36">
            <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="2"/>
            <path d="M16 20c0-4.4 3.6-8 8-8s8 3.6 8 8c0 3-1.7 5.6-4 6.9V30h-8v-3.1c-2.3-1.3-4-3.9-4-6.9z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="20" y1="34" x2="28" y2="34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p>Configure your AI provider to start chatting.</p>
          <button
            type="button"
            className="ghostAction"
            onClick={onOpenSettings}
          >
            Open Settings
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="aiChatPanel">
      <div className="aiChatHeader">
        <span className="aiChatTitle">AI Assistant</span>
        <div className="aiChatHeaderActions">
          <button
            type="button"
            className="aiChatHeaderBtn"
            onClick={clearChat}
            title="Clear chat"
          >
            Clear
          </button>
          <button
            type="button"
            className="aiChatHeaderBtn"
            onClick={onOpenSettings}
            title="AI Settings"
          >
            &#x2699;
          </button>
        </div>
      </div>

      <div className="aiChatMessages">
        {messages.length === 0 && (
          <div className="aiChatEmpty">
            <svg className="emptyStateIcon" viewBox="0 0 48 48" width="32" height="32">
              <path d="M24 4l4 8 8 1.5-6 5.5 1.5 8L24 22l-7.5 5 1.5-8-6-5.5 8-1.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M12 34l-4 8M36 34l4 8M24 36v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div>Ask about your schema, request SQL queries, or explore your data</div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`chatMsg chatMsg--${msg.role}`}>
            <div className="chatMsgRole">
              {msg.role === "user" ? "You" : "AI"}
            </div>
            {renderMessageContent(msg)}
          </div>
        ))}
        {loading && (
          <div className="chatMsg chatMsg--assistant">
            <div className="chatMsgRole">AI</div>
            <div className="chatMsgText chatMsgLoading">
              <span className="thinkingDots">Thinking</span>
            </div>
          </div>
        )}
        {error && <div className="chatError">{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="aiChatInput">
        <textarea
          className="aiChatTextarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your database..."
          rows={2}
          disabled={loading}
        />
        <button
          type="button"
          className="aiChatSendBtn"
          onClick={sendMessage}
          disabled={!input.trim() || loading}
        >
          Send
        </button>
      </div>
    </aside>
  );
}
