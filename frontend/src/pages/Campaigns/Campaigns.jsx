import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { campaignsApi } from '../../services/campaigns.api.js';
import './Campaigns.css';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const campaignsData = await campaignsApi.list();
      setCampaigns(campaignsData.campaigns || []);
    } catch (err) {
      setError(
        err?.response?.data?.message || 'Não foi possível carregar campanhas.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handlePause(id) {
    setActionId(id);
    setError('');
    try {
      await campaignsApi.pause(id);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao pausar campanha.');
    } finally {
      setActionId(null);
    }
  }

  async function handleActivate(id) {
    setActionId(id);
    setError('');
    try {
      await campaignsApi.activate(id);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao ativar campanha.');
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="campaigns-page">
      <header className="campaigns-page__header">
        <div>
          <h1 className="text-h2">Campanhas</h1>
          <p className="text-subtitle campaigns-page__subtitle">
            Crie Lead Ads completas sem abrir o Gerenciador de Anúncios da Meta.
          </p>
        </div>
        <Link className="btn btn-primary" to="/campaigns/new">
          Nova campanha
        </Link>
      </header>

      <section className="card campaigns-page__card">
        <h2 className="campaigns-page__section-title">Minhas campanhas</h2>

        {loading ? <p className="text-body">Carregando...</p> : null}
        {error ? <p className="campaigns-page__error">{error}</p> : null}

        {!loading && campaigns.length === 0 ? (
          <div className="campaigns-page__empty-box">
            <p className="text-body campaigns-page__empty">
              Nenhuma campanha ainda. Monte formulário, público e anúncio em um
              só fluxo.
            </p>
            <Link className="btn btn-primary" to="/campaigns/new">
              Criar primeira campanha
            </Link>
          </div>
        ) : null}

        {!loading && campaigns.length > 0 ? (
          <div className="campaigns-table-wrap">
            <table className="campaigns-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Conta</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>{campaign.name}</td>
                    <td>{campaign.adAccountId}</td>
                    <td>
                      <span className="campaigns-status">{campaign.status}</span>
                      {campaign.objective ? (
                        <span className="campaigns-objective">
                          {' '}
                          · {campaign.objective}
                        </span>
                      ) : null}
                    </td>
                    <td className="campaigns-actions">
                      <Link
                        className="btn btn-secondary"
                        to={`/campaigns/${campaign.id}/automation`}
                      >
                        Automação
                      </Link>
                      {campaign.status !== 'PAUSED' ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={actionId === campaign.id}
                          onClick={() => handlePause(campaign.id)}
                        >
                          Pausar
                        </button>
                      ) : null}
                      {campaign.status !== 'ACTIVE' ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={actionId === campaign.id}
                          onClick={() => handleActivate(campaign.id)}
                        >
                          Ativar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
