import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('📦 Building production bundle...');
execSync('npm run build', { stdio: 'inherit' });

console.log('🚀 Deploying to gh-pages branch...');
const tempDir = '/tmp/gh-pages-deploy-' + Date.now();
try {
  execSync(`git fetch origin gh-pages`, { stdio: 'inherit' });
  execSync(`git worktree add ${tempDir} origin/gh-pages`, { stdio: 'inherit' });
  
  const files = fs.readdirSync(tempDir);
  for (const f of files) {
    if (f !== '.git') {
      fs.rmSync(path.join(tempDir, f), { recursive: true, force: true });
    }
  }
  
  execSync(`cp -r dist/* ${tempDir}/`, { stdio: 'inherit' });
  execSync(`cd ${tempDir} && git add -A && git commit --allow-empty -m "deploy: $(date -u)" && git push origin HEAD:gh-pages`, { stdio: 'inherit' });
  console.log('✓ Successfully deployed to gh-pages!');
} finally {
  try {
    execSync(`git worktree remove --force ${tempDir}`);
  } catch {}
}
