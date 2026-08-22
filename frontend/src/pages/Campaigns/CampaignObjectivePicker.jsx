import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DraftResumeBanner from './DraftResumeBanner.jsx';
import './CampaignObjectivePicker.css';

const OBJECTIVES = [
  {
    id: 'leads',
    path: '/campaigns/new/leads',
    title: 'Capturar leads',
    description: 'Encontre pessoas interessadas no seu negócio.',
    icon: '👥',
  },
  {
    id: 'messages',
    path: '/campaigns/new/messages',
    title: 'Receber mensagens',
    description: 'Converse pelo WhatsApp ou Instagram.',
    icon: '💬',
  },
  {
    id: 'traffic',
    path: '/campaigns/new/traffic',
    title: 'Levar para meu site',
    description: 'Aumente as visitas ao seu site.',
    icon: '🌐',
  },
];

export default function CampaignObjectivePicker() {
  const navigate = useNavigate();
  const [bannerKey, setBannerKey] = useState(0);

  return (
    <div className="objective-page">
      <header className="objective-page__header">
        <div>
          <h1 className="text-h2">Nova campanha</h1>
          <p className="text-subtitle objective-page__subtitle">
            O que você quer conseguir?
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate('/campaigns')}
        >
          Voltar
        </button>
      </header>

      <DraftResumeBanner
        key={bannerKey}
        onContinue={() => navigate('/campaigns/new/leads')}
        onDiscard={() => setBannerKey((k) => k + 1)}
      />

      <div className="objective-grid" aria-label="Objetivo da campanha">
        {OBJECTIVES.map((item) => (
          <button
            key={item.id}
            type="button"
            className="objective-card"
            onClick={() => navigate(item.path)}
          >
            <span className="objective-card__icon" aria-hidden>
              {item.icon}
            </span>
            <span className="objective-card__title">{item.title}</span>
            <span className="objective-card__desc">{item.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
