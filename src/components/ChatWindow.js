import React, { useState, useRef, useEffect } from 'react';
import { FaUserCircle, FaCheckSquare, FaDownload, FaTimes } from 'react-icons/fa';
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
  const [typewriterMsg, setTypewriterMsg] = useState(null);
  const [typewriterContent, setTypewriterContent] = useState("");
  const [displayedMessages, setDisplayedMessages] = useState([]);
  const [lastResponseId, setLastResponseId] = useState(null);
  const messagesEndRef = useRef(null);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  // user display name / initials (for a stylish display)
  const storedUserName = localStorage.getItem('userName') || '';
  const displayName = storedUserName;
  const initials = displayName ? displayName.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase() : 'U';
  const projectName = localStorage.getItem('projectName') || '';
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);

  // Scroll automatique
  useEffect(() => {
    if (
      messagesEndRef.current &&
      !waitingForResponse &&
      !typewriterMsg
    ) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, waitingForResponse, optimisticUserMsg, typewriterContent]);

  // Scroll automatique en bas quand on change de conversation ou que les messages sont mis à jour
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversationId, displayedMessages]);

  // Bouton scroll haut
  useEffect(() => {
    const chatMessagesDiv = document.querySelector('.chat-messages');
    if (!chatMessagesDiv) return;
    const handleScroll = () => {
      setShowScrollTop(chatMessagesDiv.scrollTop > 100);
    };
    chatMessagesDiv.addEventListener('scroll', handleScroll);
    return () => {
      chatMessagesDiv.removeEventListener('scroll', handleScroll);
    };
  }, [displayedMessages, waitingForResponse, typewriterMsg, typewriterContent]);

  useEffect(() => {
    setDisplayedMessages(messages);
  }, [messages]);

  // Helper: detecte si la réponse contient du HTML (simple heuristique)
  const isHTMLContent = (text) => {
    if (!text) return false;
    return /<\/?[a-z][\s\S]*>/i.test(text);
  };

  // Effet typewriter
  useEffect(() => {
    let intervalId;

    const handleVisibilityChange = () => {
      if (document.hidden && typewriterMsg) {
        setTypewriterContent(typewriterMsg);
        setTypewriterMsg(null);
        setDisplayedMessages(prev => [
          ...prev,
          { id: Date.now(), content: typewriterMsg, role: "assistant" },
        ]);
        setWaitingForResponse(false);
        setOptimisticUserMsg(null);
      }
    };

    if (typewriterMsg && typewriterContent.length < typewriterMsg.length) {
      intervalId = setInterval(() => {
        setTypewriterContent(prev => typewriterMsg.slice(0, prev.length + 1));
      }, 7);
    }

    if (typewriterMsg && typewriterContent.length === typewriterMsg.length) {
      setTimeout(() => {
        setDisplayedMessages(prev => [
          ...prev,
          { id: Date.now(), content: typewriterMsg, role: "assistant" },
        ]);
        setTypewriterMsg(null);
        setTypewriterContent("");
        setWaitingForResponse(false);
        setOptimisticUserMsg(null);
        refreshMessages(false);
      }, 500);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [typewriterMsg, typewriterContent, refreshMessages]);


  // Envoi message utilisateur
  const sendMessage = async () => {
  if (!prompt || !conversationId) return;

  const originalPrompt = prompt; // Keep a copy to restore on error
  setSending(true);
  setLocalError("");
  setOptimisticUserMsg({ prompt: originalPrompt });
  setWaitingForResponse(true);
  setPrompt(""); // Clear input for better UX

  setTimeout(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, 100);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3-minute timeout

  try {
    const res = await fetch(`https://dcd612f5d791.ngrok-free.app/api/restitution/addMessageToConversation_ined`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ message: prompt, conversation_id: conversationId, projet_name: projectName }),
      signal: controller.signal, // Pass the signal to the fetch request
    });

    clearTimeout(timeoutId); // Clear the timeout if the fetch completes successfully

    const data = await res.json();

    if (data.success) {
      setLastResponseId(data.response_id);

      if (window.__chat_polling_interval) {
        clearInterval(window.__chat_polling_interval);
        window.__chat_polling_interval = null;
      }

      pollForResponse(data.response_id); // Start polling for response
    } else {
      setLocalError("Erreur lors de l'ajout du message");
      setOptimisticUserMsg(null);
      setWaitingForResponse(false);
      setPrompt(originalPrompt); // Restore user input on failure
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      setLocalError("La requête a été annulée en raison du délai d'attente");
    } else {
      setLocalError("Erreur d'envoi : " + err.message);
    }
    setOptimisticUserMsg(null);
    setWaitingForResponse(false);
    setPrompt(originalPrompt); // Restore user input on error
  }
  setSending(false);
};


  // Polling réponse IA
  const pollForResponse = (responseId) => {
  window.__chat_polling_interval = setInterval(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // Timeout après 3 minutes

    try {
      const res = await fetch(`https://dcd612f5d791.ngrok-free.app/api/restitution/getFinalResponseAssistant_ined`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ response_id: responseId }),
        signal: controller.signal, // Pass the signal to the fetch request
      });

      clearTimeout(timeoutId); // Clear the timeout if the fetch completes successfully

      if (!res.ok) throw new Error("Polling échoué");

      const data = await res.json();

      if (data.success && data.message) {
        setOptimisticUserMsg(null);
        setWaitingForResponse(false);

        if (!typewriterMsg) {
          setTypewriterMsg(data.message);
          setTypewriterContent("");
        }

        clearInterval(window.__chat_polling_interval); // Clear polling interval
        window.__chat_polling_interval = null;
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setLocalError("Le polling a été annulé en raison du délai d'attente");
      } else {
        setLocalError("Erreur polling : " + err.message);
      }
      setWaitingForResponse(false);
      setOptimisticUserMsg(null);
      clearInterval(window.__chat_polling_interval); // Clear polling interval
      window.__chat_polling_interval = null;
    }
  }, 120000); // Polling every 2 minutes
};


  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleStopGeneration = () => {
    if (window.__chat_polling_interval) {
      clearInterval(window.__chat_polling_interval);
      window.__chat_polling_interval = null;
    }
    if (typewriterMsg && typewriterContent) {
      setDisplayedMessages(prev => {
        const alreadyExists = prev.some(
          msg => msg.content === typewriterContent
        );
        if (!alreadyExists) {
          return [
            ...prev,
            { id: Date.now(), content: typewriterContent, role: "assistant" }
          ];
        }
        return prev;
      });
    }
    setTypewriterMsg(null);
    setTypewriterContent("");
    setWaitingForResponse(false);
    setOptimisticUserMsg(null);
    setLocalError("Génération arrêtée.");
  };

  // Scroll pendant génération
  useEffect(() => {
    if (typewriterMsg && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [typewriterContent, typewriterMsg]);

  // When streaming HTML into the iframe, also scroll the iframe's inner document to bottom
  useEffect(() => {
    if (!typewriterMsg) return;
    if (!isHTMLContent(typewriterMsg)) return;

    // find the last iframe preview (the one for the streaming message)
    const iframes = document.querySelectorAll('.html-preview-iframe');
    if (!iframes || iframes.length === 0) return;
    const iframe = iframes[iframes.length - 1];
    if (!iframe) return;

    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const scrollHeight = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
      // scroll the iframe's window to bottom smoothly
      iframe.contentWindow.scrollTo({ top: scrollHeight, behavior: 'smooth' });
    } catch (err) {
      // accessing iframe might fail if sandbox/origin changes; ignore silently
      // console.warn('Could not scroll iframe:', err);
    }
  }, [typewriterContent, typewriterMsg]);

  // Also ensure that when a full HTML message is appended we scroll its iframe to bottom
  useEffect(() => {
    // run after displayedMessages update
    const last = displayedMessages && displayedMessages.length ? displayedMessages[displayedMessages.length - 1] : null;
    if (!last || !last.content) return;
    if (!isHTMLContent(last.content)) return;

    const iframes = document.querySelectorAll('.html-preview-iframe');
    if (!iframes || iframes.length === 0) return;
    const iframe = iframes[iframes.length - 1];
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const scrollHeight = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
      iframe.contentWindow.scrollTo({ top: scrollHeight, behavior: 'smooth' });
    } catch (err) {
      // ignore
    }
  }, [displayedMessages]);

  // Toggle message selection
  const toggleSelectMessage = (id) => {
    setSelectedMessages(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      return [...prev, id];
    });
  };

  // Clear selection mode
  const clearSelection = () => {
    setSelectedMessages([]);
    setSelectMode(false);
  };

  // Download selected messages as Word document
  const downloadSelectedAsWord = () => {
    if (!selectedMessages || selectedMessages.length === 0) return;

    // small helper: escape HTML special chars
    const escapeHtml = (str) => {
      if (!str && str !== 0) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    // Convert markdown content to simple HTML but preserve code blocks and inline code,
    // convert headings and lists, group code blocks by language, and convert emphasis.
    const renderContentHtml = (markdown) => {
      if (!markdown && markdown !== 0) return '';

      const codeBlocks = [];
      // 1) extract fenced code blocks to placeholders (escape their contents)
      let working = String(markdown).replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (m, lang, code) => {
        const idx = codeBlocks.length;
        const safeCode = escapeHtml(code);
        const langNorm = (lang || '').toLowerCase();
        const langClass = lang ? `language-${langNorm}` : '';
        let codeHtml = `<pre><code class="${langClass}" style="white-space: pre-wrap;">${safeCode}</code></pre>`;
        if (langNorm === 'html' || langNorm === 'xml') {
          codeHtml = `<div class="code-section"><div class="code-title">HTML</div>${codeHtml}</div>`;
        } else if (langNorm === 'css') {
          codeHtml = `<div class="code-section"><div class="code-title">CSS</div>${codeHtml}</div>`;
        } else if (langNorm === 'js' || langNorm === 'javascript') {
          codeHtml = `<div class="code-section"><div class="code-title">JavaScript</div>${codeHtml}</div>`;
        } else {
          codeHtml = `<div class="code-section"><div class="code-title">Code</div>${codeHtml}</div>`;
        }
        codeBlocks.push(codeHtml);
        return `<!--CODE_BLOCK_${idx}-->`;
      });

      // 2) extract inline code to placeholders
      const inlineCodes = [];
      working = working.replace(/`([^`]+)`/g, (m, code) => {
        const idx = inlineCodes.length;
        inlineCodes.push(`<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-family:Consolas,monospace;">${escapeHtml(code)}</code>`);
        return `<!--INLINE_CODE_${idx}-->`;
      });

      // 3) emphasis: bold/italic (strong/em)
      // handle bold+italic
      working = working.replace(/\*\*\*([\s\S]+?)\*\*\*/g, '<strong><em>$1</em></strong>');
      working = working.replace(/___([\s\S]+?)___/g, '<strong><em>$1</em></strong>');
      // bold
      working = working.replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>');
      working = working.replace(/__([^\n]+?)__/g, '<strong>$1</strong>');
      // italic
      working = working.replace(/\*([^\n*][^\n]*?)\*/g, '<em>$1</em>');
      working = working.replace(/_([^\n_][^\n]*?)_/g, '<em>$1</em>');

      // 4) headings
      working = working.replace(/^ {0,3}(#{1,6})\s*(.+)$/gm, (m, hashes, title) => {
        const level = Math.min(hashes.length, 6);
        return `<h${level}>${title.trim()}</h${level}>`;
      });

      // 5) unordered lists
      working = working.replace(/(^((?:[ \t]*[-\*]\s+.*\n?)+))/gm, (group) => {
        const lines = group.split(/\n/).filter(Boolean);
        const items = lines.map(line => line.replace(/^[ \t]*[-\*]\s+/, ''))
          .map(item => `<li>${item}</li>`).join('');
        return `<ul>${items}</ul>`;
      });

      // 6) ordered lists
      working = working.replace(/(^((?:[ \t]*\d+\.\s+.*\n?)+))/gm, (group) => {
        const lines = group.split(/\n/).filter(Boolean);
        const items = lines.map(line => line.replace(/^[ \t]*\d+\.\s+/, ''))
          .map(item => `<li>${item}</li>`).join('');
        return `<ol>${items}</ol>`;
      });

      // 7) paragraphs: split on double newlines
      const parts = working.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
      working = parts.map(p => {
        if (/^<(h[1-6]|ul|ol|pre|div|blockquote)/i.test(p)) return p;
        const withBreaks = p.replace(/\n/g, '<br/>');
        return `<p>${withBreaks}</p>`;
      }).join('\n');

      // 8) re-insert inline code and code blocks
      working = working.replace(/<!--INLINE_CODE_(\d+)-->/g, (m, i) => inlineCodes[Number(i)] || '');
      working = working.replace(/<!--CODE_BLOCK_(\d+)-->/g, (m, i) => codeBlocks[Number(i)] || '');

      return working;
    };

    // collect messages in original order
    const selected = displayedMessages
      .filter(m => selectedMessages.includes(m.id) && m.content)
      .sort((a, b) => a.id - b.id);

    // build HTML document (Word can open HTML saved as .doc)
    let bodyHtml = `
        <style>
          /* Minimal, document-wide formatting requested by user */
          body, .document, .message, .message-content, p, div {
            font-family: 'Aptos', Calibri, Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.15;
            text-align: justify;
            color: #000000;
            margin: 0;
            padding: 0;
          }
          /* Ensure paragraphs have no extra spacing before/after */
          p { margin-top: 0; margin-bottom: 0; }
          /* Keep code blocks monospaced but do not introduce extra margins */
          pre, code { font-family: Consolas, 'Courier New', monospace; font-size: 10pt; margin: 0; padding: 0; }
          /* Prevent page-break splitting individual messages when printing/Word */
          .message { page-break-inside: avoid; }
        </style>
      <div class="document">`;
    selected.forEach((m, idx) => {
      const rendered = renderContentHtml(m.content);
      const safe = DOMPurify.sanitize(rendered, { ALLOWED_TAGS: ['div','span','p','pre','code','br','ul','ol','li','strong','em','h1','h2','h3'], ALLOWED_ATTR: ['class', 'style'] });
      bodyHtml += `
        <div class="message">
          <div class="message-content">${safe}</div>
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
      {/* Floating action buttons */}
      <div className="floating-actions">
        {!selectMode ? (
          <button 
            className="select-mode-btn"
            onClick={() => setSelectMode(true)}
            title="Sélectionner des messages"
          >
            <FaCheckSquare />
            <span>Télécharger Word</span>
          </button>
        ) : (
          <>
            <button 
              className="download-selected-btn"
              onClick={downloadSelectedAsWord}
              disabled={selectedMessages.length === 0}
              title="Télécharger la sélection"
            >
              <FaDownload />
              <span>{selectedMessages.length} sélectionné{selectedMessages.length > 1 ? 's' : ''}</span>
            </button>
            <button 
              className="cancel-select-btn"
              onClick={clearSelection}
              title="Annuler la sélection"
            >
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
          <div
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#06b6d4,#6366f1)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14
            }}>{initials}</div>
            <div style={{
              fontWeight: 700,
              fontSize: 14,
              background: 'linear-gradient(90deg,#06b6d4,#9f7aea)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>{displayName || 'Utilisateur'}</div>
          </div>
          <ul className={`dropdown-menu ${dropdownOpen ? 'open' : ''}`} style={{
            position: 'absolute',
            top: '30px',
            right: '0',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
            zIndex: 1000,
            listStyleType: 'none',
            padding: '0',
            margin: '0'
          }}>
            <li
              className="dropdown-item"
              onClick={handleLogout}
              style={{
                padding: '10px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
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
                    <input
                      type="checkbox"
                      checked={selectedMessages.includes(msg.id)}
                      onChange={() => toggleSelectMessage(msg.id)}
                    />
                  </div>
                )}
                <strong>Agent IA :</strong>
                <div className="formatted-content">
                  {/* ✅ Rendu Markdown à la place du split en phrases */}
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ))}
        {optimisticUserMsg && (
          <div className="message">
            <div className="user-message styled-user-message"><strong>Vous :</strong> {optimisticUserMsg.prompt}</div>
          </div>
        )}
        {waitingForResponse && !typewriterMsg && (
          <div className="ai-message ai-thinking styled-ai-thinking">
            <span className="thinking-dots">L'IA réfléchit<span className="dot">.</span><span className="dot">.</span><span className="dot">.</span></span>
          </div>
        )}
        {typewriterMsg && (
          <div className="ai-message styled-ai-message">
            <strong>Agent IA :</strong>
            <div className="formatted-content">
              <ReactMarkdown>{typewriterContent}</ReactMarkdown>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
        {showScrollTop && (
          <button
            className="scroll-top-btn"
            onClick={() => {
              const chatMessagesDiv = document.querySelector('.chat-messages');
              if (chatMessagesDiv) {
                chatMessagesDiv.scrollTo({ top: 0, behavior: 'smooth' });
              }
              setShowScrollTop(false);
            }}
            title="Remonter en haut"
          >
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
                setPrompt("");
              }
            }}
            placeholder="Votre message..."
            rows={3}
            style={{ paddingRight: (waitingForResponse || typewriterMsg) ? '40px' : undefined }}
          />
          <button onClick={sendMessage} disabled={sending || !prompt}>Envoyer</button>
          {(waitingForResponse || typewriterMsg) && (
            <button
              className="stop-btn stop-btn-input"
              onClick={handleStopGeneration}
              title="Arrêter la génération"
            >
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
