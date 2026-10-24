import type { Metadata } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  let title = 'SmartShare | מרחב משותף';
  let description = 'הוזמנת להצטרף ולשתף פעולה במרחב ב-SmartShare';
  const siteUrl = 'https://smart-share-tvwn-delta.vercel.app';
  const spaceUrl = siteUrl + '/space/' + id;
  try {
    if (adminDb) {
      const snap = await adminDb.collection('spaces').doc(id).get();
      if (snap.exists) {
        const spaceData = snap.data();
        const spaceTitle = spaceData?.title || 'מרחב משותף';
        title = 'הזמנה למרחב: ' + spaceTitle;
        description = 'הוזמנת על ידי שותפי המרחב להצטרף ל-' + spaceTitle + ' ב-SmartShare. לחץ להצטרפות וכניסה ישירה.';
      }
    }
  } catch (error) {
    console.error('Error generating space metadata:', error);
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: spaceUrl,
      siteName: 'SmartShare',
      images: [{ url: siteUrl + '/icons/icon-512x512.png', width: 512, height: 512, alt: title }],
      type: 'website',
      locale: 'he_IL',
    },
    twitter: { card: 'summary', title, description, images: [siteUrl + '/icons/icon-512x512.png'] }
  };
}

export default function SpaceLayout({ children }: { children: React.ReactNode }) { return <>{children}</>; }