# Missing case media (production)

Database case records and media URLs are intact. The **files themselves** were deleted during app deploy.
Only packaged `as-mr` media still exists on disk.

**Total missing files:** 69

## How to restore
1. Collect original uploads from the client / admin machine.
2. In Admin → Cases → edit each case below.
3. Re-upload each missing file into the matching maneuver slot.
4. New uploads go to `/home/adminanmkavps/synoza-media/exam/cases/` (survives deploys).

## AS + MR (Aortic Stenosis & Mitral Regurgitation) (3 missing)
- `AS---PULMONARY-STENOSIS.mp3` — slot: `auscultation` — url: `/exam/cases/as-mr-aortic-stenosis-mitral-regurgitation/AS---PULMONARY-STENOSIS.mp3`
- `Mitral_Regurgitation_MR_Heart_Auscultation_Episode_4MP3_160K2.mp3` — slot: `auscultation` — url: `/exam/cases/as-mr-aortic-stenosis-mitral-regurgitation/Mitral_Regurgitation_MR_Heart_Auscultation_Episode_4MP3_160K2.mp3`
- `5836913327987166802.jpg` — slot: `auscultation` — url: `/exam/cases/as-mr-aortic-stenosis-mitral-regurgitation/5836913327987166802.jpg`

## Ascites (3 missing)
- `ASCITES.png` — slot: `inspection` — url: `/exam/cases/ascites/ASCITES.png`
- `ASCITES-PALPATION.mp4` — slot: `palpation` — url: `/exam/cases/ascites/ASCITES-PALPATION.mp4`
- `ASCITES-PERCUSSION.mp4` — slot: `percussion` — url: `/exam/cases/ascites/ASCITES-PERCUSSION.mp4`

## Bilharziasis (Schistosomiasis) (3 missing)
- `Bilharziasis.png` — slot: `inspection` — url: `/exam/cases/bilharziasis-schistosomiasis/Bilharziasis.png`
- `liver palpation.mp4` — slot: `palpation` — url: `/liver palpation.mp4`
- `spleen palpation.mp4` — slot: `palpation` — url: `/spleen palpation.mp4`

## Chronic Heart Failure (5 missing)
- `Chronic-Heart-Failure--HFrEF-.png` — slot: `inspection` — url: `/exam/cases/chronic-heart-failure/Chronic-Heart-Failure--HFrEF-.png`
- `chronic-heart-failure.mp4` — slot: `palpation` — url: `/exam/cases/chronic-heart-failure/chronic-heart-failure.mp4`
- `S3_Heart_Sound_S3_Gallop_Heart_Auscultation_Episode_9MP3_160K2_1.mp3` — slot: `auscultation` — url: `/exam/cases/chronic-heart-failure/S3_Heart_Sound_S3_Gallop_Heart_Auscultation_Episode_9MP3_160K2_1.mp3`
- `Mitral_Regurgitation_MR_Heart_Auscultation_Episode_4MP3_160K2.mp3` — slot: `auscultation` — url: `/exam/cases/chronic-heart-failure/Mitral_Regurgitation_MR_Heart_Auscultation_Episode_4MP3_160K2.mp3`
- `5836913327987166802.jpg` — slot: `auscultation` — url: `/exam/cases/chronic-heart-failure/5836913327987166802.jpg`

## Chronic Mitral Regurgitation (4 missing)
- `Chronic-Mitral-Regurgitation.png` — slot: `inspection` — url: `/exam/cases/chronic-mitral-regurgitation/Chronic-Mitral-Regurgitation.png`
- `Chronic-Mitral-Regurgitation.mp4` — slot: `palpation` — url: `/exam/cases/chronic-mitral-regurgitation/Chronic-Mitral-Regurgitation.mp4`
- `Mitral_Regurgitation_MR_Heart_Auscultation_Episode_4MP3_160K2.mp3` — slot: `auscultation` — url: `/exam/cases/chronic-mitral-regurgitation/Mitral_Regurgitation_MR_Heart_Auscultation_Episode_4MP3_160K2.mp3`
- `5836913327987166802.jpg` — slot: `auscultation` — url: `/exam/cases/chronic-mitral-regurgitation/5836913327987166802.jpg`

## Chronic Stable Angina (4 missing)
- `Chronic-Stable-Angina.png` — slot: `inspection` — url: `/exam/cases/chronic-stable-angina/Chronic-Stable-Angina.png`
- `Chronic-Stable-Angina.mp4` — slot: `palpation` — url: `/exam/cases/chronic-stable-angina/Chronic-Stable-Angina.mp4`
- `NORMAL-HEART-SOUND.mp3` — slot: `auscultation` — url: `/exam/cases/chronic-stable-angina/NORMAL-HEART-SOUND.mp3`
- `5836913327987166802.jpg` — slot: `?` — url: `/exam/cases/chronic-stable-angina/5836913327987166802.jpg`

## Chronic Viral Hepatitis (3 missing)
- `Chronic-Viral-Hepatitis.png` — slot: `inspection` — url: `/exam/cases/chronic-viral-hepatitis/Chronic-Viral-Hepatitis.png`
- `palmar_erythema_hand.jpg` — slot: `inspection` — url: `/palmar_erythema_hand.jpg`
- `liver palpation.mp4` — slot: `palpation` — url: `/liver palpation.mp4`

## Classic Mitral Stenosis (4 missing)
- `Classic-Mitral-Stenosis2.png` — slot: `inspection` — url: `/exam/cases/classic-mitral-stenosis/Classic-Mitral-Stenosis2.png`
- `Classic-Mitral-Stenosis.mp4` — slot: `palpation` — url: `/exam/cases/classic-mitral-stenosis/Classic-Mitral-Stenosis.mp4`
- `MS.mp3` — slot: `auscultation` — url: `/exam/cases/classic-mitral-stenosis/MS.mp3`
- `5836913327987166802.jpg` — slot: `auscultation` — url: `/exam/cases/classic-mitral-stenosis/5836913327987166802.jpg`

## Gastroesophageal Reflux Disease (GERD) (1 missing)
- `Gastroesophageal-Reflux-Disease--GERD.png` — slot: `inspection` — url: `/exam/cases/gastroesophageal-reflux-disease-gerd/Gastroesophageal-Reflux-Disease--GERD.png`

## Hepatocellular Carcinoma (4 missing)
- `Hepatocellular-Carcinoma.png` — slot: `inspection` — url: `/exam/cases/hepatocellular-carcinoma/Hepatocellular-Carcinoma.png`
- `ascites_distended_abdomen.everted_umbilicus.jpg` — slot: `inspection` — url: `/ascites_distended_abdomen.everted_umbilicus.jpg`
- `liver palpation.mp4` — slot: `palpation` — url: `/liver palpation.mp4`
- `spleen palpation.mp4` — slot: `palpation` — url: `/spleen palpation.mp4`

## Irritable Bowel Syndrome (2 missing)
- `ChatGPT-Image-Jul-13--2026--06_20_15-PM.png` — slot: `inspection` — url: `/exam/cases/irritable-bowel-syndrome/ChatGPT-Image-Jul-13--2026--06_20_15-PM.png`
- `liver palpation.mp4` — slot: `palpation` — url: `/liver palpation.mp4`

## Liver Cirrhosis (Decompensated) (6 missing)
- `Liver-Cirrhosis--Decompensated-.png` — slot: `inspection` — url: `/exam/cases/liver-cirrhosis-decompensated/Liver-Cirrhosis--Decompensated-.png`
- `bilateral_pitting_edema_leg.jpg` — slot: `inspection` — url: `/bilateral_pitting_edema_leg.jpg`
- `Jaundice_.jpg` — slot: `inspection` — url: `/Jaundice_.jpg`
- `leukonychia_hand.jpg` — slot: `inspection` — url: `/leukonychia_hand.jpg`
- `palmar_erythema_hand.jpg` — slot: `inspection` — url: `/palmar_erythema_hand.jpg`
- `spleen palpation.mp4` — slot: `palpation` — url: `/spleen palpation.mp4`

## MR + AR + Thalassemia Major (5 missing)
- `MR---AR---Thalassemia-Major.png` — slot: `inspection` — url: `/exam/cases/mr-ar-thalassemia-major/MR---AR---Thalassemia-Major.png`
- `MR---AR---Thalassemia-Major.mp4` — slot: `palpation` — url: `/exam/cases/mr-ar-thalassemia-major/MR---AR---Thalassemia-Major.mp4`
- `Mitral_Regurgitation_MR_Heart_Auscultation_Episode_4MP3_160K2.mp3` — slot: `auscultation` — url: `/exam/cases/mr-ar-thalassemia-major/Mitral_Regurgitation_MR_Heart_Auscultation_Episode_4MP3_160K2.mp3`
- `Aortic-Regurgitation--normal-speed-MP3_160K-.mp3` — slot: `auscultation` — url: `/exam/cases/mr-ar-thalassemia-major/Aortic-Regurgitation--normal-speed-MP3_160K-.mp3`
- `5836913327987166802.jpg` — slot: `auscultation` — url: `/exam/cases/mr-ar-thalassemia-major/5836913327987166802.jpg`

## Peptic Ulcer Disease (2 missing)
- `Peptic-Ulcer-Disease.png` — slot: `inspection` — url: `/exam/cases/peptic-ulcer-disease/Peptic-Ulcer-Disease.png`
- `liver palpation.mp4` — slot: `palpation` — url: `/liver palpation.mp4`

## Portal Hypertension (3 missing)
- `Portal-Hypertension.png` — slot: `inspection` — url: `/exam/cases/portal-hypertension/Portal-Hypertension.png`
- `ascites_distended_abdomen.everted_umbilicus.jpg` — slot: `inspection` — url: `/ascites_distended_abdomen.everted_umbilicus.jpg`
- `spleen palpation.mp4` — slot: `palpation` — url: `/spleen palpation.mp4`

## Prosthetic Valve Replacement (4 missing)
- `Prosthetic-Valve-Replacement.png` — slot: `inspection` — url: `/exam/cases/prosthetic-valve-replacement/Prosthetic-Valve-Replacement.png`
- `video5954128306499494155.mp4` — slot: `palpation` — url: `/exam/cases/prosthetic-valve-replacement/video5954128306499494155.mp4`
- `Prosthetic_Mitral_Valve_Closing_Click_normal_speedMP3_160K.mp3` — slot: `auscultation` — url: `/exam/cases/prosthetic-valve-replacement/Prosthetic_Mitral_Valve_Closing_Click_normal_speedMP3_160K.mp3`
- `5836913327987166802.jpg` — slot: `?` — url: `/exam/cases/prosthetic-valve-replacement/5836913327987166802.jpg`

## Pulmonary Hypertension (4 missing)
- `Pulmonary-Hypertension.png` — slot: `inspection` — url: `/exam/cases/pulmonary-hypertension/Pulmonary-Hypertension.png`
- `Pulmonary-Hypertension.mp4` — slot: `palpation` — url: `/exam/cases/pulmonary-hypertension/Pulmonary-Hypertension.mp4`
- `TR.mp3` — slot: `auscultation` — url: `/exam/cases/pulmonary-hypertension/TR.mp3`
- `5836913327987166802.jpg` — slot: `?` — url: `/exam/cases/pulmonary-hypertension/5836913327987166802.jpg`

## Rheumatic Triple Valve Disease (MS, TR & TS) (5 missing)
- `Rheumatic-Triple-Valve-Disease--MS--TR---TS-.png` — slot: `inspection` — url: `/exam/cases/rheumatic-triple-valve-disease-ms-tr-ts/Rheumatic-Triple-Valve-Disease--MS--TR---TS-.png`
- `Rheumatic-Triple-Valve-Disease--MS--TR---TS-.mp4` — slot: `palpation` — url: `/exam/cases/rheumatic-triple-valve-disease-ms-tr-ts/Rheumatic-Triple-Valve-Disease--MS--TR---TS-.mp4`
- `MS.mp3` — slot: `auscultation` — url: `/exam/cases/rheumatic-triple-valve-disease-ms-tr-ts/MS.mp3`
- `TR.mp3` — slot: `auscultation` — url: `/exam/cases/rheumatic-triple-valve-disease-ms-tr-ts/TR.mp3`
- `5836913327987166802.jpg` — slot: `auscultation` — url: `/exam/cases/rheumatic-triple-valve-disease-ms-tr-ts/5836913327987166802.jpg`

## VSD (Ventricular Septal Defect) (4 missing)
- `VSD--Ventricular-Septal-Defect-.png` — slot: `inspection` — url: `/exam/cases/vsd-ventricular-septal-defect/VSD--Ventricular-Septal-Defect-.png`
- `video5954128306499494169.mp4` — slot: `palpation` — url: `/exam/cases/vsd-ventricular-septal-defect/video5954128306499494169.mp4`
- `5836913327987166802.jpg` — slot: `auscultation` — url: `/exam/cases/vsd-ventricular-septal-defect/5836913327987166802.jpg`
- `Ventricular-Septal-Defect--VSD----Heart-Auscultation---Episode-11-MP3_160K--2-.mp3` — slot: `auscultation` — url: `/exam/cases/vsd-ventricular-septal-defect/Ventricular-Septal-Defect--VSD----Heart-Auscultation---Episode-11-MP3_160K--2-.mp3`
