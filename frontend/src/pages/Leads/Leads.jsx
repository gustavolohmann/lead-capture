import { useEffect, useMemo, useState } from 'react';
import { leadsApi } from '../../services/leads.api.js';
import './Leads.css';

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function DetailRow({ label, value }) {
  if (value == null || String(value).trim() === '') return null;
  return (
    <div className="leads-kv">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [originFilter, setOriginFilter] = useState('ALL');

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

  const originOptions = useMemo(
    () => ['ALL', ...new Set(leads.map((l) => l.origin).filter(Boolean))],
    [leads]
  );

  const visibleLeads = useMemo(
    () =>
      originFilter === 'ALL'
        ? leads
        : leads.filter((lead) => lead.origin === originFilter),
    [leads, originFilter]
  );

  const selected = useMemo(
    () => visibleLeads.find((l) => l.id === selectedId) || leads.find((l) => l.id === selectedId) || null,
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

  return (
    <div className="leads-page">
      <header className="leads-page__header">
        <div>
          <h1 className="text-h2">Leads</h1>
          <p className="text-subtitle leads-page__subtitle">
            Clique em um lead para ver a campanha de origem e todas as respostas
            do formulário.
          </p>
        </div>
        {!loading && leads.length > 0 ? (
          <label className="leads-filter field">
            <span className="field-label">Filtrar origem</span>
            <select
              className="input"
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
            >
              {originOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'ALL' ? 'Todas as origens' : option}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      {loading ? <p className="text-body">Carregando leads...</p> : null}
      {error ? <p className="leads-page__error">{error}</p> : null}

      {!loading && !error && leads.length === 0 ? (
        <section className="card leads-page__card">
          <p className="text-body leads-page__empty">
            Nenhum lead recebido ainda. Configure o webhook Meta e publique um
            formulário Lead Ads.
          </p>
        </section>
      ) : null}

      {!loading && leads.length > 0 ? (
        <div className="leads-layout">
          <section className="card leads-list-card">
            <div className="leads-table-wrap">
              <table className="leads-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Campanha</th>
                    <th>Data</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.map((lead) => {
                    const active = lead.id === selectedId;
                    return (
                      <tr
                        key={lead.id}
                        className={
                          active
                            ? 'leads-table__row is-selected'
                            : 'leads-table__row is-clickable'
                        }
                        onClick={() => setSelectedId(lead.id)}
                      >
                        <td>
                          <div className="leads-list-name">{lead.name || '—'}</div>
                          <div className="leads-list-meta">
                            {lead.email || lead.phone || 'Sem contato'}
                          </div>
                        </td>
                        <td>
                          <div className="leads-list-name">
                            {lead.tracking?.campaignName ||
                              lead.origin ||
                              '—'}
                          </div>
                          <div className="leads-list-meta">
                            {lead.tracking?.adName ||
                              lead.tracking?.formName ||
                              '—'}
                          </div>
                        </td>
                        <td>{formatDate(lead.createdAt)}</td>
                        <td>
                          <span className="leads-status">{lead.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {visibleLeads.length === 0 ? (
              <p className="text-body leads-page__empty" style={{ padding: 16 }}>
                Nenhum lead nesta origem.
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
                <header className="leads-detail-card__header">
                  <div>
                    <h2 className="leads-detail-card__title">
                      {selected.name || 'Lead sem nome'}
                    </h2>
                    <p className="leads-detail-card__subtitle">
                      {selected.email || '—'} · {selected.phone || '—'}
                    </p>
                  </div>
                  <span className="leads-status">{selected.status}</span>
                </header>

                <div className="leads-detail__block">
                  <h3 className="leads-detail__title">De onde veio</h3>
                  <div className="leads-origin-banner">
                    <strong>
                      {tracking.campaignName ||
                        tracking.formName ||
                        selected.origin ||
                        'Origem não identificada'}
                    </strong>
                    <span>
                      {tracking.adName
                        ? `Anúncio: ${tracking.adName}`
                        : selected.origin}
                    </span>
                  </div>
                  <dl className="leads-kv-grid">
                    <DetailRow label="Origem" value={selected.origin} />
                    <DetailRow label="Campanha" value={tracking.campaignName} />
                    <DetailRow
                      label="ID da campanha"
                      value={tracking.campaignId}
                    />
                    <DetailRow
                      label="Conjunto de anúncios"
                      value={tracking.adsetName}
                    />
                    <DetailRow label="Anúncio" value={tracking.adName} />
                    <DetailRow
                      label="Formulário"
                      value={tracking.formName || tracking.formId}
                    />
                    <DetailRow label="Plataforma" value={tracking.platform} />
                    <DetailRow
                      label="Orgânico"
                      value={
                        tracking.source === 'META_LEAD_ADS'
                          ? tracking.isOrganic
                            ? 'Sim'
                            : 'Não (pago)'
                          : null
                      }
                    />
                    <DetailRow label="Meta Lead ID" value={tracking.metaLeadId} />
                    <DetailRow
                      label="Capturado em"
                      value={formatDate(selected.createdAt)}
                    />
                  </dl>
                </div>

                <div className="leads-detail__block">
                  <h3 className="leads-detail__title">
                    O que o lead respondeu ({answers.length})
                  </h3>
                  {answers.length === 0 ? (
                    <p className="leads-detail__empty">
                      Este lead ainda não tem respostas detalhadas salvas.
                    </p>
                  ) : (
                    <dl className="leads-answers">
                      {answers.map((answer) => (
                        <div key={answer.key} className="leads-answers__item">
                          <dt>{answer.label}</dt>
                          <dd>{answer.value || '—'}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
