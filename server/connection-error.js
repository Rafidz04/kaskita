const redact = (value) => String(value).replace(
  /mongodb(?:\+srv)?:\/\/[^\s'"<>]+/gi,
  '[redacted MongoDB URI]',
);

function errorDetails(error, seen = new Set(), depth = 0) {
  if (error == null) return null;
  if (typeof error !== 'object') return { message: redact(error) };
  if (seen.has(error) || depth > 4) return { message: '[nested error omitted]' };
  seen.add(error);

  const details = {};
  for (const key of ['name', 'message', 'code', 'syscall', 'hostname', 'stack']) {
    const value = error[key];
    if (typeof value === 'string') details[key] = redact(value);
    else if (typeof value === 'number') details[key] = value;
  }
  if (error.cause) details.cause = errorDetails(error.cause, seen, depth + 1);
  if (Array.isArray(error.errors)) {
    details.errors = error.errors.map((nested) => errorDetails(nested, seen, depth + 1));
  }
  return details;
}

export function describeConnectionError(error) {
  const details = errorDetails(error);
  const topology = error?.reason;
  if (topology?.servers instanceof Map) {
    details.topology = {
      type: topology.type,
      servers: [...topology.servers.values()].map((server) => ({
        address: redact(server.address),
        type: server.type,
        error: errorDetails(server.error),
      })),
    };
  }
  return details;
}
