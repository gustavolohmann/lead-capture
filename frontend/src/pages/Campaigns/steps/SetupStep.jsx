import CampaignStep from './CampaignStep.jsx';
import AudienceStep from './AudienceStep.jsx';

export default function SetupStep({
  state,
  pages,
  adAccounts,
  fieldErrors,
  onCampaignChange,
  onAudienceChange,
}) {
  return (
    <div className="wizard-setup">
      <div>
        <h2 className="wizard-step-title">Configure sua campanha</h2>
      </div>
      <CampaignStep
        state={state}
        pages={pages}
        adAccounts={adAccounts}
        fieldErrors={fieldErrors}
        onChange={onCampaignChange}
        onAudienceChange={onAudienceChange}
        embedded
      />
      <hr className="wizard-divider" />
      <AudienceStep
        state={state}
        fieldErrors={fieldErrors}
        onChange={onAudienceChange}
        embedded
      />
    </div>
  );
}
