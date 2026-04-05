import http from 'node:http';
import { URL } from 'node:url';
import axios from 'axios';
import { BrowserWindow } from 'electron';
import { DEFAULT_CALLBACK_URL } from '../shared/constants.js';

const CLIENT_ID = 'REPLACE_WITH_GITHUB_CLIENT_ID';
const CLIENT_SECRET = 'REPLACE_WITH_GITHUB_CLIENT_SECRET';

export async function startGithubOAuth() {
  if (CLIENT_ID.includes('REPLACE') || CLIENT_SECRET.includes('REPLACE')) {
    throw new Error('Please set GitHub OAuth CLIENT_ID and CLIENT_SECRET in src/main/oauth.js');
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
  authUrl.searchParams.set('client_id', CLIENT_ID);
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
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
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
