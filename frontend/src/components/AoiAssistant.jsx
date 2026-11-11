import { useEffect, useRef, useState } from 'react';
import { usePondData } from '../context/pondDataStore';
import { chatWithAoi } from '../services/dataSource';

const QUICK_PROMPTS = [
  'What is happening?',
  'Why is my pond stressed?',
  'What should I do?',
  'Can I improve it further?',
  'Explain the carbon estimate',
];

export default function AoiAssistant() {
  const { activePondId, snapshot } = usePondData();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]);

  const bottomRef = useRef(null);

  // Scroll to the latest message.
  // IMPORTANT: use a block body so this effect explicitly returns nothing.
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [messages, busy]);

  // Close the assistant when Escape is pressed.
  useEffect(() => {
    const close = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', close);

    // This is the ONLY thing this effect returns:
    // a synchronous cleanup function.
    return () => {
      window.removeEventListener('keydown', close);
    };
  }, []);

  async function send(value) {
    const text = String(value || input).trim();

    if (!text || busy) {
      return;
    }

    // Add user's message immediately.
    setMessages((current) => [
      ...current,
      {
        role: 'user',
        text,
      },
    ]);

    setInput('');
    setBusy(true);

    try {
      const result = await chatWithAoi(activePondId, text);

      setMessages((current) => [
        ...current,
        {
          role: 'aoi',
          text: result?.answer || 'I received the request but no answer was returned.',
          provider: result?.provider || 'insight engine',
          action: result?.recommended_action || null,
        },
      ]);
    } catch (error) {
      console.error('Aoi request failed:', error);

      setMessages((current) => [
        ...current,
        {
          role: 'aoi',
          text:
            error?.status === 404
              ? 'I need the first live prediction before I can answer from the digital twin. Use Predict now or wait for the automatic cycle.'
              : `I could not reach the insight engine: ${
                  error?.message || 'Unknown error'
                }`,
          provider: 'connection notice',
          action: null,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const greeting = `${
    snapshot?.label || 'Current'
  } state loaded for ${activePondId}. Ask what the twin sees, or let me test a supported action.`;

  return (
    <>
      {/* Aoi launcher */}
      <button
        className="aoi-launcher"
        onClick={() => setOpen(true)}
        aria-label="Open Aoi assistant"
        aria-expanded={open}
      >
        <img src="/images/aoi-mascot.png" alt="" />
        <i />
        <span>Ask Aoi</span>
      </button>

      {/* Overlay */}
      <div
        className={`aoi-overlay ${open ? 'is-open' : ''}`}
        aria-hidden={!open}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setOpen(false);
          }
        }}
      >
        <section
          className="aoi-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Aoi digital twin assistant"
        >
          {/* Header */}
          <header>
            <div className="aoi-dialog-avatar">
              <img src="/images/aoi-mascot.png" alt="Aoi" />
            </div>

            <div>
              <b>Aoi</b>
              <span>Model-grounded pond guide</span>

              <small>
                <i /> Watching {activePondId}
              </small>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Aoi"
            >
              ×
            </button>
          </header>

          {/* Trust indicators */}
          <div className="aoi-trust-strip">
            <span>Digital twin</span>
            <span>Scenario search</span>
            <span>Gemini-ready</span>
          </div>

          {/* Quick prompts */}
          <div className="aoi-quick-actions">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                type="button"
                key={prompt}
                onClick={() => {
                  void send(prompt);
                }}
                disabled={busy}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div
            className="aoi-messages"
            aria-live="polite"
          >
            {/* Initial greeting */}
            <div className="aoi-message">
              <img
                src="/images/aoi-mascot.png"
                alt=""
              />

              <div>
                <p>{greeting}</p>
                <small className="aoi-provider">
                  live twin context
                </small>
              </div>
            </div>

            {/* Conversation */}
            {messages.map((message, index) => {
              const hasAction =
                message.role === 'aoi' &&
                message.action &&
                message.action.changes &&
                typeof message.action.changes === 'object';

              const changeCount = hasAction
                ? Object.keys(message.action.changes).length
                : 0;

              return (
                <div
                  key={`${message.role}-${index}`}
                  className={`aoi-message ${message.role}`}
                >
                  {message.role === 'user' ? (
                    <span className="aoi-user">YOU</span>
                  ) : (
                    <img
                      src="/images/aoi-mascot.png"
                      alt=""
                    />
                  )}

                  <div>
                    <p>{message.text}</p>

                    {hasAction && (
                      <span className="aoi-action-proof">
                        <span>
                          Tested {changeCount} control
                          {changeCount === 1 ? '' : 's'}
                        </span>

                        <span>
                          Live state unchanged
                        </span>
                      </span>
                    )}

                    {message.provider && (
                      <small className="aoi-provider">
                        {message.provider}
                      </small>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {busy && (
              <div className="aoi-message">
                <img
                  src="/images/aoi-mascot.png"
                  alt=""
                />

                <div className="aoi-typing">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            )}

            {/* Scroll target */}
            <span ref={bottomRef} />
          </div>

          {/* Composer */}
          <form
            className="aoi-compose"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <input
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
              }}
              placeholder="Ask about this pond..."
              aria-label="Ask Aoi"
              disabled={busy}
            />

            <button
              type="submit"
              disabled={!input.trim() || busy}
            >
              {busy ? 'Thinking...' : 'Send'}
            </button>
          </form>

          {/* Disclaimer */}
          <footer className="aoi-disclaimer">
            Advice is restricted to current AlgaTwin evidence.
            Simulations are never presented as measurements.
          </footer>
        </section>
      </div>
    </>
  );
}