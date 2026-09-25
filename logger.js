'use strict';
// Winston logger. Every line is prefixed with the active log-context tag
// `[scope|user|entity|jobId]` (see lib/log-context.js). Writes to the console
// and to app.log. Logs stay in one language (German here) — they are not
// user-facing, so they are exempt from the i18n rule.

const winston = require('winston');
const path = require('path');
const { contextTag } = require('./lib/log-context');

const LOG_FILE = process.env.LOG_PATH || path.join(__dirname, 'app.log');

const fmt = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.printf(({ timestamp, level, message }) => {
    const tag = contextTag();
    return `${timestamp} ${level.toUpperCase()} ${tag ? tag + ' ' : ''}${message}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fmt,
  transports: [
    new winston.transports.Console(),
    // Self-rotating: 5 MB × 5 files, `tailable` keeps the newest lines in the
    // base file (app.log → app1.log → …). No logrotate needed on the LXC.
    new winston.transports.File({ filename: LOG_FILE, maxsize: 5 * 1024 * 1024, maxFiles: 5, tailable: true }),
  ],
});

module.exports = logger;
