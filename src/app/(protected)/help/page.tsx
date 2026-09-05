'use client';

import React, { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlossyButton } from '@/components/ui/GlossyButton';
import { HelpCircle, Search, BookOpen, AlertCircle } from 'lucide-react';

interface DictionaryTerm {
  term: string;
  abbreviation: string;
  definition: string;
  category: 'פיקוד' | 'לוגיסטיקה' | 'מבצעי' | 'כללי';
}

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const terms: DictionaryTerm[] = [
    {
      term: 'אזור שליטה ותזמון',
      abbreviation: 'אש״ת',
      definition: 'טבלת לוחות הזמנים המרכזית לפעילויות הפלוגה (אימונים, מטווחים, טיפול שבועי).',
      category: 'מבצעי',
    },
    {
      term: 'סדר כוחות',
      abbreviation: 'סד״כ',
      definition: 'נתוני כוח האדם הפעיל, הנמצאים בחופשה, או שאינם כשירים רפואית לביצוע משימה.',
      category: 'פיקוד',
    },
    {
      term: 'ביקורת קשר שבועית',
      abbreviation: 'ביק״ש',
      definition: 'בקרת מפקד המבוצעת לכלל מכשירי הקשר והצפנים בפלוגה לוודא כשירות קשר מלאה.',
      category: 'מבצעי',
    },
    {
      term: 'רב סמל פלוגתי',
      abbreviation: 'רס״פ',
      definition: 'האחראי הבלעדי על ריכוז הציוד, המזון, האספקה הלוגיסטית והמנהלה בפלוגה.',
      category: 'לוגיסטיקה',
    },
    {
      term: 'פקודת מבצע פלוגתית',
      abbreviation: 'פקמ״ב',
      definition: 'תוכנית עבודה מפורטת לפעילות מבצעית פלוגתית המופקת על ידי המ״פ והסמ״פ.',
      category: 'פיקוד',
    },
    {
      term: 'פער לוגיסטי',
      abbreviation: 'פער לוגיסטי',
      definition: 'חוסר ציוד, אספקה או תחמושת הפוגע ביכולת הפלוגה. נפתח בלשונית "פערים ודרישות" וניתן להמרה מיידית לדרישה לוגיסטית.',
      category: 'לוגיסטיקה',
    },
    {
      term: 'פער הדרכתי',
      abbreviation: 'פער הדרכתי',
      definition: 'פער ידע או יכולת בין הנדרש לקיים בקרב חייל, כיתה או מחלקה. מנותב למ״מ, סמ״פ או מ״פ להשלמה.',
      category: 'פיקוד',
    },
    {
      term: 'פער לו״זי',
      abbreviation: 'פער לו״זי',
      definition: 'התנגשות זמנים או פגיעה בשעות מנוחה ובלו״ז המתוכנן. מנותב לסמ״פ או למ״פ.',
      category: 'מבצעי',
    },
    {
      term: 'פורום מוביל',
      abbreviation: 'פורום מוביל',
      definition: 'סיכום פיקודי יומי לפי דרגים — כיתה, מחלקה ופלוגה — עד אישור וסגירת מ״פ, עם הפקת הודעת WhatsApp מוכנה להפצה.',
      category: 'פיקוד',
    },
    {
      term: 'תפיסת פיקוד',
      abbreviation: 'תפיסת פיקוד',
      definition: 'מערכת הערכים והעקרונות שמנחים את אופן הפיקוד בפלוגה — כיצד מפקד מקבל החלטות ומתעדף.',
      category: 'פיקוד',
    },
    {
      term: 'כוננות',
      abbreviation: 'כוננות',
      definition: 'מצב מוכנות לחימה וציוד של מסגרת נתונה — מדווח כחלק מהפורום המוביל היומי.',
      category: 'מבצעי',
    },
    {
      term: 'רצוי מול מצוי',
      abbreviation: 'רצוי מול מצוי',
      definition: 'השוואה בין מה שתוכנן למה שבוצע בפועל, כולל זיהוי הפער בין השניים והמלצת המשך.',
      category: 'כללי',
    },
    {
      term: 'בקרה',
      abbreviation: 'בקרה',
      definition: 'מעקב שוטף אחר ביצוע משימה או פעילות ומדידת התוצר שהתקבל בפועל.',
      category: 'פיקוד',
    },
    {
      term: 'שפה פלוגתית',
      abbreviation: 'שפה פלוגתית',
      definition: 'מושגים וראשי תיבות אחידים שכלל הסגל משתמש בהם, כדי שכולם ידברו באותה שפה — ראו מילון זה.',
      category: 'כללי',
    },
    {
      term: 'שיחת מ״פ',
      abbreviation: 'שיחת מ״פ',
      definition: 'שיחה אישית של מפקד הפלוגה עם פקוד, לרוב בעקבות אירוע, בקשה או צורך מיוחד.',
      category: 'פיקוד',
    },
    {
      term: 'סגן מפקד הפלוגה',
      abbreviation: 'סמ״פ',
      definition: 'מחליף המ״פ בהעדרו. חבר "פורום מתכנן" פלוגתי ומוביל "פורום משניה". אמון על משימות המפל״ג, שגרת הבטיחות, הצל״מ והלוגיסטיקה אל מול התקינה.',
      category: 'פיקוד',
    },
    {
      term: 'סגן רב סמל פלוגתי',
      abbreviation: 'סרס״פ',
      definition: 'מחליף הרס״פ בהעדרו ומספר 2 במפל״ג. מסייע לרס״פ באכיפת משמעת ונהלים וניהול המפל״ג — חלוקת התפקידים ביניהם נקבעת ע״י הרס״פ.',
      category: 'לוגיסטיקה',
    },
    {
      term: 'חובש פלוגתי',
      abbreviation: 'חופ״ל',
      definition: 'אמון על הטיפול הרפואי בכוח האדם בפלוגה כולל מסופחים. נותן מענה ראשוני לאירוע רפואי, ומסייע לרופא הגדודי בבירורים רפואיים.',
      category: 'כללי',
    },
    {
      term: 'מפקד שאינו קצין — הדרכה',
      abbreviation: 'מש״ד',
      definition: 'עוזר המ״פ ומפקד שאינו קצין — אחראי על ההדרכה בפלוגה.',
      category: 'פיקוד',
    },
  ];

  const filteredTerms = terms.filter(t => 
    t.term.includes(searchQuery) || 
    t.abbreviation.includes(searchQuery) || 
    t.definition.includes(searchQuery) ||
    t.category.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader 
        title="עזרה ומדריך שימוש במערכת" 
        subtitle="מרכז הסברים, פתרון תקלות ומילון מונחים צבאיים. כאן תוכל ללמוד כיצד לעבוד עם מערכת 'המפקד' ולנהל את הפלוגה שלך בצורה הטובה ביותר."
      />

      {/* FAQs and Info section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dictionary Column */}
        <GlassCard className="lg:col-span-2 space-y-4" glow="none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-semibold text-[var(--text-primary)]">מילון מונחי פיקוד וראשי תיבות</h2>
            </div>
            
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted-accessible)]" />
              <input
                type="text"
                placeholder="חיפוש מונח או ראשי תיבות..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--surface-muted)] border border-[var(--border-subtle)] focus:border-cyan-500/50 rounded-xl py-1.5 pr-9 pl-3 text-caption text-[var(--text-primary)] placeholder-slate-600 focus:outline-none transition duration-300 text-right"
              />
            </div>
          </div>

          {filteredTerms.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted-accessible)] text-xs">
              לא נמצאו מונחים התואמים את החיפוש המבוקש.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredTerms.map((t, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] flex flex-col justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">{t.abbreviation}</span>
                      <span className="text-caption text-[var(--text-muted-accessible)] font-bold">({t.term})</span>
                    </div>
                    <p className="text-caption text-[var(--text-muted-accessible)] leading-relaxed">{t.definition}</p>
                  </div>
                  <div className="self-start mt-2">
                    <span className="text-caption font-semibold px-2 py-0.5 rounded-md bg-[var(--surface-muted)] text-cyan-400 border border-cyan-500/10">
                      {t.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* General Guidelines & Support */}
        <GlassCard className="space-y-4" glow="none">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-subtle)]">
            <HelpCircle className="w-4 h-4 text-[var(--color-action-on-surface)]" />
            <h2 className="text-xs font-semibold text-[var(--text-primary)]">הנחיות שימוש מהירות</h2>
          </div>

          <div className="space-y-4 text-right">
            {/* Step 1 */}
            <div className="flex gap-3">
              <div className="w-5 h-5 rounded-lg border border-[var(--brand)]/25 bg-[var(--brand)]/10 text-[var(--color-action-on-surface)] flex items-center justify-center font-bold text-caption shrink-0">
                1
              </div>
              <div className="space-y-0.5">
                <span className="block text-caption font-semibold text-[var(--text-primary)]">קבלת אישור גישה</span>
                <span className="block text-caption text-[var(--text-muted-accessible)] leading-relaxed">
                  הירשם באונבורדינג והמתן לאישור מפקד. המ"פ או הסמ"פ יקבלו התראה מיידית בלשונית "אישור משתמשים" ויאשרו את כניסתך.
                </span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-3">
              <div className="w-5 h-5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 flex items-center justify-center font-bold text-caption shrink-0">
                2
              </div>
              <div className="space-y-0.5">
                <span className="block text-caption font-semibold text-[var(--text-primary)]">ניהול לוח שליטה (HUD)</span>
                <span className="block text-caption text-[var(--text-muted-accessible)] leading-relaxed">
                  עבור על מדדי סד"כ, כשירות ומשימות פעילות. מפקדי מחלקות מנהלים כאן משימות ופערים מחלקתיים ייעודיים.
                </span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-3">
              <div className="w-5 h-5 rounded-lg bg-[var(--color-teal)]/10 border border-[var(--color-teal)]/25 text-[var(--color-teal)] flex items-center justify-center font-bold text-caption shrink-0">
                3
              </div>
              <div className="space-y-0.5">
                <span className="block text-caption font-semibold text-[var(--text-primary)]">סנכרון ודיווח יומי</span>
                <span className="block text-caption text-[var(--text-muted-accessible)] leading-relaxed">
                  בסוף כל יום עבודה הגישו סיכום לפורום המוביל. המערכת תבצע אינטגרציה מלאה ותייצר נוסח הודעת סגירת יום ל-WhatsApp.
                </span>
              </div>
            </div>

            {/* Technical alert banner */}
            <div className="p-3 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] flex gap-2.5 mt-2">
              <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <p className="text-caption text-[var(--text-muted-accessible)] leading-normal">
                נתקלת בבעיה טכנית במערכת או שגיאת הרשאות? פנה לצוות התמיכה הטכנית של פלוגה א׳ במייל <strong className="text-cyan-400 font-mono">support.a@idf.il</strong>.
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
