import { formatMonthlyEstimate } from '../campaignMoney.js';

export default function CampaignStep({
  state,
  pages,
  adAccounts,
  fieldErrors = {},
  onChange,
  onAudienceChange,
  embedded = false,
}) {
  const { campaign, audience } = state;
  const singleAccount = adAccounts.length === 1;
  const singlePage = pages.length === 1;
  const pageName =
    pages.find((p) => p.pageId === campaign.pageId)?.name || campaign.pageId;
  const accountName =
    adAccounts.find((a) => a.accountId === campaign.adAccountId)?.name ||
    campaign.adAccountId;

  return (
    <div className={`wizard-grid${embedded ? ' wizard-grid--tight' : ''}`}>
      {!embedded ? (
        <div>
          <h2 className="wizard-step-title">Configure sua campanha</h2>
          <p className="wizard-step-subtitle">
            Defina onde publicar e quanto investir.
          </p>
        </div>
      ) : null}

      <label className={`field${fieldErrors.name ? ' is-invalid' : ''}`}>
        <span className="field-label">
          Nome<span className="field-required">*</span>
        </span>
        <input
          className="input"
          value={campaign.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Campanha Barbearia - Agosto"
        />
        {fieldErrors.name ? (
          <span className="field-error">{fieldErrors.name}</span>
        ) : null}
      </label>

      {singlePage && singleAccount && campaign.pageId && campaign.adAccountId ? (
        <p className="wizard-publish-meta">
          Publicando pela <strong>{pageName}</strong>
          {accountName ? ` · ${accountName}` : ''}
        </p>
      ) : (
        <>
          <div className="wizard-section-label">Onde o anúncio será publicado</div>
          <div className="wizard-assets-row">
            {singlePage && campaign.pageId ? (
              <p className="wizard-publish-meta">
                Página: <strong>{pageName}</strong>
              </p>
            ) : (
              <label
                className={`field${fieldErrors.pageId ? ' is-invalid' : ''}`}
              >
                <span className="field-label">
                  Página do Facebook<span className="field-required">*</span>
                </span>
                <select
                  className="input"
                  value={campaign.pageId}
                  onChange={(e) => onChange({ pageId: e.target.value })}
                >
                  <option value="">Selecione</option>
                  {pages.map((page) => (
                    <option key={page.pageId} value={page.pageId}>
                      {page.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.pageId ? (
                  <span className="field-error">{fieldErrors.pageId}</span>
                ) : null}
              </label>
            )}

            {singleAccount && campaign.adAccountId ? (
              <p className="wizard-publish-meta">
                Conta: <strong>{accountName}</strong>
              </p>
            ) : (
              <label
                className={`field${fieldErrors.adAccountId ? ' is-invalid' : ''}`}
              >
                <span className="field-label">
                  Conta de anúncios<span className="field-required">*</span>
                </span>
                <select
                  className="input"
                  value={campaign.adAccountId}
                  onChange={(e) => onChange({ adAccountId: e.target.value })}
                >
                  <option value="">Selecione</option>
                  {adAccounts.map((account) => (
                    <option key={account.accountId} value={account.accountId}>
                      {account.name || account.accountId}
                    </option>
                  ))}
                </select>
                {fieldErrors.adAccountId ? (
                  <span className="field-error">{fieldErrors.adAccountId}</span>
                ) : null}
              </label>
            )}
          </div>
        </>
      )}

      <div className="wizard-budget-block">
        <div className="wizard-section-label">Orçamento</div>

        <label
          className={`field${fieldErrors.dailyBudget ? ' is-invalid' : ''}`}
        >
          <span className="field-label">
            Quanto você quer investir por dia?
            <span className="field-required">*</span>
          </span>
          <div className="wizard-budget-input">
            <span>R$</span>
            <input
              className="input"
              type="number"
              min="1"
              step="0.01"
              value={campaign.dailyBudget}
              onChange={(e) =>
                onChange({ dailyBudget: Number(e.target.value) })
              }
            />
          </div>
          {fieldErrors.dailyBudget ? (
            <span className="field-error">{fieldErrors.dailyBudget}</span>
          ) : null}
        </label>

        <p className="wizard-hint wizard-hint--estimate">
          ≈ {formatMonthlyEstimate(campaign.dailyBudget)} por mês
        </p>

        <p className="wizard-hint wizard-hint--meta">
          A Meta pode distribuir seu orçamento de forma diferente entre os dias
          para buscar melhores resultados.
        </p>

        {typeof onAudienceChange === 'function' ? (
          <label
            className={`field wizard-budget-bid${
              fieldErrors.bidLimit ? ' is-invalid' : ''
            }`}
          >
            <span className="field-label">Limite de lance (opcional)</span>
            <div className="wizard-budget-input">
              <span>R$</span>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={audience?.bidLimit ?? 0}
                onChange={(e) =>
                  onAudienceChange({
                    bidLimit:
                      e.target.value === '' ? 0 : Number(e.target.value),
                  })
                }
                placeholder="0"
              />
            </div>
            <span className="wizard-hint">
              Defina um limite para o valor usado na disputa por novos
              resultados. Na maioria dos casos, recomendamos deixar a Meta
              otimizar automaticamente.
            </span>
            {fieldErrors.bidLimit ? (
              <span className="field-error">{fieldErrors.bidLimit}</span>
            ) : null}
          </label>
        ) : null}
      </div>
    </div>
  );
}
