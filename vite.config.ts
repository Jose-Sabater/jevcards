import { defineConfig, loadEnv } from 'vite';
import { createApi } from './server/api.ts';

export default defineConfig(({ mode }) => {
  // Shell variables win over .env, as on the production server.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return {
    plugins: [
      {
        name: 'jev-cards-api',
        configureServer(server) {
          const api = createApi(env);
          server.middlewares.use(async (req, res, next) => {
            if (!(await api(req, res))) next();
          });
        },
      },
    ],
    build: { target: 'es2022' },
  };
});
