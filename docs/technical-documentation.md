# CADViz technical documentation

## 1. Problem and scope
CADViz visualizes overall CAD and vessel-level LAD, LCX, and RCA model estimates from structured inputs. It is an educational hackathon prototype, not a clinical product.

## 2. Data and leakage control
UCI Extension of Z-Alizadeh Sani dataset 411 (303 records, CC BY 4.0). Cath is the overall CAD angiography label. All four target columns (Cath, LAD, LCX, RCA) are excluded from every input matrix. The source workbook spells female as “Fmale”; preprocessing corrects it to “Female”. Target encodings are normalized explicitly; unknown labels fail closed. See DATASET.md for attribution.

## 3. Methods and results
Four independent L2 logistic classifiers use numeric median imputation/standardization and categorical mode imputation/one-hot encoding. Repeated stratified 5-fold CV (when class counts permit) runs on the training partition; a stratified 20% holdout remains untouched. Sigmoid calibration is fit to cross-fitted training margins. Metrics include accuracy, precision, recall, F1, ROC-AUC, PR-AUC, and Brier score in ml/artifacts/metrics.json. Native scikit-learn extensions were blocked by host application control, so the prototype uses an explicit NumPy implementation; this removes tree-model comparison but keeps the pipeline inspectable and reproducible.

## 4. Explainability
Exact linear SHAP values are calculated for calibrated log-odds under an independent-feature assumption: coefficient times deviation from the training-background feature mean. Contributions are signed, show transformed feature names, and describe model output rather than physiology or causation.

## 5. 3D mapping and limitations
Three.js (React Three Fiber) renders a procedurally generated anatomical heart inspired by classical anatomical-plate illustration (Beau/Bourgery): a parametric ventricular mass with a pointed apex sweeping down/forward/left, a flattened diaphragmatic underside, deep interventricular grooves meeting at the apex, atria with wrinkled left/right atrial appendages, an atrial skirt shell that blends the ventricular base continuously into the atrial mass, aortic arch and branch vessels, pulmonary artery and veins, cream epicardial fat along the atrioventricular groove and crux, and surface-mapped LAD, LCX, and RCA paths with conus, diagonal, obtuse-marginal, acute-marginal, apical-twig, and full-length posterior-descending branches. A static steel-blue venous system (great/middle cardiac veins, posterior LV vein, small cardiac vein, coronary sinus) provides anatomical context only and is never risk-weighted. The myocardium uses a warm flesh-tone procedural texture with capillary webbing, base-to-apex fiber striations, and bump/roughness shading, plus an optional heartbeat animation. Anterior/Left/Posterior/Right camera presets mirror the four figures of the reference plate.

Each vessel is colored continuously by its vessel-level probability (teal → amber → red ramp), with emissive and additive halo intensity scaling with the estimate, and selectability plus a percentage tag per vessel. The territory supplied by each vessel is rendered as a diffuse, vertex-alpha patch over the myocardium whose intensity follows that vessel's estimate — shown only for the selected or hovered vessel. Selecting a vessel scopes the readout (SHAP contributions, band, metrics) to that target; the overall CAD target shows all territories faintly. Rotation, zoom, damped auto-rotate, translucent myocardium, and view reset are supported.

Dataset inputs have no lesion coordinates; focal markers, stenosis grading, and lesion localization are never shown — risk is rendered only at vessel and perfusion-territory level, with a persistent on-screen note stating this. Colors and glow communicate model probability only, not anatomy or flow.

## 6. Safety, ethics, and future work
Outputs are experimental/educational, not a diagnosis or substitute for angiography, imaging, formal assessment, or clinical care. The app includes an acknowledgement and persistent safety banner. Reference values are illustrative context, explicitly separated from the model output, and must not be used as clinical classifications. BP provides systolic only, not a complete BP reading; the dataset has no total cholesterol field; hemoglobin ranges vary by sex and laboratory. The dataset is small and historical; external validation, broader calibration and fairness analyses, and clinician review would be required before clinical use.

Reference sources for UI context: [AHA blood-pressure categories](https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings), [NHLBI cholesterol guidance](https://www.nhlbi.nih.gov/health/blood-cholesterol/diagnosis), [NHLBI fasting glucose](https://www.nhlbi.nih.gov/health/metabolic-syndrome/diagnosis), and [AHA ejection fraction](https://www.heart.org/en/health-topics/heart-failure/diagnosing-heart-failure/ejection-fraction-heart-failure-measurement).

## 7. Interface
A three-column dashboard: curated clinical inputs (risk, presentation, vitals and labs, ECG/echo tabs; unlisted features held at dataset defaults), the 3D heart stage, and a readout rail with probability, low/intermediate/high band, holdout metrics, top SHAP contributions, global influence, and reference context. Predictions recompute automatically with a short debounce after any input change; a target selector in the top bar switches the readout between CAD, LAD, LCX, and RCA. A reset control restores dataset defaults.

## Five-minute demo
0:00–0:30 problem and safety; 0:30–1:30 dataset and leakage guard; 1:30–3:30 profile input, rotate the heart, select vessels; 3:30–4:30 explain contributions and location limitation; 4:30–5:00 wrap-up.

