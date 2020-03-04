const winston = require('winston');
const config = require('../../config');
const { combine, timestamp, printf } = winston.format;

// Setup the default logger
const myFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
});
const consoleTransport = new winston.transports.Console({
    level: config.LOG_LEVEL,
    format: combine(
        winston.format.colorize(),
        timestamp(),
        myFormat
        ),
    handleExceptions: true
});
winston.add(consoleTransport);
module.exports = winston;