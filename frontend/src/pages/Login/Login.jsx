import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import './Login.css';

const LOGO_SRC =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAzGP-my6yYJK61wGppd3kvhlwPlKLeIV3FUBzW4sSv_t-NSTrUGu-n6QdJhfqfs0LIsoD4puL4RXIRTNgiyvqlcQIyvMeb__XTGmveHGkXlSFcw0t6s-tMVlzWc35ZlZVIsgqsQBKuwctjgD7faR0feF1vPIZM1wNLCFjDuQ0ITaXv2OfFfa-4L7RcbtNhMZ3kzy8qeWAelDD1R0YJG5ZWqDYjkko6FVIQMHCZwxOE0wT7WBDUsd8';

function IconMail() {
  return (
    <svg
      className="lc-login__svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6.75A1.75 1.75 0 0 1 5.75 5h12.5A1.75 1.75 0 0 1 20 6.75v10.5A1.75 1.75 0 0 1 18.25 19H5.75A1.75 1.75 0 0 1 4 17.25V6.75Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="m5 7 7 5.25L19 7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLock() {
  return (
    <svg
      className="lc-login__svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M8 10V7.5a4 4 0 0 1 8 0V10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconEye({ off = false }) {
  if (off) {
    return (
      <svg
        className="lc-login__svg"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 3l18 18"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M10.6 10.7a2.5 2.5 0 0 0 3.5 3.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M9.9 5.5A10.8 10.8 0 0 1 12 5.25c5 0 8.75 3.5 10.5 6.75a12.4 12.4 0 0 1-4.1 4.7M6.2 6.3C4.1 7.7 2.5 9.7 1.5 12c1.75 3.25 5.5 6.75 10.5 6.75 1.3 0 2.5-.25 3.6-.7"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      className="lc-login__svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 12s3.5-6.75 10-6.75S22 12 22 12s-3.5 6.75-10 6.75S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/meta', { replace: true });
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        'Não foi possível autenticar. Tente novamente.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lc-login">
      <aside className="lc-login__brand">
        <div className="lc-login__brand-grid" aria-hidden="true" />

        <div className="lc-login__brand-logo">
          <img
            src={LOGO_SRC}
            alt="Lead Capture"
            className="lc-login__logo-img lc-login__logo-img--lg"
            width={48}
            height={48}
            onError={(event) => {
              event.currentTarget.style.display = 'none';
              event.currentTarget.nextElementSibling?.classList.add(
                'lc-login__logo-fallback--visible'
              );
            }}
          />
          <span className="lc-login__logo-fallback" aria-hidden="true">
            LC
          </span>
        </div>

        <div className="lc-login__brand-copy">
          <h1 className="lc-login__brand-title">
            Transforme seus anúncios em oportunidades reais.
          </h1>
          <p className="lc-login__brand-subtitle">
            Conecte suas campanhas, capture leads e acompanhe seus clientes em
            um único lugar.
          </p>
        </div>

        <div aria-hidden="true" />
      </aside>

      <main className="lc-login__main">
        <div className="lc-login__mobile-logo">
          <img
            src={LOGO_SRC}
            alt="Lead Capture"
            className="lc-login__logo-img lc-login__logo-img--sm"
            width={40}
            height={40}
            onError={(event) => {
              event.currentTarget.style.display = 'none';
              event.currentTarget.nextElementSibling?.classList.add(
                'lc-login__logo-fallback--visible'
              );
            }}
          />
          <span
            className="lc-login__logo-fallback lc-login__logo-fallback--sm"
            aria-hidden="true"
          >
            LC
          </span>
        </div>

        <div className="lc-login__card">
          <div className="lc-login__card-header">
            <h2 className="lc-login__card-title">Bem-vindo novamente</h2>
            <p className="lc-login__card-subtitle">
              Entre na sua conta para continuar
            </p>
          </div>

          <form className="lc-login__form" onSubmit={handleSubmit} noValidate>
            <div className="lc-login__field">
              <label className="lc-login__label" htmlFor="email">
                Email
              </label>
              <div className="lc-login__control">
                <span className="lc-login__icon lc-login__icon--left">
                  <IconMail />
                </span>
                <input
                  id="email"
                  className="lc-login__input"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Digite seu email"
                  required
                />
              </div>
            </div>

            <div className="lc-login__field">
              <label className="lc-login__label" htmlFor="password">
                Senha
              </label>
              <div className="lc-login__control">
                <span className="lc-login__icon lc-login__icon--left">
                  <IconLock />
                </span>
                <input
                  id="password"
                  className="lc-login__input lc-login__input--password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Digite sua senha"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="lc-login__icon lc-login__icon--right"
                  aria-label={
                    showPassword ? 'Ocultar senha' : 'Mostrar senha'
                  }
                  onClick={() => setShowPassword((current) => !current)}
                >
                  <IconEye off={showPassword} />
                </button>
              </div>
            </div>

            {error ? <p className="lc-login__error">{error}</p> : null}

            <div className="lc-login__submit-wrap">
              <button
                className="lc-login__submit"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </form>

          <div className="lc-login__footer">
            <a
              className="lc-login__forgot"
              href="#"
              onClick={(event) => event.preventDefault()}
            >
              Esqueceu sua senha?
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
