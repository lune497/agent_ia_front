// src/components/Sidebar.js
import React, { useEffect, useState } from 'react';
import './Sidebar.css';
import { FaHeadset } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import PromptSelector from './PromptSelector';

const Sidebar = ({ conversations, onConversationSelect, onNewConversation, selectedConversation, onPromptSubmit }) => {
  const navigate = useNavigate();
  const [promptSelectorOpen, setPromptSelectorOpen] = useState(false);
  const token = localStorage.getItem('token');
  const projectName = localStorage.getItem('projectName') || '';

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handlePromptSelect = (promptText) => {
    if (onPromptSubmit) {
      onPromptSubmit(promptText);
    }
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
        <button 
          onClick={() => setPromptSelectorOpen(true)} 
          className="prompts-btn"
        >
          💡 Prompts
        </button>
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
      <PromptSelector 
        isOpen={promptSelectorOpen}
        onClose={() => setPromptSelectorOpen(false)}
        onPromptSelect={handlePromptSelect}
        hasActiveConversation={!!selectedConversation}
        token={token}
        projectName={projectName}
      />
    </div>
  );
};

export default Sidebar;
