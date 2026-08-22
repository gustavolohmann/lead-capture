import { useEffect, useMemo, useState } from 'react';
import { leadsApi } from '../../services/leads.api.js';
import './Leads.css';

const STATUS_FILTERS = [
  { id: 'ALL', label: 'Todos' },
  { id: 'NEW', label: 'Novos' },
  { id: 'QUALIFIED', label: 'Qualificados' },
];

const STATUS_META = {
  NEW: { label: 'Novo', tone: 'new' },
  CONTACTED: { label: 'Contatado', tone: 'contacted' },
  QUALIFIED: { label: 'Qualificado', tone: 'qualified' },
  CONVERTED: { label: 'Convertido', tone: 'converted' },
  LOST: { label: 'Perdido', tone: 'lost' },
};

function statusMeta(status) {
  const key = String(status || '').toUpperCase();
  return STATUS_META[key] || { label: status || '—', tone: 'new' };
}

function initialsFromName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatRelativeDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startToday - startDate) / 86400000);
  const time = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (diffDays === 0) return `Hoje, ${time}`;
  if (diffDays === 1) return `Ontem, ${time}`;
  if (diffDays < 7) return `Há ${diffDays} dias`;
  return date.toLocaleDateString('pt-BR', { dateStyle: 'short' });
}

function platformLabel(platform, source) {
  if (source === 'FORM') return 'Formulário';
  const p = String(platform || '').toLowerCase();
  if (p === 'ig' || p === 'instagram') return 'Instagram';
  if (p === 'fb' || p === 'facebook') return 'Facebook';
  if (p === 'an' || p === 'audience_network') return 'Audience Network';
  if (platform) return String(platform);
  return 'Meta Ads';
}

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await leadsApi.list();
        if (!active) return;
        const next = data.leads || [];
        setLeads(next);
        setSelectedId(next[0]?.id ?? null);
      } catch (err) {
        if (active) {
          setError(
            err?.response?.data?.message || 'Não foi possível carregar os leads.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const visibleLeads = useMemo(() => {
    if (statusFilter === 'ALL') return leads;
    return leads.filter(
      (lead) => String(lead.status || '').toUpperCase() === statusFilter
    );
  }, [leads, statusFilter]);

  const selected = useMemo(
    () =>
      visibleLeads.find((l) => l.id === selectedId) ||
      leads.find((l) => l.id === selectedId) ||
      null,
    [visibleLeads, leads, selectedId]
  );

  useEffect(() => {
    if (!selectedId && visibleLeads[0]) {
      setSelectedId(visibleLeads[0].id);
      return;
    }
    if (
      selectedId &&
      visibleLeads.length > 0 &&
      !visibleLeads.some((l) => l.id === selectedId)
    ) {
      setSelectedId(visibleLeads[0].id);
    }
  }, [visibleLeads, selectedId]);

  const tracking = selected?.tracking || {};
  const answers = selected?.answers || [];
  const selectedStatus = statusMeta(selected?.status);

  return (
    <div className="leads-page">
      <div className="leads-page__inner">
        <header className="page-header leads-page__header">
          <div className="page-header__copy">
            <h1 className="page-header__title">Leads</h1>
            <p className="page-header__subtitle">
              Acompanhe origem, status e respostas de cada lead.
            </p>
          </div>
        </header>

        {loading ? <p className="text-body">Carregando leads...</p> : null}
        {error ? <p className="leads-page__error">{error}</p> : null}

        {!loading && !error && leads.length === 0 ? (
          <section className="card leads-page__empty-card">
            <p className="text-body leads-page__empty">
              Nenhum lead recebido ainda. Publique um formulário Lead Ads na Meta
              para começar a capturar contatos.
            </p>
          </section>
        ) : null}

        {!loading && leads.length > 0 ? (
          <div className="leads-layout">
            <section className="card leads-list-card">
              <div className="leads-list-card__head">
                <div className="leads-list-card__title-row">
                  <h2 className="leads-list-card__title">Leads Recentes</h2>
                  <span className="leads-list-card__count">
                    {statusFilter === 'ALL'
                      ? `${leads.length} total`
                      : `${visibleLeads.length} de ${leads.length}`}
                  </span>
                </div>

                <div className="leads-tabs" role="tablist" aria-label="Filtrar status">
                  {STATUS_FILTERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={statusFilter === item.id}
                      className={`leads-tabs__btn${statusFilter === item.id ? ' is-active' : ''}`}
                      onClick={() => setStatusFilter(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <ul className="leads-list">
                {visibleLeads.map((lead) => {
                  const active = lead.id === selectedId;
                  const meta = statusMeta(lead.status);
                  const campaign =
                    lead.tracking?.campaignName ||
                    lead.tracking?.formName ||
                    lead.origin ||
                    'Sem origem';

                  return (
                    <li key={lead.id}>
                      <button
                        type="button"
                        className={`leads-list__item${active ? ' is-selected' : ''}`}
                        onClick={() => setSelectedId(lead.id)}
                      >
                        <div className="leads-list__main">
                          <span className="leads-list__name">
                            {lead.name || 'Lead sem nome'}
                          </span>
                          <span className="leads-list__campaign">
                            Campanha: {campaign}
                          </span>
                          <span className="leads-list__time">
                            {formatRelativeDate(lead.createdAt)}
                          </span>
                        </div>
                        <span className={`leads-status leads-status--${meta.tone}`}>
                          {meta.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {visibleLeads.length === 0 ? (
                <p className="leads-page__empty leads-list__empty">
                  Nenhum lead neste filtro. Troque o filtro ou aguarde novos
                  leads.
                </p>
              ) : null}
            </section>

            <section className="card leads-detail-card">
              {!selected ? (
                <p className="text-body leads-page__empty">
                  Selecione um lead à esquerda para ver os detalhes.
                </p>
              ) : (
                <>
                  <header className="leads-detail__profile">
                    <div className="leads-detail__identity">
                      <div className="leads-detail__avatar" aria-hidden="true">
                        {initialsFromName(selected.name)}
                      </div>
                      <div className="leads-detail__who">
                        <h2 className="leads-detail__name">
                          {selected.name || 'Lead sem nome'}
                        </h2>
                        <div className="leads-detail__contacts">
                          {selected.email ? (
                            <span className="leads-detail__contact">
                              <span
                                className="material-symbols-outlined"
                                aria-hidden="true"
                              >
                                mail
                              </span>
                              {selected.email}
                            </span>
                          ) : null}
                          {selected.phone ? (
                            <span className="leads-detail__contact">
                              <span
                                className="material-symbols-outlined"
                                aria-hidden="true"
                              >
                                call
                              </span>
                              {selected.phone}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="leads-detail__actions">
                      <span
                        className={`leads-status-btn leads-status-btn--${selectedStatus.tone}`}
                      >
                        {selectedStatus.label}
                      </span>
                    </div>
                  </header>

                  <div className="leads-detail__block">
                    <h3 className="leads-detail__section-title">De onde veio</h3>
                    <div className="leads-origin-grid">
                      <div className="leads-origin-grid__item">
                        <span className="leads-origin-grid__label">Campanha</span>
                        <strong>
                          {tracking.campaignName ||
                            tracking.formName ||
                            selected.origin ||
                            '—'}
                        </strong>
                      </div>
                      <div className="leads-origin-grid__item">
                        <span className="leads-origin-grid__label">
                          Conjunto de anúncios
                        </span>
                        <strong>{tracking.adsetName || '—'}</strong>
                      </div>
                      <div className="leads-origin-grid__item">
                        <span className="leads-origin-grid__label">Anúncio</span>
                        <strong>{tracking.adName || tracking.formName || '—'}</strong>
                      </div>
                      <div className="leads-origin-grid__item">
                        <span className="leads-origin-grid__label">Plataforma</span>
                        <strong className="leads-origin-grid__platform">
                          <span
                            className="material-symbols-outlined"
                            aria-hidden="true"
                          >
                            ads_click
                          </span>
                          {platformLabel(tracking.platform, selected.source)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="leads-detail__block">
                    <h3 className="leads-detail__section-title">
                      O que o lead respondeu
                    </h3>
                    {answers.length === 0 ? (
                      <p className="leads-detail__empty">
                        Este lead ainda não tem respostas detalhadas salvas.
                      </p>
                    ) : (
                      <div className="leads-answers-grid">
                        {answers.map((answer) => (
                          <article
                            key={answer.key || answer.label}
                            className="leads-answer-card"
                          >
                            <h4 className="leads-answer-card__label">
                              {answer.label}
                            </h4>
                            <p className="leads-answer-card__value">
                              {answer.value || '—'}
                            </p>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
