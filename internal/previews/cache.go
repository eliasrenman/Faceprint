package previews

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
)

var ErrNotFound = errors.New("preview is no longer available")

type Entry struct {
	ID     string
	Digest string
	Bytes  []byte
}

type Cache struct {
	mu       sync.RWMutex
	maxBytes int
	current  *Entry
}

func New(maxBytes int) *Cache { return &Cache{maxBytes: maxBytes} }

func (c *Cache) Put(data []byte) (Entry, error) {
	if len(data) == 0 {
		return Entry{}, errors.New("cannot cache an empty PDF")
	}
	if len(data) > c.maxBytes {
		return Entry{}, fmt.Errorf("PDF exceeds the %d-byte preview limit", c.maxBytes)
	}
	idBytes := make([]byte, 16)
	if _, err := rand.Read(idBytes); err != nil {
		return Entry{}, fmt.Errorf("create preview id: %w", err)
	}
	digest := sha256.Sum256(data)
	entry := Entry{
		ID:     hex.EncodeToString(idBytes),
		Digest: hex.EncodeToString(digest[:]),
		Bytes:  append([]byte(nil), data...),
	}
	c.mu.Lock()
	c.current = &entry
	c.mu.Unlock()
	return clone(entry), nil
}

func (c *Cache) Get(id string) (Entry, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.current == nil || c.current.ID != id {
		return Entry{}, ErrNotFound
	}
	return clone(*c.current), nil
}

func (c *Cache) Discard(id string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.current != nil && c.current.ID == id {
		c.current = nil
	}
}

func clone(entry Entry) Entry {
	entry.Bytes = append([]byte(nil), entry.Bytes...)
	return entry
}
