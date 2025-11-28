import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHeadset } from 'react-icons/fa'; // Import headset icon
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [projetId, setProjetId] = useState('');
  const [projets, setProjets] = useState([]);
  const [error, setError] = useState('');
  const [loadingProjets, setLoadingProjets] = useState(true);
  const navigate = useNavigate();

  // Récupérer les projets via GraphQL au chargement du composant
  useEffect(() => {
    const fetchProjets = async () => {
      try {
        const query = encodeURIComponent('{projets{id,nom_projet}}');
        const res = await fetch(`http://localhost/ia/public/graphql?query=${query}`);
        const data = await res.json();
        if (data.data && data.data.projets) {
          setProjets(data.data.projets);
          // Garder projetId vide pour que "Sélectionner un projet" soit par défaut
          setProjetId('');
        }
      } catch (err) {
        console.error('Erreur lors de la récupération des projets:', err);
        setError('Impossible de charger les projets');
      } finally {
        setLoadingProjets(false);
      }
    };
    fetchProjets();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (!projetId) {
        setError('Veuillez sélectionner un projet');
        return;
      }
      const res = await fetch('http://localhost/ia/public/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, projet_id: projetId }),
      });
      const data = await res.json();
      if (data.token && data.user && data.user.id && data.user.name) {
        localStorage.setItem('token', data.token); // Save token to localStorage
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('userName', data.user.name);
        if (data.projet_name) {
          localStorage.setItem('projectName', data.projet_name);
          localStorage.setItem('projectId', data.projet_id);
        }
        navigate('/'); // Redirect to the main app
      } else if (data.token) {
        // fallback si l'API ne retourne pas user
        localStorage.setItem('token', data.token);
        if (data.projet_name) {
          localStorage.setItem('projectName', data.projet_name);
          localStorage.setItem('projectId', data.projet_id);
        }
        navigate('/');
      } else {
        // Récupérer le message d'erreur dynamique du backend
        setError(data.message || 'Erreur lors de la connexion');
      }
    } catch (err) {
      setError('Une erreur s\'est produite. Veuillez réessayer.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <FaHeadset className="login-icon" />
        <h1>Assistant IA LVDC</h1>
      </div>
      <form onSubmit={handleLogin} className="login-form">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <select
          value={projetId}
          onChange={(e) => setProjetId(e.target.value)}
          required
          disabled={loadingProjets}
        >
          <option value="">
            {loadingProjets ? 'Chargement des projets...' : 'Sélectionner un projet'}
          </option>
          {projets.map((projet) => (
            <option key={projet.id} value={projet.id}>
              {projet.nom_projet}
            </option>
          ))}
        </select>
        <button type="submit">Login</button>
      </form>
      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default Login;