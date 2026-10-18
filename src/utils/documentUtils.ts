/**
 * Shared document utilities for SmartShare
 * Follows Rule 2 & 4 (DRY Principle - Single Source of Truth)
 */

export async function shareDocument(url: string, title?: string): Promise<void> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const isPdf = url.includes('.pdf') || blob.type === 'application/pdf';
    const ext = isPdf ? 'pdf' : 'jpg';
    const mime = isPdf ? 'application/pdf' : 'image/jpeg';
    const cleanTitle = (title || 'document').replace(/[/\\?%*:|"<>]/g, '-');
    const file = new File([blob], `${cleanTitle}.${ext}`, { type: mime });
    
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: title || 'מסמך' });
    } else {
      downloadDocument(url, title);
    }
  } catch (e) {
    console.error('Error sharing document', e);
    downloadDocument(url, title);
  }
}

export async function downloadDocument(url: string, title?: string): Promise<void> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const isPdf = url.includes('.pdf') || blob.type === 'application/pdf';
    const ext = isPdf ? 'pdf' : 'jpg';
    const cleanTitle = (title || 'document').replace(/[/\\?%*:|"<>]/g, '-');
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = `${cleanTitle}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
  } catch (e) {
    console.error('Error downloading document via fetch blob, falling back to direct link', e);
    const a = document.createElement('a');
    a.href = url;
    a.download = title || 'document';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/**
 * Returns the best URL to view a document in an iframe.
 * On mobile/Chrome, direct PDF URLs in iframes trigger the browser's download placeholder card (with 'פתיחה' button).
 * Using Google Docs Viewer renders the actual PDF pages inline!
 */
export function getDocumentPreviewUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (url.includes('.pdf')) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  }
  return url;
}
