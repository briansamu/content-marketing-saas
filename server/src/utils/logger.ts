import winston from 'winston';
import dotenv from 'dotenv';
import util from 'util';

dotenv.config();

// Define a custom info interface to correctly type the splat property
interface CustomLogInfo extends winston.Logform.TransformableInfo {
  splat?: any[];
}

// Custom format function to handle multiple arguments and objects
const customFormat = winston.format((info: CustomLogInfo) => {
  // If there are additional metadata arguments, format them nicely
  if (info.splat && Array.isArray(info.splat)) {
    // Format objects and arrays properly
    const splatArgs = info.splat.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        return util.inspect(arg, { depth: 3, colors: true });
      }
      return arg;
    });

    // Check if message is already a string with placeholder
    if (typeof info.message === 'string' && info.message.includes('%')) {
      // Try to use printf-style formatting if the message appears to contain format specifiers
      try {
        info.message = util.format(info.message, ...splatArgs);
      } catch (err) {
        // If that fails, just append the arguments
        info.message = `${info.message} ${splatArgs.join(' ')}`;
      }
    } else {
      // Otherwise just append the arguments
      info.message = `${info.message} ${splatArgs.join(' ')}`;
    }
  }

  return info;
});

// Initialize the logger with console transport first
const logger = winston.createLogger({
  level: "debug",
  format: winston.format.combine(
    customFormat(),
    winston.format.errors({ stack: true })
  ),
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