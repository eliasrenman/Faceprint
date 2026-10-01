package main

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
)

func TestReadKernelOverride(t *testing.T) {
	path := filepath.Join(t.TempDir(), "occt-wasm.wasm")
	missing, err := readKernelOverride(path)
	if err != nil || missing.Found {
		t.Fatalf("missing override = %+v, %v", missing, err)
	}

	payload := []byte("compatible-wasm-fixture")
	if err := os.WriteFile(path, payload, 0o600); err != nil {
		t.Fatal(err)
	}
	result, err := readKernelOverride(path)
	if err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(payload)
	if !result.Found || result.Digest != hex.EncodeToString(digest[:]) || result.Base64 == "" {
		t.Fatalf("override = %+v", result)
	}
}

func TestIntegrationSelfTestCannotWriteUnlessEnabled(t *testing.T) {
	t.Setenv("FACEPRINT_INTEGRATION_SELFTEST", "")
	t.Setenv("FACEPRINT_SELFTEST_RESULT", filepath.Join(t.TempDir(), "result.json"))
	if err := NewApp().RecordIntegrationSelfTest(IntegrationSelfTestResult{Passed: true}); err == nil {
		t.Fatal("RecordIntegrationSelfTest unexpectedly succeeded")
	}
}
