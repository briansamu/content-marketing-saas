import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the logger with console transport first
const logger = winston.createLogger({
  level: "debug",
  transports: [
    // Always add a console transport regardless of environment
    // to prevent "no transports" warning
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.combine(
          winston.format.label({
            label: '[LOGGER]'
          }),
          winston.format.timestamp({
            format: "HH:mm:ss"
          }),
          winston.format.printf(
            info => ` ${info.label}  ${info.timestamp}  ${info.level} : ${info.message}`
          ),
          winston.format.colorize({
            all: true
          })
        )
      )
    })
  ],
});

// Only add OpenSearch transport in production
if (process.env.NODE_ENV === 'production') {
  const initOpenSearch = async () => {
    try {
      const { OpensearchTransport } = await import('winston-opensearch');

      // Ensure ELASTICSEARCH_URL has a protocol prefix
      let esUrl = process.env.ELASTICSEARCH_URL || '';
      if (esUrl && !esUrl.startsWith('http://') && !esUrl.startsWith('https://')) {
        esUrl = `https://${esUrl}`;
      }

      const esTransportOpts = {
        level: 'info',
        indexPrefix: 'server-logs',
        clientOpts: {
          node: esUrl,
          auth: {
            username: process.env.ELASTICSEARCH_USERNAME || '',
            password: process.env.ELASTICSEARCH_PASSWORD || ''
          },
          ssl: {
            rejectUnauthorized: false // In case of self-signed certificates
          }
        }
      };

      console.log(`Connecting to OpenSearch at: ${esUrl}`);
      const esTransport = new OpensearchTransport(esTransportOpts);
      logger.add(esTransport);
    } catch (error) {
      console.error('Failed to initialize OpenSearch transport:', error);
      // Log but continue with console transport only
    }
  };

  initOpenSearch().catch(error => {
    console.error('OpenSearch initialization error:', error);
  });
}

export default logger;