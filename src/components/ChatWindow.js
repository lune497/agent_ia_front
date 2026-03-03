import React, { useState, useRef, useEffect } from 'react';
import { FaUserCircle, FaCheckSquare, FaDownload, FaTimes, FaFolderOpen } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';
import './ChatWindow.css';

const ChatWindow = ({ conversationId, messages, loading, error, refreshMessages, conversationIdInt, promptToSend, onPromptSent }) => {
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [localError, setLocalError] = useState("");
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [displayedMessages, setDisplayedMessages] = useState([]);
  const [lastResponseId, setLastResponseId] = useState(null);

  // streaming helper – break the final answer into chunks and reveal progressively
  const [streamingSegments, setStreamingSegments] = useState(null);
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const [streamingIndex, setStreamingIndex] = useState(0);
  const messagesEndRef = useRef(null);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  // user display name / initials (for a stylish display)
  const storedUserName = localStorage.getItem('userName') || '';
  const displayName = storedUserName;
  const initials = displayName ? displayName.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase() : 'U';
  const projectName = localStorage.getItem('projectName') || '';
  const projectId = localStorage.getItem('projectId') || '';
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);
  // Upload / fichier states
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [uploadedInfo, setUploadedInfo] = useState(null);
  const fileInputRef = useRef(null);
  const xhrRef = useRef(null);
  // Floating file panel states
  const [filePanelOpen, setFilePanelOpen] = useState(false);
  const [filesList, setFilesList] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState("");
  // Side panel state
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  // Selected file for prompts
  const [selectedFile, setSelectedFile] = useState(null);

  // Prompts prédéfinis
  const predefinedPrompts = [
    {
      id: 1,
      label: "VÉRIFICATION DE LA NUMEROTATION",
      prompt: "Voici mon questionnaire en état brute Intensif avant.docx merci de me traiter cette partie VÉRIFICATION DE LA NUMEROTATION"
    },
    {
      id: 2,
      label: "AMÉLIORATION DE LA FORMULATION",
      prompt: "Voici mon questionnaire en état brute Intensif avant.docx merci de me traiter cette partie AMÉLIORATION DE LA FORMULATION"
    },
    {
      id: 3,
      label: "VÉRIFICATION DES FILTRES",
      prompt: "Voici mon questionnaire en état brute Intensif avant.docx merci de me traiter cette partie VÉRIFICATION DES FILTRES"
    },
    {
      id: 4,
      label: "COHÉRENCE DES MODALITÉS",
      prompt: "Voici mon questionnaire en état brute Intensif avant.docx merci de me traiter cette partie COHÉRENCE DES MODALITÉS"
    },
    {
      id: 5,
      label: "CRÉATION DE L'ARGUMENTAIRE CATI",
      prompt: "Voici mon questionnaire en état brute Intensif avant.docx merci de me traiter cette partie CRÉATION DE L'ARGUMENTAIRE CATI"
    },
    {
      id: 6,
      label: "CRÉATION DE LA PRISE DE CONGÉ",
      prompt: "Voici mon questionnaire en état brute Intensif avant.docx merci de me traiter cette partie CRÉATION DE LA PRISE DE CONGÉ"
    },
    // Ajoutez d'autres prompts ici si nécessaire
  ];


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
  }, [displayedMessages, waitingForResponse]);

  useEffect(() => {
    setDisplayedMessages(messages);
  }, [messages]);

  // Handle prompt from PromptSelector
  useEffect(() => {
    if (promptToSend && promptToSend.trim()) {
      setPrompt(promptToSend);
      // Auto-send the prompt after a small delay to ensure UI has updated
      setTimeout(() => {
        sendMessage(promptToSend);
        if (onPromptSent) {
          onPromptSent();
        }
      }, 100);
    }
  }, [promptToSend]);



  // Helper: detecte si la réponse contient du HTML (simple heuristique)
  const isHTMLContent = (text) => {
    if (!text) return false;
    return /<\/?[a-z][\s\S]*>/i.test(text);
  };

  // Helper: render HTML content with sanitization, allowing spans with styles
  const renderSafeHTML = (htmlContent) => {
    const cleaned = DOMPurify.sanitize(htmlContent, {
      ALLOWED_TAGS: ['span', 'div', 'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'pre', 'code'],
      ALLOWED_ATTR: ['style', 'class']
    });
    return cleaned;
  };



  // Envoi message utilisateur
  const sendMessage = async (textToSend) => {
  const messageText = textToSend || prompt;
  if (!messageText || !conversationId) return;

  const originalPrompt = messageText; // Keep a copy to restore on error
  // immediately show user message in history (even before server
  // confirms) so the question never disappears
  setDisplayedMessages(prev => [...prev, { id: Date.now(), prompt: messageText }]);
  setSending(true);
  setLocalError("");
  setWaitingForResponse(true);
  if (!textToSend) {
    setPrompt(""); // Clear input for better UX (only if not from PromptSelector)
  }

  setTimeout(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, 100);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 360000); // 6-minute timeout

 fetch(`http://localhost/ia/public/api/restitution/addMessageToConversation_ined`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    message: messageText,
    conversation_id: conversationId,
    projet_name: projectName,
  }),
  // signal: controller.signal,
})
  .then(res => {
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return res.json(); // or res.text() if needed
  })
  .then(async(data) => {
    console.log('Message added:', data);
    // success logic
      if (data.success) {
      setLastResponseId(data.response_id);

      if (window.__chat_polling_interval) {
        clearInterval(window.__chat_polling_interval);
        window.__chat_polling_interval = null;
      }

       await pollForResponse(data.response_id, messageText); // Start polling for response
    } else {
      setLocalError("Erreur lors de l'ajout du message");
      setWaitingForResponse(false);
      if (!textToSend) {
        setPrompt(originalPrompt); // Restore user input on failure
      }
    }
  })
  .catch(err => {
   if (err.name === 'AbortError') {
      setLocalError("La requête a été annulée en raison du délai d'attente");
    } else {
      setLocalError("Erreur d'envoi : " + err.message);
    }
    setWaitingForResponse(false);
    setPrompt(originalPrompt); // Restore user input on error
  })
  .finally(() => {
    console.log('Add message request finished');
    setSending(false);
    // cleanup / loader off
  });


  }


  // Envoi message prédéfini
  const sendPredefinedPrompt = async (predefinedPromptText) => {
    if (!predefinedPromptText || !conversationId) return;

    // Replace placeholder with selected file name if available
    let finalPrompt = predefinedPromptText;
    if (selectedFile) {
      finalPrompt = predefinedPromptText.replace('Intensif avant.docx', selectedFile.nom_fichier);
    }

    // show the chosen prompt as a message as soon as user clicks
    setDisplayedMessages(prev => [...prev, { id: Date.now(), prompt: finalPrompt }]);
    setSending(true);
    setLocalError("");
    setWaitingForResponse(true);

    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 360000); // 6-minute timeout

    fetch(`http://localhost/ia/public/api/restitution/addMessageToConversation_ined`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: finalPrompt,
        conversation_id: conversationId,
        projet_name: projectName,
      }),
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(async(data) => {
        console.log('Message added:', data);
        if (data.success) {
          setLastResponseId(data.response_id);

          if (window.__chat_polling_interval) {
            clearInterval(window.__chat_polling_interval);
            window.__chat_polling_interval = null;
          }

          await pollForResponse(data.response_id, finalPrompt);
        } else {
          setLocalError("Erreur lors de l'ajout du message");
          setWaitingForResponse(false);
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') {
          setLocalError("La requête a été annulée en raison du délai d'attente");
        } else {
          setLocalError("Erreur d'envoi : " + err.message);
        }
        setWaitingForResponse(false);
      })
      .finally(() => {
        setSending(false);
      });
  }


  // Polling réponse IA
  const pollForResponse = async (responseId,prompt) => {
  // window.__chat_polling_interval = setInterval(async () => {
    const controller = new AbortController();
    // const timeoutId = setTimeout(() => controller.abort(), 180000); // Timeout après 3 minutes

    try {
      const res = await fetch(`http://localhost/ia/public/api/restitution/getFinalResponseAssistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ response_id: responseId }),
        signal: controller.signal, // Pass the signal to the fetch request
      });

      // clearTimeout(timeoutId); // Clear the timeout if the fetch completes successfully

      if (!res.ok) throw new Error("Polling échoué");

      const data = await res.json();
      console.log("mmmmm first",data)
      if (data.success && data.message) {
        console.log("mmmmm",data.message);

        // prepare streaming: split by lines and add empty message placeholder
        const chunks = String(data.message).split(/\r?\n/);
        const msgId = Date.now();
        setStreamingSegments(chunks);
        setStreamingMessageId(msgId);
        setStreamingIndex(0);
        setDisplayedMessages(prev => [...prev, { id: msgId, content: "" }]);

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
      clearInterval(window.__chat_polling_interval); // Clear polling interval
      window.__chat_polling_interval = null;
    }


  // }, 120000); // Polling every 2 minutes
};


  // effect: gradually append segments to the streaming message
  useEffect(() => {
    if (streamingMessageId !== null && streamingSegments) {
      if (streamingIndex < streamingSegments.length) {
        const timeout = setTimeout(() => {
          setDisplayedMessages(prev => prev.map(m => {
            if (m.id === streamingMessageId) {
              const sep = m.content ? '\n' : '';
              // when the first segment appears, hide the global loader/spinner
              if (!m.content) {
                setWaitingForResponse(false);
              }
              return { ...m, content: m.content + sep + streamingSegments[streamingIndex] };
            }
            return m;
          }));
          setStreamingIndex(i => i + 1);
        }, 250);
        return () => clearTimeout(timeout);
      } else {
        // done streaming
        setStreamingMessageId(null);
        setStreamingSegments(null);
        setWaitingForResponse(false);
      }
    }
  }, [streamingIndex, streamingMessageId, streamingSegments]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleStopGeneration = () => {
    if (window.__chat_polling_interval) {
      clearInterval(window.__chat_polling_interval);
      window.__chat_polling_interval = null;
    }
    // clear any streaming in progress
    setStreamingMessageId(null);
    setStreamingSegments(null);
    setStreamingIndex(0);
    setWaitingForResponse(false);
    setLocalError("Génération arrêtée.");
  };



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
      const hasDoubleNewline = /\n\s*\n/.test(working);

      if (hasDoubleNewline) {
        const parts = working.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
        working = parts.map(p => {
          if (/^<(h[1-6]|ul|ol|pre|div|blockquote)/i.test(p)) return p;
          const withBreaks = p.replace(/\n/g, '<br/>');
          const isVerbatim = !withBreaks.includes('<strong>');
          return `<p class="${isVerbatim ? 'verbatim' : ''}">${withBreaks}</p>`;
        }).join('\n');
      } else {
        const lines = working.split('\n').map(l => l.trim()).filter(Boolean);
        working = lines.map(l => {
          if (/^<(h[1-6]|ul|ol|pre|div|blockquote)/i.test(l)) return l;
          const isVerbatim = !l.includes('<strong>');
          return `<p class="${isVerbatim ? 'verbatim' : ''}">${l}</p>`;
        }).join('\n');
      }

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
          body, .document, .message, .message-content, p, div {
            font-family: 'Aptos', Calibri, Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.15;
            text-align: justify;
            color: #000000;
            margin: 0;
            padding: 0;
          }
          p {
            margin-top: 0;
            margin-bottom: 0;
            line-height: 15pt;
            mso-line-height-rule: exactly;
            text-align: left;
          }
          h2:first-of-type { text-align: center; }
          pre, code { font-family: Consolas, 'Courier New', monospace; font-size: 10pt; margin: 0; padding: 0; }
          .message { page-break-inside: avoid; }
          .message + .message { margin-top: 10pt; }
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

  // Handle file selection (hidden input)
  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    // accept only doc, docx, or pdf
    const allowed = ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf'];
    const hasValidType = allowed.includes(file.type);
    const hasValidExtension = /\.(?:docx?|pdf)$/i.test(file.name);
    // Accept if either type is valid OR extension is valid (allows files without extension if type is detected)
    // Also accept if type is empty and extension is valid (some systems don't set MIME type for PDF)
    if (!hasValidType && !hasValidExtension) {
      setUploadError('Format non supporté — choisissez .doc, .docx ou .pdf');
      return;
    }
    setUploadError("");
    setUploadOpen(true);
    uploadFile(file);
  };

  const uploadFile = (file) => {
    setUploading(true);
    setUploadProgress(0);
    setUploadError("");
    setUploadedInfo(null);

    const url = 'http://localhost/ia/public/api/charger_fichier_openai';
    const form = new FormData();
    form.append('fichier', file);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', url, true);
    // set auth header
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(pct);
      }
    };

    xhr.onload = () => {
      setUploading(false);
      try {
        const res = JSON.parse(xhr.responseText || '{}');
        console?.log("error respo 1",res)
        if(res?.original?.response){
          setUploadError(res?.original?.response);
          return
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          // expected backend response with vector_store_id, file_id, nom_fichier, statut
          setUploadedInfo(res);
          setUploadError("");
          // allow caller to refresh messages or perform follow-up
          if (typeof refreshMessages === 'function') refreshMessages(true);
        } else {
          setUploadError(res.message || 'Erreur upload — code ' + xhr.status);
          console?.log("error xhr",xhr)
          console?.log("error respo",res)
        }
      } catch (err) {
        setUploadError('Réponse invalide du serveur');
        console?.log("error response",err)
      }
      xhrRef.current = null;
    };

    xhr.onerror = () => {
      setUploading(false);
      setUploadError('Erreur réseau lors de l\'upload');
      xhrRef.current = null;
    };

    xhr.onabort = () => {
      setUploading(false);
      setUploadError('Upload annulé');
      xhrRef.current = null;
    };

    xhr.send(form);
  };

  const cancelUpload = () => {
    if (xhrRef.current) xhrRef.current.abort();
    setUploading(false);
    setUploadProgress(0);
    setUploadOpen(false);
  };

  return (
    <div className="chat-window">
      {/* Hamburger button to toggle side panel */}
      <button 
        className="hamburger-toggle-btn"
        onClick={() => setSidePanelOpen(!sidePanelOpen)}
        title="Ouvrir le menu"
        style={{ display: sidePanelOpen ? 'none' : 'flex' }}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* Side panel with action buttons */}
      <div className={`side-actions-panel ${sidePanelOpen ? 'open' : ''}`}>
        <div className="side-panel-header">
          <h3>Actions</h3>
          <button 
            className="side-panel-close"
            onClick={() => setSidePanelOpen(false)}
            title="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="side-panel-content">
          {/* Files button */}
          <button
            className="files-toggle-btn"
            onClick={async () => {
              const willOpen = !filePanelOpen;
              setFilePanelOpen(willOpen);
              if (willOpen && filesList.length === 0 && !filesLoading) {
                setFilesLoading(true);
                setFilesError("");
                try {
                  const query = `{vector_stores(projet_id:${projectId}){id,nom_fichier}}`;
                  const url = `http://localhost/ia/public/graphql?query=${encodeURIComponent(query)}`;
                  const res = await fetch(url, {
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                    },
                  });
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  const json = await res.json();
                  const list = (json && json.data && json.data.vector_stores) ? json.data.vector_stores : [];
                  setFilesList(Array.isArray(list) ? list : []);
                } catch (err) {
                  setFilesError(String(err.message || err));
                } finally {
                  setFilesLoading(false);
                }
              }
            }}
            title="Afficher les fichiers"
          >
            <FaFolderOpen />
            <span>Fichiers</span>
          </button>

          {/* Upload Word or PDF file */}
          <button
            className="upload-btn"
            onClick={() => {
              setUploadError("");
              setUploadedInfo(null);
              if (fileInputRef.current) fileInputRef.current.value = null;
              fileInputRef.current?.click();
            }}
            title="Uploader un fichier Word ou PDF"
            disabled={uploading}
          >
            📁
            <span>Uploader Word/PDF</span>
          </button>

          {/* Download Word / Select mode */}
          {!selectMode ? (
            <button 
              className="select-mode-btn"
              onClick={() => setSelectMode(true)}
              title="Sélectionner des messages"
            >
              <FaCheckSquare />
              <span>Télécharger une réponse</span>
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

          {/* hidden file input used by upload button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".doc,.docx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Overlay when side panel is open */}
      {sidePanelOpen && (
        <div 
          className="side-panel-overlay"
          onClick={() => setSidePanelOpen(false)}
        />
      )}

      {/* Floating file panel (volet) */}
      <div className={`file-panel ${filePanelOpen ? 'open' : ''}`} role="dialog" aria-hidden={!filePanelOpen}>
        <div className="file-panel-header">
          <div className="file-panel-title">Fichiers disponibles</div>
          <button className="file-panel-close" onClick={() => setFilePanelOpen(false)} title="Fermer">✕</button>
        </div>
        <div className="file-panel-body">
          {filesLoading && <div className="files-loader">Chargement...</div>}
          {filesError && <div className="files-error">Erreur : {filesError}</div>}
          {!filesLoading && !filesError && filesList && filesList.length === 0 && (
            <div className="files-empty">Aucun fichier disponible</div>
          )}
          {selectedFile && (
            <div style={{ padding: '12px', marginBottom: '12px', backgroundColor: '#e0e7ff', borderRadius: '8px', borderLeft: '4px solid #6366f1' }}>
              <strong>Fichier sélectionné:</strong> {selectedFile.nom_fichier}
            </div>
          )}
          <ul className="files-list">
            {filesList.map(f => (
              <li 
                className="file-item" 
                key={f.id}
                onClick={() => setSelectedFile(f)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: selectedFile?.id === f.id ? '#dbeafe' : 'transparent',
                  borderLeft: selectedFile?.id === f.id ? '4px solid #3b82f6' : 'none',
                  paddingLeft: selectedFile?.id === f.id ? '12px' : '16px',
                  transition: 'all 0.2s'
                }}
              >
                <div className="file-name">{f.nom_fichier || `#${f.id}`}</div>
                <div className="file-id">ID: {f.id}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="chat-title-bar">
        <h1 className="chat-title-gradient">AGENT IA PROJET {projectName && `- ${projectName}`}</h1>
        {/* <img src="/agent-restitution.gif" alt="Agent de restitution" className="chat-title-gif" /> */}
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
              <div className="user-message styled-user-message">
                <strong style={{ fontSize: '1.1em', color: '#4f46e5' }}>Vous :</strong> 
                <span style={{ fontSize: '1.05em', fontWeight: '600', color: '#030806', marginLeft: '8px', lineHeight: '1.6' }}>
                  {msg.prompt}
                </span>
              </div>
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
                  {isHTMLContent(msg.content) ? (
                    <div dangerouslySetInnerHTML={{ __html: renderSafeHTML(msg.content) }} />
                  ) : (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {waitingForResponse && (
          <div className="ai-message ai-thinking styled-ai-thinking">
            <span className="spinner" />
            <span className="thinking-dots">L'IA réfléchit<span className="dot">.</span><span className="dot">.</span><span className="dot">.</span></span>
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

      {/* Upload modal / progress */}
      {(uploadOpen || uploading || uploadedInfo || uploadError) && (
        <div className="upload-modal">
          <div className="upload-card">
            <h3>Upload de fichier Word ou PDF</h3>
            {uploading && (
              <>
                <div className="upload-progress">
                  <div className="progress-bar" style={{ width: `${uploadProgress}%` }} />
                </div>
                <div className="upload-progress-label">{uploadProgress}%</div>
              </>
            )}
            {uploadedInfo && (
              <div className="upload-success">Fichier chargé : {uploadedInfo.nom_fichier || uploadedInfo.file_id}</div>
            )}
            {uploadError && (
              <div className="upload-error">{uploadError}</div>
            )}
            <div className="upload-actions">
              {uploading ? (
                <button className="cancel-upload-btn" onClick={cancelUpload}>Annuler</button>
              ) : (
                <button className="close-upload-btn" onClick={() => { setUploadOpen(false); setUploadProgress(0); setUploadError(''); setUploadedInfo(null); }}>Fermer</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section prompts prédéfinis */}
      {/* {conversationId && displayedMessages.length === 0 && projectName === 'AGENT-FT' && (
        
        <div className="predefined-prompts-section">
          <h3 className="predefined-prompts-title">Prompts recommandés</h3>
          <div className="predefined-prompts-grid">
            {predefinedPrompts.map((pdPrompt) => (
              <button
                key={pdPrompt.id}
                className="predefined-prompt-card"
                onClick={() => sendPredefinedPrompt(pdPrompt.prompt)}
                disabled={sending || waitingForResponse}
              >
                <span className="prompt-card-text">{pdPrompt.label}</span>
                <span className="prompt-card-arrow">→</span>
              </button>
            ))}
          </div>
        </div>
      )} */}

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
            style={{ paddingRight: waitingForResponse ? '40px' : undefined }}
          />
          <button onClick={sendMessage} disabled={sending || !prompt}>Envoyer</button>
          {waitingForResponse && (
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