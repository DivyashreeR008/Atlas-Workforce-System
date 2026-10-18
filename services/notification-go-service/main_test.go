package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// The broker fan-in used to default a missing tenant_id to "default" and store
// and broadcast under it, so an event with no tenant landed in the shared
// default feed that every subscriber without an explicit tenant sees.
func TestProcessMessage_RejectsMissingTenant(t *testing.T) {
	before := len(store.List(""))
	body := []byte(`{"title":"System Alert","message":"no tenant here"}`)
	processMessage(body)
	if after := len(store.List("")); after != before {
		t.Errorf("expected no notification stored for a message without tenant_id, before=%d after=%d", before, after)
	}
}

func TestProcessMessage_RejectsNonStringTenant(t *testing.T) {
	before := len(store.List(""))
	body := []byte(`{"tenant_id":123,"title":"System Alert"}`)
	processMessage(body)
	if after := len(store.List("")); after != before {
		t.Errorf("expected no notification stored for a non-string tenant_id, before=%d after=%d", before, after)
	}
}

func TestProcessMessage_StoresUnderDeclaredTenant(t *testing.T) {
	body := []byte(`{"tenant_id":"tenant-a","title":"System Alert","message":"hello"}`)
	processMessage(body)
	items := store.List("tenant-a")
	if len(items) != 1 {
		t.Fatalf("expected exactly 1 notification under tenant-a, got %d", len(items))
	}
	if items[0].Title != "System Alert" {
		t.Errorf("expected title to round-trip, got %q", items[0].Title)
	}
}

func TestValidateJWT_NoSecret(t *testing.T) {
	os.Unsetenv("JWT_SECRET")
	_, err := validateJWT("some-token")
	if err == nil {
		t.Error("expected error when JWT_SECRET is not set")
	}
}

func TestValidateJWT_InvalidToken(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret")
	defer os.Unsetenv("JWT_SECRET")
	_, err := validateJWT("invalid-token")
	if err == nil {
		t.Error("expected error for invalid token")
	}
}

func TestValidateJWT_ValidToken(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret")
	defer os.Unsetenv("JWT_SECRET")

	claims := jwt.MapClaims{
		"sub":       "user-123",
		"tenant_id": "test-tenant",
		"exp":       time.Now().Add(time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	parsedClaims, err := validateJWT(tokenString)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if parsedClaims.TenantID != "test-tenant" {
		t.Errorf("expected tenant_id=test-tenant, got %s", parsedClaims.TenantID)
	}
}

func TestValidateJWT_ExpiredToken(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret")
	defer os.Unsetenv("JWT_SECRET")

	claims := jwt.MapClaims{
		"sub":       "user-123",
		"tenant_id": "test-tenant",
		"exp":       time.Now().Add(-time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, _ := token.SignedString([]byte("test-secret"))

	_, err := validateJWT(tokenString)
	if err == nil {
		t.Error("expected error for expired token")
	}
}

func TestValidateJWT_WrongSigningMethod(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret")
	defer os.Unsetenv("JWT_SECRET")

	claims := jwt.MapClaims{
		"sub":       "user-123",
		"tenant_id": "test-tenant",
		"exp":       time.Now().Add(time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodNone, claims)
	tokenString, _ := token.SignedString(jwt.UnsafeAllowNoneSignatureType)

	_, err := validateJWT(tokenString)
	if err == nil {
		t.Error("expected error for none signing method")
	}
}

func TestNotificationStore_Add(t *testing.T) {
	store := &NotificationStore{}
	n := Notification{
		ID:        "notif-1",
		Title:     "Test",
		Message:   "Test message",
		TenantID:  "tenant-1",
		Read:      false,
		CreatedAt: time.Now().Format(time.RFC3339),
	}
	store.Add(n)
	items := store.List("")
	if len(items) != 1 {
		t.Errorf("expected 1 item, got %d", len(items))
	}
	if items[0].ID != "notif-1" {
		t.Errorf("expected notif-1, got %s", items[0].ID)
	}
}

func TestNotificationStore_ListByTenant(t *testing.T) {
	store := &NotificationStore{}
	store.Add(Notification{ID: "1", TenantID: "tenant-a"})
	store.Add(Notification{ID: "2", TenantID: "tenant-b"})
	store.Add(Notification{ID: "3", TenantID: "tenant-a"})

	items := store.List("tenant-a")
	if len(items) != 2 {
		t.Errorf("expected 2 items for tenant-a, got %d", len(items))
	}

	items = store.List("tenant-b")
	if len(items) != 1 {
		t.Errorf("expected 1 item for tenant-b, got %d", len(items))
	}
}

func TestNotificationStore_MarkRead(t *testing.T) {
	store := &NotificationStore{}
	store.Add(Notification{ID: "1", TenantID: "tenant-a", Read: false})
	store.Add(Notification{ID: "2", TenantID: "tenant-a", Read: false})

	if updated := store.MarkRead("tenant-a", []string{"1"}); updated != 1 {
		t.Errorf("expected 1 updated notification, got %d", updated)
	}

	items := store.List("tenant-a")
	for _, item := range items {
		if item.ID == "1" && !item.Read {
			t.Error("expected item 1 to be marked as read")
		}
		if item.ID == "2" && item.Read {
			t.Error("expected item 2 to remain unread")
		}
	}
}

func TestNotificationStore_MarkReadCrossTenant(t *testing.T) {
	store := &NotificationStore{}
	store.Add(Notification{ID: "1", TenantID: "tenant-b", Read: false})

	if updated := store.MarkRead("tenant-a", []string{"1"}); updated != 0 {
		t.Errorf("expected 0 updated notifications for another tenant, got %d", updated)
	}
	if items := store.List("tenant-b"); items[0].Read {
		t.Error("expected another tenant's notification to remain unread")
	}
}

func TestHealthHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	healthHandler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var result map[string]string
	json.NewDecoder(w.Body).Decode(&result)
	if result["status"] != "Notification Service is running" {
		t.Errorf("unexpected status: %s", result["status"])
	}
}

func TestHandleConnections_MissingToken(t *testing.T) {
	req := httptest.NewRequest("GET", "/ws", nil)
	w := httptest.NewRecorder()
	handleConnections(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestHandleConnections_InvalidToken(t *testing.T) {
	req := httptest.NewRequest("GET", "/ws?token=invalid", nil)
	w := httptest.NewRecorder()
	handleConnections(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestListNotificationsHandler_MissingTenant(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/notifications", nil)
	w := httptest.NewRecorder()
	listNotificationsHandler(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestListNotificationsHandler_WithTenant(t *testing.T) {
	store.Add(Notification{
		ID:        "notif-1",
		Title:     "Test",
		Message:   "Test message",
		TenantID:  "tenant-1",
		Read:      false,
		CreatedAt: time.Now().Format(time.RFC3339),
	})

	req := httptest.NewRequest("GET", "/api/notifications", nil)
	req.Header.Set("X-Tenant-Id", "tenant-1")
	w := httptest.NewRecorder()
	listNotificationsHandler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var result []Notification
	json.NewDecoder(w.Body).Decode(&result)
	if len(result) != 1 {
		t.Errorf("expected 1 notification, got %d", len(result))
	}
}

func TestMarkReadHandler_InvalidBody(t *testing.T) {
	req := httptest.NewRequest("POST", "/api/notifications", bytes.NewBufferString("invalid json"))
	req.Header.Set("X-Tenant-Id", "tenant-1")
	w := httptest.NewRecorder()
	markReadHandler(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestMarkReadHandler_EmptyIDs(t *testing.T) {
	body := `{"ids": []}`
	req := httptest.NewRequest("POST", "/api/notifications", bytes.NewBufferString(body))
	req.Header.Set("X-Tenant-Id", "tenant-1")
	w := httptest.NewRecorder()
	markReadHandler(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestMarkReadHandler_MissingTenant(t *testing.T) {
	id := "11111111-1111-4111-8111-111111111111"
	store.Add(Notification{ID: id, TenantID: "tenant-1", Read: false})

	body := `{"ids": ["` + id + `"]}`
	req := httptest.NewRequest("POST", "/api/notifications", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	markReadHandler(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
	if itemsByID(t, id).Read {
		t.Error("expected notification to remain unread without tenant context")
	}
}

func TestMarkReadHandler_InvalidIDFormat(t *testing.T) {
	body := `{"ids": ["not-a-uuid"]}`
	req := httptest.NewRequest("POST", "/api/notifications", bytes.NewBufferString(body))
	req.Header.Set("X-Tenant-Id", "tenant-1")
	w := httptest.NewRecorder()
	markReadHandler(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for malformed id, got %d", w.Code)
	}
}

func TestMarkReadHandler_TooManyIDs(t *testing.T) {
	body := `{"ids": [`
	for i := 0; i < maxMarkReadIDs+1; i++ {
		if i > 0 {
			body += ","
		}
		body += `"11111111-1111-4111-8111-111111111111"`
	}
	body += `]}`
	req := httptest.NewRequest("POST", "/api/notifications", bytes.NewBufferString(body))
	req.Header.Set("X-Tenant-Id", "tenant-1")
	w := httptest.NewRecorder()
	markReadHandler(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for too many ids, got %d", w.Code)
	}
}

func TestMarkReadHandler_Success(t *testing.T) {
	id := "22222222-2222-4222-8222-222222222222"
	store.Add(Notification{
		ID:        id,
		Title:     "Test",
		Message:   "Test message",
		TenantID:  "tenant-2",
		Read:      false,
		CreatedAt: time.Now().Format(time.RFC3339),
	})

	body := `{"ids": ["` + id + `"]}`
	req := httptest.NewRequest("POST", "/api/notifications", bytes.NewBufferString(body))
	req.Header.Set("X-Tenant-Id", "tenant-2")
	w := httptest.NewRecorder()
	markReadHandler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if !itemsByID(t, id).Read {
		t.Error("expected notification to be marked as read")
	}
}

// TestMarkReadHandler_CrossTenantRejected is the regression proof for #349:
// a caller may not mutate another tenant's read state with a bare id.
func TestMarkReadHandler_CrossTenantRejected(t *testing.T) {
	id := "33333333-3333-4333-8333-333333333333"
	store.Add(Notification{
		ID:        id,
		Title:     "Test",
		Message:   "Test message",
		TenantID:  "tenant-2",
		Read:      false,
		CreatedAt: time.Now().Format(time.RFC3339),
	})

	body := `{"ids": ["` + id + `"]}`
	req := httptest.NewRequest("POST", "/api/notifications", bytes.NewBufferString(body))
	req.Header.Set("X-Tenant-Id", "tenant-1")
	w := httptest.NewRecorder()
	markReadHandler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 (no-op), got %d", w.Code)
	}
	var result map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if result["updated"].(float64) != 0 {
		t.Errorf("expected 0 updated, got %v", result["updated"])
	}
	if itemsByID(t, id).Read {
		t.Error("expected another tenant's notification to remain unread")
	}
}

func TestMarkReadHandler_UnknownIDIsNoOp(t *testing.T) {
	body := `{"ids": ["44444444-4444-4444-8444-444444444444"]}`
	req := httptest.NewRequest("POST", "/api/notifications", bytes.NewBufferString(body))
	req.Header.Set("X-Tenant-Id", "tenant-1")
	w := httptest.NewRecorder()
	markReadHandler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	var result map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if result["updated"].(float64) != 0 {
		t.Errorf("expected 0 updated for unknown id, got %v", result["updated"])
	}
}

// itemsByID finds a stored notification by id for assertions.
func itemsByID(t *testing.T, id string) Notification {
	t.Helper()
	for _, item := range store.List("") {
		if item.ID == id {
			return item
		}
	}
	t.Fatalf("notification %s not found in store", id)
	return Notification{}
}

func TestInternalAuthMiddleware_NoSecret(t *testing.T) {
	os.Unsetenv("INTERNAL_JWT_SECRET")

	handler := internalAuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/api/notifications", nil)
	w := httptest.NewRecorder()
	handler(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

func TestInternalAuthMiddleware_MissingToken(t *testing.T) {
	os.Setenv("INTERNAL_JWT_SECRET", "test-secret")
	defer os.Unsetenv("INTERNAL_JWT_SECRET")

	handler := internalAuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/api/notifications", nil)
	w := httptest.NewRecorder()
	handler(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestInternalAuthMiddleware_InvalidToken(t *testing.T) {
	os.Setenv("INTERNAL_JWT_SECRET", "test-secret")
	defer os.Unsetenv("INTERNAL_JWT_SECRET")

	handler := internalAuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/api/notifications", nil)
	req.Header.Set("x-internal-auth", "invalid-token")
	w := httptest.NewRecorder()
	handler(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestCanAcceptConnection(t *testing.T) {
	ipConnections = make(map[string]int)

	if !canAcceptConnection("192.168.1.1") {
		t.Error("expected true for new connection")
	}

	ipConnections["192.168.1.1"] = maxConnsPerIP
	if canAcceptConnection("192.168.1.1") {
		t.Error("expected false when at max connections")
	}
}

func TestReleaseConnection(t *testing.T) {
	ipConnections = make(map[string]int)
	ipConnections["192.168.1.1"] = 5

	releaseConnection("192.168.1.1")
	if ipConnections["192.168.1.1"] != 4 {
		t.Errorf("expected 4, got %d", ipConnections["192.168.1.1"])
	}

	ipConnections["192.168.1.1"] = 1
	releaseConnection("192.168.1.1")
	if _, ok := ipConnections["192.168.1.1"]; ok {
		t.Error("expected key to be deleted at 0")
	}
}

func TestNotificationStore_ListEmpty(t *testing.T) {
	store := &NotificationStore{}
	items := store.List("")
	if len(items) != 0 {
		t.Errorf("expected 0 items, got %d", len(items))
	}
}

func TestNotificationStore_ListNonExistentTenant(t *testing.T) {
	store := &NotificationStore{}
	store.Add(Notification{ID: "1", TenantID: "tenant-a"})
	items := store.List("nonexistent")
	if len(items) != 0 {
		t.Errorf("expected 0 items, got %d", len(items))
	}
}

func TestNotificationStore_MarkReadNonExistent(t *testing.T) {
	store := &NotificationStore{}
	store.Add(Notification{ID: "1", TenantID: "tenant-a", Read: false})
	if updated := store.MarkRead("tenant-a", []string{"nonexistent"}); updated != 0 {
		t.Errorf("expected 0 updated for unknown id, got %d", updated)
	}
	items := store.List("tenant-a")
	if len(items) != 1 {
		t.Errorf("expected 1 item, got %d", len(items))
	}
	if items[0].Read {
		t.Error("expected item to remain unread")
	}
}

func TestInternalAuthMiddleware_ValidToken(t *testing.T) {
	os.Setenv("INTERNAL_JWT_SECRET", "test-secret")
	defer os.Unsetenv("INTERNAL_JWT_SECRET")

	claims := jwt.MapClaims{
		"sub":       "user-123",
		"tenant_id": "test-tenant",
		"exp":       time.Now().Add(time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, _ := token.SignedString([]byte("test-secret"))

	handler := internalAuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/api/notifications", nil)
	req.Header.Set("x-internal-auth", tokenString)
	w := httptest.NewRecorder()
	handler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestInternalAuthMiddleware_ExpiredToken(t *testing.T) {
	os.Setenv("INTERNAL_JWT_SECRET", "test-secret")
	defer os.Unsetenv("INTERNAL_JWT_SECRET")

	claims := jwt.MapClaims{
		"sub":       "user-123",
		"tenant_id": "test-tenant",
		"exp":       time.Now().Add(-time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, _ := token.SignedString([]byte("test-secret"))

	handler := internalAuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/api/notifications", nil)
	req.Header.Set("x-internal-auth", tokenString)
	w := httptest.NewRecorder()
	handler(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

// --- Test helpers ---------------------------------------------------------

// isolateNotificationState swaps the service's package-level stores for fresh
// ones so preference, digest and broadcast tests never observe state left
// behind by earlier tests, and restores them when the test finishes.
func isolateNotificationState(t *testing.T) {
	t.Helper()
	prevStore, prevQueue, prevKeys, prevPrefs, prevClients, prevBroadcast := store, digestQueue, sendKeys, prefsStore, clients, broadcast
	store = &NotificationStore{}
	digestQueue = newDigestQueue()
	sendKeys = newSendKeyStore()
	prefsStore = newPreferenceStore()
	clients = make(map[*Client]bool)
	broadcast = make(chan BroadcastMessage, 256)
	t.Cleanup(func() {
		store, digestQueue, sendKeys, prefsStore, clients, broadcast = prevStore, prevQueue, prevKeys, prevPrefs, prevClients, prevBroadcast
	})
}

// nextBroadcastMessage takes the next queued broadcast envelope or fails the
// test when processMessage never produced one.
func nextBroadcastMessage(t *testing.T) BroadcastMessage {
	t.Helper()
	select {
	case msg := <-broadcast:
		return msg
	default:
		t.Fatal("expected a broadcast message to be queued")
		return BroadcastMessage{}
	}
}

func drainBroadcast() {
	for {
		select {
		case <-broadcast:
		default:
			return
		}
	}
}

func ptrBool(v bool) *bool { return &v }

func ptrStr(v string) *string { return &v }

func signedInternalToken(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte("test-internal-secret"))
	if err != nil {
		t.Fatalf("failed to sign internal token: %v", err)
	}
	return tokenString
}

// --- Preference store -----------------------------------------------------

func TestPreferenceStore_DefaultsAndCriticalConstraints(t *testing.T) {
	s := newPreferenceStore()

	prefs := s.Get("tenant-a", "user-1")
	if !prefs.Channels.InApp || prefs.Channels.Email || prefs.Channels.Digest {
		t.Errorf("unexpected default channels: %+v", prefs.Channels)
	}
	if prefs.QuietHours.Enabled {
		t.Error("expected quiet hours to be disabled by default")
	}
	if prefs.DigestFrequency != "daily" {
		t.Errorf("expected daily digest default, got %s", prefs.DigestFrequency)
	}
	for _, c := range notificationCategories {
		ch := prefs.Categories[c.ID]
		if !ch.InApp || ch.Email || ch.Digest {
			t.Errorf("unexpected default channels for %s: %+v", c.ID, ch)
		}
	}

	// Trying to mute a critical category's in-app channel must be ignored,
	// while its email opt-in is stored.
	updated, err := s.Update("tenant-a", "user-1", preferencesUpdate{
		Categories: map[string]channelUpdate{
			"security": {InApp: ptrBool(false), Email: ptrBool(true)},
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !updated.Categories["security"].InApp {
		t.Error("expected critical in-app channel to stay forced on")
	}
	if !updated.Categories["security"].Email {
		t.Error("expected email opt-in for a critical category to persist")
	}

	// Non-critical categories can be muted.
	updated, err = s.Update("tenant-a", "user-1", preferencesUpdate{
		Categories: map[string]channelUpdate{"leave": {InApp: ptrBool(false)}},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Categories["leave"].InApp {
		t.Error("expected leave in-app channel to be disabled")
	}
}

func TestPreferenceStore_UpdateValidation(t *testing.T) {
	s := newPreferenceStore()

	if _, err := s.Update("tenant-a", "", preferencesUpdate{}); err == nil {
		t.Error("expected error when user id is missing")
	}

	if _, err := s.Update("tenant-a", "user-1", preferencesUpdate{
		Categories: map[string]channelUpdate{"nonsense": {InApp: ptrBool(false)}},
	}); err == nil {
		t.Error("expected error for unknown category")
	}

	if _, err := s.Update("tenant-a", "user-1", preferencesUpdate{
		QuietHours: &quietHoursUpdate{Enabled: true, Start: "25:00", End: "07:00"},
	}); err == nil {
		t.Error("expected error for invalid quiet hours start")
	}

	if _, err := s.Update("tenant-a", "user-1", preferencesUpdate{
		QuietHours: &quietHoursUpdate{Enabled: true, Start: "08:00", End: "08:00"},
	}); err == nil {
		t.Error("expected error when quiet hours start equals end")
	}

	if _, err := s.Update("tenant-a", "user-1", preferencesUpdate{
		DigestFrequency: ptrStr("hourly"),
	}); err == nil {
		t.Error("expected error for unsupported digest frequency")
	}

	updated, err := s.Update("tenant-a", "user-1", preferencesUpdate{DigestFrequency: ptrStr("WEEKLY")})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.DigestFrequency != "weekly" {
		t.Errorf("expected frequency to be normalized to weekly, got %s", updated.DigestFrequency)
	}
	if updated.UpdatedAt == "" {
		t.Error("expected updated_at to be recorded")
	}
	if updated.UserID != "user-1" || updated.TenantID != "tenant-a" {
		t.Errorf("unexpected stored identity: %+v", updated)
	}
}

// --- Quiet hours and delivery decisions -----------------------------------

func TestQuietHoursActive(t *testing.T) {
	at := func(hour, minute int) time.Time {
		return time.Date(2026, 10, 18, hour, minute, 0, 0, time.UTC)
	}
	cases := []struct {
		name  string
		quiet QuietHours
		now   time.Time
		want  bool
	}{
		{"disabled", QuietHours{Enabled: false, Start: "22:00", End: "07:00"}, at(23, 0), false},
		{"inside same-day window", QuietHours{Enabled: true, Start: "09:00", End: "17:00"}, at(12, 0), true},
		{"before same-day window", QuietHours{Enabled: true, Start: "09:00", End: "17:00"}, at(8, 59), false},
		{"start of same-day window is inclusive", QuietHours{Enabled: true, Start: "09:00", End: "17:00"}, at(9, 0), true},
		{"end of same-day window is exclusive", QuietHours{Enabled: true, Start: "09:00", End: "17:00"}, at(17, 0), false},
		{"inside overnight window", QuietHours{Enabled: true, Start: "22:00", End: "07:00"}, at(23, 30), true},
		{"early morning inside overnight window", QuietHours{Enabled: true, Start: "22:00", End: "07:00"}, at(6, 0), true},
		{"end of overnight window is exclusive", QuietHours{Enabled: true, Start: "22:00", End: "07:00"}, at(7, 0), false},
		{"afternoon outside overnight window", QuietHours{Enabled: true, Start: "22:00", End: "07:00"}, at(15, 0), false},
		{"invalid start clock", QuietHours{Enabled: true, Start: "nope", End: "07:00"}, at(23, 0), false},
		{"equal clocks never activate", QuietHours{Enabled: true, Start: "10:00", End: "10:00"}, at(10, 30), false},
	}
	for _, tc := range cases {
		if got := tc.quiet.Active(tc.now); got != tc.want {
			t.Errorf("%s: expected %v, got %v", tc.name, tc.want, got)
		}
	}
}

func TestDecideDelivery(t *testing.T) {
	day := time.Date(2026, 10, 18, 12, 0, 0, 0, time.UTC)
	night := time.Date(2026, 10, 18, 23, 0, 0, 0, time.UTC)
	quiet := QuietHours{Enabled: true, Start: "22:00", End: "07:00"}

	if d := decideDelivery(defaultPreferences("tenant-a", "user-1"), "leave", day); !d.Realtime || d.Email || d.Digest {
		t.Errorf("unexpected default decision: %+v", d)
	}

	// Quiet hours silence non-critical realtime and email delivery.
	quietPrefs := defaultPreferences("tenant-a", "user-1")
	quietPrefs.QuietHours = quiet
	if d := decideDelivery(quietPrefs, "leave", night); d.Realtime || d.Email {
		t.Errorf("expected quiet hours to suppress delivery, got %+v", d)
	}
	if d := decideDelivery(quietPrefs, "leave", day); !d.Realtime {
		t.Errorf("expected delivery to resume outside quiet hours, got %+v", d)
	}

	// Critical categories always push in realtime; quiet hours still apply to
	// their (opt-in) email channel.
	criticalPrefs := defaultPreferences("tenant-a", "user-1")
	criticalPrefs.QuietHours = quiet
	criticalPrefs.Categories["security"] = ChannelSettings{InApp: true, Email: true}
	if d := decideDelivery(criticalPrefs, "security", night); !d.Realtime || d.Email {
		t.Errorf("expected critical realtime delivery to bypass quiet hours, got %+v", d)
	}
	if d := decideDelivery(criticalPrefs, "security", day); !d.Realtime || !d.Email {
		t.Errorf("expected critical email delivery outside quiet hours, got %+v", d)
	}
	if d := decideDelivery(criticalPrefs, "security", day); d.Digest {
		t.Errorf("expected critical categories to skip the digest, got %+v", d)
	}

	// Digest batching is opt-in and survives quiet hours: the user asked for
	// batching, which is exactly what quiet hours mean.
	digestPrefs := defaultPreferences("tenant-a", "user-1")
	digestPrefs.Categories["leave"] = ChannelSettings{InApp: false, Email: false, Digest: true}
	if d := decideDelivery(digestPrefs, "leave", night); d.Realtime || d.Email || !d.Digest {
		t.Errorf("expected digest-only delivery, got %+v", d)
	}
}

// --- Preferences HTTP API -------------------------------------------------

func TestHandlePreferences_GetReturnsDefaults(t *testing.T) {
	isolateNotificationState(t)
	os.Setenv("INTERNAL_JWT_SECRET", "test-internal-secret")
	defer os.Unsetenv("INTERNAL_JWT_SECRET")

	token := signedInternalToken(t, jwt.MapClaims{
		"sub":       "user-1",
		"tenant_id": "tenant-a",
		"email":     "user@example.com",
		"exp":       time.Now().Add(time.Hour).Unix(),
	})

	handler := internalAuthMiddleware(handlePreferences)
	req := httptest.NewRequest("GET", "/preferences", nil)
	req.Header.Set("x-internal-auth", token)
	w := httptest.NewRecorder()
	handler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var env preferencesEnvelope
	if err := json.NewDecoder(w.Body).Decode(&env); err != nil {
		t.Fatalf("failed to decode envelope: %v", err)
	}
	if env.Preferences.TenantID != "tenant-a" || env.Preferences.UserID != "user-1" {
		t.Errorf("unexpected preference identity: %+v", env.Preferences)
	}
	if env.Preferences.Email != "user@example.com" {
		t.Errorf("expected authenticated email to be remembered, got %q", env.Preferences.Email)
	}
	if !env.Preferences.Channels.InApp {
		t.Error("expected in-app channel on by default")
	}
	if len(env.Catalog) != len(notificationCategories) {
		t.Errorf("expected %d catalog entries, got %d", len(notificationCategories), len(env.Catalog))
	}
}

func TestHandlePreferences_PutAppliesPartialUpdate(t *testing.T) {
	isolateNotificationState(t)
	os.Setenv("INTERNAL_JWT_SECRET", "test-internal-secret")
	defer os.Unsetenv("INTERNAL_JWT_SECRET")

	token := signedInternalToken(t, jwt.MapClaims{
		"user_id":   "user-2",
		"tenant_id": "tenant-a",
		"exp":       time.Now().Add(time.Hour).Unix(),
	})
	handler := internalAuthMiddleware(handlePreferences)

	body := `{"channels":{"email":true},"categories":{"leave":{"in_app":false,"digest":true}},"quiet_hours":{"enabled":true,"start":"21:30","end":"06:30"},"digest_frequency":"weekly"}`
	req := httptest.NewRequest("PUT", "/preferences", bytes.NewBufferString(body))
	req.Header.Set("x-internal-auth", token)
	w := httptest.NewRecorder()
	handler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var env preferencesEnvelope
	if err := json.NewDecoder(w.Body).Decode(&env); err != nil {
		t.Fatalf("failed to decode envelope: %v", err)
	}
	leave := env.Preferences.Categories["leave"]
	if leave.InApp || !leave.Digest {
		t.Errorf("expected leave category overrides to persist, got %+v", leave)
	}
	if !env.Preferences.Channels.Email || env.Preferences.Channels.Digest {
		t.Errorf("unexpected channel update: %+v", env.Preferences.Channels)
	}
	if !env.Preferences.QuietHours.Enabled || env.Preferences.QuietHours.Start != "21:30" || env.Preferences.QuietHours.End != "06:30" {
		t.Errorf("unexpected quiet hours: %+v", env.Preferences.QuietHours)
	}
	if env.Preferences.DigestFrequency != "weekly" {
		t.Errorf("expected weekly digest, got %s", env.Preferences.DigestFrequency)
	}

	// Malformed bodies and out-of-range values are rejected.
	req = httptest.NewRequest("PUT", "/preferences", bytes.NewBufferString(`{"digest_frequency":`))
	req.Header.Set("x-internal-auth", token)
	w = httptest.NewRecorder()
	handler(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for a malformed body, got %d", w.Code)
	}

	req = httptest.NewRequest("PUT", "/preferences", bytes.NewBufferString(`{"digest_frequency":"hourly"}`))
	req.Header.Set("x-internal-auth", token)
	w = httptest.NewRecorder()
	handler(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for an invalid frequency, got %d", w.Code)
	}
}

func TestHandlePreferences_RequiresUserClaim(t *testing.T) {
	isolateNotificationState(t)
	os.Setenv("INTERNAL_JWT_SECRET", "test-internal-secret")
	defer os.Unsetenv("INTERNAL_JWT_SECRET")

	token := signedInternalToken(t, jwt.MapClaims{
		"tenant_id": "tenant-a",
		"exp":       time.Now().Add(time.Hour).Unix(),
	})

	handler := internalAuthMiddleware(handlePreferences)
	req := httptest.NewRequest("GET", "/preferences", nil)
	req.Header.Set("x-internal-auth", token)
	req.Header.Set("X-User-Id", "spoofed-user")
	w := httptest.NewRecorder()
	handler(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 when the internal token carries no user id, got %d", w.Code)
	}
}

func TestInternalAuthMiddleware_OverwritesSpoofedUserHeaders(t *testing.T) {
	os.Setenv("INTERNAL_JWT_SECRET", "test-internal-secret")
	defer os.Unsetenv("INTERNAL_JWT_SECRET")

	token := signedInternalToken(t, jwt.MapClaims{
		"user_id":   "real-user",
		"tenant_id": "real-tenant",
		"email":     "real@example.com",
		"exp":       time.Now().Add(time.Hour).Unix(),
	})

	var seenUser, seenTenant, seenEmail string
	handler := internalAuthMiddleware(func(w http.ResponseWriter, r *http.Request) {
		seenUser = r.Header.Get("X-User-Id")
		seenTenant = r.Header.Get("X-Tenant-Id")
		seenEmail = r.Header.Get("X-User-Email")
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/preferences", nil)
	req.Header.Set("x-internal-auth", token)
	req.Header.Set("X-User-Id", "spoofed-user")
	req.Header.Set("X-Tenant-Id", "spoofed-tenant")
	req.Header.Set("X-User-Email", "spoofed@example.com")
	w := httptest.NewRecorder()
	handler(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if seenUser != "real-user" || seenTenant != "real-tenant" || seenEmail != "real@example.com" {
		t.Errorf("expected claims to overwrite spoofed headers, got user=%q tenant=%q email=%q", seenUser, seenTenant, seenEmail)
	}
}

func TestValidateJWT_NumericIDClaim(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret")
	defer os.Unsetenv("JWT_SECRET")

	claims := jwt.MapClaims{
		"id":        42,
		"tenant_id": "test-tenant",
		"exp":       time.Now().Add(time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	parsed, err := validateJWT(tokenString)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := parsed.userID(); got != "42" {
		t.Errorf("expected numeric id claim to normalize to \"42\", got %q", got)
	}
}

// --- Broker event parsing -------------------------------------------------

func TestEventFieldID(t *testing.T) {
	if got := eventFieldID(map[string]interface{}{"user_id": float64(42)}, "user_id", "userId"); got != "42" {
		t.Errorf("expected numeric user_id to normalize to 42, got %q", got)
	}
	if got := eventFieldID(map[string]interface{}{"userId": "user-9"}, "user_id", "userId"); got != "user-9" {
		t.Errorf("expected userId fallback to work, got %q", got)
	}
	if got := eventFieldID(map[string]interface{}{"employeeId": "5"}, "user_id", "userId"); got != "" {
		t.Errorf("expected events without a user key to stay tenant-wide, got %q", got)
	}
}

func TestNormalizeCategory(t *testing.T) {
	cases := map[string]string{
		"security":        "security",
		"Payroll":         "payroll",
		"leave.approved":  "leave",
		"attendance:late": "attendance",
		"rumor/mill":      "general",
		"":                "general",
	}
	for input, want := range cases {
		if got := normalizeCategory(input); got != want {
			t.Errorf("normalizeCategory(%q) = %q, want %q", input, got, want)
		}
	}
}

// --- Broadcast targeting --------------------------------------------------

func TestDispatchBroadcast_Targeting(t *testing.T) {
	isolateNotificationState(t)

	aliceA := &Client{send: make(chan []byte, 4), tenantID: "tenant-a", userID: "alice"}
	aliceB := &Client{send: make(chan []byte, 4), tenantID: "tenant-a", userID: "alice"}
	bob := &Client{send: make(chan []byte, 4), tenantID: "tenant-a", userID: "bob"}
	outsider := &Client{send: make(chan []byte, 4), tenantID: "tenant-b", userID: "alice"}
	clients[aliceA] = true
	clients[aliceB] = true
	clients[bob] = true
	clients[outsider] = true

	if skipped := dispatchBroadcast(BroadcastMessage{TenantID: "tenant-a", UserID: "alice", Realtime: true, Payload: []byte("direct")}); skipped != 0 {
		t.Errorf("expected no skipped clients, got %d", skipped)
	}
	if len(aliceA.send) != 1 || len(aliceB.send) != 1 {
		t.Errorf("expected both of alice's connections to receive the directed event, got %d and %d", len(aliceA.send), len(aliceB.send))
	}
	if len(bob.send) != 0 {
		t.Errorf("expected bob not to receive alice's event, queued %d", len(bob.send))
	}
	if len(outsider.send) != 0 {
		t.Errorf("expected other tenants not to receive the event, queued %d", len(outsider.send))
	}

	dispatchBroadcast(BroadcastMessage{TenantID: "tenant-a", Realtime: true, Payload: []byte("broadcast")})
	if len(bob.send) != 1 {
		t.Errorf("expected tenant-wide events to reach bob, queued %d", len(bob.send))
	}
	if len(aliceA.send) != 2 {
		t.Errorf("expected tenant-wide events to reach alice too, queued %d", len(aliceA.send))
	}
	if len(outsider.send) != 0 {
		t.Errorf("expected tenant-wide events to skip other tenants, queued %d", len(outsider.send))
	}

	dispatchBroadcast(BroadcastMessage{TenantID: "tenant-a", UserID: "bob", Realtime: false, Payload: []byte("muted")})
	if len(bob.send) != 1 {
		t.Errorf("expected non-realtime events to be dropped, queued %d", len(bob.send))
	}
}

// --- Message processing ---------------------------------------------------

func TestProcessMessage_DirectedRouting(t *testing.T) {
	isolateNotificationState(t)

	alice := &Client{send: make(chan []byte, 4), tenantID: "tenant-a", userID: "alice"}
	bob := &Client{send: make(chan []byte, 4), tenantID: "tenant-a", userID: "bob"}
	clients[alice] = true
	clients[bob] = true

	processMessage([]byte(`{"tenant_id":"tenant-a","user_id":"alice","category":"leave","title":"Time off approved","message":"Your leave was approved"}`))

	stored := store.List("tenant-a")
	if len(stored) != 1 {
		t.Fatalf("expected 1 stored notification, got %d", len(stored))
	}
	if stored[0].UserID != "alice" || stored[0].Category != "leave" {
		t.Errorf("unexpected stored notification: %+v", stored[0])
	}

	direct := nextBroadcastMessage(t)
	if !direct.Realtime || direct.UserID != "alice" || direct.TenantID != "tenant-a" {
		t.Errorf("unexpected directed broadcast: %+v", direct)
	}
	dispatchBroadcast(direct)
	if len(alice.send) != 1 {
		t.Errorf("expected alice to receive the event, queued %d", len(alice.send))
	}
	if len(bob.send) != 0 {
		t.Errorf("expected bob to receive nothing, queued %d", len(bob.send))
	}

	// While alice is inside her quiet hours a regular category is stored but
	// not pushed, and a critical category still pushes through.
	now := time.Now().UTC()
	if _, err := prefsStore.Update("tenant-a", "alice", preferencesUpdate{
		QuietHours: &quietHoursUpdate{
			Enabled: true,
			Start:   now.Add(-10 * time.Minute).Format("15:04"),
			End:     now.Add(10 * time.Minute).Format("15:04"),
		},
	}); err != nil {
		t.Fatalf("failed to set quiet hours: %v", err)
	}

	processMessage([]byte(`{"tenant_id":"tenant-a","user_id":"alice","category":"attendance","title":"Reminder","message":"Clock in"}`))
	quietMsg := nextBroadcastMessage(t)
	if quietMsg.Realtime {
		t.Error("expected quiet hours to suppress realtime delivery")
	}
	dispatchBroadcast(quietMsg)
	if len(alice.send) != 1 {
		t.Errorf("expected suppressed event not to reach alice, queued %d", len(alice.send))
	}

	processMessage([]byte(`{"tenant_id":"tenant-a","user_id":"alice","category":"security","title":"New sign-in","message":"New device"}`))
	critical := nextBroadcastMessage(t)
	if !critical.Realtime {
		t.Error("expected critical category to bypass quiet hours")
	}
	dispatchBroadcast(critical)
	if len(alice.send) != 2 {
		t.Errorf("expected critical event to reach alice, queued %d", len(alice.send))
	}

	// Events without a user id (leave-service sends employeeId only) stay
	// tenant-wide broadcasts.
	processMessage([]byte(`{"tenant_id":"tenant-a","employeeId":"77","event":"leave.requested","title":"New leave request"}`))
	wide := nextBroadcastMessage(t)
	if wide.UserID != "" {
		t.Errorf("expected undefined user id to stay tenant-wide, got %q", wide.UserID)
	}
	dispatchBroadcast(wide)
	if len(bob.send) != 1 {
		t.Errorf("expected tenant-wide event to reach bob, queued %d", len(bob.send))
	}
}

func TestProcessMessage_DigestQueueing(t *testing.T) {
	isolateNotificationState(t)

	if _, err := prefsStore.Update("tenant-a", "user-1", preferencesUpdate{
		Email:      ptrStr("user@example.com"),
		Categories: map[string]channelUpdate{"leave": {Digest: ptrBool(true)}},
	}); err != nil {
		t.Fatalf("failed to set preferences: %v", err)
	}

	processMessage([]byte(`{"tenant_id":"tenant-a","user_id":"user-1","category":"leave","title":"Batched","message":"Batched message"}`))
	processMessage([]byte(`{"tenant_id":"tenant-a","user_id":"user-1","category":"security","title":"Immediate","message":"Immediate message"}`))
	drainBroadcast()

	items := digestQueue.Snapshot()[prefsKey("tenant-a", "user-1")]
	if len(items) != 1 {
		t.Fatalf("expected exactly 1 digest item (leave only), got %d", len(items))
	}
	if items[0].Category != "leave" || items[0].Title != "Batched" {
		t.Errorf("unexpected digest item: %+v", items[0])
	}
}

// --- Digest cycle ---------------------------------------------------------

func TestDigestWindowBucket(t *testing.T) {
	at := time.Date(2026, 10, 18, 12, 0, 0, 0, time.UTC)
	if got := digestWindowBucket(at, "daily"); got != "2026-10-18" {
		t.Errorf("expected daily bucket 2026-10-18, got %s", got)
	}
	if got := digestWindowBucket(at, "weekly"); got != "2026-W42" {
		t.Errorf("expected weekly bucket 2026-W42, got %s", got)
	}
}

func TestRunDigestCycle_IdempotentPerWindow(t *testing.T) {
	isolateNotificationState(t)

	originalSender := digestSender
	defer func() { digestSender = originalSender }()
	var sent []DigestEmail
	digestSender = func(mail DigestEmail) error {
		sent = append(sent, mail)
		return nil
	}

	if _, err := prefsStore.Update("tenant-a", "user-1", preferencesUpdate{
		DigestFrequency: ptrStr("daily"),
		Email:           ptrStr("user@example.com"),
	}); err != nil {
		t.Fatalf("failed to set preferences: %v", err)
	}
	queueDigest(prefsKey("tenant-a", "user-1"), DigestItem{ID: "n1", Title: "Batch me"})

	noon := time.Date(2026, 10, 18, 12, 0, 0, 0, time.UTC)
	if n := runDigestCycle(noon); n != 1 {
		t.Fatalf("expected 1 digest sent, got %d", n)
	}
	if len(sent) != 1 {
		t.Fatalf("expected 1 sender call, got %d", len(sent))
	}
	if sent[0].To != "user@example.com" || sent[0].ItemCount != 1 || sent[0].Frequency != "daily" {
		t.Errorf("unexpected digest mail: %+v", sent[0])
	}

	// A rerun inside the same UTC day must not double-send, even with fresh
	// items queued; the deferred item goes out in the next window.
	queueDigest(prefsKey("tenant-a", "user-1"), DigestItem{ID: "n2", Title: "Another"})
	if n := runDigestCycle(noon.Add(time.Hour)); n != 0 {
		t.Errorf("expected no sends inside the same window, got %d", n)
	}
	if len(sent) != 1 {
		t.Errorf("expected the sender to be called once, got %d", len(sent))
	}
	if n := runDigestCycle(noon.Add(24 * time.Hour)); n != 1 {
		t.Fatalf("expected the next window to send the deferred item, got %d", n)
	}
	if len(sent) != 2 {
		t.Fatalf("expected 2 sender calls, got %d", len(sent))
	}
	if sent[1].ItemCount != 1 {
		t.Errorf("expected 1 deferred item, got %d", sent[1].ItemCount)
	}

	// An empty queue sends nothing.
	if n := runDigestCycle(noon.Add(48 * time.Hour)); n != 0 {
		t.Errorf("expected an empty queue to send nothing, got %d", n)
	}
}

func TestRunDigestCycle_FailedSendKeepsBatch(t *testing.T) {
	isolateNotificationState(t)

	originalSender := digestSender
	defer func() { digestSender = originalSender }()
	calls := 0
	digestSender = func(mail DigestEmail) error {
		calls++
		if calls == 1 {
			return errors.New("smtp down")
		}
		return nil
	}

	if _, err := prefsStore.Update("tenant-a", "user-1", preferencesUpdate{
		DigestFrequency: ptrStr("daily"),
		Email:           ptrStr("user@example.com"),
	}); err != nil {
		t.Fatalf("failed to set preferences: %v", err)
	}
	queueDigest(prefsKey("tenant-a", "user-1"), DigestItem{ID: "n1", Title: "Retry me"})

	noon := time.Date(2026, 10, 18, 12, 0, 0, 0, time.UTC)
	if n := runDigestCycle(noon); n != 0 {
		t.Errorf("expected a failed send to report 0, got %d", n)
	}
	if digestQueue.Total() != 1 {
		t.Errorf("expected the batch to stay queued, got %d items", digestQueue.Total())
	}

	// The send key was rolled back, so a retry in the same window goes out.
	if n := runDigestCycle(noon.Add(time.Minute)); n != 1 {
		t.Errorf("expected the retry to send, got %d", n)
	}
	if calls != 2 {
		t.Errorf("expected 2 sender calls, got %d", calls)
	}
	if digestQueue.Total() != 0 {
		t.Errorf("expected the queue to drain after the successful retry, got %d items", digestQueue.Total())
	}
}

// --- One-click unsubscribe ------------------------------------------------

func TestUnsubscribeTokenRoundTrip(t *testing.T) {
	token := signUnsubscribeToken("top-secret", "tenant-a", "user-1", time.Now().Add(time.Hour))
	tenantID, userID, err := verifyUnsubscribeToken("top-secret", token)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tenantID != "tenant-a" || userID != "user-1" {
		t.Errorf("unexpected token identity: %q %q", tenantID, userID)
	}

	if _, _, err := verifyUnsubscribeToken("other-secret", token); err == nil {
		t.Error("expected a wrong secret to fail verification")
	}
	if _, _, err := verifyUnsubscribeToken("top-secret", token+"x"); err == nil {
		t.Error("expected a tampered token to fail verification")
	}
	if _, _, err := verifyUnsubscribeToken("top-secret", "not-a-token"); err == nil {
		t.Error("expected a malformed token to fail verification")
	}
	expired := signUnsubscribeToken("top-secret", "tenant-a", "user-1", time.Now().Add(-time.Minute))
	if _, _, err := verifyUnsubscribeToken("top-secret", expired); err == nil {
		t.Error("expected an expired token to fail verification")
	}
}

func TestUnsubscribeLink(t *testing.T) {
	os.Unsetenv("UNSUBSCRIBE_SECRET")
	if link := unsubscribeLink("tenant-a", "user-1"); link != "" {
		t.Errorf("expected no link without a secret, got %q", link)
	}

	os.Setenv("UNSUBSCRIBE_SECRET", "test-unsubscribe-secret")
	defer os.Unsetenv("UNSUBSCRIBE_SECRET")
	os.Unsetenv("UNSUBSCRIBE_BASE_URL")

	link := unsubscribeLink("tenant-a", "user-1")
	parsed, err := url.Parse(link)
	if err != nil {
		t.Fatalf("failed to parse link: %v", err)
	}
	if parsed.Path != "/api/notification/unsubscribe" {
		t.Errorf("unexpected link path: %s", parsed.Path)
	}
	tenantID, userID, err := verifyUnsubscribeToken("test-unsubscribe-secret", parsed.Query().Get("token"))
	if err != nil {
		t.Fatalf("mailed token failed verification: %v", err)
	}
	if tenantID != "tenant-a" || userID != "user-1" {
		t.Errorf("unexpected link identity: %q %q", tenantID, userID)
	}
}

func TestHandleUnsubscribe(t *testing.T) {
	isolateNotificationState(t)

	os.Unsetenv("UNSUBSCRIBE_SECRET")
	req := httptest.NewRequest("GET", "/unsubscribe?token=none", nil)
	w := httptest.NewRecorder()
	handleUnsubscribe(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503 without a configured secret, got %d", w.Code)
	}

	os.Setenv("UNSUBSCRIBE_SECRET", "test-unsubscribe-secret")
	defer os.Unsetenv("UNSUBSCRIBE_SECRET")

	req = httptest.NewRequest("GET", "/unsubscribe?token=broken", nil)
	w = httptest.NewRecorder()
	handleUnsubscribe(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for an invalid token, got %d", w.Code)
	}

	// Two users opt into email; unsubscribing one must not touch the other.
	if _, err := prefsStore.Update("tenant-a", "user-1", preferencesUpdate{
		Email:    ptrStr("user@example.com"),
		Channels: &channelUpdate{Email: ptrBool(true), Digest: ptrBool(true)},
	}); err != nil {
		t.Fatalf("failed to set preferences: %v", err)
	}
	if _, err := prefsStore.Update("tenant-a", "user-1", preferencesUpdate{
		Categories: map[string]channelUpdate{"leave": {Email: ptrBool(true), Digest: ptrBool(true)}},
	}); err != nil {
		t.Fatalf("failed to set category preferences: %v", err)
	}
	if _, err := prefsStore.Update("tenant-a", "user-2", preferencesUpdate{
		Channels: &channelUpdate{Email: ptrBool(true)},
	}); err != nil {
		t.Fatalf("failed to set the second user's preferences: %v", err)
	}

	token := signUnsubscribeToken("test-unsubscribe-secret", "tenant-a", "user-1", time.Now().Add(time.Hour))
	req = httptest.NewRequest("GET", "/unsubscribe?token="+token, nil)
	w = httptest.NewRecorder()
	handleUnsubscribe(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	prefs := prefsStore.Get("tenant-a", "user-1")
	if prefs.Channels.Email || prefs.Channels.Digest {
		t.Errorf("expected unsubscribe to disable email and digest, got %+v", prefs.Channels)
	}
	if !prefs.Channels.InApp {
		t.Error("expected in-app delivery to survive unsubscribe")
	}
	if !prefs.Unsubscribed {
		t.Error("expected the unsubscribed flag to be set")
	}
	if prefs.Categories["leave"].Email || prefs.Categories["leave"].Digest {
		t.Errorf("expected category email and digest overrides to be cleared, got %+v", prefs.Categories["leave"])
	}
	if !prefs.Categories["security"].InApp {
		t.Error("expected critical in-app delivery to survive unsubscribe")
	}
	if other := prefsStore.Get("tenant-a", "user-2"); !other.Channels.Email {
		t.Error("expected unsubscribe to only affect the token's user")
	}

	// The link is idempotent.
	req = httptest.NewRequest("GET", "/unsubscribe?token="+token, nil)
	w = httptest.NewRecorder()
	handleUnsubscribe(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected an idempotent 200, got %d", w.Code)
	}

	// An explicit settings save clears the flag.
	if _, err := prefsStore.Update("tenant-a", "user-1", preferencesUpdate{Email: ptrStr("user@example.com")}); err != nil {
		t.Fatalf("failed to re-save preferences: %v", err)
	}
	if prefsStore.Get("tenant-a", "user-1").Unsubscribed {
		t.Error("expected an explicit save to clear the unsubscribed flag")
	}
}
