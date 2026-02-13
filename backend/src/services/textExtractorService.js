const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

/**
 * Extract text content from a file based on its MIME type.
 * Returns null for unsupported types (images, audio, video).
 */
async function extractText(filePath, mimeType) {
  try {
    // Text/CSV - read directly
    if (mimeType === 'text/plain' || mimeType === 'text/csv') {
      return fs.readFileSync(filePath, 'utf-8');
    }

    // PDF
    if (mimeType === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    }

    // Word .docx
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }

    // Word .doc (older format) - try mammoth, may not work for all .doc files
    if (mimeType === 'application/msword') {
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
      } catch {
        logger.warn({ filePath }, 'Could not parse .doc file with mammoth');
        return null;
      }
    }

    // Excel .xls/.xlsx
    if (
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      const XLSX = require('xlsx');
      const workbook = XLSX.readFile(filePath);
      const texts = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv.trim()) {
          texts.push(`Sheet: ${sheetName}\n${csv}`);
        }
      }
      return texts.join('\n\n') || null;
    }

    // PowerPoint .pptx
    if (
      mimeType === 'application/vnd.ms-powerpoint' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ) {
      const officeparser = require('officeparser');
      const text = await officeparser.parseOffice(filePath);
      return text || null;
    }

    // Images, audio, video - skip
    if (
      mimeType.startsWith('image/') ||
      mimeType.startsWith('audio/') ||
      mimeType.startsWith('video/')
    ) {
      return null;
    }

    logger.warn({ mimeType, filePath }, 'Unsupported MIME type for text extraction');
    return null;
  } catch (error) {
    logger.error({ err: error, filePath, mimeType }, 'Text extraction failed');
    throw error;
  }
}

module.exports = { extractText };
