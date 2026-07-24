// InputField.jsx — the message composer at the bottom of the chat.

import { useState } from 'react';

export default function InputField({ onSend, disabled }) {
  const [value, setValue] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  return (
    <form className="input" onSubmit={submit}>
      <input
        type="text"
        className="input__field"
        placeholder="Ask about incident tickets…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        autoFocus
      />
      <button type="submit" className="input__button" disabled={disabled}>
        Send
      </button>
    </form>
  );
}
