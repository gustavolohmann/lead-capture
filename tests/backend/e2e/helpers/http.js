import request from 'supertest';
import { createApp } from '../../../../backend/src/app.js';
import { wireDomainEvents } from '../../../../backend/src/events/wire.js';

let app;

export function getApp() {
  if (!app) {
    wireDomainEvents();
    app = createApp();
  }
  return app;
}

function withApiPrefix(path) {
  if (
    path.startsWith('/api') ||
    path.startsWith('/webhooks') ||
    path.startsWith('/health') ||
    path.startsWith('/meta/callback')
  ) {
    return path;
  }
  return `/api${path.startsWith('/') ? path : `/${path}`}`;
}

export function api() {
  const agent = request(getApp());
  return {
    get: (path) => agent.get(withApiPrefix(path)),
    post: (path) => agent.post(withApiPrefix(path)),
    put: (path) => agent.put(withApiPrefix(path)),
    patch: (path) => agent.patch(withApiPrefix(path)),
    delete: (path) => agent.delete(withApiPrefix(path)),
  };
}

export async function loginAs(email, password) {
  const res = await api().post('/auth/login').send({ email, password });
  return res;
}

export function auth(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}
