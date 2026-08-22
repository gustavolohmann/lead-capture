import { CTA_OPTIONS } from '../leadsWizardState.js';

const PRIMARY_MAX = 125;
const TITLE_MAX = 40;

export default function AdStep({
  state,
  pageName,
  imagePreviewUrl,
  imageNeedsReselect,
  imageError,
  fieldErrors = {},
  onChange,
  onImageSelect,
  showPreview = true,
  embedded = false,
  ctaOptions = CTA_OPTIONS,
  showCta = true,
}) {
  const { ad } = state;

  const editor = (
    <div className={`wizard-ad-editor${embedded ? ' wizard-ad-editor--embedded' : ''}`}>
      {!embedded ? (
        <div>
          <h2 className="wizard-step-title">Crie seu anúncio</h2>
        </div>
      ) : null}

      {imageNeedsReselect ? (
        <p className="wizard-banner-warn" role="status">
          A imagem usada anteriormente não pode ser restaurada por segurança do
          navegador. Selecione-a novamente para publicar.
          {ad.imageMeta?.name ? ` (antes: ${ad.imageMeta.name})` : ''}
        </p>
      ) : null}

      <label className={`field${fieldErrors.name ? ' is-invalid' : ''}`}>
        <span className="field-label">
          Nome do anúncio<span className="field-required">*</span>
        </span>
        <input
          className="input"
          value={ad.name || ''}
          maxLength={255}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Ex.: Benefício principal"
        />
        {fieldErrors.name ? (
          <span className="field-error">{fieldErrors.name}</span>
        ) : null}
      </label>

      <label className={`field${fieldErrors.primaryText ? ' is-invalid' : ''}`}>
        <span className="field-label">
          Texto principal<span className="field-required">*</span>
        </span>
        <textarea
          className="input wizard-textarea"
          value={ad.primaryText}
          maxLength={PRIMARY_MAX}
          onChange={(e) => onChange({ primaryText: e.target.value })}
          rows={embedded ? 3 : 4}
          placeholder="Conte aos seus clientes o que você está oferecendo..."
        />
        <span className="wizard-char-count">
          {ad.primaryText.length} / {PRIMARY_MAX}
        </span>
        {fieldErrors.primaryText ? (
          <span className="field-error">{fieldErrors.primaryText}</span>
        ) : null}
      </label>

      <label className={`field${fieldErrors.title ? ' is-invalid' : ''}`}>
        <span className="field-label">
          Título<span className="field-required">*</span>
        </span>
        <input
          className="input"
          value={ad.title}
          maxLength={TITLE_MAX}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Um título curto e impactante"
        />
        <span className="wizard-char-count">
          {ad.title.length} / {TITLE_MAX}
        </span>
        {fieldErrors.title ? (
          <span className="field-error">{fieldErrors.title}</span>
        ) : null}
      </label>

      <label className={`field${fieldErrors.image ? ' is-invalid' : ''}`}>
        <span className="field-label">
          Imagem<span className="field-required">*</span>
        </span>
        <div
          className={`wizard-dropzone${embedded ? ' wizard-dropzone--compact' : ''}`}
        >
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onImageSelect(e.target.files?.[0] || null)}
          />
          <p>{ad.imageMeta?.name || 'Arraste ou selecione uma imagem'}</p>
          <span>JPG ou PNG · até 5MB</span>
        </div>
        {imageError ? <span className="field-error">{imageError}</span> : null}
        {fieldErrors.image ? (
          <span className="field-error">{fieldErrors.image}</span>
        ) : null}
      </label>

      {showCta ? <label className={`field${fieldErrors.cta ? ' is-invalid' : ''}`}>
        <span className="field-label">
          Botão<span className="field-required">*</span>
        </span>
        <select
          className="input"
          value={ad.cta}
          onChange={(e) => onChange({ cta: e.target.value })}
        >
          {ctaOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {fieldErrors.cta ? (
          <span className="field-error">{fieldErrors.cta}</span>
        ) : null}
      </label> : null}
    </div>
  );

  if (!showPreview) return editor;

  return (
    <div className="wizard-ad-layout">
      {editor}
      <aside className="wizard-ad-preview-pane">
        <div className="wizard-preview-label">Prévia</div>
        <div className="wizard-ad-preview wizard-ad-preview--mobile">
          <div className="wizard-ad-preview__head">
            <strong>{pageName || 'Sua página'}</strong>
            <span>Patrocinado</span>
          </div>
          <p className="wizard-ad-preview__text">
            {ad.primaryText || 'Seu texto principal aparece aqui.'}
          </p>
          <div className="wizard-ad-preview__media">
            {imagePreviewUrl ? (
              <img src={imagePreviewUrl} alt="Prévia do anúncio" />
            ) : (
              <div className="wizard-ad-preview__placeholder">Sua imagem</div>
            )}
          </div>
          <div className="wizard-ad-preview__footer">
            <div>
              <strong>{ad.title || 'Título'}</strong>
            </div>
            <button type="button" className="wizard-ad-preview__cta" tabIndex={-1}>
              {ctaOptions.find((o) => o.value === ad.cta)?.label || 'Saiba mais'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
