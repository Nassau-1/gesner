// Stage installer-only changes without accessing a signing key or rebuilding the CRX.
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../deployment/mci/', import.meta.url));
export async function stageIntune(config, output) {
  if (!/^[a-p]{32}$/.test(config.extensionId) || !/^\d+\.\d+\.\d+(\.\d+)?$/.test(config.version)
    || config.tenantId !== 'd9ef70ce-45e1-4de9-9547-4a1fa301bf70'
    || config.updateUrl !== 'https://github.com/Nassau-1/gesner/releases/download/mci-channel/gesner-mci-updates.xml') throw new Error('Invalid MCI configuration');
  await mkdir(output, { recursive: true });
  for (const file of ['Core.ps1', 'Install.ps1', 'Uninstall.ps1']) await copyFile(path.join(source, file), path.join(output, file));
  const core = await readFile(path.join(source, 'Core.ps1'), 'utf8');
  const template = await readFile(path.join(source, 'Detect.ps1'), 'utf8');
  const detector = template.replace('__CORE__', () => core).replaceAll('__EXTENSION_ID__', config.extensionId).replaceAll('__VERSION__', config.version);
  await writeFile(path.join(output, 'Detect.ps1'), detector);
  await writeFile(path.join(output, 'config.json'), JSON.stringify(config, null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [configFile, output] = process.argv.slice(2);
  if (!configFile || !output) throw new Error('Usage: node scripts/stage-intune.mjs <config.json> <output-dir>');
  await stageIntune(JSON.parse((await readFile(configFile, 'utf8')).replace(/^\uFEFF/, '')), path.resolve(output));
}
