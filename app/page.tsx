import MdaSimulator from '@/components/MdaSimulator';

/**
 * דף הבית של סימולטור מד"א.
 * הקובץ מוגדר כ-Server Component כברירת מחדל, 
 * והוא טוען את קומפוננטת הלקוח שמנהלת את הצאט.
 */
export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950">
      <MdaSimulator />
    </main>
  );
}

// הגדרות Metadata לקידום האפליקציה כ-Web App
export const metadata = {
  title: 'סימולטור מע"ר מד"א',
  description: 'אימון אינטראקטיבי על סכמת ABCDE ופרוטוקולי הצלת חיים',
};
