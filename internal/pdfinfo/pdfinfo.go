package pdfinfo

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/pdfcpu/pdfcpu/pkg/api"
)

const pointsPerMM = 72.0 / 25.4

type Info struct {
	PageCount           int     `json:"pageCount"`
	PageWidthMM         float64 `json:"pageWidthMM"`
	PageHeightMM        float64 `json:"pageHeightMM"`
	ResolvedOrientation string  `json:"resolvedOrientation"`
}

func Inspect(ctx context.Context, data []byte, maxPages int) (Info, error) {
	if len(data) == 0 {
		return Info{}, errors.New("PDF is empty")
	}
	count, err := api.PageCount(ctx, bytes.NewReader(data), nil)
	if err != nil {
		return Info{}, fmt.Errorf("read PDF page count: %w", err)
	}
	if count < 1 {
		return Info{}, errors.New("PDF has no pages")
	}
	if count > maxPages {
		return Info{}, fmt.Errorf("PDF has %d pages; the limit is %d", count, maxPages)
	}
	dims, err := api.PageDims(ctx, bytes.NewReader(data), nil)
	if err != nil {
		return Info{}, fmt.Errorf("read PDF page dimensions: %w", err)
	}
	if len(dims) != count {
		return Info{}, fmt.Errorf("PDF dimension count %d does not match page count %d", len(dims), count)
	}
	w, h := dims[0].Width/pointsPerMM, dims[0].Height/pointsPerMM
	for i := 1; i < len(dims); i++ {
		wi, hi := dims[i].Width/pointsPerMM, dims[i].Height/pointsPerMM
		if math.Abs(w-wi) > 0.01 || math.Abs(h-hi) > 0.01 {
			return Info{}, fmt.Errorf("output page %d has inconsistent dimensions", i+1)
		}
	}
	orientation := "portrait"
	if w > h {
		orientation = "landscape"
	}
	return Info{PageCount: count, PageWidthMM: w, PageHeightMM: h, ResolvedOrientation: orientation}, nil
}
