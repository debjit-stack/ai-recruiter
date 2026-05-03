const fs = require('fs');
const csv = require('csv-parser');

/**
 * Parses a CSV file from disk into an array of candidate objects.
 * Normalises common column name variants (Name/name, Email/email, etc.)
 *
 * @param {string} filePath - Absolute path to the CSV file
 * @returns {Promise<Array>} - Array of { name, email, phone, rawProfileText }
 */
const parseCsvFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const candidates = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        candidates.push({
          name: row.Name || row.name || '',
          email: row.Email || row.email || '',
          phone: row.Phone || row.phone || '',
          rawProfileText:
            row.Profile ||
            row.Resume ||
            row.rawProfileText ||
            row.Summary ||
            JSON.stringify(row)
        });
      })
      .on('end', () => resolve(candidates))
      .on('error', (err) => reject(err));
  });
};

module.exports = { parseCsvFile };