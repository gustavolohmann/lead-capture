import { formatStepProgress } from './leadsWizardState.js';
import { formatDraftAge, getDraft, clearDraft } from './campaignDraft.js';
import './DraftResumeBanner.css';

export default function DraftResumeBanner({ onContinue, onDiscard }) {
  const draft = getDraft();
  if (!draft) return null;

  const name = draft.state?.campaign?.name?.trim() || 'Campanha sem nome';
  const age = formatDraftAge(draft.updatedAt);

  function handleDiscard() {
    const ok = window.confirm(
      'Descartar este rascunho? A campanha em andamento será apagada deste dispositivo.'
    );
    if (!ok) return;
    clearDraft();
    onDiscard?.();
  }

  return (
    <div className="draft-resume-banner" role="status">
      <div>
        <strong>Você tem uma campanha em andamento</strong>
        <p>
          {name} · {formatStepProgress(draft.step)}
          {age ? ` · salva ${age}` : ''}
        </p>
        <p className="draft-resume-banner__device">Rascunho neste dispositivo</p>
      </div>
      <div className="draft-resume-banner__actions">
        <button type="button" className="btn btn-primary" onClick={onContinue}>
          Continuar campanha
        </button>
        <button type="button" className="btn btn-ghost" onClick={handleDiscard}>
          Descartar rascunho
        </button>
      </div>
    </div>
  );
}
