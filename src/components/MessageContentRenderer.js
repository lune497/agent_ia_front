import React from 'react';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';

/**
 * Détecte si le contenu contient du HTML (simple heuristique)
 */
const isHTMLContent = (text) => {
  if (!text) return false;
  return /<\/?[a-z][\s\S]*>/i.test(text);
};

/**
 * Composant pour rendre le contenu d'un message
 * - Si c'est du HTML : affiche via iframe sandbox + DOMPurify
 * - Si c'est du Markdown : affiche via ReactMarkdown
 */
const MessageContentRenderer = ({ content }) => {
  if (!content) return null;

  // Déterminer le type de contenu
  const isHTML = isHTMLContent(content);

  if (isHTML) {
    // Nettoyer le HTML avec DOMPurify
    const cleanHTML = DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img',
        'div', 'span', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
        'form', 'input', 'button', 'label', 'select', 'option', 'textarea'
      ],
      ALLOWED_ATTR: ['class', 'style', 'id', 'href', 'target', 'src', 'alt', 'width', 'height', 'type', 'name', 'value'],
      FORCE_BODY: true,
      RETURN_DOM: false
    });

    // Construire le document complet avec styles de base
    const fullHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #333;
            padding: 12px;
            background-color: #fff;
          }
          h1, h2, h3, h4, h5, h6 {
            margin-top: 16px;
            margin-bottom: 8px;
            font-weight: 600;
          }
          h1 { font-size: 24px; }
          h2 { font-size: 20px; }
          h3 { font-size: 18px; }
          h4 { font-size: 16px; }
          h5 { font-size: 14px; }
          h6 { font-size: 12px; }
          p {
            margin-bottom: 8px;
          }
          ul, ol {
            margin-left: 24px;
            margin-bottom: 8px;
          }
          li {
            margin-bottom: 4px;
          }
          code {
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            background-color: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 13px;
          }
          pre {
            background-color: #f5f5f5;
            padding: 12px;
            border-radius: 4px;
            overflow-x: auto;
            margin-bottom: 8px;
            border-left: 3px solid #06b6d4;
          }
          pre code {
            background-color: transparent;
            padding: 0;
            border-radius: 0;
          }
          blockquote {
            border-left: 4px solid #06b6d4;
            padding-left: 12px;
            margin-left: 0;
            margin-bottom: 8px;
            color: #666;
            font-style: italic;
          }
          a {
            color: #06b6d4;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 8px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f5f5f5;
            font-weight: 600;
          }
          img {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        ${cleanHTML}
      </body>
      </html>
    `;

    return (
      <iframe
        className="html-preview-iframe"
        srcDoc={fullHTML}
        style={{
          width: '100%',
          border: 'none',
          borderRadius: '4px',
          backgroundColor: '#fff',
          marginTop: '8px'
        }}
        title="HTML Preview"
        sandbox="allow-same-origin"
      />
    );
  }

  // Sinon, rendre le markdown
  return <ReactMarkdown>{content}</ReactMarkdown>;
};

export default MessageContentRenderer;
