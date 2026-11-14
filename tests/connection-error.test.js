import assert from 'node:assert/strict';
import test from 'node:test';
import { describeConnectionError } from '../server/connection-error.js';

test('includes per-server errors and nested connection failures in JSON logs', () => {
  const timeout = Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' });
  const network = new Error('TLS connection failed', { cause: timeout });
  const error = new Error('Could not connect to any servers');
  error.reason = {
    type: 'ReplicaSetNoPrimary',
    servers: new Map([['atlas:27017', {
      address: 'atlas:27017', type: 'Unknown', error: network,
    }]]),
  };
  const logged = JSON.parse(JSON.stringify(describeConnectionError(error)));
  assert.equal(logged.message, error.message);
  assert.equal(logged.topology.type, 'ReplicaSetNoPrimary');
  assert.equal(logged.topology.servers[0].error.cause.code, 'ETIMEDOUT');
});

test('redacts MongoDB URIs in messages, stacks, and nested errors', () => {
  const uri = 'mongodb+srv://user:private-password@cluster.mongodb.net/db?authSource=admin';
  const error = new Error(`Failed connecting to ${uri}`, {
    cause: new Error('mongodb://user:other-password@host:27017/db'),
  });
  const logged = JSON.stringify(describeConnectionError(error));
  assert.ok(logged.includes('[redacted MongoDB URI]'));
  assert.ok(!logged.includes('private-password'));
  assert.ok(!logged.includes('other-password'));
  assert.ok(!logged.includes('authSource'));
});

test('handles circular causes and preserves aggregate network error codes', () => {
  const error = new AggregateError([
    Object.assign(new Error('DNS lookup failed'), { code: 'ENOTFOUND' }),
  ], 'Connection failed');
  error.cause = error;
  const logged = JSON.parse(JSON.stringify(describeConnectionError(error)));
  assert.equal(logged.errors[0].code, 'ENOTFOUND');
  assert.equal(logged.cause.message, '[nested error omitted]');
});
