# Spreadsheet review: what changed and what to verify

Every calculator reproduces the original spreadsheet result for the sheet's own inputs (`node tests/run.js`, 92 checks).
The items below are where the web version deliberately differs from the spreadsheet, or where I could not verify the method.

## Formula fixes

| Calculator | Issue in the spreadsheet | Web version |
|---|---|---|
| Current imbalance | `Im = MAX(Imax-Iav, Imin-Iav)`. `Imin-Iav` is never positive, so a low phase was ignored. Example: 140 / 140 / 100 A gave 13.3 A instead of 26.7 A. | Uses the absolute deviation of all phases. |
| Current imbalance | FLC of 140 was typed into the % unbalance formula and `CTR = 140/0.56` was typed into a cell. | FLC and CT ratio are inputs. |
| Differential stability | One cell used a 2% tolerance, the other five used 1.5%. | One tolerance input (default 1.5%). |
| Differential stability | Error was divided by the relay reading. | Divided by the expected value (injected x CT ratio). |
| Differential pickup | HV injection value `O87P x Ip` was never divided by the CT ratio, so it only worked for a 1000:1 CT. | CT ratio applied. |
| Differential pickup | LV Ph-E in the summary block always used sqrt(3); the second block used the W2CTC lookup. | Both use the W2CTC lookup. |
| Differential pickup | Injection formulas had 3, 2 and sqrt(3) typed in, valid only for W1CTC 12 / W2CTC 11. | Multiplier comes from the lookup, and a warning shows for other combinations. |
| Loss of field | Phi returned the text "IDK" when the offset was not negative. | 270 deg if the circle centre is below the R axis, otherwise 90 deg. |
| Loss of field | Two copies of the whole sheet. The test copy had Xd = 118 and X'd = 20 (percent) while the other used per-unit. | One page with a mode switch and two presets. Xd and X'd are per-unit, with a warning if they look like percent. |
| REF630 | Ph-Ph test table used min resistive reach for the parallel line; the graph sheet used max. | Max. |
| REF630 | Ph-E graph used the min ground reach for the top-right corner; the relay table used max. | Max. |
| REF630 | Graph drew the lower line at a fixed 45 deg; the Omicron table used 360 - max phase angle (300 deg). | Both use 360 - max phase angle, so the plot matches what gets tested. |
| REF630 | Tilt-angle table referenced empty cells (D22, D28) and was unfinished. | Not carried over. Tell me the intended behaviour and I will add it. |
| Underpower | Settings were text ("80kW"), the power formula used typed phase voltages (1905 V), and the current was typed in rather than calculated. | Numeric settings, VT ratio inputs, current calculated for each setting. Results differ by about 0.01 kW because 3300 / sqrt3 = 1905.26 V. |
| Volts/Hz | The 63.51 V input was labelled L-L but is a line-to-neutral value (110 V / sqrt3). | Label no longer assumes a basis. |

## Please verify against relay manuals

These are carried over from the spreadsheet because I cannot confirm them from the files alone.

1. **SEL-787 Ph-E multiplier table** (W1CTC / W2CTC): odd = sqrt(3), 2/4/8/10 = 3, 6/12 = 1.5. Note that 9 appears in the sheet's list of 3s but is odd, so it always returned sqrt(3).
2. **Injection formulas** for the differential pickup test (the `(3 x LL + Ib + Ic) / 2` and `LL x sqrt3 + Ic` forms).
3. **Current imbalance basis**: % of FLC below FLC, % of average current at or above FLC.
4. **Underpower**: the page reports whether power is above or below each setting and does not assume which direction operates.

## Not converted

- The Excel charts in the Loss of Field and REF630 workbooks and the "Graphing Guide" images in REF630. The web pages draw their own plots.
- The 40-row angle table in the Loss of Field "Curve" sheet (replaced by a 5 degree step calculation).
