import React, { useState, useRef, useEffect } from 'react';
import { FaCheckSquare, FaDownload, FaTimes } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';
import './ChatWindow.css';

const ChatWindow = ({ conversationId, messages, loading, error, refreshMessages, conversationIdInt }) => {
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [localError, setLocalError] = useState("");
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [optimisticUserMsg, setOptimisticUserMsg] = useState(null);

  const [displayedMessages, setDisplayedMessages] = useState([]);
  const messagesEndRef = useRef(null);

  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  const storedUserName = localStorage.getItem('userName') || '';
  const displayName = storedUserName;
  const initials = displayName ? displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'U';
  const projectName = localStorage.getItem('projectName') || '';

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);

  // Scroll automatique
  useEffect(() => {
    if (messagesEndRef.current && !waitingForResponse) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, waitingForResponse, optimisticUserMsg, displayedMessages]);

  // Scroll auto quand conversation change / messages changent
  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [conversationId, displayedMessages]);

  // Bouton scroll haut
  useEffect(() => {
    const chatMessagesDiv = document.querySelector('.chat-messages');
    if (!chatMessagesDiv) return;

    const handleScroll = () => setShowScrollTop(chatMessagesDiv.scrollTop > 100);
    chatMessagesDiv.addEventListener('scroll', handleScroll);
    return () => chatMessagesDiv.removeEventListener('scroll', handleScroll);
  }, [displayedMessages, waitingForResponse]);

  useEffect(() => {
    setDisplayedMessages(messages);
  }, [messages]);

  const isHTMLContent = (text) => {
    if (!text) return false;
    return /<\/?[a-z][\s\S]*>/i.test(text);
  };

  // STOP streaming (AbortController)
  const handleStopGeneration = () => {
    if (window.__chat_stream_controller) {
      window.__chat_stream_controller.abort();
      window.__chat_stream_controller = null;
    }
    setWaitingForResponse(false);
    setOptimisticUserMsg(null);
    setLocalError("Génération arrêtée.");
  };

  // Envoi message utilisateur (STREAM)
  const sendMessage = async () => {
    if (!prompt || !conversationId || sending || waitingForResponse) return;

    const originalPrompt = prompt;

    setSending(true);
    setLocalError("");

    // ✅ afficher le prompt UNE SEULE FOIS: via optimisticUserMsg
    setOptimisticUserMsg({ prompt: originalPrompt });

    setWaitingForResponse(true);
    setPrompt("");

    setTimeout(() => {
      if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    // ✅ message assistant en cours (vide)
    const streamingMsgId = Date.now();
    setDisplayedMessages(prev => ([
      ...prev,
      { id: streamingMsgId, role: "assistant", content: "" }
    ]));

    const controller = new AbortController();
    window.__chat_stream_controller = controller;

    try {
      const res = await fetch(`http://localhost/ia/public/api/restitution/addMessageToConversation_ined_stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          message: originalPrompt,
          conversation_id: conversationId,
          projet_name: projectName
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      // ✅ support \n\n et \r\n\r\n
      const nextBlock = () => {
        const p1 = buffer.indexOf("\n\n");
        const p2 = buffer.indexOf("\r\n\r\n");
        if (p1 === -1 && p2 === -1) return null;

        let cut, len;
        if (p2 !== -1 && (p1 === -1 || p2 < p1)) { cut = p2; len = 4; }
        else { cut = p1; len = 2; }

        const block = buffer.slice(0, cut);
        buffer = buffer.slice(cut + len);
        return block;
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let block;
        while ((block = nextBlock()) !== null) {
          let eventName = "message";
          const dataLines = [];

          block.split(/\r?\n/).forEach(line => {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            if (line.startsWith("data:")) dataLines.push(line.slice(5)); // garder tel quel
          });

          const dataStr = dataLines.join("\n").trim();

          if (eventName === "delta") {
            // ✅ dès le 1er delta, on enlève "réfléchit..."
            setWaitingForResponse(false);

            setDisplayedMessages(prev => prev.map(m =>
              m.id === streamingMsgId
                ? { ...m, content: (m.content || "") + dataStr }
                : m
            ));
          }

          if (eventName === "done") {
            setWaitingForResponse(false);

            // ✅ on retire le prompt optimiste quand c'est terminé
            setOptimisticUserMsg(null);

            refreshMessages(false);
          }

          if (eventName === "error") {
            let err;
            try { err = JSON.parse(dataStr); } catch { err = { message: dataStr }; }
            setLocalError(err.message || "Erreur streaming");
            setWaitingForResponse(false);
            setOptimisticUserMsg(null);
          }
        }
      }
    } catch (err) {
      setLocalError(err.name === "AbortError" ? "Génération arrêtée." : ("Erreur streaming : " + err.message));
      setWaitingForResponse(false);
      setOptimisticUserMsg(null);
    } finally {
      setSending(false);
      window.__chat_stream_controller = null;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Scroll pendant “streaming”
  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [displayedMessages]);

  // Scroll iframe HTML preview si besoin
  useEffect(() => {
    const last = displayedMessages?.length ? displayedMessages[displayedMessages.length - 1] : null;
    if (!last?.content) return;
    if (!isHTMLContent(last.content)) return;

    const iframes = document.querySelectorAll('.html-preview-iframe');
    if (!iframes?.length) return;

    const iframe = iframes[iframes.length - 1];
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const scrollHeight = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
      iframe.contentWindow.scrollTo({ top: scrollHeight, behavior: 'smooth' });
    } catch (_) {}
  }, [displayedMessages]);

  const toggleSelectMessage = (id) => {
    setSelectedMessages(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const clearSelection = () => {
    setSelectedMessages([]);
    setSelectMode(false);
  };

  const downloadSelectedAsWord = () => {
    if (!selectedMessages?.length) return;

    const escapeHtml = (str) => {
      if (!str && str !== 0) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const renderContentHtml = (markdown) => {
      if (!markdown && markdown !== 0) return '';

      markdown = String(markdown).replace(/réponses\s+fermées/gi, '');

      const codeBlocks = [];
      let working = String(markdown).replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (m, lang, code) => {
        const idx = codeBlocks.length;
        const safeCode = escapeHtml(code);
        const langNorm = (lang || '').toLowerCase();
        const langClass = lang ? `language-${langNorm}` : '';
        let codeHtml = `<pre><code class="${langClass}" style="white-space: pre-wrap;">${safeCode}</code></pre>`;
        if (langNorm === 'html' || langNorm === 'xml') codeHtml = `<div class="code-section"><div class="code-title">HTML</div>${codeHtml}</div>`;
        else if (langNorm === 'css') codeHtml = `<div class="code-section"><div class="code-title">CSS</div>${codeHtml}</div>`;
        else if (langNorm === 'js' || langNorm === 'javascript') codeHtml = `<div class="code-section"><div class="code-title">JavaScript</div>${codeHtml}</div>`;
        else codeHtml = `<div class="code-section"><div class="code-title">Code</div>${codeHtml}</div>`;
        codeBlocks.push(codeHtml);
        return `<!--CODE_BLOCK_${idx}-->`;
      });

      const inlineCodes = [];
      working = working.replace(/`([^`]+)`/g, (m, code) => {
        const idx = inlineCodes.length;
        inlineCodes.push(`<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-family:Consolas,monospace;">${escapeHtml(code)}</code>`);
        return `<!--INLINE_CODE_${idx}-->`;
      });

      working = working.replace(/\*\*\*([\s\S]+?)\*\*\*/g, '<strong><em>$1</em></strong>');
      working = working.replace(/___([\s\S]+?)___/g, '<strong><em>$1</em></strong>');
      working = working.replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>');
      working = working.replace(/__([^\n]+?)__/g, '<strong>$1</strong>');
      working = working.replace(/\*([^\n*][^\n]*?)\*/g, '<em>$1</em>');
      working = working.replace(/_([^\n_][^\n]*?)_/g, '<em>$1</em>');

      working = working.replace(/^ {0,3}(#{1,6})\s*(.+)$/gm, (m, hashes, title) => {
        const level = Math.min(hashes.length, 6);
        return `<h${level}>${title.trim()}</h${level}>`;
      });

      working = working.replace(/(^((?:[ \t]*[-\*]\s+.*\n?)+))/gm, (group) => {
        const lines = group.split(/\n/).filter(Boolean);
        return lines
          .map(line => line.replace(/^[ \t]*[-\*]\s+/, ''))
          .map(item => `<p style="line-height:1.15; mso-line-height-rule:exactly;">${item}</p>`).join('');
      });

      working = working.replace(/(^((?:[ \t]*\d+\.\s+.*\n?)+))/gm, (group) => {
        const lines = group.split(/\n/).filter(Boolean);
        return lines
          .map(line => line.replace(/^[ \t]*\d+\.\s+/, ''))
          .map(item => `<p style="line-height:1.15; mso-line-height-rule:exactly;">${item}</p>`).join('');
      });

      const parts = working.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
      working = parts.map(p => {
        if (/^<(h[1-6]|ul|ol|pre|div|blockquote)/i.test(p)) return p;
        return `<p style="line-height:1.15; mso-line-height-rule:exactly;">${p.replace(/\n/g, '<br/>')}</p>`;
      }).join('\n');

      working = working.replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').replace(/[ \t]{2,}/g, ' ');
      working = working.replace(/<!--INLINE_CODE_(\d+)-->/g, (m, i) => inlineCodes[Number(i)] || '');
      working = working.replace(/<!--CODE_BLOCK_(\d+)-->/g, (m, i) => codeBlocks[Number(i)] || '');

      return working;
    };

    const selected = displayedMessages
      .filter(m => selectedMessages.includes(m.id) && m.content)
      .sort((a, b) => a.id - b.id);

    let bodyHtml = `
      <style>
        body, .document, .message, .message-content, p, div {
          font-family: 'Aptos', Calibri, Arial, sans-serif;
          font-size: 11pt;
          text-align: left;
          color: #000000;
          margin: 0;
          padding: 0;
        }
        p { margin-top: 0pt; margin-bottom: 0pt; }
        p, .message-content { line-height: 1.15; }
        body { line-height: 115%; }
        pre, code { font-family: Consolas, 'Courier New', monospace; font-size: 10pt; margin: 0; padding: 0; }
        .message { page-break-inside: avoid; }
        .message.first .message-content { text-align: center; }
      </style>
      <div class="document">`;

    selected.forEach((m, idx) => {
      const rendered = renderContentHtml(m.content);
      const safe = DOMPurify.sanitize(rendered, {
        ALLOWED_TAGS: ['div', 'span', 'p', 'pre', 'code', 'br', 'strong', 'em', 'h1', 'h2', 'h3'],
        ALLOWED_ATTR: ['class', 'style']
      });

      const wrapperClass = idx === 0 ? 'message first' : 'message';
      const inlineStyle = idx === 0
        ? ' style="text-align:center; line-height:1.15; mso-line-height-rule:exactly;"'
        : ' style="line-height:1.15; mso-line-height-rule:exactly;"';

      bodyHtml += `
        <div class="${wrapperClass}">
          <div class="message-content"${inlineStyle}>${safe}</div>
        </div>`;
    });

    bodyHtml += `</div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Messages sélectionnés</title></head><body>${bodyHtml}</body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'messages-selectionnes.doc';
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
    clearSelection();
  };

  return (
    <div className="chat-window">
      <div className="floating-actions">
        {!selectMode ? (
          <button className="select-mode-btn" onClick={() => setSelectMode(true)} title="Sélectionner des messages">
            <FaCheckSquare />
            <span>Télécharger Word</span>
          </button>
        ) : (
          <>
            <button className="download-selected-btn" onClick={downloadSelectedAsWord} disabled={selectedMessages.length === 0} title="Télécharger la sélection">
              <FaDownload />
              <span>{selectedMessages.length} sélectionné{selectedMessages.length > 1 ? 's' : ''}</span>
            </button>
            <button className="cancel-select-btn" onClick={clearSelection} title="Annuler la sélection">
              <FaTimes />
            </button>
          </>
        )}
      </div>

      <div className="chat-title-bar">
        <h1 className="chat-title-gradient">AGENT IA PROJET {projectName && `- ${projectName}`}</h1>
        <img src="/agent-restitution.gif" alt="Agent de restitution" className="chat-title-gif" />
      </div>

      <div className="chat-header">
        {conversationId ? `Conversation #${conversationIdInt}` : 'Aucun chat sélectionné'}
        <div className="user-menu" style={{ marginTop: '17px', marginRight: '115px', position: 'fixed' }}>
          <div onClick={() => setDropdownOpen(!dropdownOpen)} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#06b6d4,#6366f1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{initials}</div>
            <div style={{ fontWeight: 700, fontSize: 14, background: 'linear-gradient(90deg,#06b6d4,#9f7aea)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{displayName || 'Utilisateur'}</div>
          </div>
          <ul className={`dropdown-menu ${dropdownOpen ? 'open' : ''}`} style={{ position: 'absolute', top: '30px', right: '0', backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '4px', boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)', zIndex: 1000, listStyleType: 'none', padding: '0', margin: '0' }}>
            <li className="dropdown-item" onClick={handleLogout} style={{ padding: '10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Déconnexion
            </li>
          </ul>
        </div>
      </div>

      <div className="chat-messages">
        {loading && <div className="loader">Chargement...</div>}

        {displayedMessages?.sort((a, b) => a.id - b.id)?.map((msg) => (
          <div key={msg.id} className="message">
            {msg.prompt && (
              <div className="user-message styled-user-message"><strong>Vous :</strong> {msg.prompt}</div>
            )}
            {msg.content && (
              <div className="ai-message styled-ai-message">
                {selectMode && (
                  <div className="message-checkbox">
                    <input type="checkbox" checked={selectedMessages.includes(msg.id)} onChange={() => toggleSelectMessage(msg.id)} />
                  </div>
                )}
                <strong>Agent IA :</strong>
                <div className="formatted-content">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* ✅ prompt affiché UNE seule fois pendant l’attente */}
        {optimisticUserMsg && (
          <div className="message">
            <div className="user-message styled-user-message"><strong>Vous :</strong> {optimisticUserMsg.prompt}</div>
          </div>
        )}

        {waitingForResponse && (
          <div className="ai-message ai-thinking styled-ai-thinking">
            <span className="thinking-dots">L'IA réfléchit<span className="dot">.</span><span className="dot">.</span><span className="dot">.</span></span>
          </div>
        )}

        <div ref={messagesEndRef} />

        {showScrollTop && (
          <button className="scroll-top-btn" onClick={() => {
            const chatMessagesDiv = document.querySelector('.chat-messages');
            if (chatMessagesDiv) chatMessagesDiv.scrollTo({ top: 0, behavior: 'smooth' });
            setShowScrollTop(false);
          }} title="Remonter en haut">
            ↑
          </button>
        )}
      </div>

      {conversationId && (
        <div className="chat-input" style={{ position: 'relative' }}>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Votre message..."
            rows={3}
            style={{ paddingRight: waitingForResponse ? '40px' : undefined }}
          />
          <button onClick={sendMessage} disabled={sending || !prompt || waitingForResponse}>Envoyer</button>

          {waitingForResponse && (
            <button className="stop-btn stop-btn-input" onClick={handleStopGeneration} title="Arrêter la génération">
              &#9632;
            </button>
          )}
        </div>
      )}

      {(error || localError) && <div className="error-message">{error || localError}</div>}
    </div>
  );
};

export default ChatWindow;
