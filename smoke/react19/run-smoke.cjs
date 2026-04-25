const { execSync } = require('child_process');
const { existsSync, readdirSync, rmSync } = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const smokeDir = __dirname;

const run = (command, cwd = rootDir, stdio = 'inherit') => {
  return execSync(command, { cwd, stdio, encoding: 'utf8' });
};

const clearOldTarballs = () => {
  const files = readdirSync(smokeDir);
  files
    .filter(file => /^axboot-stores-.*\.tgz$/.test(file))
    .forEach(file => rmSync(path.join(smokeDir, file), { force: true }));
};

const ensureCleanNodeModules = () => {
  const nodeModules = path.join(smokeDir, 'node_modules');
  if (existsSync(nodeModules)) {
    rmSync(nodeModules, { recursive: true, force: true });
  }
};

const cleanup = () => {
  clearOldTarballs();
  ensureCleanNodeModules();
};

const main = () => {
  cleanup();

  try {
    const packOutput = run('npm pack --pack-destination ./smoke/react19 --silent', rootDir, 'pipe');
    const tarball = packOutput.trim().split(/\r?\n/).pop();

    if (!tarball) {
      throw new Error('Failed to create npm pack tarball');
    }

    run('npm install --no-package-lock', smokeDir);
    run(`npm install --no-package-lock --no-save ./"${tarball}"`, smokeDir);
    run('npm run typecheck', smokeDir);
    run('npm run runtime', smokeDir);

    console.log(`smoke:react19 done (${tarball})`);
  } finally {
    cleanup();
  }
};

main();
