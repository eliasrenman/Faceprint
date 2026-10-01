package files

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var unsafeName = regexp.MustCompile(`[<>:"/\\|?*\x00-\x1f]`)

func SuggestedPDFName(modelName string) string {
	base := strings.TrimSuffix(filepath.Base(modelName), filepath.Ext(modelName))
	base = strings.TrimSpace(unsafeName.ReplaceAllString(base, "-"))
	base = strings.Trim(base, ". ")
	if base == "" {
		base = "face-template"
	}
	return base + "-faceprint.pdf"
}

// AtomicWrite writes beside the destination and renames only after the data is
// fully synced. A failed write therefore preserves any existing destination.
func AtomicWrite(destination string, data []byte) (err error) {
	if destination == "" {
		return errors.New("destination is empty")
	}
	dir := filepath.Dir(destination)
	tmp, err := os.CreateTemp(dir, ".faceprint-*.pdf")
	if err != nil {
		return fmt.Errorf("create temporary output: %w", err)
	}
	tmpName := tmp.Name()
	defer func() {
		_ = tmp.Close()
		_ = os.Remove(tmpName)
	}()
	if err := tmp.Chmod(0o644); err != nil {
		return fmt.Errorf("set output permissions: %w", err)
	}
	if _, err := tmp.Write(data); err != nil {
		return fmt.Errorf("write output: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		return fmt.Errorf("sync output: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close output: %w", err)
	}
	if err := os.Rename(tmpName, destination); err != nil {
		return fmt.Errorf("replace destination: %w", err)
	}
	return nil
}
