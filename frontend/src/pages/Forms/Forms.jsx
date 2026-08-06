import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formsApi } from '../../services/forms.api.js';
import { copyFormPublicLink, getFormPublicUrl } from './formLinks.js';
import './Forms.css';

export default function Forms() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

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

  async function handleDelete(id) {
    if (!window.confirm('Excluir este formulário?')) return;
    try {
      await formsApi.remove(id);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao excluir.');
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
      <header className="forms-page__header">
        <div>
          <h1 className="text-h2">Formulários</h1>
          <p className="text-subtitle forms-page__subtitle">
            Crie formulários dinâmicos e compartilhe o link público. Leads entram
            no CRM e disparam automações.
          </p>
        </div>
        <Link className="btn btn-primary" to="/forms/new">
          Novo formulário
        </Link>
      </header>

      <section className="card forms-page__card">
        {loading ? <p className="text-body">Carregando...</p> : null}
        {error ? <p className="forms-page__error">{error}</p> : null}

        {!loading && forms.length === 0 ? (
          <div className="forms-page__empty">
            <p>Nenhum formulário ainda.</p>
            <Link className="btn btn-primary" to="/forms/new">
              Criar primeiro formulário
            </Link>
          </div>
        ) : null}

        {!loading && forms.length > 0 ? (
          <div className="forms-table-wrap">
            <table className="forms-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Link público</th>
                  <th>Campos</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {forms.map((form) => {
                  const publicUrl = getFormPublicUrl(form.id);
                  return (
                    <tr key={form.id}>
                      <td>
                        <strong>{form.name}</strong>
                        {form.description ? (
                          <div className="forms-table__desc">
                            {form.description}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <a
                          className="forms-table__link"
                          href={publicUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {publicUrl}
                        </a>
                      </td>
                      <td>{form.fields?.length || 0}</td>
                      <td>{form.status}</td>
                      <td className="forms-table__actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleCopyLink(form.id)}
                        >
                          {copiedId === form.id ? 'Copiado!' : 'Copiar link'}
                        </button>
                        <Link
                          className="btn btn-secondary"
                          to={`/forms/${form.id}`}
                        >
                          Editar
                        </Link>
                        <Link
                          className="btn btn-secondary"
                          to={`/forms/${form.id}/preview`}
                        >
                          Preview
                        </Link>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleDelete(form.id)}
                        >
                          Excluir
                        </button>
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
