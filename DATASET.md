# Dataset and attribution

UCI Machine Learning Repository dataset 411: Extension of Z-Alizadeh Sani, 303 records, CC BY 4.0. UCI identifies Cath as the angiography result and advises retaining only one of Cath/LAD/LCX/RCA as the target. This prototype trains four independent targets and excludes all four columns from every feature matrix.

The workbook spells the female category as “Fmale”; training normalizes it to “Female” before the schema and models are generated. Target labels are “Stenotic”/“Normal” for vessels and “CAD”/“Normal” for Cath.

Source: https://archive.ics.uci.edu/dataset/411/extention%2Bof%2Bz%2Balizadeh%2Bsani%2Bdataset
Citation: Alizadehsani, R., Roshanzamir, M., & Sani, Z. (2013). Extension of Z-Alizadeh Sani Dataset. UCI Machine Learning Repository. https://doi.org/10.24432/C5461K.
Raw workbook is not bundled; fetch from UCI or supply a local XLSX/CSV to training.