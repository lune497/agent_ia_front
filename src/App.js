// src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import Login from './pages/Login';
import './App.css';

function App() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [newConversationId, setNewConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const projectName = localStorage.getItem('projectName');
  const projectId = localStorage.getItem('projectId');
  // build a GraphQL filter for the current user (if available)
  const userFilter = userId ? `(user_id:${userId}` : '';
  const projectFilter = projectId ? `,projet_id:${projectId})` : '';

  useEffect(() => {
    if (!token) {
      navigate('/login');
    } else {
      fetchConversations();
    }
  }, [token, navigate]);

  const fetchConversations = async () => {
    try {
      const res = await fetch(`https://lvdc-group.com/ia/public/graphql?query={conversation_ineds${userFilter}${projectFilter}{id,conversation_id}}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      console.log('Fetched Conversations:', data);
      setConversations(data.data.conversation_ineds);
    } catch (err) {
      setError("Erreur lors du chargement des conversations : " + err.message);
    }
  };

  const handleConversationSelect = async (numericId, stringId, showLoader = true) => {
    setSelectedConversation(stringId);
    setSelectedConversationId(numericId);
    if (showLoader) setLoading(true);
    setMessages([]);
    try {
      const res = await fetch(`https://lvdc-group.com/ia/public/graphql?query={message_ineds(conversation_ined_id:${numericId}){id,prompt,message_ined_id,content,role}}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      setMessages(data.data.message_ineds);
    } catch (err) {
      setError("Erreur lors du chargement des messages : " + err.message);
    }
    if (showLoader) setLoading(false);
  };

  const handleNewConversation = async () => {
    setMessages([]);
    setSelectedConversation(null);
    setSelectedConversationId(null);
    setLoading(true);
    try {
      const res = await fetch('https://lvdc-group.com/ia/public/api/restitution/createConversation_ined', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({projet_name: projectName})
      });
      
      const data = await res.json();
      if (data.success) {
        

        const convRes = await fetch(`https://lvdc-group.com/ia/public/graphql?query={conversation_ineds${userFilter}${projectFilter}{id,conversation_id}}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        const convData = await convRes.json();
        const newConversations = convData.data.conversation_ineds;
        setSelectedConversation(data.conversation_id);
        // setNewConversationId(data.conversation_id)
        setConversations(newConversations);
        const newConv = newConversations.find(c => c.conversation_id === data.conversation_id);
        if (newConv) {
          
          setSelectedConversationId(newConv.id);
         
        }
      } else {
        setError("Impossible de créer une nouvelle conversation");
      }
    } catch (err) {
      setError("Erreur lors de la création de la conversation : " + err.message);
    }
    setLoading(false);
  };

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <div className="App">
            <Sidebar
              conversations={conversations}
              onConversationSelect={(id, conv_id) => handleConversationSelect(id, conv_id)}
              onNewConversation={handleNewConversation}
              selectedConversation={selectedConversation}
            />
            {!loading && <ChatWindow
              conversationId={selectedConversation}
              conversationIdInt={selectedConversationId}
              // newConversationId={newConversationId}
              messages={messages}
              loading={loading}
              error={error}
              refreshMessages={() => handleConversationSelect(selectedConversationId, selectedConversation)}
            />}
          </div>
        }
      />
    </Routes>
  );
}

export default App;
