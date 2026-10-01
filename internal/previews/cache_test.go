package previews

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"
)

func TestCacheKeepsOneImmutablePreview(t *testing.T) {
	cache := New(1024)
	source := []byte("%PDF-test")
	first, err := cache.Put(source)
	if err != nil {
		t.Fatal(err)
	}
	source[0] = 'x'
	wantDigest := sha256.Sum256([]byte("%PDF-test"))
	if first.Digest != hex.EncodeToString(wantDigest[:]) {
		t.Fatalf("digest = %s", first.Digest)
	}
	read, err := cache.Get(first.ID)
	if err != nil {
		t.Fatal(err)
	}
	read.Bytes[0] = 'y'
	again, _ := cache.Get(first.ID)
	if string(again.Bytes) != "%PDF-test" {
		t.Fatalf("cached bytes mutated: %q", again.Bytes)
	}
	second, err := cache.Put([]byte("%PDF-second"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := cache.Get(first.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("old preview error = %v", err)
	}
	if _, err := cache.Get(second.ID); err != nil {
		t.Fatal(err)
	}
}
