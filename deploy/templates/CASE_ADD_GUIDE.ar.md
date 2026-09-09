# دليل إضافة Case جديد (بعد تحديثات الجامعات والـ Station)

> بلغة بسيطة — خطوة بخطوة من الأدمن

---

## 1) قبل ما تبدأ

| حاجة | فين |
|------|-----|
| الجامعات | Admin → **Site Content** → Partner Universities |
| التخصص / الصعوبة / القسم | موجودين في النظام — هتختارهم من القوائم |
| صور/صوت الفحص | Admin → Case → **Media** (أو ارفع على السيرفر تحت `/exam/cases/...`) |

---

## 2) طريقتين تضيف بيهم الـ Case

### الطريقة أ — Import (أسرع للمحتوى الكبير)

1. افتح **Admin → OSCE Cases**
2. **Import / Paste**
3. انسخ من الملف: `deploy/templates/case-import-template.ts`
4. **Parse** → راجع البيانات → **Save**
5. **مهم:** الاستيراد **مش** بيحط إعدادات الـ Station — لازم الخطوة 3 تحت

### الطريقة ب — Add case يدوي

1. **Add case**
2. املأ كل الأقسام (Patient, History, Physical exam, Labs, …)
3. **Save**

---

## 3) إعداد الـ Station (الجزء الجديد المهم)

بعد ما تحفظ الحالة، في **نفس صفحة التعديل** → قسم **Station**:

### أ) Maneuvers (خطوات الفحص)

علّم اللي الطالب **هيعملها** في الامتحان:

- Inspection
- Palpation
- Percussion
- Auscultation

**مثال:** حالة قلب → غالباً Inspection + Palpation + Auscultation (من غير Percussion)

### ب) History examiner

- ✅ = الطالب يتExamined شفهياً بعد التاريخ (viva)
- ❌ = يكلم المريض بس

### c) Investigations stage

- ✅ = يظهر تبويب الفحوصات والـ labs
- ❌ = يعدّي على Diagnosis بعد الفحص

### d) Examiner opening message (رسالة الممتحن)

**دي الجملة اللي في الصورة** — أول ما الطالب يدخل Inspection مثلاً.

- **سيب الحقل فاضي** = النص الافتراضي الإنجليزي
- **اكتب نصك** = يظهر للطالب زي ما كتبته

**مثال Inspection:**

```
Look at the precordium and neck veins. Describe inspection findings 
for this valvular case in a systematic way.
```

**مثال Auscultation:**

```
Auscultate all valve areas. Characterize each murmur: timing, site, 
radiation. Which valve lesion does each suggest?
```

شكل الـ JSON لو حابب تشوفه: `deploy/templates/case-station-config.example.json`

---

## 4) Override لجامعة معينة (اختياري)

لو **قاهرة** مثلاً عندها OSCE مختلف عن **عين شمس**:

1. في نفس صفحة الحالة → **University OSCE flow overrides**
2. اختار الجامعة من القائمة
3. ظبط:
   - Maneuvers مختلفة
   - Investigations on/off
   - History examiner on/off
   - **رسائل الممتحن** لكل maneuver (لو عايز نص مختلف عن الافتراضي)
4. **Save university override**

| مين يشوف إيه؟ |
|----------------|
| طالب **من غير** override → الإعداد **الافتراضي** في قسم Station |
| طالب **جامعة فيها override** → إعداد الجامعة |
| طالب **من غير جامعة مسجلة** → الافتراضي العام بس |

مثال API: `deploy/templates/case-university-override.example.json`

---

## 5) Qbank (منفصل عن الـ Case)

**Admin → Q-Bank → Modules**

- Module **من غير جامعات** = يظهر لكل الطلبة
- Module **مربوط بجامعات** = يظهر لطلبة الجامعات دي بس

---

## 6) Checklist قبل Publish

- [ ] Title EN / AR
- [ ] Specialty + Difficulty + Category (Board)
- [ ] scenarioPrompt (عامية المريض لو عربي)
- [ ] Physical exam + صور/صوت لكل maneuver
- [ ] Labs / investigations
- [ ] Final diagnosis + teaching points
- [ ] Station: maneuvers + history examiner + investigations
- [ ] رسائل الممتحن (لو محتاج تخصيص)
- [ ] University overrides (لو في اختلاف بين الجامعات)
- [ ] **Published** ✅
- [ ] **Free tier** (لو عايزها مجانية للتجربة)

---

## 7) مثال سريع — حالة AS + MR

```
الافتراضي (كل الجامعات):
  History ✅ + History examiner ✅
  Examination: Inspection, Palpation, Auscultation
  Investigations ✅
  Diagnosis ✅

Override — Cairo University:
  History ✅ + History examiner ❌
  Examination: Inspection, Palpation بس
  Investigations ❌
  رسالة Inspection مخصصة: "Describe precordium in 2 minutes..."
```

---

## 8) ملفات القوالب في المشروع

| ملف | استخدامه |
|-----|----------|
| `deploy/templates/case-import-template.ts` | Paste في Import |
| `deploy/templates/case-station-config.example.json` | مرجع شكل Station |
| `deploy/templates/case-university-override.example.json` | مرجع Override |

---

## 9) مشاكل شائعة

| المشكلة | الحل |
|---------|------|
| الطالب مش شايف مرحلة Investigations | اتأكد `enableInvestigations` ✅ في Station أو Override |
| رسالة الممتحن لسه الافتراضي | اكتب في textarea الـ maneuver واحفظ Case |
| طالب جامعة تانية شايف maneuvers غلط | شوف Override للجامعة دي — أو امسحه يرجع للافتراضي |
| Import نجح بس Station فاضي | طبيعي — Station دايماً من الفورم بعد Save |

---

**آخر خطوة:** Save → جرّب session كطالب من جامعة مختلفة وتأكد المسار والرسائل.
