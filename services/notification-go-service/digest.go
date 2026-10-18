package main

import (
	"context"
	"fmt"
	"log"
	"sort"
	"strings"
	"sync"
	"time"
)

// DigestItem is one notification held back for a batched digest mail.
type DigestItem struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Message   string `json:"message"`
	Category  string `json:"category"`
	CreatedAt string `json:"created_at"`
}

// DigestQueue keeps per-user batches in memory, mirroring the store pattern
// used for notifications themselves.
type DigestQueue struct {
	mu    sync.Mutex
	items map[string][]DigestItem
}

func newDigestQueue() *DigestQueue {
	return &DigestQueue{items: make(map[string][]DigestItem)}
}

func (q *DigestQueue) Add(key string, item DigestItem) {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.items[key] = append(q.items[key], item)
	if len(q.items[key]) > 500 {
		q.items[key] = q.items[key][len(q.items[key])-500:]
	}
}

func (q *DigestQueue) Snapshot() map[string][]DigestItem {
	q.mu.Lock()
	defer q.mu.Unlock()
	out := make(map[string][]DigestItem, len(q.items))
	for key, items := range q.items {
		copied := make([]DigestItem, len(items))
		copy(copied, items)
		out[key] = copied
	}
	return out
}

func (q *DigestQueue) Clear(key string) {
	q.mu.Lock()
	defer q.mu.Unlock()
	delete(q.items, key)
}

func (q *DigestQueue) Total() int {
	q.mu.Lock()
	defer q.mu.Unlock()
	total := 0
	for _, items := range q.items {
		total += len(items)
	}
	return total
}

// SendKeyStore remembers which digest windows already went out. Idempotency is
// keyed by tenant, user and window bucket, so a scheduler rerun inside the same
// window can never double-mail.
type SendKeyStore struct {
	mu   sync.Mutex
	keys map[string]bool
}

func newSendKeyStore() *SendKeyStore {
	return &SendKeyStore{keys: make(map[string]bool)}
}

func (s *SendKeyStore) Has(key string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.keys[key]
}

func (s *SendKeyStore) Mark(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.keys[key] = true
}

func (s *SendKeyStore) Unmark(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.keys, key)
}

// DigestEmail is the payload handed to the email transport. It deliberately
// carries only titles and counts, never tokens or secrets.
type DigestEmail struct {
	To             string
	TenantID       string
	UserID         string
	Frequency      string
	SendKey        string
	ItemCount      int
	Titles         []string
	UnsubscribeURL string
}

// digestSender is the transport hook. No SMTP server is configured anywhere in
// this repo, so the default records the batch it would have mailed - the same
// log-only approach auth-service uses for password reset mail. Tests replace
// this var to capture sends; wiring a real transport is a one-function change.
var digestSender = func(mail DigestEmail) error {
	log.Printf("[email] digest to=%s items=%d frequency=%s send_key=%s unsubscribe=%s",
		sanitizeLogArg(mail.To), mail.ItemCount, sanitizeLogArg(mail.Frequency),
		sanitizeLogArg(mail.SendKey), sanitizeLogArg(mail.UnsubscribeURL))
	return nil
}

// digestWindowBucket returns the idempotency bucket a send belongs to: the UTC
// date for daily digests, the ISO year-week for weekly digests.
func digestWindowBucket(at time.Time, frequency string) string {
	utc := at.UTC()
	if frequency == "weekly" {
		year, week := utc.ISOWeek()
		return fmt.Sprintf("%04d-W%02d", year, week)
	}
	return utc.Format("2006-01-02")
}

func buildDigestEmail(prefs NotificationPreferences, items []DigestItem, sendKey string) DigestEmail {
	titles := make([]string, 0, len(items))
	for _, item := range items {
		titles = append(titles, item.Title)
	}
	mail := DigestEmail{
		To:        prefs.Email,
		TenantID:  prefs.TenantID,
		UserID:    prefs.UserID,
		Frequency: prefs.DigestFrequency,
		SendKey:   sendKey,
		ItemCount: len(items),
		Titles:    titles,
	}
	mail.UnsubscribeURL = unsubscribeLink(prefs.TenantID, prefs.UserID)
	return mail
}

func sortedDigestKeys(items map[string][]DigestItem) []string {
	keys := make([]string, 0, len(items))
	for key := range items {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// runDigestCycle sends every due batch once. It is safe to call repeatedly:
// the send key marks a window as mailed before the transport is invoked and is
// rolled back if the transport fails.
func runDigestCycle(now time.Time) int {
	sent := 0
	snapshot := digestQueue.Snapshot()
	for _, key := range sortedDigestKeys(snapshot) {
		items := snapshot[key]
		if len(items) == 0 {
			continue
		}
		tenantID, userID := splitPrefsKey(key)
		prefs := prefsStore.Get(tenantID, userID)
		if prefs.Email == "" {
			// No address on file yet; keep the batch queued until the user
			// visits settings (which records the authenticated email).
			continue
		}
		if !prefs.LastDigestAt.IsZero() && digestWindowBucket(prefs.LastDigestAt, prefs.DigestFrequency) == digestWindowBucket(now, prefs.DigestFrequency) {
			continue
		}
		sendKey := key + "|" + digestWindowBucket(now, prefs.DigestFrequency)
		if sendKeys.Has(sendKey) {
			continue
		}
		mail := buildDigestEmail(prefs, items, sendKey)
		sendKeys.Mark(sendKey)
		if err := digestSender(mail); err != nil {
			sendKeys.Unmark(sendKey)
			log.Printf("Digest send failed for tenant %s user %s: %v", sanitizeLogArg(tenantID), sanitizeLogArg(userID), err)
			continue
		}
		digestQueue.Clear(key)
		prefsStore.MarkDigestSent(tenantID, userID, now)
		sent++
	}
	return sent
}

func startDigestScheduler(ctx context.Context) {
	interval := getDurationEnv("DIGEST_TICK_SEC", time.Hour)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	log.Printf("Digest scheduler started (tick %s)", interval)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if n := runDigestCycle(time.Now().UTC()); n > 0 {
				log.Printf("Digest cycle sent %d batch(es)", n)
			}
		}
	}
}

// queueDigest stores an event for later batching, trimming empty entries.
func queueDigest(key string, item DigestItem) {
	if strings.TrimSpace(item.Title) == "" {
		item.Title = "Atlas notification"
	}
	digestQueue.Add(key, item)
}
