package tiling

import (
	"fmt"
	"math"
	"strings"
	"sync"

	upstream "github.com/oxplot/pdftilecut"
)

// TileOptions is the application-owned tiling contract. Printable dimensions
// are millimetres at this boundary, regardless of upstream representation.
type TileOptions struct {
	Paper       string  `json:"paper"`
	Orientation string  `json:"orientation"`
	MarginMM    float64 `json:"marginMM"`
	FullPage    bool    `json:"fullPage"`
}

type Tiler interface {
	TilePDF(input []byte, opts TileOptions) ([]byte, error)
}

type PDFTileCut struct {
	mu sync.Mutex
}

func NewPDFTileCut() *PDFTileCut { return &PDFTileCut{} }

func validate(opts TileOptions) error {
	switch strings.ToUpper(opts.Paper) {
	case "A4", "A3", "A2":
	default:
		return fmt.Errorf("unsupported paper %q", opts.Paper)
	}
	switch strings.ToLower(opts.Orientation) {
	case "auto", "portrait", "landscape":
	default:
		return fmt.Errorf("unsupported orientation %q", opts.Orientation)
	}
	if math.IsNaN(opts.MarginMM) || math.IsInf(opts.MarginMM, 0) || opts.MarginMM < 0 || opts.MarginMM > 50 {
		return fmt.Errorf("margin must be between 0 and 50 mm")
	}
	if opts.FullPage && opts.MarginMM != 0 {
		return fmt.Errorf("full-page output cannot include a positive margin")
	}
	return nil
}

func (p *PDFTileCut) TilePDF(input []byte, opts TileOptions) ([]byte, error) {
	if err := validate(opts); err != nil {
		return nil, err
	}
	upstreamOptions := mapOptions(opts)

	// The upstream revision also serializes internally. Keep serialization at
	// this adapter boundary so callers never depend on native reentrancy.
	p.mu.Lock()
	defer p.mu.Unlock()
	result, err := upstream.TilePDF(input, upstreamOptions)
	if err != nil {
		return nil, fmt.Errorf("pdftilecut: %w", err)
	}
	return result, nil
}

func mapOptions(opts TileOptions) upstream.Options {
	result := upstream.Options{
		TileSize:    strings.ToUpper(opts.Paper),
		Orientation: strings.ToLower(opts.Orientation),
		FullPage:    opts.FullPage,
		NoMarks:     true,
	}
	if opts.MarginMM > 0 {
		// The pinned upstream API accepts a dimension string and documents mm.
		result.Margin = fmt.Sprintf("%.6gmm", opts.MarginMM)
	}
	return result
}
