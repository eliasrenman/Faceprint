package tiling

import (
	"bytes"
	"context"
	"fmt"
	"testing"

	"github.com/eliasrenman/faceprint/internal/pdfinfo"
)

func TestOptionMappingIsCleanAndUnitExplicit(t *testing.T) {
	fullPage := mapOptions(TileOptions{Paper: "A4", Orientation: "landscape", FullPage: true})
	if !fullPage.FullPage || !fullPage.NoMarks || fullPage.Margin != "" {
		t.Fatalf("full-page mapping = %+v", fullPage)
	}
	margin := mapOptions(TileOptions{Paper: "A3", Orientation: "portrait", MarginMM: 5})
	if margin.FullPage || !margin.NoMarks || margin.Margin != "5mm" {
		t.Fatalf("margin mapping = %+v", margin)
	}
}

func TestRealTilerRegressionLayouts(t *testing.T) {
	tiler := NewPDFTileCut()
	tests := []struct {
		name        string
		widthMM     float64
		heightMM    float64
		paper       string
		orientation string
		pages       int
		pageWidth   float64
		pageHeight  float64
	}{
		{"A4 portrait", 900, 297, "A4", "portrait", 5, 210, 297},
		{"A4 landscape", 900, 297, "A4", "landscape", 8, 297, 210},
		{"A3 portrait", 900, 297, "A3", "portrait", 4, 297, 420},
		{"A3 landscape", 900, 297, "A3", "landscape", 3, 420, 297},
		{"A2 portrait", 900, 297, "A2", "portrait", 3, 420, 594},
		{"A2 landscape", 900, 297, "A2", "landscape", 2, 594, 420},
		{"rotated template", 297, 900, "A4", "landscape", 5, 297, 210},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result, err := tiler.TilePDF(testPDF(test.widthMM, test.heightMM), TileOptions{
				Paper: test.paper, Orientation: test.orientation, FullPage: true,
			})
			if err != nil {
				t.Fatal(err)
			}
			info, err := pdfinfo.Inspect(context.Background(), result, 500)
			if err != nil {
				t.Fatal(err)
			}
			if info.PageCount != test.pages {
				t.Fatalf("page count = %d, want %d", info.PageCount, test.pages)
			}
			if difference(info.PageWidthMM, test.pageWidth) > 0.01 || difference(info.PageHeightMM, test.pageHeight) > 0.01 {
				t.Fatalf("page size = %.4f x %.4f mm, want %.1f x %.1f", info.PageWidthMM, info.PageHeightMM, test.pageWidth, test.pageHeight)
			}
		})
	}
}

func TestRealTilerAutoOrientationAndPositiveMargin(t *testing.T) {
	tiler := NewPDFTileCut()
	auto, err := tiler.TilePDF(testPDF(900, 297), TileOptions{Paper: "A4", Orientation: "auto", FullPage: true})
	if err != nil {
		t.Fatal(err)
	}
	autoInfo, err := pdfinfo.Inspect(context.Background(), auto, 500)
	if err != nil {
		t.Fatal(err)
	}
	if autoInfo.PageCount != 5 || autoInfo.ResolvedOrientation != "portrait" {
		t.Fatalf("auto result = %+v", autoInfo)
	}

	margin, err := tiler.TilePDF(testPDF(900, 297), TileOptions{Paper: "A4", Orientation: "portrait", MarginMM: 5})
	if err != nil {
		t.Fatal(err)
	}
	marginInfo, err := pdfinfo.Inspect(context.Background(), margin, 500)
	if err != nil {
		t.Fatal(err)
	}
	if marginInfo.PageCount != 10 {
		t.Fatalf("positive-margin page count = %d, want 10", marginInfo.PageCount)
	}
}

func difference(a, b float64) float64 {
	if a < b {
		return b - a
	}
	return a - b
}

func testPDF(widthMM, heightMM float64) []byte {
	width := widthMM * 72 / 25.4
	height := heightMM * 72 / 25.4
	content := fmt.Sprintf("0.4252 w 0 0 m %.6f %.6f l S\n", width, height)
	objects := []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		fmt.Sprintf("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.6f %.6f] /CropBox [0 0 %.6f %.6f] /TrimBox [0 0 %.6f %.6f] /BleedBox [0 0 %.6f %.6f] /Resources << >> /Contents 4 0 R >>", width, height, width, height, width, height, width, height),
		fmt.Sprintf("<< /Length %d >>\nstream\n%sendstream", len(content), content),
	}
	var result bytes.Buffer
	result.WriteString("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
	offsets := make([]int, len(objects)+1)
	for index, object := range objects {
		offsets[index+1] = result.Len()
		fmt.Fprintf(&result, "%d 0 obj\n%s\nendobj\n", index+1, object)
	}
	xref := result.Len()
	fmt.Fprintf(&result, "xref\n0 %d\n0000000000 65535 f \n", len(objects)+1)
	for index := 1; index <= len(objects); index++ {
		fmt.Fprintf(&result, "%010d 00000 n \n", offsets[index])
	}
	fmt.Fprintf(&result, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(objects)+1, xref)
	return result.Bytes()
}
