import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { ensurePartnerUniversities } from './data/defaultUniversities.js';
import { seedQbankCatalog } from './data/seedQbank.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Synoza database...');

  // Existing accounts (before email verification) stay login-ready after migration.
  await prisma.user.updateMany({
    where: { emailVerified: false, otpCode: null, otpExpires: null },
    data: { emailVerified: true },
  });

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@synoza.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { emailVerified: true },
    create: {
      email: adminEmail,
      passwordHash,
      firstName: 'Synoza',
      lastName: 'Admin',
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'student@synoza.com' },
    update: { emailVerified: true, studentId: '202400001' },
    create: {
      email: 'student@synoza.com',
      passwordHash: await bcrypt.hash('Student@123456', 12),
      firstName: 'Mohamed',
      lastName: 'Ali',
      role: 'STUDENT',
      university: 'Cairo University',
      phone: '01024828652',
      studentId: '202400001',
      emailVerified: true,
    },
  });

  const testStudentPassword = 'Student@123456';
  const testStudents: Array<{
    email: string;
    firstName: string;
    lastName: string;
    university: string;
    studentId: string;
    plan?: 'PACKAGE_50' | 'PACKAGE_150' | 'PACKAGE_300';
  }> = [
    { email: 'student2@synoza.com', firstName: 'Sara', lastName: 'Hassan', university: 'Ain Shams University', studentId: '202400002' },
    { email: 'student.basic@synoza.com', firstName: 'Omar', lastName: 'Khaled', university: 'MUST', studentId: '202400003', plan: 'PACKAGE_50' },
    { email: 'student.pro@synoza.com', firstName: 'Nour', lastName: 'Adel', university: 'Alexandria University', studentId: '202400004', plan: 'PACKAGE_150' },
    { email: 'student.premium@synoza.com', firstName: 'Youssef', lastName: 'Mahmoud', university: 'Cairo University', studentId: '202400005', plan: 'PACKAGE_300' },
  ];

  for (const s of testStudents) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: { emailVerified: true, studentId: s.studentId },
      create: {
        email: s.email,
        passwordHash: await bcrypt.hash(testStudentPassword, 12),
        firstName: s.firstName,
        lastName: s.lastName,
        role: 'STUDENT',
        university: s.university,
        studentId: s.studentId,
        emailVerified: true,
      },
    });

    if (s.plan) {
      await prisma.subscription.updateMany({
        where: { userId: user.id, status: 'ACTIVE' },
        data: { status: 'CANCELLED', endDate: new Date() },
      });
      const months = s.plan === 'PACKAGE_50' ? 2 : s.plan === 'PACKAGE_150' ? 4 : 6;
      const casesQuota = s.plan === 'PACKAGE_50' ? 30 : s.plan === 'PACKAGE_150' ? 60 : 100;
      const priceEgp = s.plan === 'PACKAGE_50' ? 150 : s.plan === 'PACKAGE_150' ? 300 : 500;
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + months);
      await prisma.subscription.create({
        data: {
          userId: user.id,
          plan: s.plan,
          status: 'ACTIVE',
          casesQuota,
          priceEgp,
          endDate,
        },
      });
    }
  }

  const specialties = [
    { nameEn: 'Cardiology', nameAr: 'أمراض القلب', description: 'Cardiovascular clinical cases' },
    { nameEn: 'Internal Medicine', nameAr: 'الباطنة', description: 'General internal medicine' },
    { nameEn: 'Surgery', nameAr: 'الجراحة', description: 'Surgical cases' },
    { nameEn: 'Pediatrics', nameAr: 'طب الأطفال', description: 'Pediatric cases' },
    { nameEn: 'Obstetrics & Gynecology', nameAr: 'النساء والتوليد', description: 'OBGYN cases' },
  ];

  for (const s of specialties) {
    const existing = await prisma.specialty.findFirst({ where: { nameEn: s.nameEn } });
    if (!existing) await prisma.specialty.create({ data: s });
  }

  const difficulties = [
    { nameEn: 'Beginner', nameAr: 'مبتدئ', level: 1, color: '#22C55E' },
    { nameEn: 'Intermediate', nameAr: 'متوسط', level: 2, color: '#F59E0B' },
    { nameEn: 'Advanced', nameAr: 'متقدم', level: 3, color: '#EF4444' },
  ];

  for (const d of difficulties) {
    await prisma.difficultyLevel.upsert({
      where: { level: d.level },
      update: {},
      create: d,
    });
  }

  const internalMed = await prisma.knowledgeCategory.upsert({
    where: { id: 'seed-internal-med' },
    update: {},
    create: {
      id: 'seed-internal-med',
      nameEn: 'Internal Medicine',
      nameAr: 'الباطنة',
      description: 'General internal medicine OSCE stations',
      sortOrder: 1,
    },
  });

  const placeholderBoards = [
    { id: 'seed-surgery', nameEn: 'Surgery', nameAr: 'الجراحة', sortOrder: 2 },
    { id: 'seed-pediatrics', nameEn: 'Pediatrics', nameAr: 'طب الأطفال', sortOrder: 3 },
    { id: 'seed-obgyn', nameEn: 'Obstetrics & Gynecology', nameAr: 'النساء والتوليد', sortOrder: 4 },
  ];
  for (const board of placeholderBoards) {
    await prisma.knowledgeCategory.upsert({
      where: { id: board.id },
      update: {},
      create: {
        ...board,
        description: `${board.nameEn} OSCE stations — coming soon`,
      },
    });
  }

  const chest = await prisma.knowledgeCategory.upsert({
    where: { id: 'seed-chest' },
    update: {},
    create: {
      id: 'seed-chest',
      parentId: internalMed.id,
      nameEn: 'Chest / Cardiology',
      nameAr: 'الصدر / القلب',
      description: 'Cardiac and respiratory chest cases',
      sortOrder: 1,
    },
  });

  const existingKnowledge = await prisma.knowledgeItem.findFirst({
    where: { titleEn: 'Key history questions for chest pain' },
  });
  if (!existingKnowledge) {
    await prisma.knowledgeItem.createMany({
      data: [
        {
          categoryId: chest.id,
          titleEn: 'Key history questions for chest pain',
          titleAr: 'أسئلة مهمة لألم الصدر',
          content:
            'Ask about onset, character, radiation, associated dyspnea, palpitations, syncope, risk factors (smoking, family history), and exertional symptoms.',
          type: 'QUESTION',
        },
        {
          categoryId: chest.id,
          titleEn: 'Rheumatic heart disease teaching points',
          titleAr: 'نقاط تعليمية لمرض القلب الروماتيزمي',
          content:
            'Students should explore history of rheumatic fever, penicillin prophylaxis, murmur characteristics, and functional limitation.',
          type: 'TEACHING',
        },
      ],
    });
  }

  const cardiology = await prisma.specialty.findFirst({ where: { nameEn: 'Cardiology' } });
  const advanced = await prisma.difficultyLevel.findFirst({ where: { level: 3 } });
  const beginner = await prisma.difficultyLevel.findFirst({ where: { level: 1 } });

  if (cardiology && advanced) {
    const asmrTitle = 'AS + MR (Aortic Stenosis & Mitral Regurgitation)';
    const existingCase = await prisma.case.findFirst({ where: { titleEn: asmrTitle } });

    const caseData = {
      titleEn: asmrTitle,
      titleAr: 'تضيق أورطي + قصور mitral',
      specialtyId: cardiology.id,
      difficultyId: advanced.id,
      categoryId: chest.id,
      patientName: 'Tarek Moustafa El-Haddad',
      patientAge: 17,
      patientGender: 'Male',
      patientNationality: 'Egyptian',
      patientResidence: 'Shobra Al-Kheima, Cairo',
      patientOccupation: 'Apprentice house painter',
      patientMaritalStatus: 'Single',
      patientSmokingStatus: 'Non-smoker',
      chiefComplaint: 'Shortness of breath of 2-week duration.',
      medicalHistory:
        'Progressive exertional dyspnea for 5 years (gradual onset, worse on exertion, relieved by rest). Paroxysmal nocturnal dyspnea — wakes gasping after ~2 hours of sleep, sleeps on 2 pillows. Lightheadedness and blurred vision on exertion. Productive cough with dark yellow sputum (~1/4 cup). High-grade fever 2 weeks ago with painful tonsillitis. Child-onset bronchial asthma with repeated tonsillitis (4–5/year). Rheumatic fever diagnosed 5 years ago (Jones criteria; steroids and aspirin with temporary improvement). Denies hemoptysis, weight loss, syncope, chest pain, cyanosis, edema, ascites, or pressure symptoms.',
      medicationHistory:
        'Depot penicillin IM every 15 days (prophylaxis). Inhaled Ventolin (salbutamol) for asthma. Occasional home oxygen for asthma attacks.',
      surgicalHistory:
        'Denies prior surgery — but has a chest tube scar on inspection (critical discrepancy for students to identify).',
      familyHistory:
        'No consanguinity. No first-degree relatives with congenital or valvular heart disease.',
      socialHistory:
        'Single 17-year-old male from Shobra Al-Kheima, Cairo. Apprentice house painter (chemical fume exposure). Non-smoker.',
      physicalExam: JSON.stringify({
        inspection:
          'Mildly tachypneic cooperative adolescent sitting upright. Evident linear hyperpigmented scar from previous chest tube insertion (past pleural effusion) in left mid-axillary line. No precordial bulge, no dilated superficial veins, no chest skin lesions.',
        palpation:
          'Apex in left 5th ICS, displaced laterally from midclavicular line — sustained heaving apex (LV concentric hypertrophy). No epigastric, suprasternal, or parasternal pulsations. Distinct rough systolic thrill at 1st aortic area (R 2nd ICS) radiating to carotids.',
        percussion:
          'Normal cardiac dullness. Lungs resonant bilaterally; possible mild dullness at left lung base near old chest tube scar.',
        auscultation:
          'Aortic area: muffled/soft S2; loud ejection systolic murmur at 1st aortic area radiating to carotids and apex (louder sitting forward, breath held in expiration). Mitral area: soft muffled S1; loud blowing pansystolic murmur at apex radiating to left axilla (louder in left lateral decubitus). Mild expiratory wheeze bilaterally (asthma).',
      }),
      examImages: JSON.stringify([
        {
          url: '/exam/cases/as-mr/inspection.png',
          caption: 'Chest inspection — hyperpigmented chest tube scar, left mid-axillary line',
          captionAr: 'الفحص البصري — scar أنبوب صدر hyperpigmented في الخط الإبطي الأيسر',
          maneuver: 'inspection',
          mediaType: 'image',
        },
        {
          url: '/exam/cases/as-mr/palpation.mp4',
          caption: 'Cardiac palpation — apex beat, heaves, and thrills',
          captionAr: 'جس القلب — نبض الذروة والـ heaves والـ thrills',
          maneuver: 'palpation',
          mediaType: 'video',
        },
        {
          url: '/exam/cases/as-mr/auscultation-as.mpeg',
          caption: 'Aortic Stenosis — ejection systolic murmur (1st aortic area)',
          captionAr: 'تضيق أورطي — نفخة systolic ejection',
          maneuver: 'auscultation',
          mediaType: 'audio',
        },
        {
          url: '/exam/cases/as-mr/auscultation-mr.mpeg',
          caption: 'Mitral Regurgitation — pansystolic murmur at apex',
          captionAr: 'قصور mitral — نفخة pansystolic عند الذروة',
          maneuver: 'auscultation',
          mediaType: 'audio',
        },
      ]),
      labResults: JSON.stringify({
        sections: [
          {
            title: 'CBC / Inflammatory markers',
            titleAr: 'صورة دم / علامات التهاب',
            content:
              'Hb 12.8 g/dL. WBC 9.6×10⁹/L (mildly elevated — recent tonsillitis). Platelets 280,000. ESR 45 mm/hr (elevated). CRP positive.',
            contentAr:
              'Hb 12.8. WBC 9.6 (مرتفع قليلاً). صفائح 280,000. ESR 45 (مرتفع). CRP إيجابي.',
          },
          {
            title: 'ECG',
            titleAr: 'رسم القلب',
            content:
              'Sinus rhythm 90 bpm. LVH with strain (deep S in V1–V2, tall R in V5–V6, ST depression/T inversion lateral). P-mitrale in lead II (LAE).',
            contentAr: 'إيقاع sinus 90. LVH مع strain. P-mitrale (تضخم أذين أيسر).',
          },
          {
            title: 'Echocardiography',
            titleAr: 'إيكو القلب',
            content:
              'Severe AS: calcified rheumatic aortic valve, PG 64 mmHg, AVA 0.8 cm². Double mitral disease: moderate MR + moderate MS (MVA 1.6 cm²). Concentric LVH, LVEF 60%. No pleural effusion.',
            contentAr:
              'تضيق aortic شديد PG 64، AVA 0.8. مرض mitral مزدوج: MR + MS متوسط. LVH متحد المركز EF 60%.',
          },
          {
            title: 'Chest X-Ray',
            titleAr: 'أشعة الصدر',
            content:
              'Boot-shaped heart, enlarged LV, prominent LAA. Mild hyperinflation (asthma). Pleural thickening at right mid-axillary margin (prior chest tube).',
            contentAr: 'قلب boot-shaped. تضخم LV. hyperinflation خفيف. تثخن pleural عند موقع أنبوب الصدر.',
          },
        ],
      }),
      finalDiagnosis:
        'Rheumatic combined valvular heart disease — severe aortic stenosis and mitral regurgitation, complicated by bronchial asthma',
      teachingPoints:
        'Identify rheumatic fever history and penicillin prophylaxis gaps. Recognize AS (ESM, thrill, narrow pulse pressure, soft S2) and MR (pansystolic apical murmur). Note chest tube scar vs denied surgical history. Urgent surgical referral for double valve replacement. Avoid aggressive vasodilation in severe fixed AS.',
      evaluationRubric: JSON.stringify({
        checklist: [
          { item: 'Elicited occupation and Shobra Al-Kheima residence', category: 'History' },
          { item: 'Explored exertional dyspnea, PND, and low cardiac output symptoms', category: 'History' },
          { item: 'Asked about asthma, salbutamol, and childhood rheumatic fever', category: 'History' },
          { item: 'Identified chest tube scar discrepancy vs denied surgical history', category: 'Examination' },
          { item: 'Palpated sustained displaced heaving apex', category: 'Examination' },
          { item: 'Noted systolic thrill at 1st aortic area', category: 'Examination' },
          { item: 'Auscultated AS murmur (soft S2, ESM to carotids)', category: 'Examination' },
          { item: 'Auscultated MR murmur (pansystolic at apex to axilla)', category: 'Examination' },
          { item: 'Interpreted echo: severe AS (PG 64, AVA 0.8) + double mitral disease', category: 'Reasoning' },
          { item: 'Outlined valve surgery and cautioned against aggressive vasodilators in severe AS', category: 'Reasoning' },
        ],
      }),
      vitalSigns: JSON.stringify({
        bp: { value: '105/80 mmHg', note: 'Narrow pulse pressure' },
        hr: { value: '90 bpm', note: 'Regular, small volume / pulsus parvus' },
        rr: { value: '22 bpm', note: 'Tachypneic' },
        temp: { value: '37.2 °C', note: '' },
        spo2: { value: '95%', note: 'Room air' },
      }),
      patientPersonality:
        'Anxious 17-year-old painter, cooperative but minimizes surgical history. Speaks Egyptian Arabic.',
      scenarioPrompt: `You are Tarek Moustafa El-Haddad, 17-year-old Egyptian male house painter from Shobra Al-Kheima.

Chief complaint: shortness of breath for 2 weeks (worsening on top of 5-year progressive exertional dyspnea).

History to reveal when asked:
- PND: wakes gasping after ~2 hours, uses 2 pillows
- Exertional dizziness and blurred vision; denies syncope
- Productive cough, dark yellow sputum ~1/4 cup
- Recent tonsillitis with fever 2 weeks ago
- Childhood rheumatic fever, asthma, repeated tonsillitis
- Depot penicillin every 15 days; Ventolin inhaler
- Denies surgery (IMPORTANT: you have a chest tube scar but will deny surgery unless pressed gently — then admit chest tube for past pleural effusion)
- Works as painter; non-smoker; lives with parents

Do NOT volunteer the diagnosis. Answer in Egyptian Arabic when student uses Arabic.`,
      isPublished: true,
      isFreeTier: true,
    };

    if (!existingCase) {
      await prisma.case.create({ data: caseData });
    } else {
      await prisma.case.update({
        where: { id: existingCase.id },
        data: caseData,
      });
    }
  }

  if (cardiology && beginner) {
    const hfTitle = 'Acute Heart Failure — Dilated Cardiomyopathy';
    const existingHfCase = await prisma.case.findFirst({ where: { titleEn: hfTitle } });
    const hfCaseData = {
      titleEn: hfTitle,
      titleAr: 'قصور قلب حاد — dilated cardiomyopathy',
      specialtyId: cardiology.id,
      difficultyId: beginner.id,
      categoryId: chest.id,
      patientName: 'Samira Abdel Rahman',
      patientAge: 58,
      patientGender: 'Female',
      patientNationality: 'Egyptian',
      patientOccupation: 'Retired teacher',
      patientSmokingStatus: 'Former smoker (quit 5 years ago)',
      chiefComplaint:
        'Progressive shortness of breath and ankle swelling for 3 weeks, worse when lying flat.',
      medicalHistory:
        'Hypertension for 10 years. Type 2 diabetes. No known coronary artery disease. No rheumatic fever.',
      medicationHistory: 'Amlodipine 5mg daily, Metformin 500mg twice daily. Poor adherence reported.',
      surgicalHistory: 'No previous cardiac surgery.',
      familyHistory: 'Father died of heart failure at age 62. Sister has hypertension.',
      socialHistory: 'Retired teacher. Former smoker (quit 5 years ago). Sedentary lifestyle.',
      physicalExam:
        'Bilateral basal crepitations. Raised JVP. Bilateral pitting ankle edema. Displaced apex beat. S3 gallop. No murmur.',
      examImages: JSON.stringify([
        {
          url: '/exam/chest-inspection.svg',
          caption: 'Chest inspection — pulmonary congestion signs',
          captionAr: 'الفحص البصري — علامات احتقان رئوي',
          maneuver: 'inspection',
        },
        {
          url: '/exam/chest-palpation.svg',
          caption: 'Palpation — displaced apex and heave',
          captionAr: 'الجس — ذروة منزاحة',
          maneuver: 'palpation',
        },
        {
          url: '/exam/chest-percussion.svg',
          caption: 'Percussion — dullness at bases',
          captionAr: 'النقر — dullness عند القواعد',
          maneuver: 'percussion',
        },
        {
          url: '/exam/chest-auscultation.svg',
          caption: 'Auscultation — bibasal crepitations and S3',
          captionAr: 'الاستماع — crepitations + S3',
          maneuver: 'auscultation',
        },
      ]),
      labResults: JSON.stringify({
        sections: [
          {
            title: 'ECG',
            titleAr: 'رسم القلب ECG',
            content: 'Sinus tachycardia. Left bundle branch block. No acute ST changes.',
            contentAr: 'تسرع sinus. Left bundle branch block. لا تغيرات ST حادة.',
          },
          {
            title: 'Echocardiography',
            titleAr: 'إيكو القلب',
            content:
              'Severely reduced LV ejection fraction (~30%). Dilated left ventricle. Moderate functional mitral regurgitation.',
            contentAr: 'EF منخفض (~30%). dilatation ventricle أيسر. regurgitation mitral وظيفي.',
          },
          {
            title: 'Chest X-ray',
            titleAr: 'أشعة الصدر',
            content: 'Cardiomegaly. Pulmonary venous congestion. Kerley B lines. Small pleural effusions.',
            contentAr: 'تضخم القلب. احتقان وريدي رئوي. Kerley B lines.',
          },
          {
            title: 'Blood tests',
            titleAr: 'تحاليل الدم',
            content: 'BNP markedly elevated (980 pg/mL). Creatinine mildly elevated. HbA1c 8.2%.',
            contentAr: 'BNP مرتفع (980). كreatinine مرتفع قليلاً. HbA1c 8.2%.',
          },
        ],
      }),
      finalDiagnosis: 'Acute decompensated heart failure secondary to dilated cardiomyopathy',
      teachingPoints:
        'Recognize heart failure (dyspnea, orthopnea, PND, edema). Interpret BNP and echo. Know acute management with diuretics and afterload reduction.',
      evaluationRubric:
        'Introduction (10%), Presenting complaint (20%), Cardiac history (25%), Examination (20%), Diagnosis & management (15%), Professionalism (10%)',
      vitalSigns: JSON.stringify({
        bp: { value: '145/95 mmHg', note: 'Hypertensive' },
        hr: { value: '105 bpm', note: 'Tachycardia' },
        temp: { value: '36.8 °C', note: '' },
        spo2: { value: '91%', note: 'Room air' },
      }),
      patientPersonality:
        'Anxious older woman, breathless when speaking, cooperative but fatigued.',
      scenarioPrompt:
        'Background: 58-year-old Egyptian woman with breathlessness and ankle swelling for 3 weeks. Do not mention any details unless the doctor asks.',
      isPublished: true,
    };

    if (!existingHfCase) {
      await prisma.case.create({ data: hfCaseData });
      console.log('  + Case created: Acute Heart Failure');
    } else {
      await prisma.case.update({ where: { id: existingHfCase.id }, data: hfCaseData });
      console.log('  ~ Case updated: Acute Heart Failure');
    }
  }

  const aiProvider = process.env.AI_PROVIDER || 'openrouter';
  const aiModel = process.env.OPENAI_MODEL || 'openai/gpt-4o';
  const existingAI = await prisma.aISettings.findFirst();
  if (existingAI) {
    await prisma.aISettings.update({
      where: { id: existingAI.id },
      data: { provider: aiProvider, patientModel: aiModel, examinerModel: aiModel },
    });
  } else {
    await prisma.aISettings.create({
      data: { provider: aiProvider, patientModel: aiModel, examinerModel: aiModel },
    });
  }

  await ensurePartnerUniversities(prisma);

  await seedQbankCatalog(prisma);

  await prisma.siteSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });

  console.log('Seed completed!');
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
  console.log('Students (password for all: Student@123456):');
  console.log('  student@synoza.com          — Free (3 tries/case)');
  console.log('  student2@synoza.com         — Free');
  console.log('  student.basic@synoza.com    — Basic 150 EGP / 50 cases');
  console.log('  student.pro@synoza.com      — Pro 300 EGP / 150 cases');
  console.log('  student.premium@synoza.com  — Premium 500 EGP / 300 cases');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
