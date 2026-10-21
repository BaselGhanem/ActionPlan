# Design QA — ActionPlan

Source visual truth: selected first image, `generated_images/exec-47570c29-3ef7-4a19-bed6-137792d02731.png` (parent workspace).
Browser-rendered implementation: `/workspace/scratch/actionplan-desktop-final.jpg`.
Full-view comparison: `qa/comparison.jpg` (local verification artifact).
Focused drawer comparison: `qa/drawer-comparison.jpg`.
Mobile evidence: `qa/mobile.jpg`.

## State and normalization

Arabic RTL customer directory, first customer selected, scientific activity, USD 600 split USD 300/300 between Cardio and Primary Care. Source 1488 × 1058; implementation browser viewport 1363 × 936 CSS pixels at density 1. Both use the desktop responsive branch. Full-view source is proportionally downsampled for comparison; there is no claim of pixel-identical matching at unequal viewport dimensions. Focused crops preserve pixels for typography and control comparison. Mobile uses a real 390 × 844 iframe viewport, cropped from the browser screenshot without rescaling.

## Comparison history

- Initial P2: page-level scrolling could move the filter header under the sticky top bar. Fixed by giving workspace a viewport height and main content its own scroll container. Verified in the revised browser capture.
- Initial P2: excessive sidebar width and two filter rows crowded the working table at laptop width. Reduced desktop sidebar to 190px, header to 80px, and aligned five requested filters in one row. Verified in full-view comparison.
- Initial P1: immediate full-screen mobile drawer prevented adding a second customer. Added a searchable customer selector inside the drawer. Browser-tested selecting a second customer and returning to a two-customer allocation.
- Initial P2: money inputs normalized every keystroke, risking loss of partially entered decimals. Added local editing text and normalization on blur; currency domain remains integer cents.

## Required fidelity surfaces

- Typography: Cairo Arabic with Inter numeric fields. Hierarchy, strong customer name, readable form labels, tabular dollar amounts. Slight optical differences from image-generated text are acceptable P3.
- Spacing/layout: deep blue right sidebar, central customer table, white left drawer, pale filter panel and fixed orange save action retained. Real product adds group-client selection, status, actual spending and notes; drawer therefore scrolls at shorter laptop heights while save stays visible. This is an intentional scope adaptation.
- Colors/tokens: #0B457F primary, #F07D00 CTA and selection, #F8FAFC background, pale blue table headers and subdued borders match selected direction.
- Assets: source uses textual brand rather than supplied logo; textual Dar Al Dawa preserved. Phosphor icon library used. No fabricated logo, stock portraits or decorative raster placeholders.
- Copy: Arabic interface, USD labels, unambiguous planned/actual rules. Fictional demo is clearly marked and cannot write to Firebase. Production starts at login with empty data.

## Browser interactions tested

- Customer selection and side panel.
- USD 600 automatically split 300/300; equal redistribution.
- Saving in demo updates local activities and balances.
- Group allocation mismatch is blocked with a toast.
- Classification disabled until a team is selected; team + A filter returns four demo customers.
- Reports navigation and Excel export success state.
- Generated workbook inspected independently: five worksheets, 12,239-byte XLSX test output.
- Mobile full-screen allocation and adding second customer through selector.
- No desktop document horizontal overflow.
- Browser console inspected: no application-origin errors; extension-origin metadata errors excluded.

## Remaining limits

Live Firebase authentication profiles, functions, permission checks and concurrency are not yet deployed/tested against the user's project because deployment credentials are unavailable. This QA pass covers the visual frontend and demo, not production backend acceptance. Domain tests passed; production build and Sites packaging tests passed. Browser download event did not resolve in this environment despite export-success state; workbook generation was separately verified.

## Follow-up polish

P3: optional denser row mode can be refined after feedback. Numeric difference counters use requestAnimationFrame and honor reduced-motion preferences.

final result: passed
