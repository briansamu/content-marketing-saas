import dotenv from 'dotenv';
import https from 'https';
import querystring from 'querystring';

dotenv.config();

const BING_API_KEY = process.env.AZURE_API_KEY;
const BING_API_BASE_URL = process.env.AZURE_API_BASE_URL || 'api.bing.microsoft.com';

class AzureApiService {
  async spellCheck(text: string, market = 'en-US', mode = 'proof') {
    return new Promise((resolve, reject) => {
      const path = '/v7.0/spellcheck';
      const queryString = `?mkt=${market}&mode=${mode}`;

      const requestParams = {
        method: 'POST',
        hostname: BING_API_BASE_URL,
        path: path + queryString,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': text.length + 5,
          'Ocp-Apim-Subscription-Key': BING_API_KEY,
        }
      };

      const req = https.request(requestParams, (response) => {
        let body = '';
        response.on('data', (d) => {
          body += d;
        });

        response.on('end', () => {
          try {
            const responseBody = JSON.parse(body);
            resolve(responseBody);
          } catch (error) {
            reject(error);
          }
        });

        response.on('error', (e) => {
          reject(e);
        });
      });

      req.write("text=" + text);
      req.end();
    });
  }
}

export default AzureApiService;

