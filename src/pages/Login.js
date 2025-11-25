import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHeadset } from 'react-icons/fa'; // Import headset icon
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('https://lvdc-group.com/ia/public/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.token && data.user && data.user.id && data.user.name) {
        localStorage.setItem('token', data.token); // Save token to localStorage
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('userName', data.user.name);
        navigate('/'); // Redirect to the main app
      } else if (data.token) {
        // fallback si l'API ne retourne pas user
        localStorage.setItem('token', data.token);
        navigate('/');
      } else {
        setError('Invalid email or password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
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
        <button type="submit">Login</button>
      </form>
      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default Login;