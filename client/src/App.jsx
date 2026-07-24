// App.jsx — top-level component. Owns the conversation state and wiring.

import { useState } from 'react';
import ChatWindow from './components/ChatWindow.jsx';
import InputField from './components/InputField.jsx';
import { sendMessage } from './api/chat.js';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (text) => {
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setLoading(true);

    try {
      const { reply, sql } = await sendMessage(text);
      setMessages((prev) => [...prev, { role: 'assistant', text: reply, sql }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>SecOps Ticket Assistant</h1>
        <p>Ask about security incident tickets in plain English.</p>
      </header>
      <ChatWindow messages={messages} loading={loading} />
      <InputField onSend={handleSend} disabled={loading} />
    </div>
  );
}
