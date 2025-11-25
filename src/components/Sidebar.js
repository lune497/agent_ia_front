// src/components/Sidebar.js
import React,{useEffect} from 'react';
import './Sidebar.css';
import { FaHeadset } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const Sidebar = ({ conversations, onConversationSelect, onNewConversation, selectedConversation }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

   useEffect(() => {
     console.log('Selected Conversation ID:', conversations);
    });

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <button onClick={onNewConversation} className="new-chat-btn">Nouvelle Conversation +</button>
        <h2>
          <FaHeadset /> Assistant IA
        </h2>
        <p className="lvdc-text">LVDC</p>
      </div>
      <div className="thread-list">
        {conversations && conversations.length > 0 ? (
          conversations.map(conv => (
            <div
              key={conv.conversation_id}
              className={`thread-item ${selectedConversation === conv.conversation_id ? 'active' : ''}`}
              onClick={() => onConversationSelect(conv.id, conv.conversation_id)}
            >
              Conversation #{conv.id}
            </div>
          ))
        ) : (
          <div className="no-conversations">Aucune conversation</div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
