/**
 * ═══════════════════════════════════════════════════════════════════
 *  Synoza — قالب استيراد Case (Admin → OSCE Cases → Import)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  إزاي تستخدمه:
 *  1) انسخ الملف ده كله (من export const لحد آخر })
 *  2) Admin Dashboard → OSCE Cases → Import / Paste
 *  3) الصق الكود → Parse → راجع الفورم → Save
 *  4) بعد الحفظ: روح قسم Station وظبط المراحل ورسائل الممتحن
 *  5) (اختياري) University overrides لكل جامعة
 *
 *  ملاحظة: الاستيراد مش بيجيب stationConfig — لازم تظبطه من الأدمن بعد Save
 */

export const myCase = {
  name: 'AS + MR (Aortic Stenosis + Mitral Regurgitation)',
  specialty: 'Cardiology',
  difficulty: 'Intermediate',

  patient: {
    name: 'Ahmed Mahmoud',
    age: 55,
    gender: 'Male',
    nationality: 'Egyptian',
    occupation: 'Retired teacher',
    chiefComplaint: 'Progressive shortness of breath and chest discomfort on exertion for 6 months.',
    vitals: {
      bp: '110/70 mmHg',
      hr: '88 bpm (irregular)',
      rr: '18 /min',
      temp: '36.9 °C',
      spo2: '96% on room air',
    },
  },

  history: {
    presentIllness:
      '6-month history of dyspnea on exertion (NYHA II–III), occasional chest tightness, no syncope. No orthopnea or PND yet.',
    pastHistory: 'Hypertension. No diabetes. No known CAD.',
    drugHistory: 'Amlodipine 5 mg OD. No anticoagulation.',
    familyHistory: 'Father died suddenly at age 62 (possible cardiac).',
    socialHistory: 'Non-smoker. Lives in Cairo with family.',
  },

  examination: {
    inspection:
      'Elderly male, mild respiratory distress on exertion. No cyanosis. No peripheral edema.',
    inspectionImage: '/exam/cases/as-mr/inspection.jpg',
    palpation:
      'Heaving apex beat at 5th ICS MCL. Thrill over aortic area on expiration.',
    palpationVideo: '',
    percussion: 'Cardiac dullness slightly shifted. Lungs resonant.',
    auscultation:
      'Harsh crescendo–decrescendo systolic murmur at RUSB radiating to carotids (AS). Soft holosystolic murmur at apex radiating to axilla (MR). S2 soft.',
    auscultationAudio: '/exam/cases/as-mr/aortic-murmur.mp3',
    specialTests: [{ name: 'Peripheral pulses', finding: 'Slow rising carotid pulse (pulsus parvus et tardus)' }],
  },

  investigations: [
    {
      title: 'ECG',
      content: 'Atrial fibrillation. LVH criteria. No acute ST changes.',
    },
    {
      title: 'Chest X-ray',
      content: 'Cardiomegaly. Pulmonary congestion mild. No pleural effusion.',
    },
    {
      title: 'Echocardiography',
      content:
        'Severe aortic stenosis (AVA ~0.8 cm², mean gradient ~45 mmHg). Moderate MR. LVEF 55%.',
    },
  ],

  diagnosis: {
    provisional: 'Combined valvular heart disease: Severe AS + Moderate MR',
    differentials: ['HOCM', 'Mitral valve prolapse with MR', 'Pulmonary hypertension'],
    management:
      'Refer for valve intervention discussion. Rate control if AF. Endocarditis prophylaxis counseling.',
  },

  checklist: [
    { item: 'Structured cardiac history including exertional symptoms', category: 'History' },
    { item: 'Characterize murmurs by site, timing, radiation', category: 'Examination' },
    { item: 'Interpret echo findings and severity', category: 'Investigations' },
    { item: 'Clear working diagnosis and plan', category: 'Reasoning' },
  ],

  examinerQuestions: [
    {
      question: 'What murmur features suggest aortic stenosis?',
      sampleAnswer: 'Harsh crescendo–decrescendo systolic murmur at RUSB, radiates to carotids, soft S2.',
    },
    {
      question: 'When would you refer for valve replacement?',
      sampleAnswer: 'Symptomatic severe AS, or asymptomatic with LV dysfunction / very severe stenosis per guidelines.',
    },
  ],
};
