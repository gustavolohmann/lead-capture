import './ConversationUserInfo.css';

function display(value) {
  if (value == null || String(value).trim() === '') return 'Não informado';
  return String(value);
}

function formatDate(value) {
  if (!value) return 'Não informado';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return 'Não informado';
  }
}

function socialLabel(contact) {
  const platform = String(contact?.platform || contact?.channel || '').toUpperCase();
  if (platform === 'INSTAGRAM' || contact?.channel === 'INSTAGRAM') return 'Instagram';
  if (
    platform === 'FACEBOOK' ||
    platform === 'FB' ||
    contact?.channel === 'MESSENGER'
  ) {
    return 'Facebook Messenger';
  }
  if (platform === 'WHATSAPP' || contact?.channel === 'WHATSAPP') return 'WhatsApp';
  return contact?.channel || 'Canal';
}

export default function ConversationUserInfo({ contact, loading }) {
  if (loading) {
    return (
      <aside className="conversation-user-info">
        <p className="conversation-user-info__hint">Carregando contato...</p>
      </aside>
    );
  }

  if (!contact) {
    return (
      <aside className="conversation-user-info">
        <p className="conversation-user-info__hint">Selecione uma conversa.</p>
      </aside>
    );
  }

  const handle =
    contact.socialUsername
      ? `@${String(contact.socialUsername).replace(/^@/, '')}`
      : null;

  return (
    <aside className="conversation-user-info">
      <div className="conversation-user-info__identity">
        {contact.profilePictureUrl ? (
          <img
            className="conversation-user-info__avatar"
            src={contact.profilePictureUrl}
            alt=""
          />
        ) : (
          <div className="conversation-user-info__avatar is-placeholder" aria-hidden="true">
            {(contact.name || '?').slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h3>{display(contact.name)}</h3>
          <p>{socialLabel(contact)}</p>
          {handle ? <p className="conversation-user-info__handle">{handle}</p> : null}
        </div>
      </div>

      <section className="conversation-user-info__section">
        <h4>Contato</h4>
        <dl className="conversation-user-info__list">
          <div>
            <dt>Telefone</dt>
            <dd>{display(contact.phone)}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{display(contact.email)}</dd>
          </div>
          {contact.pageName ? (
            <div>
              <dt>Página</dt>
              <dd>{display(contact.pageName)}</dd>
            </div>
          ) : null}
        </dl>
        {contact.channel === 'MESSENGER' ? (
          <p className="conversation-user-info__note">
            No Messenger a Meta não envia telefone nem email. Nome e foto vêm do
            perfil público.
          </p>
        ) : null}
      </section>

      <section className="conversation-user-info__section">
        <h4>Origem do lead</h4>
        <dl className="conversation-user-info__list">
          <div>
            <dt>Origem</dt>
            <dd>{display(contact.origin)}</dd>
          </div>
          <div>
            <dt>Campanha</dt>
            <dd>{display(contact.campaignName)}</dd>
          </div>
          <div>
            <dt>Anúncio</dt>
            <dd>{display(contact.adName)}</dd>
          </div>
          <div>
            <dt>Formulário</dt>
            <dd>{display(contact.formName)}</dd>
          </div>
          <div>
            <dt>Entrou em</dt>
            <dd>{formatDate(contact.leadCreatedAt)}</dd>
          </div>
        </dl>
      </section>

      {contact.messengerPsid || contact.externalUserId ? (
        <details className="conversation-user-info__tech">
          <summary>Dados técnicos</summary>
          <dl className="conversation-user-info__list">
            <div>
              <dt>ID Messenger (PSID)</dt>
              <dd className="conversation-user-info__mono">
                {display(contact.messengerPsid || contact.externalUserId)}
              </dd>
            </div>
          </dl>
        </details>
      ) : null}
    </aside>
  );
}
