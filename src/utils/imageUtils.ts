
/**
 * Transforms a Google Drive URL into a more reliable format for direct image embedding.
 * Handles standard drive.google.com/uc?id=ID and drive.google.com/open?id=ID formats.
 * Transforms them to lh3.googleusercontent.com/d/ID format which is better for CORS.
 */
export const transformGoogleDriveUrl = (url: string): string => {
  if (!url) return '';
  
  // If it's already in the lh3 format, return as is
  if (url.includes('lh3.googleusercontent.com/d/')) return url;
  
  // Match standard Google Drive share links or direct download links
  const driveMatch = url.match(/(?:drive\.google\.com\/(?:uc|open|file\/d\/|thumbnail\?id=)|docs\.google\.com\/file\/d\/)([a-zA-Z0-9_-]+)/);
  
  if (driveMatch && driveMatch[1]) {
    const fileId = driveMatch[1];
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  
  return url;
};
