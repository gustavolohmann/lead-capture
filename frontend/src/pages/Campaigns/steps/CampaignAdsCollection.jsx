export default function CampaignAdsCollection({
  ads,
  activeAdIndex,
  onAdSelect,
  onAdAdd,
  onAdDuplicate,
  onAdRemove,
}) {
  return (
    <section className="wizard-ads-collection" aria-label="Anúncios da campanha">
      <div className="wizard-ads-collection__head">
        <div>
          <h2>Anúncios</h2>
          <p>
            {ads.length}{' '}
            {ads.length === 1 ? 'anúncio configurado' : 'anúncios configurados'}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onAdAdd}>
          + Adicionar anúncio
        </button>
      </div>

      <div
        className="wizard-ads-collection__list"
        role="tablist"
        aria-label="Selecionar anúncio"
      >
        {ads.map((item, index) => (
          <div
            key={item.clientKey}
            className={`wizard-ad-tab${activeAdIndex === index ? ' is-active' : ''}`}
          >
            <button
              type="button"
              className="wizard-ad-tab__select"
              role="tab"
              aria-selected={activeAdIndex === index}
              onClick={() => onAdSelect(index)}
            >
              <span className="wizard-ad-tab__number">{index + 1}</span>
              <span className="wizard-ad-tab__copy">
                <strong>{item.name || `Anúncio ${index + 1}`}</strong>
                <span>{item.title || 'Sem título'}</span>
              </span>
            </button>
            <div className="wizard-ad-tab__actions">
              <button
                type="button"
                aria-label={`Duplicar ${item.name || `anúncio ${index + 1}`}`}
                title="Duplicar"
                onClick={() => onAdDuplicate(index)}
              >
                ⎘
              </button>
              <button
                type="button"
                aria-label={`Remover ${item.name || `anúncio ${index + 1}`}`}
                title={
                  ads.length === 1
                    ? 'A campanha precisa de um anúncio'
                    : 'Remover'
                }
                disabled={ads.length === 1}
                onClick={() => onAdRemove(index)}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
