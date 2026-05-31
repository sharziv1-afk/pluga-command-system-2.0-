'use client';

import React from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  CheckSquare, 
  Clock, 
  Truck, 
  Users,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useApp } from '@/lib/context/AppContext';

function getDashboardData(role: string) {
  const normRole = role.replace(/["״]/g, '"'); // Normalize quotes
  
  if (normRole.includes('מ"פ') || normRole.includes('סמ"פ') || normRole.includes('ע. מ"פ')) {
    return {
      title: 'לוח בקרה - פיקוד הפלוגה',
      stats: [
        { title: 'סד"כ פלוגתי פעיל', value: '86%', sub: '95 מתוך 110 חיילים', icon: Users, color: 'cyan' },
        { title: 'משימות בביצוע', value: '14', sub: '5 משימות דחופות פלוגתיות', icon: CheckSquare, color: 'orange' },
        { title: 'דרישות לוגיסטיקה פתוחות', value: '8', sub: '3 ממתינות לאישור רס"פ', icon: Truck, color: 'none' },
        { title: 'כשירות מבצעית פלוגתית', value: '92%', sub: 'עלייה של 2% השבוע', icon: Activity, color: 'cyan' },
      ],
      recentTasks: [
        { id: 'TSK-101', title: 'הכנת ציוד לתרח"ט פלוגתי', target: 'כלל הפלוגה', status: 'בתהליך', due: 'היום, 18:00' },
        { id: 'TSK-102', title: 'אישור תוכניות (אש"ת) מול מפקד הגדוד', target: 'סגל פלוגה', status: 'ממתין לאישור', due: 'מחר, 10:00' },
        { id: 'TSK-103', title: 'רענון פקודות בטיחות שבועיות בנשק', target: 'כלל הפלוגה', status: 'חדש', due: 'בעוד יומיים' },
        { id: 'TSK-104', title: 'תיאומי מטווחים מול חמ"ל חטיבה', target: 'סמ"פ', status: 'הושלם', due: 'בוצע אתמול' },
      ],
      alerts: [
        { title: 'מחסור במחסניות טקטיות', text: 'מחלקה 3 דיווחה על פער של 14 מחסניות עבור פק"ל נגב.', tone: 'orange', icon: AlertTriangle },
        { title: 'סיכום פורום מוביל חסר', text: 'טרם התקבל סיכום מפקדים יומי ממחלקה 4.', tone: 'blue', icon: Clock },
        { title: 'ביקורת כשירות קשר עברה', text: 'מחלקות 1 ו-2 הושלמו ללא חריגות ציוד.', tone: 'green', icon: CheckCircle },
      ]
    };
  }

  if (normRole.includes('מ"מ')) {
    return {
      title: 'לוח בקרה - מפקד מחלקה',
      stats: [
        { title: 'סד"כ מחלקתי פעיל', value: '91%', sub: '27 מתוך 30 חיילים', icon: Users, color: 'cyan' },
        { title: 'משימות מחלקתיות', value: '5', sub: '2 משימות דחופות למחלקה', icon: CheckSquare, color: 'orange' },
        { title: 'דרישות לוגיסטיקה מחלקתיות', value: '3', sub: 'ממתינות לטיפול רס"פ', icon: Truck, color: 'none' },
        { title: 'כשירות מחלקתית', value: '88%', sub: 'כשירות קליעה וקשר', icon: Activity, color: 'cyan' },
      ],
      recentTasks: [
        { id: 'TSK-201', title: 'השלמת מטווחים והסמכות כשירות קליעה במחלקה', target: 'כיתה 1', status: 'בתהליך', due: 'היום, 18:00' },
        { id: 'TSK-202', title: 'אישור פקודת מבצע לתרגיל מחלקתי רטוב', target: 'מפקדי כיתות', status: 'ממתין לאישור', due: 'מחר, 10:00' },
        { id: 'TSK-203', title: 'השלמת רישום חוסרי ציוד ב\' למסדר רס"פ', target: 'כיתה 2', status: 'חדש', due: 'בעוד יומיים' },
        { id: 'TSK-204', title: 'שיעור עזרה ראשונה שבועי למחלקה', target: 'כלל המחלקה', status: 'הושלם', due: 'בוצע אתמול' },
      ],
      alerts: [
        { title: 'פער מכשירי קשר תקינים במחלקה', text: 'דווח על פער של 5 מכשירי קשר תקינים. הרס"פ מטפל.', tone: 'orange', icon: AlertTriangle },
        { title: 'הגשת סיכום פורום מוביל', text: 'נא להגיש את הסיכום היומי למפקד הפלוגה.', tone: 'blue', icon: Clock },
        { title: 'כשירות רפואית מחלקתית תקינה', text: '100% מהמחלקה בעלי כשירות רפואית פעילה.', tone: 'green', icon: CheckCircle },
      ]
    };
  }

  if (normRole.includes('מ"כ')) {
    return {
      title: 'לוח בקרה - מפקד כיתה',
      stats: [
        { title: 'סד"כ כיתתי פעיל', value: '88%', sub: '8 מתוך 9 חיילים', icon: Users, color: 'cyan' },
        { title: 'משימות כיתתיות', value: '3', sub: 'משימה אחת דחופה', icon: CheckSquare, color: 'orange' },
        { title: 'ציוד כיתתי חסר', value: '2', sub: 'פנסים טקטיים ואפודי מגן', icon: Truck, color: 'none' },
        { title: 'כשירות הכיתה', value: '90%', sub: 'כשירות קליעה', icon: Activity, color: 'cyan' },
      ],
      recentTasks: [
        { id: 'TSK-301', title: 'הכנת אפודים וביקורת ציוד לחימה כיתתי', target: 'חיילי כיתה', status: 'בתהליך', due: 'היום, 18:00' },
        { id: 'TSK-302', title: 'השלמת מטווח לילה של לוחמי הכיתה', target: 'לוחמים חריגים', status: 'לביצוע', due: 'מחר, 20:00' },
        { id: 'TSK-303', title: 'שיעור עזרה ראשונה כיתתי', target: 'כלל הכיתה', status: 'הושלם', due: 'בוצע אתמול' },
      ],
      alerts: [
        { title: 'מחסור בפנסי ראש טקטיים', text: 'חסרים 4 פנסי ראש אדומים לעבודה חשוכה בכיתה.', tone: 'orange', icon: AlertTriangle },
        { title: 'השלמת דיווח נוכחות כיתתי', text: 'נא להעביר דיווח נוכחות בוקר לסמל המחלקה.', tone: 'blue', icon: Clock },
        { title: 'ניקוי נשקים שבועי הושלם', text: 'כלל כלי הנשק של הכיתה נוקו ונבדקו.', tone: 'green', icon: CheckCircle },
      ]
    };
  }

  if (normRole.includes('רס"פ') || normRole.includes('לוגיסטיקה')) {
    return {
      title: 'לוח בקרה - לוגיסטיקה פלוגתית',
      stats: [
        { title: 'דרישות בטיפול', value: '6', sub: '3 דרישות חדשות', icon: Truck, color: 'cyan' },
        { title: 'משימות לוגיסטיות', value: '4', sub: '2 משימות דחופות', icon: CheckSquare, color: 'orange' },
        { title: 'ספקי ציוד פתוחים', value: '2', sub: 'מול מחסן גדודי', icon: Users, color: 'none' },
        { title: 'כשירות ציוד פלוגתי', value: '85%', sub: 'ציוד אופרטיבי ב\' תקין', icon: Activity, color: 'cyan' },
      ],
      recentTasks: [
        { id: 'TSK-401', title: 'השלמת מנות קרב ומים לתרגילי שטח', target: 'לוגיסטיקה פלוגתית', status: 'בתהליך', due: 'היום, 18:00' },
        { id: 'TSK-402', title: 'חלוקת פנסים טקטיים למחלקות 1 ו-2', target: 'לוגיסטיקה פלוגתית', status: 'לביצוע', due: 'מחר, 10:00' },
        { id: 'TSK-403', title: 'מסדר פלוגתי לביקורת אמל"ח וציוד לחימה ב\'', target: 'כלל הפלוגה', status: 'חדש', due: 'בעוד יומיים' },
        { id: 'TSK-404', title: 'משיכת ציוד קשר מאושר מאחסנה גדוד', target: 'לוגיסטיקה פלוגתית', status: 'הושלם', due: 'בוצע אתמול' },
      ],
      alerts: [
        { title: 'דרישות למנות קרב ומים בטיפול', text: 'הדרישה עבור 120 לוחמים ליום שטח מחלקתי בטיפול מול הגדוד.', tone: 'blue', icon: Clock },
        { title: 'מחסור באפודי מגן קרמיים', text: 'חסרים 6 אפודים קרמיים במידות בינוניות במחסן.', tone: 'orange', icon: AlertTriangle },
        { title: 'משלוח חלקי חילוף התקבל', text: 'התקבלו חלקי חילוף לנשקים תקועים מבית המלאכה החטיבתי.', tone: 'green', icon: CheckCircle },
      ]
    };
  }

  if (normRole.includes('חובש')) {
    return {
      title: 'לוח בקרה - רפואה פלוגתית',
      stats: [
        { title: 'כשירות רפואית פלוגתית', value: '94%', sub: '6 חיילים עם פטור זמני', icon: Activity, color: 'cyan' },
        { title: 'בקשות רפואיות פתוחות', value: '3', sub: 'ממתינות לתיאום רופא גדודי', icon: Clock, color: 'orange' },
        { title: 'ציוד רפואי חסר', value: '2 פריטים', sub: 'חסימות עורקים ותחבושות', icon: Truck, color: 'none' },
        { title: 'סד"כ רפואה פעיל', value: '100%', sub: 'חובש מלווה לכל מטווח', icon: Users, color: 'cyan' },
      ],
      recentTasks: [
        { id: 'TSK-501', title: 'תיאום תורים לרופא מומחה עבור לוחמי חוד', target: 'מרפאה גדודית', status: 'בתהליך', due: 'היום, 14:00' },
        { id: 'TSK-502', title: 'רענון ערכות עזרה ראשונה מחלקתיות', target: 'חובשים מחלקתיים', status: 'לביצוע', due: 'מחר, 12:00' },
        { id: 'TSK-503', title: 'ביקורת כשירות רפואית שבועית לפלוגה', target: 'חובש פלוגתי', status: 'חדש', due: 'בעוד יומיים' },
        { id: 'TSK-504', title: 'תיאום חובש מלווה למטווח מחלקה 1', target: 'חובש פלוגתי', status: 'הושלם', due: 'בוצע אתמול' },
      ],
      alerts: [
        { title: 'מחסור בחסמי עורקים טקטיים (CAT)', text: 'נמצא חוסר של 8 חסמי עורקים בבדיקת מלאי מרפאה פלוגתית.', tone: 'orange', icon: AlertTriangle },
        { title: 'תיאום בדיקה תקופתית', text: 'יש לתאם בדיקה שנתית לרופא שיניים צבאי עבור 4 לוחמים.', tone: 'blue', icon: Clock },
        { title: 'מלאי ציוד עזרה ראשונה חודש', text: 'כלל תיקי החובש עודכנו בתחבושות אישיות חדשות.', tone: 'green', icon: CheckCircle },
      ]
    };
  }

  if (normRole.includes('קשר')) {
    return {
      title: 'לוח בקרה - קשר ותקשוב',
      stats: [
        { title: 'מכשירי קשר תקינים', value: '88%', sub: '22 מתוך 25 מכשירים', icon: Activity, color: 'cyan' },
        { title: 'תקלות קשר פתוחות', value: '3', sub: '2 בטיפול מעבדת קשר חטיבה', icon: Clock, color: 'orange' },
        { title: 'ציוד קשר חסר', value: '5 פריטים', sub: 'סוללות רזרביות ואנטנות', icon: Truck, color: 'none' },
        { title: 'סד"כ קשר פעיל', value: '100%', sub: 'קשר פלוגתי וקשרי מחלקות', icon: Users, color: 'cyan' },
      ],
      recentTasks: [
        { id: 'TSK-601', title: 'ביצוע צריבת תדרים מעודכנים למכשירי קשר', target: 'קשר פלוגתי', status: 'בתהליך', due: 'היום, 16:00' },
        { id: 'TSK-602', title: 'ביקורת כשירות קשר מחלקתית מרוכזת', target: 'מחלקות 3 ו-4', status: 'לביצוע', due: 'מחר, 10:00' },
        { id: 'TSK-603', title: 'שיעור הפעלת מכשיר קשר מתקדם לסגל', target: 'סגל פלוגה', status: 'חדש', due: 'בעוד יומיים' },
        { id: 'TSK-604', title: 'השלמת מבדקי כשירות קשר מפל"ג', target: 'קשר פלוגתי', status: 'הושלם', due: 'בוצע אתמול' },
      ],
      alerts: [
        { title: 'מחסור בסוללות רזרביות לקשר', text: 'מחלקה 1 דיווחה על מחסור בסוללות רזרביות לתרגיל השטח.', tone: 'orange', icon: AlertTriangle },
        { title: 'מכשירי קשר בתיקון', text: '3 מכשירי קשר ישנים נמסרו לתיקון במעבדה האוגדתית.', tone: 'blue', icon: Clock },
        { title: 'בדיקת תדרים פלוגתית עברה', text: 'בוצע תיאום קשר מלא מול הגדוד השכן בהצלחה.', tone: 'green', icon: CheckCircle },
      ]
    };
  }

  if (normRole.includes('נהג') || normRole.includes('ב.קוד') || normRole.includes('רכב')) {
    return {
      title: 'לוח בקרה - רכב וניידות',
      stats: [
        { title: 'כשירות רכבים', value: '92%', sub: '11 מתוך 12 רכבים תקינים', icon: Activity, color: 'cyan' },
        { title: 'נסיעות מתוכננות השבוע', value: '8', sub: '3 משימות הובלת לוחמים וציוד', icon: Clock, color: 'orange' },
        { title: 'רכבים בטיפול מעבדה/חימוש', value: '1', sub: 'ג׳יפ דוד בטיפול תקופתי', icon: Truck, color: 'none' },
        { title: 'סד"כ נהגים פעיל', value: '85%', sub: '11 נהגים כשירים מבצעית', icon: Users, color: 'cyan' },
      ],
      recentTasks: [
        { id: 'TSK-701', title: 'ביצוע טיפול שבועי (טיפול ב\') לרכבי הפלוגה', target: 'צוות נהגים', status: 'בתהליך', due: 'היום, 18:00' },
        { id: 'TSK-702', title: 'תיאום נסיעה מנהלתית מרוכזת למחסן הגדודי', target: 'נהג תורן', status: 'לביצוע', due: 'מחר, 08:00' },
        { id: 'TSK-703', title: 'הכנת רכב מנהלתי עבור אישור תוכניות סמ"פ', target: 'נהג מ"פ', status: 'חדש', due: 'בעוד יומיים' },
        { id: 'TSK-704', title: 'הובלת מנות המים שביקשה מחלקה 1', target: 'נהג לוגיסטיקה', status: 'הושלם', due: 'בוצע אתמול' },
      ],
      alerts: [
        { title: 'טיפול תקופתי מעוכב לרכב', text: 'ג׳יפ דוד מעוכב במרכז הטיפולים הגדודי עקב מחסור בחלקי חילוף.', tone: 'orange', icon: AlertTriangle },
        { title: 'תיאום אישור נסיעה חריג', text: 'יש לקבל אישור בטיחות חתום למעבר צירים חסומים.', tone: 'blue', icon: Clock },
        { title: 'רישיונות נהגים בתוקף', text: 'כלל הנהגים הפעילים עברו את רענון הבטיחות השנתי בהצלחה.', tone: 'green', icon: CheckCircle },
      ]
    };
  }

  // Fallback defaults
  return {
    title: 'לוח בקרה פלוגתי',
    stats: [
      { title: 'סד"כ פלוגתי פעיל', value: '84%', sub: '92 מתוך 110 חיילים', icon: Users, color: 'cyan' },
      { title: 'משימות בביצוע', value: '12', sub: '4 משימות דחופות', icon: CheckSquare, color: 'orange' },
      { title: 'דרישות לוגיסטיקה פתוחות', value: '7', sub: '3 ממתינות לאישור רס"פ', icon: Truck, color: 'none' },
      { title: 'כשירות מבצעית', value: '91%', sub: 'עלייה של 2% השבוע', icon: Activity, color: 'cyan' },
    ],
    recentTasks: [
      { id: 'TSK-102', title: 'הכנת ציוד לתרח"ט', target: 'מחלקה 1', status: 'בתהליך', due: 'היום, 18:00' },
      { id: 'TSK-104', title: 'השלמת מבדקי כשירות קשר', target: 'מפל"ג', status: 'ממתין לאישור', due: 'מחר, 10:00' },
      { id: 'TSK-105', title: 'רענון פקודות בטיחות שבועיות', target: 'כלל הפלוגה', status: 'חדש', due: '22 במאי' },
      { id: 'TSK-101', title: 'תיאומי מטווחים מול חמ"ל חטיבה', target: 'מחלקה 2', status: 'הושלם', due: 'בוצע אתמול' },
    ],
    alerts: [
      { title: 'מחסור במחסניות טקטיות', text: 'מחלקה 3 דיווחה על פער של 14 מחסניות עבור פק"ל נגב.', tone: 'orange', icon: AlertTriangle },
      { title: 'סיכום פורום מוביל', text: 'טרם התקבל סיכום מפקדים יומי ממחלקה 4.', tone: 'blue', icon: Clock },
      { title: 'ביקורת כשירות קשר עברה', text: 'מחלקות 1 ו-2 הושלמו ללא חריגות ציוד.', tone: 'green', icon: CheckCircle },
    ]
  };
}

export default function DashboardPage() {
  const { currentUser, isLoading } = useApp();

  if (isLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF6B02]" />
          <span className="text-sm font-black text-slate-400">טוען נתוני מפקדה...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="space-y-6 text-right">
        <PageHeader title="לוח בקרה" subtitle="אנא התחבר למערכת" />
        <GlassCard className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
          <ShieldAlert className="w-12 h-12 mb-3 text-red-500" />
          <span className="text-sm font-black text-slate-350">לא נמצא פרופיל משתמש פעיל</span>
          <p className="text-xs text-slate-500 mt-1">אנא התחבר מחדש.</p>
        </GlassCard>
      </div>
    );
  }

  const data = getDashboardData(currentUser.role);

  return (
    <div className="space-y-6 text-right">
      <PageHeader
        title={data.title}
        subtitle={`שלום ${currentUser.full_name}. לוח הבקרה שלך מותאם לתפקיד ${currentUser.role} במסגרת ${currentUser.assigned_frame}.`}
        actions={
          <GlossyButton variant="orange" size="sm" onClick={() => alert('מייצר סיכום יומי לתפקיד שלך...')}>
            ייצוא דוח מצב
          </GlossyButton>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <GlassCard key={stat.title} glow={stat.color as 'cyan' | 'orange' | 'none'} className="min-h-36">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <span className="block text-xs font-black text-[#667085]">{stat.title}</span>
                  <span className="block text-3xl font-black text-[#020108]">{stat.value}</span>
                  <span className="block text-xs font-semibold text-[#667085]">{stat.sub}</span>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#FF6B02]/18 bg-[#FF6B02]/10 text-[#FF6B02]">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <GlassCard className="min-h-32" glow="orange">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <span className="block text-xs font-black text-[#667085]">בקשות פתוחות</span>
              <span className="block text-2xl font-black text-[#020108]">מרכז דרישות</span>
              <p className="text-xs font-semibold leading-relaxed text-[#667085]">
                פתיחה ומעקב אחר בקשות מהשטח לפי תפקיד, יחידה וקטגוריה.
              </p>
            </div>
            <Truck className="h-7 w-7 shrink-0 text-[#FF6B02]" />
          </div>
          <GlossyButton variant="slate" size="sm" className="mt-4" onClick={() => window.location.href = '/requests'}>
            מעבר לבקשות
          </GlossyButton>
        </GlassCard>

        <GlassCard className="min-h-32">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <span className="block text-xs font-black text-[#667085]">בקשות דחופות</span>
              <span className="block text-2xl font-black text-[#020108]">לפי הרשאות</span>
              <p className="text-xs font-semibold leading-relaxed text-[#667085]">
                מפקדים רואים תמונה רחבה; בעלי תפקיד מקצועיים רואים קטגוריות רלוונטיות.
              </p>
            </div>
            <AlertTriangle className="h-7 w-7 shrink-0 text-red-600" />
          </div>
          <GlossyButton variant="slate" size="sm" className="mt-4" onClick={() => window.location.href = '/requests'}>
            צפייה בדרישות
          </GlossyButton>
        </GlassCard>

        <GlassCard className="min-h-32">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <span className="block text-xs font-black text-[#667085]">בקשות בטיפול</span>
              <span className="block text-2xl font-black text-[#020108]">פעולות תורים</span>
              <p className="text-xs font-semibold leading-relaxed text-[#667085]">
                תורים, פילטרים וסטטוסים לניהול בקשות פעילות לפי עדיפות.
              </p>
            </div>
            <Clock className="h-7 w-7 shrink-0 text-blue-500" />
          </div>
          <GlossyButton variant="slate" size="sm" className="mt-4" onClick={() => window.location.href = '/requests'}>
            לניהול בקשות
          </GlossyButton>
        </GlassCard>
      </div>

      {/* Main Blocks */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <GlassCard className="space-y-4 lg:col-span-2" glow="none">
          <div className="flex items-center justify-between gap-3 border-b border-[rgba(2,1,8,0.08)] pb-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-[#FF6B02]" />
              <h2 className="text-sm font-black text-[#020108]">משימות ובקרה שוטפת</h2>
            </div>
            <GlossyButton variant="slate" size="sm" onClick={() => window.location.href = '/tasks'}>
              כל המשימות
            </GlossyButton>
          </div>

          <div className="divide-y divide-[rgba(2,1,8,0.08)]">
            {data.recentTasks.map((task) => (
              <div key={task.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-[#98A2B3]">{task.id}</span>
                    <span className="text-sm font-black text-[#020108]">{task.title}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#667085]">
                    <span>אחריות: {task.target}</span>
                    <span>·</span>
                    <span>יעד: {task.due}</span>
                  </div>
                </div>

                <StatusBadge status={task.status} className="self-start sm:self-center" />
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="space-y-4" glow="orange">
          <div className="flex items-center gap-2 border-b border-[rgba(2,1,8,0.08)] pb-3">
            <Activity className="h-4 w-4 text-[#FF6B02]" />
            <h2 className="text-sm font-black text-[#020108]">פערים ודיווחים דחופים</h2>
          </div>

          <div className="space-y-3">
            {data.alerts.map((alertItem, idx) => (
              <AlertBlock
                key={idx}
                icon={alertItem.icon}
                title={alertItem.title}
                text={alertItem.text}
                tone={alertItem.tone as 'orange' | 'blue' | 'green'}
              />
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function AlertBlock({
  icon: Icon,
  title,
  text,
  tone,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
  tone: 'orange' | 'blue' | 'green';
}) {
  const toneClasses = {
    orange: 'border-[#FF6B02]/18 bg-[#FF6B02]/10 text-[#C54F00]',
    blue: 'border-blue-500/18 bg-blue-500/10 text-blue-700',
    green: 'border-emerald-500/18 bg-emerald-500/10 text-emerald-700',
  };

  return (
    <div className={`flex gap-3 rounded-2xl border p-3 ${toneClasses[tone]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <span className="block text-xs font-black">{title}</span>
        <span className="mt-1 block text-xs font-semibold leading-relaxed text-[#667085]">{text}</span>
      </div>
    </div>
  );
}
