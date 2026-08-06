import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { campaignsApi } from '../../services/campaigns.api.js';
import { campaignAutomationsApi } from '../../services/campaignAutomations.api.js';
import { FlowBuilder } from './FlowBuilder.jsx';
import './Automation.css';

const EMPTY_STEPS = [
  {
    type: 'SEND_WHATSAPP',
    config: { message: 'Olá {{name}}, recebemos seu interesse.' },
  },
  { type: 'WAIT', config: { minutes: 30 } },
  {
    type: 'SEND_WHATSAPP',
    config: { message: 'Ainda está interessado, {{name}}?' },
  },
];

export default function CampaignAutomation() {
  const { campaignId } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [automation, setAutomation] = useState(null);
  const [name, setName] = useState('Follow-up da campanha');
  const [steps, setSteps] = useState(EMPTY_STEPS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const campaignsData = await campaignsApi.list();
        const found = (campaignsData.campaigns || []).find(
          (c) => String(c.id) === String(campaignId)
        );
        setCampaign(found || null);

        const autos = await campaignAutomationsApi.list(campaignId);
        const current = autos.automations?.[0] || null;
        setAutomation(current);
        if (current) {
          setName(current.name || 'Follow-up da campanha');
          setSteps(
            (current.steps || []).map((s) => ({
              type: s.type,
              config: s.config || {},
            }))
          );
        }
      } catch (err) {
        setError(
          err?.response?.data?.message || 'Falha ao carregar automação.'
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [campaignId]);

  async function handleSave() {
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const payload = { name: name.trim(), steps, active: true };
      let result;
      if (automation?.id) {
        result = await campaignAutomationsApi.update(automation.id, payload);
      } else {
        result = await campaignAutomationsApi.create(campaignId, payload);
      }
      setAutomation(result.automation);
      setInfo('Fluxo salvo.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao salvar fluxo.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!automation?.id) {
      setError('Salve o fluxo antes de testar.');
      return;
    }
    setTesting(true);
    setError('');
    setInfo('');
    try {
      const result = await campaignAutomationsApi.test(automation.id);
      setInfo(
        `Teste executado. Lead #${result.lead?.id} · status ${result.execution?.status}`
      );
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha no teste.');
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flow-page">
        <p className="text-body">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flow-page">
      <header className="flow-page__header">
        <div>
          <p className="flow-page__breadcrumb">Campanhas / Automação</p>
          <h1 className="flow-page__title">Fluxo de Follow-up</h1>
          <p className="flow-page__subtitle">
            Monte o fluxo de follow-up desta campanha (WhatsApp, espera,
            condições…).
            {campaign?.name ? (
              <>
                {' '}
                Campanha: <strong>{campaign.name}</strong>
              </>
            ) : null}
          </p>
        </div>
        <Link className="flow-page__back" to="/campaigns">
          Voltar
        </Link>
      </header>

      <section className="flow-page__canvas">
        <label className="flow-field flow-field--name">
          <span className="flow-field__label flow-field__label--md">
            Nome da automação
          </span>
          <input
            className="flow-field__control flow-field__control--lg"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <FlowBuilder steps={steps} onChange={setSteps} />

        {error ? <p className="flow-page__error">{error}</p> : null}
        {info ? <p className="flow-page__info">{info}</p> : null}
      </section>

      <div className="flow-sticky-bar">
        <div className="flow-sticky-bar__inner">
          <button
            type="button"
            className="flow-sticky-bar__primary"
            disabled={saving || steps.length === 0}
            onClick={handleSave}
          >
            {saving ? 'Salvando...' : 'Salvar fluxo'}
          </button>
          <button
            type="button"
            className="flow-sticky-bar__secondary"
            disabled={testing || !automation?.id}
            onClick={handleTest}
          >
            {testing ? 'Testando...' : 'Executar teste'}
          </button>
        </div>
      </div>
    </div>
  );
}
