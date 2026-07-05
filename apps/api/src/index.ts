import './env.js';
import { buildServer } from './server.js';

// Railway (and most PaaS) inject PORT; fall back to API_PORT for local dev.
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);

const app = await buildServer();
app
  .listen({ port, host: '0.0.0.0' })
  .then(() => app.log.info(`Tulip API listening on :${port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
