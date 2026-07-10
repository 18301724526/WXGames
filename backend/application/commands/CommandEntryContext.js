'use strict';

const {
  buildCommandEnvelopeErrorPayload,
  isCommandEnvelopeError,
  normalizeCommandEnvelope,
  summarizeCommand,
} = require('./CommandEnvelope');
const { inspectCommandOwners } = require('./CommandOwnerResolver');

function appendReport(req, report) {
  req.commandReports = Array.isArray(req.commandReports) ? req.commandReports : [];
  req.commandReports.push(report);
  req.commandEnvelope = report.envelope;
  req.commandOwnerResolution = report.ownerResolution;
}

function prepareCommandEntry(req = {}, options = {}) {
  try {
    const envelope = normalizeCommandEnvelope(req, options);
    const ownerResolution = inspectCommandOwners(envelope, options.ownerResolver);
    const report = {
      schema: 'command-entry-report-v1',
      mode: options.mode || 'report-only',
      inventoryId: options.inventoryId || '',
      envelope,
      command: summarizeCommand(envelope),
      idempotencyClassification: envelope.compatibility.idempotencyClassification,
      ownerResolution,
      recordedAt: new Date().toISOString(),
    };
    appendReport(req, report);
    options.reporter?.(report);
    if (options.requireOwner && ownerResolution.status !== 'resolved') {
      return {
        ok: false,
        statusCode: 400,
        payload: {
          success: false,
          error: ownerResolution.error,
          message: ownerResolution.message,
          requiredFields: ownerResolution.requiredFields,
        },
        report,
      };
    }
    return { ok: true, envelope, ownerResolution, report };
  } catch (error) {
    if (!isCommandEnvelopeError(error)) throw error;
    const report = {
      schema: 'command-entry-report-v1',
      mode: options.mode || 'report-only',
      inventoryId: options.inventoryId || '',
      envelope: null,
      command: null,
      idempotencyClassification: 'invalid-envelope',
      ownerResolution: null,
      error: error.code,
      recordedAt: new Date().toISOString(),
    };
    appendReport(req, report);
    options.reporter?.(report);
    return {
      ok: false,
      statusCode: error.status || 400,
      payload: buildCommandEnvelopeErrorPayload(error),
      report,
    };
  }
}

function sendCommandEntryError(res, entry) {
  return res.status(entry.statusCode || 400).json(entry.payload || {
    success: false,
    error: 'COMMAND_ENTRY_INVALID',
    message: 'Command entry is invalid',
  });
}

module.exports = {
  appendReport,
  prepareCommandEntry,
  sendCommandEntryError,
};
