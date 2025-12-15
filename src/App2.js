import React, { useState } from 'react';
import './App.css';

function App() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePromptChange = (e) => setPrompt(e.target.value);

  // Fonction de polling
  const pollForResponse = () => {
    const intervalId = setInterval(async () => {
      try {
        const res = await fetch('https://lvdc-group.com/ia/public/api/test/getFinalResponse');
        // const res = await fetch('http://51.38.230.58/script/public/test/getFinalResponse');
        if (!res.ok) throw new Error('Erreur API polling');

        const data = await res.json();

        if (data.success && data.response) {
          setResponse(data.response);
          setLoading(false);
          clearInterval(intervalId);
        }
      } catch (err) {
        setResponse("Erreur lors du polling : " + err.message);
        setLoading(false);
        clearInterval(intervalId);
      }
    }, 3000); // toutes les 3 secondes
  };

  const handleSend = async () => {
    setLoading(true);
    setResponse("");
    try {
      // Étape 1 : lancer le traitement
      // const res = await fetch('http://51.38.230.58/script/public/test/startProcess', {
      const res = await fetch('https://ljl6uqandh.sharedwithexpose.com/api/test/startProcess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: prompt }),
      });

      if (!res.ok) throw new Error('Erreur API au lancement');

      const data = await res.json();

      // Afficher message de traitement en cours
      setResponse(data.message || "Traitement en cours...");  

      // Étape 2 : démarrer le polling pour récupérer la réponse finale
      pollForResponse();

    } catch (err) {
      setResponse("Erreur lors de la requête : " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1 className="main-title">Assistant IA</h1>
        <h2 className="subtitle">
          <span className="icon-headset">
            <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 512 512" fill="#fff">
              <path d="M256 32C114.6 32 0 146.6 0 288v80c0 26.5 21.5 48 48 48h40c13.3 0 24-10.7 24-24V304c0-13.3-10.7-24-24-24H48c-8.8 0-16-7.2-16-16v-8c0-114.9 93.1-208 208-208s208 93.1 208 208v8c0 8.8-7.2 16-16 16h-40c-13.3 0-24 10.7-24 24v88c0 13.3 10.7 24 24 24h40c26.5 0 48-21.5 48-48v-80C512 146.6 397.4 32 256 32z"/>
            </svg>
          </span>
          LVDC
        </h2>
        <div className="prompt-container">
          <textarea
            className="prompt-input"
            placeholder="Écrivez votre prompt..."
            value={prompt}
            onChange={handlePromptChange}
            rows={4}
            style={{ resize: "vertical" }}
          />
          <button className="send-btn" onClick={handleSend} disabled={loading || !prompt}>
            {loading ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>
        <div className="response-container">
          {loading && <div className="loader"></div>}
          {response && <div className="response-bubble">{response}</div>}
        </div>
      </header>
    </div>
  );
}

export default App;
// ...existing code...