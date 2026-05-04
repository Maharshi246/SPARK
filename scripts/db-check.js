import dotenv from 'dotenv';
import dns from 'dns/promises';
import mongoose from 'mongoose';

dotenv.config();

const buildSeedUriFromSrvUri = (srvUri, seedlist, replicaSet) => {
  const parsed = new URL(srvUri);

  const username = parsed.username ? encodeURIComponent(parsed.username) : '';
  const password = parsed.password ? encodeURIComponent(parsed.password) : '';
  const authPrefix = username
    ? `${username}${password ? `:${password}` : ''}@`
    : '';

  const database = parsed.pathname?.replace(/^\//, '') || '';
  const seedHosts = seedlist
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => (h.includes(':') ? h : `${h}:27017`))
    .join(',');

  const params = new URLSearchParams(parsed.search);
  if (replicaSet && !params.has('replicaSet')) params.set('replicaSet', replicaSet);
  if (!params.has('authSource')) params.set('authSource', 'admin');
  if (!params.has('tls') && !params.has('ssl')) params.set('tls', 'true');

  const query = params.toString();
  return `mongodb://${authPrefix}${seedHosts}/${database}${query ? `?${query}` : ''}`;
};

const redactMongoUri = (uri = '') => {
  try {
    const parsed = new URL(uri);
    if (parsed.password) parsed.password = '***';
    if (parsed.username) parsed.username = '***';
    return parsed.toString();
  } catch {
    return uri ? '[unparseable mongo uri]' : '[missing mongo uri]';
  }
};

const main = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is missing in .env');
    process.exit(1);
  }

  console.log('Node:', process.version);
  console.log('MONGO_URI (redacted):', redactMongoUri(uri));

  // Quick DNS SRV check for mongodb+srv:// URIs
  if (uri.startsWith('mongodb+srv://')) {
    const hostname = uri.replace('mongodb+srv://', '').split('@').pop()?.split('/')[0];
    if (hostname) {
      try {
        const records = await dns.resolveSrv(`_mongodb._tcp.${hostname}`);
        console.log('SRV records:', records.map(r => `${r.name}:${r.port}`).join(', '));
      } catch (err) {
        console.error('SRV lookup failed:', err?.code || err?.message || err);
      }
    }
  }

  try {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 8000,
      });
    } catch (err) {
      const seedlist = process.env.MONGO_SEEDLIST;
      const replicaSet = process.env.MONGO_REPLICA_SET;
      const isSrvDnsError =
        uri.startsWith('mongodb+srv://') &&
        (err?.code === 'ECONNREFUSED' || String(err?.message || '').includes('querySrv'));

      if (isSrvDnsError && seedlist) {
        const fallbackUri = buildSeedUriFromSrvUri(uri, seedlist, replicaSet);
        await mongoose.connect(fallbackUri, {
          serverSelectionTimeoutMS: 8000,
        });
        console.log('MongoDB: CONNECTED (seedlist fallback)');
      } else {
        throw err;
      }
    }

    console.log('MongoDB: CONNECTED');
    const pingResult = await mongoose.connection.db.admin().ping();
    console.log('MongoDB: PING OK', pingResult);
    await mongoose.disconnect();
    console.log('MongoDB: DISCONNECTED');
    process.exit(0);
  } catch (err) {
    console.error('MongoDB connect FAILED');
    console.error('name:', err?.name);
    console.error('code:', err?.code);
    console.error('message:', err?.message);
    if (err?.cause) {
      console.error('cause:', err.cause);
    }
    process.exit(1);
  }
};

main();
