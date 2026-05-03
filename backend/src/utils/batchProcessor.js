/**
 * Processes an array of async tasks in sequence with a delay between each.
 * Used to avoid hitting Gemini API rate limits (429 errors).
 *
 * @param {Array} items - Array of items to process
 * @param {Function} asyncFn - Async function to call for each item: asyncFn(item) => Promise
 * @param {number} delayMs - Milliseconds to wait between each item (default: 2000)
 * @returns {Promise<Array>} - Array of { success, result, error } objects
 */
const processBatch = async (items, asyncFn, delayMs = 2000) => {
  const results = [];

  for (const item of items) {
    try {
      const result = await asyncFn(item);
      results.push({ success: true, result });
    } catch (error) {
      console.error(`Batch item failed:`, error.message);
      results.push({ success: false, error: error.message });
    }

    if (items.indexOf(item) < items.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
};

module.exports = { processBatch };