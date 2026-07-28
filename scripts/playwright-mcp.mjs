import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const configPath = '/Users/gabrielberger/Documents/Mahou Prints/imagegen/playwright-mcp.config.json';
let activeProfile = 'Default';
let userDataDir = '/Users/gabrielberger/ImageGen/playwright-profile';

try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.activeProfile) activeProfile = config.activeProfile;
    if (config.userDataDir) userDataDir = config.userDataDir;
  }
} catch (e) {
  console.error('Erro ao ler config do playwright:', e);
}

// Inicia o servidor do Playwright passando as flags do Chrome para o navegador interno (quando usar modo UI/headed, though mcp playwright often uses context arguments)
// O playwright-mcp aceita configuracao local ou customizada?
// actually we need to launch the npx @playwright/mcp, but we can't easily pass the user data dir via CLI args to the MCP wrapper directly unless it supports it.
