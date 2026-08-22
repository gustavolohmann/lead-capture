import { useEffect } from 'react';
import './CreateCampaignModal.css';

export const CAMPAIGN_OBJECTIVES = [
  {
    id: 'leads',
    path: '/campaigns/new/leads',
    title: 'Capturar leads',
    description: 'Anúncios com formulário para receber dados de contato.',
    icon: '👥',
    badge: 'Recomendado',
  },
  {
    id: 'messages',
    path: '/campaigns/new/messages',
    title: 'Receber mensagens',
    description: 'Anúncios que abrem conversa no WhatsApp ou Instagram.',
    icon: '💬',
  },
  {
    id: 'traffic',
    path: '/campaigns/new/traffic',
    title: 'Levar ao site',
    description: 'Anúncios que direcionam para uma URL.',
    icon: '🌐',
  },
];

export default function CreateCampaignModal({ open, onClose, onSelect }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ui-modal create-campaign-modal" role="presentation">
      <button
        type="button"
        className="ui-modal__backdrop create-campaign-modal__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        className="ui-modal__panel create-campaign-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-campaign-modal-title"
      >
        <header className="create-campaign-modal__header">
          <div>
            <h2 id="create-campaign-modal-title">Nova campanha</h2>
            <p>Escolha o objetivo.</p>
          </div>
          <button
            type="button"
            className="create-campaign-modal__close"
            aria-label="Fechar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="create-campaign-modal__grid">
          {CAMPAIGN_OBJECTIVES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="create-campaign-objective"
              onClick={() => onSelect?.(item)}
            >
              <span className="create-campaign-objective__icon" aria-hidden>
                {item.icon}
              </span>
              <span className="create-campaign-objective__title">
                {item.title}
              </span>
              <span className="create-campaign-objective__desc">
                {item.description}
              </span>
              {item.badge ? (
                <span className="create-campaign-objective__badge">
                  {item.badge}
                </span>
              ) : null}
              <span className="create-campaign-objective__arrow" aria-hidden>
                →
              </span>
            </button>
          ))}
        </div>

        <footer className="create-campaign-modal__footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
        </footer>
      </div>
    </div>
  );
}
