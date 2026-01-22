import React, { useState, useRef, useEffect } from 'react';
import './PromptSelector.css';

const PromptSelector = ({ isOpen, onClose, onPromptSelect, hasActiveConversation, token, projectName }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [filesList, setFilesList] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [uploadedInfo, setUploadedInfo] = useState(null);
  const fileInputRef = useRef(null);
  const xhrRef = useRef(null);

  // Prompts prédéfinis
  const predefinedPrompts = [
    {
      id: 1,
      label: "VÉRIFICATION DES QUESTIONS",
      prompt: "Voici mon questionnaire en état brute Intensif avant.docx merci de me traiter cette partie VÉRIFICATION DES QUESTIONS"
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
  ];

  // Load files from API when modal opens
  useEffect(() => {
    if (isOpen && filesList.length === 0 && !filesLoading && !filesError) {
      loadFiles();
    }
  }, [isOpen]);

  const loadFiles = async () => {
    setFilesLoading(true);
    setFilesError("");
    try {
      const query = '{vector_stores(projet_id:8){id,nom_fichier}}';
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
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowed = ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowed.includes(file.type) && !/\.docx?$/.test(file.name)) {
        setUploadError('Format non supporté — choisissez .doc ou .docx');
        return;
      }
      setUploadError("");
      uploadFile(file);
    }
  };

  const uploadFile = (file) => {
    setUploading(true);
    setUploadProgress(0);
    setUploadError("");
    setUploadedInfo(null);

    const url = 'http://localhost/ia/public/api/agent_ft/charger_fichier_openai';
    const form = new FormData();
    form.append('fichier', file);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', url, true);
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
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadedInfo({
            nom_fichier: file.name,
            file_id: res.id || res.file_id
          });
          // Reload the file list after successful upload
          setTimeout(() => {
            loadFiles();
            // Auto-select the newly uploaded file
            if (res.id || res.file_id) {
              const newFile = {
                id: res.id || res.file_id,
                nom_fichier: file.name
              };
              setSelectedFile(newFile);
            }
          }, 500);
        } else {
          setUploadError(res.message || 'Erreur lors de l\'upload');
        }
      } catch (err) {
        setUploadError('Réponse invalide du serveur');
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
    setUploadError("");
    setUploadedInfo(null);
  };

  const handleFileListSelect = (file) => {
    setSelectedFile(file);
  };

  const handlePromptClick = (promptTemplate) => {
    let finalPrompt = promptTemplate;
    if (selectedFile) {
      // Determine the filename to use
      const fileName = selectedFile.nom_fichier || selectedFile.name;
      finalPrompt = promptTemplate.replace('Intensif avant.docx', fileName);
    }
    onPromptSelect(finalPrompt);
    setSelectedFile(null);
    setFilesList([]);
    setFilesError("");
    onClose();
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="prompt-selector-overlay" onClick={onClose}></div>

      {/* Modal */}
      <div className="prompt-selector-modal">
        <div className="prompt-selector-header">
          <h2>Prompts Recommandés</h2>
          <button className="close-prompt-btn" onClick={onClose}>✕</button>
        </div>

        {/* Files List Section */}
        <div className="files-list-section">
          <h3 className="files-list-title">Sélectionner un fichier</h3>
          {filesLoading && <div className="files-loader">Chargement des fichiers...</div>}
          {filesError && <div className="files-error">Erreur : {filesError}</div>}
          {!filesLoading && !filesError && filesList.length === 0 && (
            <div className="files-empty">Aucun fichier disponible</div>
          )}
          {selectedFile && (
            <div className="file-selected-info">
              <strong>📄 Fichier sélectionné:</strong> {selectedFile.nom_fichier || selectedFile.name}
            </div>
          )}
          <ul className="files-list-modal">
            {filesList.map(f => (
              <li 
                className={`file-list-item ${selectedFile?.id === f.id ? 'selected' : ''}`}
                key={f.id}
                onClick={() => handleFileListSelect(f)}
              >
                <input 
                  type="radio"
                  checked={selectedFile?.id === f.id}
                  onChange={() => handleFileListSelect(f)}
                  style={{ marginRight: '8px' }}
                />
                <span className="file-list-name">{f.nom_fichier || `Fichier #${f.id}`}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Or Upload File Section */}
        <div className="file-upload-section">
          <span className="or-divider">OU</span>
          <button 
            className="select-file-btn"
            onClick={triggerFileInput}
          >
            📤 Importer un fichier
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".docx,.doc,.pdf,.txt"
            style={{ display: 'none' }}
          />
          {selectedFile?.name && !selectedFile?.id && (
            <span className="file-selected-badge">✓ Fichier importé: {selectedFile.name}</span>
          )}
        </div>

        {/* Prompts Grid - Only show if projectName is 'AGENT-FT' */}
        {projectName === 'AGENT-FT' ? (
          <>
            <div className="prompts-grid">
              {predefinedPrompts.map((prompt) => (
                <button
                  key={prompt.id}
                  className="prompt-card"
                  onClick={() => handlePromptClick(prompt.prompt)}
                  disabled={!selectedFile || !hasActiveConversation}
                  title={!selectedFile ? "Veuillez sélectionner un fichier d'abord" : !hasActiveConversation ? "Veuillez sélectionner une conversation d'abord" : ""}
                >
                  <span className="prompt-label">{prompt.label}</span>
                  <span className="prompt-arrow">→</span>
                </button>
              ))}
            </div>
            {!selectedFile && (
              <div className="no-file-message">
                ⚠️ Veuillez sélectionner un fichier pour utiliser les prompts.
              </div>
            )}
            {!hasActiveConversation && selectedFile && (
              <div className="no-conversation-message">
                ⚠️ Veuillez sélectionner ou créer une conversation avant d'utiliser un prompt.
              </div>
            )}
          </>
        ) : (
          <div className="invalid-project-message">
            ℹ️ Les prompts recommandés ne sont disponibles que pour le projet AGENT-FT.
          </div>
        )}

        {/* Upload modal / progress */}
        {(uploading || uploadedInfo || uploadError) && (
          <div className="upload-modal-overlay">
            <div className="upload-card">
              <h3>Upload de fichier Word</h3>
              {uploading && (
                <>
                  <div className="upload-progress">
                    <div className="progress-bar" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <div className="upload-progress-label">{uploadProgress}%</div>
                </>
              )}
              {uploadedInfo && (
                <div className="upload-success">✓ Fichier chargé : {uploadedInfo.nom_fichier}</div>
              )}
              {uploadError && (
                <div className="upload-error">✕ {uploadError}</div>
              )}
              <div className="upload-actions">
                {uploading ? (
                  <button className="cancel-upload-btn" onClick={cancelUpload}>Annuler</button>
                ) : (
                  <button className="close-upload-btn" onClick={() => {
                    setUploadProgress(0);
                    setUploadError("");
                    setUploadedInfo(null);
                  }}>Fermer</button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PromptSelector;
