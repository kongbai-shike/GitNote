import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import axios from 'axios';
import { BrowserWindow } from 'electron';
import { DEFAULT_CALLBACK_URL } from '../shared/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const entries = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    value = value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    entries[key] = value;
  }

  return entries;
}

function readOAuthConfig() {
  const envCandidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env')
  ];
  const jsonCandidates = [
    path.resolve(process.cwd(), 'gitnote.oauth.json'),
    path.resolve(path.dirname(process.execPath), 'gitnote.oauth.json')
  ];

  const mergedEnv = envCandidates.reduce((accumulator, candidate) => {
    return { ...accumulator, ...parseEnvFile(candidate) };
  }, {});

  const jsonConfig = jsonCandidates.reduce((accumulator, candidate) => {
    if (!fs.existsSync(candidate)) {
      return accumulator;
    }

    try {
      return { ...accumulator, ...JSON.parse(fs.readFileSync(candidate, 'utf8')) };
    } catch {
      return accumulator;
    }
  }, {});

  const clientId =
    process.env.GITNOTE_GITHUB_CLIENT_ID ||
    mergedEnv.GITNOTE_GITHUB_CLIENT_ID ||
    jsonConfig.clientId ||
    '';
  const clientSecret =
    process.env.GITNOTE_GITHUB_CLIENT_SECRET ||
    mergedEnv.GITNOTE_GITHUB_CLIENT_SECRET ||
    jsonConfig.clientSecret ||
    '';

  return {
    clientId,
    clientSecret
  };
}

export async function startGithubOAuth() {
  const { clientId, clientSecret } = readOAuthConfig();

  if (!clientId || !clientSecret) {
    throw new Error(
      'GitHub OAuth is not configured. Add GITNOTE_GITHUB_CLIENT_ID and GITNOTE_GITHUB_CLIENT_SECRET to .env, or place gitnote.oauth.json next to GitNote.exe.'
    );
  }

  const callbackUrl = DEFAULT_CALLBACK_URL;
  const callback = new URL(callbackUrl);

  const codePromise = new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const requestUrl = new URL(req.url, callback.origin);
      const code = requestUrl.searchParams.get('code');
      const error = requestUrl.searchParams.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body><h2>GitNote login complete.</h2><p>You can return to the app.</p></body></html>');
      server.close();

      if (error) {
        reject(new Error(`GitHub OAuth error: ${error}`));
        return;
      }

      resolve(code);
    });

    server.on('error', reject);
    server.listen(Number(callback.port || 80), callback.hostname);
  });

  const authWindow = new BrowserWindow({
    width: 900,
    height: 760,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('scope', 'repo read:user');

  await authWindow.loadURL(authUrl.toString());

  const code = await new Promise((resolve, reject) => {
    authWindow.on('closed', () => reject(new Error('OAuth window closed before authorization completed')));
    codePromise.then((value) => {
      resolve(value);
      if (!authWindow.isDestroyed()) {
        authWindow.close();
      }
    }).catch(reject);
  });

  const tokenResponse = await axios.post(
    'https://github.com/login/oauth/access_token',
    {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: callbackUrl
    },
    {
      headers: {
        Accept: 'application/json'
      }
    }
  );

  if (!tokenResponse.data.access_token) {
    throw new Error(tokenResponse.data.error_description || 'Failed to exchange GitHub access token.');
  }

  return tokenResponse.data.access_token;
}
