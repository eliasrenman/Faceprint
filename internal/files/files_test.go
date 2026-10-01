package files

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSuggestedPDFName(t *testing.T) {
	if got := SuggestedPDFName("My plate.step"); got != "My plate-faceprint.pdf" {
		t.Fatalf("name = %q", got)
	}
	if got := SuggestedPDFName("../<>.stp"); got != "---faceprint.pdf" {
		t.Fatalf("sanitized name = %q", got)
	}
}

func TestAtomicWriteReplacesDestination(t *testing.T) {
	destination := filepath.Join(t.TempDir(), "mö nster.pdf")
	if err := os.WriteFile(destination, []byte("old"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := AtomicWrite(destination, []byte("new-pdf")); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(destination)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "new-pdf" {
		t.Fatalf("data = %q", data)
	}
}
