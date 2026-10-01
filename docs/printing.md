# Printing accurately

FacePrint output is fixed at 1:1. It does not provide a scale control and cannot force another application's printer settings.

When printing the saved PDF:

- choose **100%** or **Actual Size**, never Fit or Shrink;
- print one PDF page per physical sheet and single-sided;
- use the same paper size shown in FacePrint;
- check a known horizontal and vertical dimension before cutting;
- align/assemble sheets in PDF page order.

The default zero-margin mode creates full physical-size PDF pages without crop marks or labels. That does not make a printer borderless: hardware with unprintable edges can clip boundary strokes. Use the explicit 5 mm margin preset when appropriate for the printer. It reduces usable tile area and can increase the page count; it does not rescale geometry.

Software coordinates and page boxes do not guarantee paper accuracy. Printer calibration, paper feed, humidity, and external PDF software can introduce error. A physical seam-spanning calibration print has not yet been recorded for this implementation.
