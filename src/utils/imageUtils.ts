
export const transformGoogleDriveUrl = (url: string): string => {
  if (!url) return '';
  
  // If it's already a direct Google Drive link, return it
  if (url.includes('lh3.googleusercontent.com/d/')) {
    return url;
  }

  // Handle standard Google Drive sharing links
  // Format: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }

  // Handle other Google Drive link formats if necessary
  // Format: https://drive.google.com/open?id=FILE_ID
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
  }

  return url;
};
