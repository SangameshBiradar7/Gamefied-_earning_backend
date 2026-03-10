/**
 * YouTube URL utility functions
 * Converts various YouTube URL formats to embed format
 */

/**
 * Extract YouTube video ID from various URL formats
 * @param {string} url - YouTube URL
 * @returns {string|null} - YouTube video ID or null if not valid
 */
function extractYouTubeId(url) {
  if (!url) return null;

  // Regular YouTube URLs
  // https://www.youtube.com/watch?v=VIDEO_ID
  // https://youtu.be/VIDEO_ID
  // https://www.youtube.com/embed/VIDEO_ID
  // https://www.youtube.com/v/VIDEO_ID
  // https://www.youtube.com/shorts/VIDEO_ID

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Convert YouTube URL to embed URL
 * @param {string} url - YouTube URL
 * @returns {string} - YouTube embed URL
 */
function convertToEmbedUrl(url) {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    return '';
  }
  return `https://www.youtube.com/embed/${videoId}`;
}

/**
 * Check if URL is a valid YouTube URL
 * @param {string} url - URL to check
 * @returns {boolean} - True if valid YouTube URL
 */
function isValidYouTubeUrl(url) {
  if (!url) return false;
  return extractYouTubeId(url) !== null;
}

/**
 * Get YouTube thumbnail URL
 * @param {string} url - YouTube URL or video ID
 * @param {string} quality - Thumbnail quality (default, medium, high, max)
 * @returns {string} - Thumbnail URL
 */
function getYouTubeThumbnail(url, quality = 'default') {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    return '';
  }

  const qualityMap = {
    default: 'https://img.youtube.com/vi/default.jpg',
    medium: 'https://img.youtube.com/vi/mqdefault.jpg',
    high: 'https://img.youtube.com/vi/hqdefault.jpg',
    max: 'https://img.youtube.com/vi/maxresdefault.jpg'
  };

  return qualityMap[quality]?.replace('default', videoId) || '';
}

module.exports = {
  extractYouTubeId,
  convertToEmbedUrl,
  isValidYouTubeUrl,
  getYouTubeThumbnail
};
