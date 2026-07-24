// ChatWindow.jsx — scrollable list of messages plus a "thinking" indicator.

import { useEffect, useRef } from 'react';
import Message from './Message.jsx';

export default function ChatWindow({ messages, loading }) {
  const endRef = useRef(null);

  // Keep the newest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="chat">
      {messages.length === 0 && (
        <div className="chat__empty">
          <p>Ask about your security incident tickets. For example:</p>
          <ul>
            <li>"How many high-priority tickets are currently open?"</li>
            <li>"What is the status of the phishing ticket assigned to Sarah?"</li>
            <li>"Show me all tickets In Progress for more than 3 days."</li>
          </ul>
        </div>
      )}

      {messages.map((m, i) => (
        <Message key={i} role={m.role} text={m.text} sql={m.sql} />
      ))}

      {loading && (
        <div className="message message--assistant">
          <div className="message__role">Assistant</div>
          <div className="message__text message__text--loading">Thinking…</div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
