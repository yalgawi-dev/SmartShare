import type { Metadata } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';

interface Props {
  params: Promise<{ token: string }>;
}

const SITE_URL = 'https://smart-share-tvwn-delta.vercel.app';
const DEFAULT_MYSPACE_LOGO = `${SITE_URL}/myspace_logo.png`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  let title = 'MySpace — צפייה במסמך משותף';
  let description = 'צפייה מאובטחת במסמכים ותיקיות משותפות באפליקציית MySpace.';
  let previewImage = DEFAULT_MYSPACE_LOGO;

  try {
    const snap = await adminDb.collection('shared_links').doc(token).get();
    if (snap.exists) {
      const data = snap.data() as any;
      const icon = data?.itemType === 'folder' ? '📁' : '📄';
      if (data?.name) {
        title = `${icon} ${data.name} | MySpace`;
      }
      if (data?.spaceTitle) {
        description = `שיתוף מאובטח מתוך "${data.spaceTitle}" ב-MySpace`;
      }
      if (typeof data?.spaceLogoUrl === 'string' && data.spaceLogoUrl.startsWith('http')) {
        previewImage = data.spaceLogoUrl;
      }
    }
  } catch (err) {
    console.warn('Error generating share metadata:', err);
  }

  const shareUrl = `${SITE_URL}/share/${token}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: shareUrl,
      siteName: 'MySpace',
      images: [
        {
          url: previewImage,
          width: 512,
          height: 512,
          alt: title,
        },
      ],
      type: 'website',
      locale: 'he_IL',
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [previewImage],
    },
  };
}

export default function ShareTokenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
