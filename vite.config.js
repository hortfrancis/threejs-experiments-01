import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

const root = import.meta.dirname;

// The dev server serves any index.html it finds, so this is only needed for
// production builds: Rollup has to be told every page it should bundle.
// Reading the directory means a new experiment folder needs no config change.
const experiments = fs
  .readdirSync(path.join(root, 'experiments'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => fs.existsSync(path.join(root, 'experiments', name, 'index.html')));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        menu: path.join(root, 'index.html'),
        ...Object.fromEntries(
          experiments.map((name) => [name, path.join(root, 'experiments', name, 'index.html')]),
        ),
      },
    },
  },
});
