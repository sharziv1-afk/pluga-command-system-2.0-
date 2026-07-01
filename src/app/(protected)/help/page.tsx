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
      term: 'פער מנוהל',
      abbreviation: 'פער',
      definition: 'בעיה או חוסר (לוגיסטי, כשירותי או לו״זי) שדווח על ידי המ״מ ונדרש להמירו למשימה מסודרת לפתרון.',
      category: 'כללי',
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-900">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-black text-slate-200">מילון מונחי פיקוד וראשי תיבות</h2>
            </div>
            
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="חיפוש מונח או ראשי תיבות..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-900 focus:border-cyan-500/50 rounded-xl py-1.5 pr-9 pl-3 text-[10px] text-slate-100 placeholder-slate-600 focus:outline-none transition duration-300 text-right"
              />
            </div>
          </div>

          {filteredTerms.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              לא נמצאו מונחים התואמים את החיפוש המבוקש.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredTerms.map((t, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-900 flex flex-col justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black text-slate-200">{t.abbreviation}</span>
                      <span className="text-[10px] text-slate-500 font-bold">({t.term})</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">{t.definition}</p>
                  </div>
                  <div className="self-start mt-2">
                    <span className="text-[8px] font-black px-2 py-0.5 rounded-md bg-slate-900 text-cyan-400 border border-cyan-500/10">
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
          <div className="flex items-center gap-2 pb-3 border-b border-slate-900">
            <HelpCircle className="w-4 h-4 text-orange-400" />
            <h2 className="text-xs font-black text-slate-200">הנחיות שימוש מהירות</h2>
          </div>

          <div className="space-y-4 text-right">
            {/* Step 1 */}
            <div className="flex gap-3">
              <div className="w-5 h-5 rounded-lg bg-orange-500/10 border border-orange-500/25 text-orange-500 flex items-center justify-center font-bold text-[10px] shrink-0">
                1
              </div>
              <div className="space-y-0.5">
                <span className="block text-[10px] font-black text-slate-200">קבלת אישור גישה</span>
                <span className="block text-[9px] text-slate-450 leading-relaxed">
                  הירשם באונבורדינג והמתן לאישור מפקד. המ"פ או הסמ"פ יקבלו התראה מיידית בלשונית "אישור משתמשים" ויאשרו את כניסתך.
                </span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-3">
              <div className="w-5 h-5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                2
              </div>
              <div className="space-y-0.5">
                <span className="block text-[10px] font-black text-slate-200">ניהול לוח שליטה (HUD)</span>
                <span className="block text-[9px] text-slate-450 leading-relaxed">
                  עבור על מדדי סד"כ, כשירות ומשימות פעילות. מפקדי מחלקות מנהלים כאן משימות ופערים מחלקתיים ייעודיים.
                </span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-3">
              <div className="w-5 h-5 rounded-lg bg-[#00f5d4]/10 border border-[#00f5d4]/25 text-[#00f5d4] flex items-center justify-center font-bold text-[10px] shrink-0">
                3
              </div>
              <div className="space-y-0.5">
                <span className="block text-[10px] font-black text-slate-200">סנכרון ודיווח יומי</span>
                <span className="block text-[9px] text-slate-450 leading-relaxed">
                  בסוף כל יום עבודה הגישו סיכום לפורום המוביל. המערכת תבצע אינטגרציה מלאה ותייצר נוסח הודעת סגירת יום ל-WhatsApp.
                </span>
              </div>
            </div>

            {/* Technical alert banner */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex gap-2.5 mt-2">
              <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <p className="text-[9px] text-slate-400 leading-normal">
                נתקלת בבעיה טכנית במערכת או שגיאת הרשאות? פנה לצוות התמיכה הטכנית של פלוגה ג׳ במייל <strong className="text-cyan-400 font-mono">support.c@idf.il</strong>.
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
