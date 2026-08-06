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

export function api() {
  return request(getApp());
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
