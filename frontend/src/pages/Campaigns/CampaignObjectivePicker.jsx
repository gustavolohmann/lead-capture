import { useNavigate } from 'react-router-dom';
import './CampaignObjectivePicker.css';

const OBJECTIVES = [
  {
    id: 'leads',
    path: '/campaigns/new/leads',
    title: 'Capturar Leads',
    subtitle: 'Lead Ads',
    description:
      'Anúncio com formulário na Meta. Ideal para imobiliárias, clínicas, seguros e consultorias.',
  },
  {
    id: 'messages',
    path: '/campaigns/new/messages',
    title: 'Receber mensagens',
    subtitle: 'WhatsApp / Instagram Direct',
    description:
      'Anúncio que abre conversa no WhatsApp ou Instagram. Bom para atendimento rápido.',
  },
  {
    id: 'traffic',
    path: '/campaigns/new/traffic',
    title: 'Gerar tráfego',
    subtitle: 'Website',
    description:
      'Leva o público para o seu site ou landing page. Foque em cliques e visitas.',
  },
];

export default function CampaignObjectivePicker() {
  const navigate = useNavigate();

  return (
    <div className="objective-page">
      <header className="objective-page__header">
        <div>
          <h1 className="text-h2">Nova campanha</h1>
          <p className="text-subtitle objective-page__subtitle">
            Escolha o objetivo. O restante do fluxo fica no seu painel — sem
            Gerenciador de Anúncios.
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

      <div className="objective-grid" role="radiogroup" aria-label="Objetivo da campanha">
        {OBJECTIVES.map((item) => (
          <button
            key={item.id}
            type="button"
            className="objective-card"
            onClick={() => navigate(item.path)}
          >
            <span className="objective-card__radio" aria-hidden="true" />
            <span className="objective-card__title">{item.title}</span>
            <span className="objective-card__subtitle">{item.subtitle}</span>
            <span className="objective-card__desc">{item.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
