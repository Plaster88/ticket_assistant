// Message.jsx — renders a single chat bubble (user or assistant).

export default function Message({ role, text, sql }) {
  const isUser = role === 'user';
  return (
    <div className={`message ${isUser ? 'message--user' : 'message--assistant'}`}>
      <div className="message__role">{isUser ? 'You' : 'Assistant'}</div>
      <div className="message__text">{text}</div>
      {sql && (
        <details className="message__sql">
          <summary>Generated SQL</summary>
          <code>{sql}</code>
        </details>
      )}
    </div>
  );
}
