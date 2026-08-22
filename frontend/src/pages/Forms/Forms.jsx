import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formsApi } from '../../services/forms.api.js';
import { copyFormPublicLink, getFormPublicUrl } from './formLinks.js';
import './Forms.css';

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

function statusLabel(status) {
  if (status === 'ACTIVE') return 'Ativo';
  if (status === 'INACTIVE') return 'Inativo';
  if (status === 'ARCHIVED') return 'Arquivado';
  return status || '—';
}

export default function Forms() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const menuRef = useRef(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await formsApi.list();
      setForms(data.forms || []);
    } catch (err) {
      setError(
        err?.response?.data?.message || 'Não foi possível carregar formulários.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function onDocClick(event) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function handleDelete(id) {
    if (
      !window.confirm(
        'Excluir este formulário? O link público deixa de funcionar. Esta ação não pode ser desfeita.'
      )
    ) {
      return;
    }
    try {
      await formsApi.remove(id);
      setMenuOpenId(null);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Não foi possível excluir o formulário. Tente novamente.');
    }
  }

  async function handleToggleStatus(form) {
    const nextStatus = form.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await formsApi.update(form.id, {
        name: form.name,
        description: form.description,
        submitLabel: form.submitLabel,
        status: nextStatus,
        fields: (form.fields || []).map((field, position) => ({
          type: field.type,
          label: field.label,
          placeholder: field.placeholder,
          required: Boolean(field.required),
          position,
          options: field.options || null,
        })),
      });
      setMenuOpenId(null);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao atualizar status.');
    }
  }

  async function handleDuplicate(form) {
    try {
      await formsApi.create({
        name: `${form.name} (cópia)`,
        description: form.description,
        submitLabel: form.submitLabel,
        fields: (form.fields || []).map((field, position) => ({
          type: field.type,
          label: field.label,
          placeholder: field.placeholder,
          required: Boolean(field.required),
          position,
          options: field.options || null,
        })),
      });
      setMenuOpenId(null);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao duplicar.');
    }
  }

  async function handleCopyLink(id) {
    try {
      await copyFormPublicLink(id);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 2000);
    } catch {
      setError('Não foi possível copiar o link.');
    }
  }

  return (
    <div className="forms-page">
      <header className="page-header forms-page__header">
        <div className="page-header__copy">
          <h1 className="page-header__title">Formulários</h1>
          <p className="page-header__subtitle">
            Monte campos, gere um link público e compartilhe. As respostas entram
            no CRM automaticamente.
          </p>
        </div>
        <div className="page-header__actions">
          <Link className="btn btn-primary" to="/forms/new">
            Novo formulário
          </Link>
        </div>
      </header>

      {error ? <p className="forms-page__error-banner">{error}</p> : null}

      <section className="forms-page__panel">
        {loading ? <p className="forms-page__hint">Carregando formulários...</p> : null}

        {!loading && forms.length === 0 ? (
          <div className="forms-page__empty">
            <div className="forms-page__empty-icon" aria-hidden="true">
              <span className="material-symbols-outlined">description</span>
            </div>
            <h2>Nenhum formulário ainda</h2>
            <p>
              Crie um formulário, gere o link público e use em campanhas ou
              WhatsApp. As respostas entram em Leads.
            </p>
            <Link className="btn btn-primary" to="/forms/new">
              Novo formulário
            </Link>
          </div>
        ) : null}

        {!loading && forms.length > 0 ? (
          <div className="forms-table-wrap" ref={menuRef}>
            <table className="forms-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Status</th>
                  <th>Campos</th>
                  <th>Criado em</th>
                  <th>Link público</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {forms.map((form) => {
                  const publicUrl = getFormPublicUrl(form.id);
                  return (
                    <tr key={form.id}>
                      <td data-label="Nome" className="forms-table__cell--name">
                        <strong>{form.name}</strong>
                        {form.description ? (
                          <div className="forms-table__desc">
                            {form.description}
                          </div>
                        ) : null}
                      </td>
                      <td data-label="Status">
                        <span
                          className={`forms-status forms-status--${String(
                            form.status || ''
                          ).toLowerCase()}`}
                        >
                          {statusLabel(form.status)}
                        </span>
                      </td>
                      <td data-label="Campos">{form.fields?.length || 0}</td>
                      <td data-label="Criado em">{formatDate(form.createdAt)}</td>
                      <td data-label="Link público">
                        <a
                          className="forms-table__link"
                          href={publicUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {publicUrl}
                        </a>
                      </td>
                      <td className="forms-table__cell--actions">
                        <div className="forms-table__actions">
                          <Link
                            className="btn btn-secondary"
                            to={`/forms/${form.id}`}
                          >
                            Editar
                          </Link>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleCopyLink(form.id)}
                          >
                            {copiedId === form.id ? 'Copiado!' : 'Copiar link'}
                          </button>
                          <div className="forms-menu">
                            <button
                              type="button"
                              className="btn btn-secondary forms-menu__trigger"
                              aria-label="Mais ações"
                              onClick={() =>
                                setMenuOpenId((current) =>
                                  current === form.id ? null : form.id
                                )
                              }
                            >
                              ⋯
                            </button>
                            {menuOpenId === form.id ? (
                              <div className="forms-menu__dropdown">
                                <Link to={`/forms/${form.id}/preview`}>
                                  Visualizar
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicate(form)}
                                >
                                  Duplicar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(form)}
                                >
                                  {form.status === 'ACTIVE'
                                    ? 'Desativar'
                                    : 'Ativar'}
                                </button>
                                <button
                                  type="button"
                                  className="is-danger"
                                  onClick={() => handleDelete(form.id)}
                                >
                                  Excluir
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
