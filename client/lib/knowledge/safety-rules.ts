import { SafetyRule } from '@/lib/types/knowledge';

export const SAFETY_RULES: SafetyRule[] = [
  // CRITICAL rules - סכנת חיים או נזק טוטאלי
  {
    id: 'brakes_fail',
    keywords: ['אין בלמים', 'הבלמים לא עובדים', 'בלמים לא עובדים', 'דוושה רכה', 'דוושה ספוגית', 'דוושה שוקעת', 'לא עוצר', 'דוושה ירדה לרצפה', 'איבוד בלמים', 'אין ברקסים', 'בלמים נכשלו', 'בלמים לא תופסים', 'אין עצירה'],
    message: 'עצור במקום בטוח בהקדם! בעיה בבלמים היא סכנת חיים. אל תמשיך בנסיעה. הזמן גרר.',
    level: 'CRITICAL',
    endConversation: true,
    followUpMessage: 'מצוין שעצרת. כיוון שמדובר בתקלת בטיחות קריטית בבלמים, לא נוכל להמשיך בדיאגנוסטיקה. אנא הזמן גרר והמתן במקום בטוח.'
  },
  {
    id: 'steering_fail',
    keywords: ['הגה ננעל', 'אי אפשר לסובב את ההגה', 'הגה קשה מאוד', 'אין היגוי', 'רכב לא מסתובב', 'אובדן היגוי', 'הגה לא מגיב'],
    message: 'סכנה בטיחותית חמורה! אובדן היגוי מסכן אותך ואת הסביבה. עצור בצד בבטחה והזמן גרר.',
    level: 'CRITICAL',
    endConversation: true,
    followUpMessage: 'עצרת במקום בטוח? מעולה. תקלת היגוי מחייבת מוסך וגרירה. השיחה תסתיים כעת.'
  },
  {
    id: 'smoke_fire',
    keywords: [
      'יוצא עשן',
      'עשן מהמנוע',
      'יש עשן',
      'עשן יוצא',
      'מנוע מעשן',
      'עשן שחור',
      'רואה עשן',
      'אש ברכב',
      'שריפה ברכב',
      'הרכב בוער',
      'עלה באש',
      'להבות מהרכב',
      'להבות',
      'גיצים',
      'ניצוצות'
    ],
    message: 'עצור במקום בטוח, כבה את המנוע מיד, צא מהרכב, התרחק למרחק בטחון והזמן מכבי אש (102).',
    level: 'CRITICAL',
    endConversation: true,
    followUpMessage: 'שמור מרחק מהרכב! אם יש נפגעים הזמן מד"א (101). אל תתקרב לרכב עד להגעת כוחות ההצלה.'
  },
  {
    id: 'fuel_leak',
    keywords: ['ריח דלק', 'ריח בנזין', 'ריח סולר', 'נזילת דלק', 'דלק מטפטף', 'שלולית דלק', 'ריח חזק של דלק'],
    message: 'חשד לדליפת דלק! כבה את המנוע מיד ואל תנסה להניע שוב. התרחק מהרכב ואל תעשן או תדליק אש בקרבתו.',
    level: 'CRITICAL',
    endConversation: true,
    followUpMessage: 'התרחק מהרכב ואל תעשן או תדליק אש בקרבתו. הזמן שירותי דרך לטיפול בדליפה.'
  },
  {
    id: 'overheating_extreme',
    keywords: [
      'אדים מהמנוע',
      'קיטור מהמנוע',
      'קיטור',
      'רתיחה',
      'המנוע רותח',
      'מים רותחים',
      'נוזל קירור נשפך',
      'נוזל קירור על הרצפה',
      'מים יוצאים מהמנוע',
      'ריח מתוק חזק'
    ],
    message: '🚨 חשד לרתיחה! עצור בצד הדרך מיד, כבה את המנוע ואל תפתח את מכסה המנוע בשום מצב! סכנת כוויות. התרחק מהרכב והזמן גרר.',
    level: 'CRITICAL',
    endConversation: true,
    followUpMessage: 'עצרת במקום בטוח? מצוין. אל תפתח את מכסה המנוע או פקק הרדיאטור עד שהמנוע יתקרר לחלוטין (לפחות 30 דקות). הזמן גרר למוסך.'
  },
  {
    id: 'overheating_severe',
    keywords: ['מחוג חום באדום', 'נורת חום אדומה', 'נורת טמפרטורה אדומה', 'מד חום עולה', 'מד חום גבוה', 'מחוג באדום'],
    message: 'חשד להתחממות יתר! עצור בצד בבטחה וכבה את המנוע. אסור לפתוח את פקק הרדיאטור כשהמנוע חם - סכנת כוויות.',
    level: 'CRITICAL',
    endConversation: false,
    nextScenarioId: 'overheating',
    followUpMessage: 'יופי, עכשיו כשהרכב כבוי והמנוע מתקרר, נוכל לבצע אבחון בזהירות. בוא נתחיל.'
  },
  {
    id: 'oil_pressure',
    keywords: ['נורת שמן אדומה', 'לחץ שמן', 'אין שמן', 'מנורת קומקום', 'נורת שמן מהבהבת', 'נורית שמן', 'מנורת אלדין אדומה'],
    message: 'חשד לבעיית לחץ שמן קריטית! עצור וכבה את המנוע מיד. המשך נסיעה עלול לגרום לנזק חמור למנוע. הזמן גרר.',
    level: 'CRITICAL',
    endConversation: true,
    followUpMessage: 'עצרת? מצוין. הזמן גרר למוסך לטיפול בבעיית השימון.'
  },

  // WARNING rules - אזהרה לפני פעולה מסוכנת
  {
    id: 'safety_hood',
    keywords: ['פתח מכסה מנוע', 'לבדוק שמן', 'לבדוק מים', 'בדיקת מנוע', 'בדיקת שמן', 'בדיקת נוזל קירור'],
    message: 'לפני פתיחת מכסה מנוע: וודא שהמנוע כבוי, בלם היד מורם, ושהמנוע לא רותח (אין אדים). היזהר מחלקים חמים!',
    level: 'WARNING',
    endConversation: false,
    followUpMessage: 'בזהירות רבה, בוא נפתח את המכסה.'
  },
  {
    id: 'safety_under_car',
    keywords: ['מתחת לרכב', 'להסתכל למטה', 'נזילה מלמטה', 'לבדוק מלמטה', 'לזחול מתחת'],
    message: 'אזהרה חמורה: לעולם אל תיכנס מתחת לרכב שמוגבה רק על ידי ג\'ק! וודא שהרכב מאובטח במישור ונתמך כראוי.',
    level: 'WARNING',
    endConversation: false,
    followUpMessage: 'רק אם אתה בטוח במאה אחוז שהרכב יציב, תציץ מתחתיו.'
  },
  {
    id: 'battery_acid',
    keywords: ['קורוזיה על המצבר', 'אבקה לבנה על המצבר', 'נוזל מהמצבר', 'מצבר מדליף', 'חומצה מהמצבר'],
    message: 'זהירות: האבקה או הנוזל על המצבר הם חומצה. אל תיגע בידיים חשופות ושטוף היטב במים אם נגעת.',
    level: 'WARNING',
    endConversation: false,
    followUpMessage: 'היזהר על העיניים והידיים. נמשיך.'
  }
];