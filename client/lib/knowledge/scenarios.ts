import { Scenario, StepOption } from '@/lib/types/knowledge';

// --- Helpers ---
// פונקציית עזר ליצירת כפתור מילוט מהיר
const createSkipOption = (nextStepId: string): StepOption => ({
  label: 'לא יודע / דלג',
  nextStepId: nextStepId,
  actions: [{ type: 'SKIPPED' }]
});

export const SCENARIOS: Record<string, Scenario> = {
  // ---------------------------------------------------------
  // תרחיש 1: הרכב לא מניע (Car Won't Start)
  // ---------------------------------------------------------
  car_wont_start: {
    id: 'car_wont_start',
    title: 'הרכב לא מניע',
    startingStepId: 'check_noise',
    suspects: [
      { id: 'battery', name: 'מצבר', score: 0 },
      { id: 'starter', name: 'סטרטר (מתנע)', score: 0 },
      { id: 'alternator', name: 'אלטרנטור', score: 0 },
      { id: 'immobilizer', name: 'קודן/אימובילייזר', score: 0 },
      { id: 'fuel_system', name: 'מערכת דלק', score: 0 }
    ],
    steps: {
      check_noise: {
        id: 'check_noise',
        text: 'כשאתה מסובב את המפתח (או לוחץ על כפתור ההנעה), מה אתה שומע?',
        options: [
          {
            label: 'יש רעש של "תיקתוק" מהיר או חזק',
            nextStepId: 'check_lights',
            actions: [
              { type: 'VERIFIES', suspectId: 'starter', weight: 2 }, // חשד חזק לסטרטר תפוס או מצבר גמור
              { type: 'VERIFIES', suspectId: 'battery', weight: 1 }
            ]
          },
          {
            label: 'שקט מוחלט, אין שום רעש',
            nextStepId: 'check_lights',
            actions: [
              { type: 'VERIFIES', suspectId: 'battery', weight: 2 }, // סבירות גבוהה למצבר מת
              { type: 'VERIFIES', suspectId: 'immobilizer', weight: 1 }
            ]
          },
          {
            label: 'המנוע מנסה להניע ("משתעל") אבל לא מצליח',
            nextStepId: 'check_fuel', // דילוג לחשד דלק
            actions: [
              { type: 'RULES_OUT', suspectId: 'battery', weight: 2 }, // אם יש סטרטר, המצבר כנראה תקין
              { type: 'RULES_OUT', suspectId: 'starter', weight: 2 },
              { type: 'VERIFIES', suspectId: 'fuel_system', weight: 2 }
            ]
          },
          createSkipOption('check_lights') // Escape Hatch
        ]
      },
      check_lights: {
        id: 'check_lights',
        text: 'בוא נבדוק את עוצמת החשמל. תדליק אורות פנימיים או פנסים ראשיים. איך הם נראים?',
        options: [
          {
            label: 'האורות חלשים מאוד או מהבהבים',
            nextStepId: 'check_immobilizer',
            actions: [
              { type: 'VERIFIES', suspectId: 'battery', weight: 3 }, // כמעט ודאי מצבר
              { type: 'RULES_OUT', suspectId: 'starter', weight: 1 }
            ]
          },
          {
            label: 'האורות חזקים ורגילים',
            nextStepId: 'check_immobilizer',
            actions: [
              { type: 'RULES_OUT', suspectId: 'battery', weight: 2 },
              { type: 'VERIFIES', suspectId: 'starter', weight: 2 } // חשמל יש, אבל לא מניע -> סטרטר
            ]
          },
          createSkipOption('check_immobilizer') // Escape Hatch: "לא יודע להבדיל"
        ]
      },
      check_immobilizer: {
        id: 'check_immobilizer',
        text: 'האם הקודן (אם יש) השמיע את הצפצוף הרגיל שלו? האם נורית האימובילייזר כבתה?',
        options: [
          {
            label: 'כן, הקודן הגיב כרגיל',
            nextStepId: 'finish_report',
            actions: [{ type: 'RULES_OUT', suspectId: 'immobilizer', weight: 3 }]
          },
          {
            label: 'לא, הקודן לא הגיב / המקשים לא עובדים',
            nextStepId: 'finish_report',
            actions: [{ type: 'VERIFIES', suspectId: 'immobilizer', weight: 3 }]
          },
          createSkipOption('finish_report')
        ]
      },
      // צעד חסר: בדיקת מערכת דלק
      check_fuel: {
        id: 'check_fuel',
        text: 'האם תדלקת לאחרונה? האם יש דלק במיכל (לפי מד הדלק)?',
        options: [
          {
            label: 'כן, יש דלק מלא',
            nextStepId: 'finish_report',
            actions: [
              { type: 'RULES_OUT', suspectId: 'fuel_system', weight: 1 }
            ]
          },
          {
            label: 'לא בטוח / קרוב לריק',
            nextStepId: 'finish_report',
            actions: [
              { type: 'VERIFIES', suspectId: 'fuel_system', weight: 2 }
            ]
          },
          createSkipOption('finish_report')
        ]
      },
      finish_report: {
        id: 'finish_report',
        text: 'סיכום: על סמך התשובות, נאספו ממצאים רלוונטיים לאבחון. מומלץ לפנות למוסך לבדיקה מקצועית.',
        options: [
          {
            label: 'סיים',
            nextStepId: null,
            actions: [{ type: 'INFO' }],
            logText: 'סיום תרחיש רכב לא מניע'
          }
        ]
      }
    }
  },

  // ---------------------------------------------------------
  // תרחיש 2: התחממות מנוע (Overheating) - בטיחות קריטית
  // ---------------------------------------------------------
  overheating: {
    id: 'overheating',
    title: 'התחממות מנוע',
    startingStepId: 'safety_steam',
    suspects: [
      { id: 'coolant_leak', name: 'חוסר מים/נזילה', score: 0 },
      { id: 'fan_failure', name: 'תקלת מאוורר', score: 0 },
      { id: 'radiator', name: 'רדיאטור סתום', score: 0 }
    ],
    steps: {
      safety_steam: {
        id: 'safety_steam',
        text: 'שאלה קריטית לבטיחותך: האם יוצאים אדים או עשן ממכסה המנוע ברגע זה?',
        options: [
          {
            label: 'כן, יש אדים/עשן',
            nextStepId: 'critical_stop', // סיום מיידי
            actions: [{ type: 'INFO' }]
          },
          {
            label: 'לא, רק מד החום עלה',
            nextStepId: 'check_coolant',
            actions: [{ type: 'INFO' }]
          }
        ]
      },
      check_coolant: {
        id: 'check_coolant',
        text: 'המתן שהמנוע יתקרר! (לפחות 20–30 דקות). גש למיכל העיבוי (מיכל פלסטיק שקוף). האם מפלס המים נמוך מהמינימום?',
        options: [
          {
            label: 'כן, חסרים מים',
            nextStepId: 'check_fan',
            actions: [{ type: 'VERIFIES', suspectId: 'coolant_leak', weight: 2 }]
          },
          {
            label: 'לא, המים מלאים',
            nextStepId: 'check_fan',
            actions: [
              { type: 'RULES_OUT', suspectId: 'coolant_leak', weight: 2 },
              { type: 'VERIFIES', suspectId: 'radiator', weight: 1 }
            ]
          },
          // מילוט קריטי: משתמש שלא יודע לפתוח מכסה מנוע
          createSkipOption('check_fan')
        ]
      },
      check_fan: {
        id: 'check_fan',
        text: 'הניע את הרכב (אם חום המנוע ירד) והקשב: כשהמנוע מתחמם שוב, האם אתה שומע את המאוורר הקדמי נכנס לפעולה?',
        options: [
          {
            label: 'לא שומע כלום',
            nextStepId: 'finish_report',
            actions: [{ type: 'VERIFIES', suspectId: 'fan_failure', weight: 3 }]
          },
          {
            label: 'כן, שומע רעש חזק של מאוורר',
            nextStepId: 'finish_report',
            actions: [{ type: 'RULES_OUT', suspectId: 'fan_failure', weight: 3 }]
          },
          createSkipOption('finish_report')
        ]
      },
      // צעד חסר: עצירה קריטית כשיש אדים
      critical_stop: {
        id: 'critical_stop',
        text: 'זהירות! אדים או עשן מהמנוע מעידים על התחממות חמורה. כבה את המנוע מיד ואל תפתח את מכסה המנוע!',
        options: [
          {
            label: 'הבנתי, כיביתי את המנוע',
            nextStepId: 'finish_report',
            actions: [{ type: 'INFO' }],
            severity: 'CRITICAL',
            stopAlert: {
              title: '⚠️ התחממות קריטית!',
              message: 'המנוע רותח. אסור לפתוח את פקק הרדיאטור - סכנת כוויות! המתן לפחות 30 דקות והזמן גרר.'
            }
          }
        ]
      },
      finish_report: {
        id: 'finish_report',
        text: 'סיכום: על סמך התשובות, נאספו ממצאים. מומלץ להמתין שהמנוע יתקרר ולפנות למוסך לבדיקה מקצועית.',
        options: [
          {
            label: 'סיים',
            nextStepId: null,
            actions: [{ type: 'INFO' }],
            logText: 'סיום תרחיש התחממות'
          }
        ]
      }
    }
  },

  // ---------------------------------------------------------
  // תרחיש 4: פנצ'ר (Flat Tire) - דוגמה לתרחיש תפעולי
  // ---------------------------------------------------------
  flat_tire: {
    id: 'flat_tire',
    title: 'פנצ\'ר בגלגל',
    startingStepId: 'safety_location',
    suspects: [], // תרחיש זה אינו דיאגנוסטי אלא תפעולי, אין "חשודים"
    steps: {
      safety_location: {
        id: 'safety_location',
        text: 'האם הרכב נמצא במקום מישורי ובטוח להחלפה, רחוק מתנועה חולפת?',
        options: [
          {
            label: 'כן, המקום בטוח',
            nextStepId: 'check_tools',
            actions: [{ type: 'INFO' }]
          },
          {
            label: 'לא, אני בשוליים מסוכנים',
            nextStepId: 'call_rescue', // הפניה לגרר
            actions: [{ type: 'INFO' }]
          }
        ]
      },
      check_tools: {
        id: 'check_tools',
        text: 'פתח את תא המטען. האם אתה מזהה: גלגל רזרבי תקין, ג\'ק (מגבה) ומפתח גלגלים?',
        options: [
          {
            label: 'יש לי את כל הציוד',
            nextStepId: 'start_guide',
            actions: [{ type: 'INFO' }]
          },
          {
            label: 'חסר לי משהו',
            nextStepId: 'call_rescue',
            actions: [{ type: 'INFO' }]
          },
          createSkipOption('call_rescue')
        ]
      },
      // צעד חסר: התחלת מדריך החלפה
      start_guide: {
        id: 'start_guide',
        text: 'מעולה! יש לך את כל הציוד. האם אתה מרגיש בטוח להחליף גלגל בעצמך, או שתעדיף להזמין עזרה?',
        options: [
          {
            label: 'אני מרגיש בטוח, אחליף בעצמי',
            nextStepId: 'finish_report',
            actions: [{ type: 'INFO' }],
            logText: 'הלקוח בחר להחליף גלגל בעצמו'
          },
          {
            label: 'אני מעדיף להזמין עזרה',
            nextStepId: 'call_rescue',
            actions: [{ type: 'INFO' }]
          }
        ]
      },
      // צעד חסר: הזמנת גרר/עזרה
      call_rescue: {
        id: 'call_rescue',
        text: 'אין בעיה! מומלץ להזמין שירות דרך או גרר. הישאר במקום בטוח עם אורות חירום דולקים.',
        options: [
          {
            label: 'הבנתי, אזמין עזרה',
            nextStepId: 'finish_report',
            actions: [{ type: 'INFO' }],
            logText: 'הלקוח הופנה להזמנת שירותי דרך'
          }
        ]
      },
      finish_report: {
        id: 'finish_report',
        text: 'סיכום: הנחיות נרשמו. אם החלפת בעצמך — המשך בזהירות. אם הזמנת עזרה — הם בדרך.',
        options: [
          {
            label: 'סיים',
            nextStepId: null,
            actions: [{ type: 'INFO' }],
            logText: 'סיום תרחיש פנצר'
          }
        ]
      }
    }
  }
};

