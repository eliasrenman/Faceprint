package main

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/eliasrenman/faceprint/internal/files"
	"github.com/eliasrenman/faceprint/internal/pdfinfo"
	"github.com/eliasrenman/faceprint/internal/previews"
	"github.com/eliasrenman/faceprint/internal/tiling"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	maxModelBytes  = 100 << 20
	maxPDFBytes    = 64 << 20
	maxKernelBytes = 64 << 20
	maxPages       = 500
)

type ModelFile struct {
	Filename string `json:"filename"`
	Base64   string `json:"base64"`
	Size     int64  `json:"size"`
}

type CreateTemplateRequest struct {
	SourcePDFBase64 string             `json:"sourcePDFBase64"`
	Options         tiling.TileOptions `json:"options"`
}

type PreviewResponse struct {
	PreviewID string       `json:"previewID"`
	Digest    string       `json:"digest"`
	PDFBase64 string       `json:"pdfBase64"`
	Info      pdfinfo.Info `json:"info"`
}

type SaveTemplateRequest struct {
	PreviewID     string `json:"previewID"`
	SuggestedName string `json:"suggestedName"`
}

type SaveTemplateResponse struct {
	Saved    bool   `json:"saved"`
	Filename string `json:"filename"`
}

type KernelOverride struct {
	Found  bool   `json:"found"`
	Base64 string `json:"base64"`
	Digest string `json:"digest"`
	Source string `json:"source"`
}

type IntegrationSelfTestResult struct {
	Finished           bool    `json:"finished"`
	Passed             bool    `json:"passed"`
	Stage              string  `json:"stage"`
	Detail             string  `json:"detail"`
	WidthMM            float64 `json:"widthMM"`
	HeightMM           float64 `json:"heightMM"`
	PageCount          int     `json:"pageCount"`
	PDFRendered        bool    `json:"pdfRendered"`
	KernelOverrideUsed bool    `json:"kernelOverrideUsed"`
	KernelDigest       string  `json:"kernelDigest"`
	PreviewDigest      string  `json:"previewDigest"`
	FinishedAt         string  `json:"finishedAt"`
}

type App struct {
	ctx      context.Context
	tiler    tiling.Tiler
	previews *previews.Cache
}

func NewApp() *App {
	return &App{
		tiler:    tiling.NewPDFTileCut(),
		previews: previews.New(maxPDFBytes),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	if a.IntegrationSelfTestEnabled() {
		_ = a.RecordIntegrationSelfTest(IntegrationSelfTestResult{
			Stage:  "backend startup",
			Detail: "Waiting for the packaged WebView self-test.",
		})
	}
}

func (a *App) OpenModel() (ModelFile, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Open STEP model",
		Filters: []runtime.FileFilter{{
			DisplayName: "STEP models (*.step;*.stp)",
			Pattern:     "*.step;*.stp",
		}},
	})
	if err != nil {
		return ModelFile{}, fmt.Errorf("open STEP dialog: %w", err)
	}
	if path == "" {
		return ModelFile{}, nil
	}
	return readModel(path)
}

func readModel(path string) (ModelFile, error) {
	ext := strings.ToLower(filepath.Ext(path))
	if ext != ".step" && ext != ".stp" {
		return ModelFile{}, errors.New("choose a .step or .stp file")
	}
	info, err := os.Stat(path)
	if err != nil {
		return ModelFile{}, fmt.Errorf("inspect STEP file: %w", err)
	}
	if info.Size() > maxModelBytes {
		return ModelFile{}, fmt.Errorf("STEP file exceeds the %d MiB limit", maxModelBytes>>20)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return ModelFile{}, fmt.Errorf("read STEP file: %w", err)
	}
	return ModelFile{
		Filename: filepath.Base(path),
		Base64:   base64.StdEncoding.EncodeToString(data),
		Size:     info.Size(),
	}, nil
}

func (a *App) CreateTemplate(request CreateTemplateRequest) (PreviewResponse, error) {
	if estimatedDecodedSize(request.SourcePDFBase64) > maxPDFBytes {
		return PreviewResponse{}, fmt.Errorf("source PDF exceeds the %d MiB limit", maxPDFBytes>>20)
	}
	source, err := base64.StdEncoding.DecodeString(request.SourcePDFBase64)
	if err != nil {
		return PreviewResponse{}, errors.New("source PDF payload is not valid base64")
	}
	if len(source) == 0 || len(source) > maxPDFBytes {
		return PreviewResponse{}, errors.New("source PDF payload size is invalid")
	}
	result, err := a.tiler.TilePDF(source, request.Options)
	if err != nil {
		return PreviewResponse{}, err
	}
	if len(result) > maxPDFBytes {
		return PreviewResponse{}, fmt.Errorf("tiled PDF exceeds the %d MiB limit", maxPDFBytes>>20)
	}
	info, err := pdfinfo.Inspect(a.ctx, result, maxPages)
	if err != nil {
		return PreviewResponse{}, err
	}
	entry, err := a.previews.Put(result)
	if err != nil {
		return PreviewResponse{}, err
	}
	return PreviewResponse{
		PreviewID: entry.ID,
		Digest:    entry.Digest,
		PDFBase64: base64.StdEncoding.EncodeToString(entry.Bytes),
		Info:      info,
	}, nil
}

func (a *App) SaveTemplate(request SaveTemplateRequest) (SaveTemplateResponse, error) {
	entry, err := a.previews.Get(request.PreviewID)
	if err != nil {
		return SaveTemplateResponse{}, err
	}
	suggested := files.SuggestedPDFName(request.SuggestedName)
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save face template",
		DefaultFilename: suggested,
		Filters: []runtime.FileFilter{{
			DisplayName: "PDF document (*.pdf)",
			Pattern:     "*.pdf",
		}},
	})
	if err != nil {
		return SaveTemplateResponse{}, fmt.Errorf("save PDF dialog: %w", err)
	}
	if path == "" {
		return SaveTemplateResponse{Saved: false}, nil
	}
	if strings.ToLower(filepath.Ext(path)) != ".pdf" {
		path += ".pdf"
	}
	if err := files.AtomicWrite(path, entry.Bytes); err != nil {
		return SaveTemplateResponse{}, err
	}
	return SaveTemplateResponse{Saved: true, Filename: filepath.Base(path)}, nil
}

func (a *App) DiscardTemplate(previewID string) {
	a.previews.Discard(previewID)
}

// GetKernelOverride returns an optional, deliberate per-user replacement for
// the bundled OCCT WebAssembly module. Models cannot select this path and the
// application never downloads a kernel.
func (a *App) GetKernelOverride() (KernelOverride, error) {
	if a.IntegrationSelfTestEnabled() {
		if testPath := os.Getenv("FACEPRINT_TEST_KERNEL_OVERRIDE"); testPath != "" {
			if !filepath.IsAbs(testPath) {
				return KernelOverride{}, errors.New("FACEPRINT_TEST_KERNEL_OVERRIDE must be an absolute path")
			}
			result, err := readKernelOverride(testPath)
			result.Source = "packaged integration test"
			return result, err
		}
	}
	configDir, err := os.UserConfigDir()
	if err != nil {
		return KernelOverride{}, fmt.Errorf("find user configuration directory: %w", err)
	}
	return readKernelOverride(filepath.Join(configDir, "FacePrint", "kernel", "occt-wasm.wasm"))
}

func readKernelOverride(path string) (KernelOverride, error) {
	info, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return KernelOverride{Found: false}, nil
	}
	if err != nil {
		return KernelOverride{}, fmt.Errorf("inspect kernel override: %w", err)
	}
	if !info.Mode().IsRegular() {
		return KernelOverride{}, errors.New("kernel override is not a regular file")
	}
	if info.Size() <= 0 || info.Size() > maxKernelBytes {
		return KernelOverride{}, fmt.Errorf("kernel override must be between 1 byte and %d MiB", maxKernelBytes>>20)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return KernelOverride{}, fmt.Errorf("read kernel override: %w", err)
	}
	digest := sha256.Sum256(data)
	return KernelOverride{
		Found:  true,
		Base64: base64.StdEncoding.EncodeToString(data),
		Digest: hex.EncodeToString(digest[:]),
		Source: "user configuration directory",
	}, nil
}

func (a *App) IntegrationSelfTestEnabled() bool {
	return os.Getenv("FACEPRINT_INTEGRATION_SELFTEST") == "1"
}

// RecordIntegrationSelfTest is intentionally unavailable during normal use.
// It lets the release script prove the packaged WebView/WASM/PDF.js/native-
// tiler path without exposing a general filesystem-write API to web content.
func (a *App) RecordIntegrationSelfTest(result IntegrationSelfTestResult) error {
	if !a.IntegrationSelfTestEnabled() {
		return errors.New("integration self-test is not enabled")
	}
	path := os.Getenv("FACEPRINT_SELFTEST_RESULT")
	if path == "" || !filepath.IsAbs(path) {
		return errors.New("FACEPRINT_SELFTEST_RESULT must be an absolute path")
	}
	result.FinishedAt = time.Now().UTC().Format(time.RFC3339Nano)
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return fmt.Errorf("encode integration self-test result: %w", err)
	}
	data = append(data, '\n')
	if err := files.AtomicWrite(path, data); err != nil {
		return fmt.Errorf("write integration self-test result: %w", err)
	}
	return nil
}

func estimatedDecodedSize(encoded string) int {
	if encoded == "" {
		return 0
	}
	return (len(encoded) / 4) * 3
}
