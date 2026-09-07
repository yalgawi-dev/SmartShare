'use client';

import Link from 'next/link';

export default function WelcomeEmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4rem 1rem',
      textAlign: 'center',
      animation: 'fadeIn 0.5s ease-out'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        fontSize: '2.5rem',
        fontWeight: '900',
        marginBottom: '0.5rem',
        letterSpacing: '-0.02em'
      }}>
        ברוכים הבאים ל-SmartShare
      </div>
      <p style={{
        fontSize: '1.2rem',
        color: 'var(--text-secondary)',
        marginBottom: '4rem',
        maxWidth: '500px',
        lineHeight: '1.5'
      }}>
        מרחב אחד חכם לכל מה שחשוב – לבד, או יחד עם השותפים שלך.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '2rem',
        width: '100%',
        maxWidth: '700px'
      }}>
        {/* Template Option */}
        <Link href="/space/new?template=finance" style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '2px solid transparent',
            borderRadius: '24px',
            padding: '2.5rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
            position: 'relative',
            overflow: 'hidden'
          }}
          className="welcome-card"
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 20px 40px rgba(99, 102, 241, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          }}>
            <div style={{
              fontSize: '3.5rem',
              marginBottom: '1rem',
              animation: 'float 3s ease-in-out infinite'
            }}>
              🚀
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.4rem' }}>
              התחל מתבנית מוכנה
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.4' }}>
              ניהול התחשבנויות, תיק רפואי ועוד. 
              הכל מוגדר ומורכב מראש בשבילך.
            </p>
          </div>
        </Link>

        {/* Blank Canvas Option */}
        <Link href="/space/new?template=blank" style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '2px dashed var(--border-light)',
            borderRadius: '24px',
            padding: '2.5rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--text-secondary)';
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.background = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-light)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.background = 'var(--bg-card)';
          }}>
            <div style={{
              fontSize: '3.5rem',
              marginBottom: '1rem',
              filter: 'grayscale(100%)'
            }}>
              🧩
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.4rem' }}>
              הרכב בעצמך 
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.4' }}>
              מרחב נקי לחלוטין. התחל מאפס והוסף כלים בהתאם לצורך כמו לגו.
            </p>
          </div>
        </Link>
      </div>

      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
