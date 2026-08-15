package handlers_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/salvuccifacundo/appointments-app/backend/internal/config"
	apihttp "github.com/salvuccifacundo/appointments-app/backend/internal/http"
	"github.com/salvuccifacundo/appointments-app/backend/internal/http/handlers"
	"github.com/salvuccifacundo/appointments-app/backend/internal/service"
	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

func TestMain(m *testing.M) {
	slog.SetDefault(slog.New(slog.NewTextHandler(io.Discard, nil)))
	os.Exit(m.Run())
}

// fakeService implements handlers.Service with per-field overrides so each
// test only stubs what it exercises.
type fakeService struct {
	listPublicStores        func(ctx context.Context, q, specialty string, page, limit int) ([]store.Store, int, error)
	getPublicStore          func(ctx context.Context, slug string) (store.Store, []store.BusinessHour, error)
	getSlots                func(ctx context.Context, slug, date string) ([]service.TimeSlot, error)
	book                    func(ctx context.Context, slug string, in service.BookInput) (*store.Appointment, error)
	listStoresByOwner       func(ctx context.Context, ownerID string) ([]store.Store, error)
	createStore             func(ctx context.Context, ownerID string, in store.CreateStoreInput) (store.Store, error)
	getStore                func(ctx context.Context, id string) (store.Store, []store.BusinessHour, []store.BlockedDate, error)
	updateStore             func(ctx context.Context, id string, in store.UpdateStoreInput) (store.Store, error)
	replaceBusinessHours    func(ctx context.Context, storeID string, in []store.BusinessHourInput) ([]store.BusinessHour, error)
	createBlockedDate       func(ctx context.Context, storeID, date, reason string) (store.BlockedDate, error)
	deleteBlockedDate       func(ctx context.Context, storeID, id string) error
	listAppointments        func(ctx context.Context, storeID, date string, status *store.AppointmentStatus) ([]store.Appointment, error)
	createAppointment       func(ctx context.Context, storeID string, in service.CreateAppointmentInput) (store.Appointment, error)
	updateAppointmentStatus func(ctx context.Context, storeID, apptID, action string) (store.Appointment, error)
	rescheduleAppointment   func(ctx context.Context, storeID, apptID, date, time string) (store.Appointment, error)
}

func (f *fakeService) ListPublicStores(ctx context.Context, q, specialty string, page, limit int) ([]store.Store, int, error) {
	if f.listPublicStores != nil {
		return f.listPublicStores(ctx, q, specialty, page, limit)
	}
	return nil, 0, nil
}

func (f *fakeService) GetPublicStore(ctx context.Context, slug string) (store.Store, []store.BusinessHour, error) {
	if f.getPublicStore != nil {
		return f.getPublicStore(ctx, slug)
	}
	return store.Store{}, nil, nil
}

func (f *fakeService) GetSlots(ctx context.Context, slug, date string) ([]service.TimeSlot, error) {
	if f.getSlots != nil {
		return f.getSlots(ctx, slug, date)
	}
	return nil, nil
}

func (f *fakeService) Book(ctx context.Context, slug string, in service.BookInput) (*store.Appointment, error) {
	if f.book != nil {
		return f.book(ctx, slug, in)
	}
	return nil, nil
}

func (f *fakeService) ListStoresByOwner(ctx context.Context, ownerID string) ([]store.Store, error) {
	if f.listStoresByOwner != nil {
		return f.listStoresByOwner(ctx, ownerID)
	}
	return nil, nil
}

func (f *fakeService) CreateStore(ctx context.Context, ownerID string, in store.CreateStoreInput) (store.Store, error) {
	if f.createStore != nil {
		return f.createStore(ctx, ownerID, in)
	}
	return store.Store{}, nil
}

func (f *fakeService) GetStore(ctx context.Context, id string) (store.Store, []store.BusinessHour, []store.BlockedDate, error) {
	if f.getStore != nil {
		return f.getStore(ctx, id)
	}
	return store.Store{}, nil, nil, nil
}

func (f *fakeService) UpdateStore(ctx context.Context, id string, in store.UpdateStoreInput) (store.Store, error) {
	if f.updateStore != nil {
		return f.updateStore(ctx, id, in)
	}
	return store.Store{}, nil
}

func (f *fakeService) ReplaceBusinessHours(ctx context.Context, storeID string, in []store.BusinessHourInput) ([]store.BusinessHour, error) {
	if f.replaceBusinessHours != nil {
		return f.replaceBusinessHours(ctx, storeID, in)
	}
	return nil, nil
}

func (f *fakeService) CreateBlockedDate(ctx context.Context, storeID, date, reason string) (store.BlockedDate, error) {
	if f.createBlockedDate != nil {
		return f.createBlockedDate(ctx, storeID, date, reason)
	}
	return store.BlockedDate{}, nil
}

func (f *fakeService) DeleteBlockedDate(ctx context.Context, storeID, id string) error {
	if f.deleteBlockedDate != nil {
		return f.deleteBlockedDate(ctx, storeID, id)
	}
	return nil
}

func (f *fakeService) ListAppointments(ctx context.Context, storeID, date string, status *store.AppointmentStatus) ([]store.Appointment, error) {
	if f.listAppointments != nil {
		return f.listAppointments(ctx, storeID, date, status)
	}
	return nil, nil
}

func (f *fakeService) CreateAppointment(ctx context.Context, storeID string, in service.CreateAppointmentInput) (store.Appointment, error) {
	if f.createAppointment != nil {
		return f.createAppointment(ctx, storeID, in)
	}
	return store.Appointment{}, nil
}

func (f *fakeService) UpdateAppointmentStatus(ctx context.Context, storeID, apptID, action string) (store.Appointment, error) {
	if f.updateAppointmentStatus != nil {
		return f.updateAppointmentStatus(ctx, storeID, apptID, action)
	}
	return store.Appointment{}, nil
}

func (f *fakeService) RescheduleAppointment(ctx context.Context, storeID, apptID, date, time string) (store.Appointment, error) {
	if f.rescheduleAppointment != nil {
		return f.rescheduleAppointment(ctx, storeID, apptID, date, time)
	}
	return store.Appointment{}, nil
}

// newTestRouter builds the real router wired to the fake service.
func newTestRouter(t *testing.T, svc handlers.Service) http.Handler {
	t.Helper()
	cfg := &config.Config{
		APIKey:      "secret-key",
		OwnerID:     "owner-1",
		CORSOrigins: []string{"http://localhost:5173"},
	}
	return apihttp.NewRouter(cfg, svc)
}

// doRequest performs a request against h with an optional JSON body. Owner
// routes get the API key header automatically.
func doRequest(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("X-API-Key", "secret-key")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}

// errContract decodes the error contract from a response.
func errContract(t *testing.T, rr *httptest.ResponseRecorder) (status int, code, field, message string) {
	t.Helper()
	var body struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
			Field   string `json:"field"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode error body: %v (body=%q)", err, rr.Body.String())
	}
	return rr.Code, body.Error.Code, body.Error.Field, body.Error.Message
}

func TestHealth(t *testing.T) {
	h := newTestRouter(t, &fakeService{})
	rr := doRequest(t, h, http.MethodGet, "/health", "")
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rr.Code)
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Status != "ok" {
		t.Errorf("status field = %q, want %q", body.Status, "ok")
	}
}

func TestGetPublicStore_NotFound(t *testing.T) {
	f := &fakeService{}
	f.getPublicStore = func(_ context.Context, slug string) (store.Store, []store.BusinessHour, error) {
		return store.Store{}, nil, service.ErrNotFound
	}
	h := newTestRouter(t, f)
	rr := doRequest(t, h, http.MethodGet, "/api/stores/public/inexistente", "")
	status, code, _, _ := errContract(t, rr)
	if status != http.StatusNotFound || code != "not_found" {
		t.Errorf("got (%d, %q), want (404, not_found)", status, code)
	}
}

func TestListPublicStores_Paginated(t *testing.T) {
	f := &fakeService{}
	f.listPublicStores = func(_ context.Context, q, specialty string, page, limit int) ([]store.Store, int, error) {
		if q != "clin" || specialty != "General" || page != 1 || limit != 12 {
			t.Errorf("args = (%q, %q, %d, %d), want (clin, General, 1, 12)", q, specialty, page, limit)
		}
		return []store.Store{{ID: "s1", Name: "Clínica", Slug: "clinica", Specialty: "General", Address: "Av 1"}}, 1, nil
	}
	h := newTestRouter(t, f)
	rr := doRequest(t, h, http.MethodGet, "/api/stores/public?q=clin&specialty=General", "")
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rr.Code)
	}
	var body struct {
		Data       []map[string]any `json:"data"`
		Page       int              `json:"page"`
		Limit      int              `json:"limit"`
		Total      int              `json:"total"`
		TotalPages int              `json:"totalPages"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body.Data) != 1 || body.Total != 1 || body.TotalPages != 1 {
		t.Errorf("page shape = %+v, want data len 1 / total 1 / totalPages 1", body)
	}
	if rating, ok := body.Data[0]["averageRating"]; !ok || rating != float64(0) {
		t.Errorf("averageRating = %v, want 0", rating)
	}
	if rc, ok := body.Data[0]["reviewCount"]; !ok || rc != float64(0) {
		t.Errorf("reviewCount = %v, want 0", rc)
	}
}

func TestBook_SlotUnavailable(t *testing.T) {
	f := &fakeService{}
	f.book = func(_ context.Context, slug string, in service.BookInput) (*store.Appointment, error) {
		if slug != "clinica" {
			t.Errorf("slug = %q, want clinica", slug)
		}
		return nil, service.ErrSlotUnavailable
	}
	h := newTestRouter(t, f)
	body := `{"date":"2027-01-04","time":"09:00","clientName":"Ana","clientPhone":"555-0100","clientEmail":"ana@example.com"}`
	rr := doRequest(t, h, http.MethodPost, "/api/stores/clinica/book", body)
	status, code, _, _ := errContract(t, rr)
	if status != http.StatusConflict || code != "slot_unavailable" {
		t.Errorf("got (%d, %q), want (409, slot_unavailable)", status, code)
	}
}

func TestBook_ValidationFieldError(t *testing.T) {
	f := &fakeService{}
	f.book = func(_ context.Context, _ string, in service.BookInput) (*store.Appointment, error) {
		return nil, &service.FieldError{Field: "clientName", Message: "clientName is required"}
	}
	h := newTestRouter(t, f)
	body := `{"date":"2027-01-04","time":"09:00","clientName":"","clientPhone":"555-0100","clientEmail":"ana@example.com"}`
	rr := doRequest(t, h, http.MethodPost, "/api/stores/clinica/book", body)
	status, _, field, _ := errContract(t, rr)
	if status != http.StatusBadRequest || field != "clientName" {
		t.Errorf("got (%d, field=%q), want (400, field=clientName)", status, field)
	}
}

func TestGetSlots_RequiresDate(t *testing.T) {
	h := newTestRouter(t, &fakeService{})
	rr := doRequest(t, h, http.MethodGet, "/api/stores/clinica/slots", "")
	status, _, field, _ := errContract(t, rr)
	if status != http.StatusBadRequest || field != "date" {
		t.Errorf("got (%d, field=%q), want (400, field=date)", status, field)
	}
}

func TestUpdateHours_InvalidTime(t *testing.T) {
	f := &fakeService{}
	h := newTestRouter(t, f)
	body := `[{"dayOfWeek":1,"openTime":"25:00","closeTime":"17:00"}]`
	rr := doRequest(t, h, http.MethodPut, "/api/stores/s1/hours", body)
	status, _, field, _ := errContract(t, rr)
	if status != http.StatusBadRequest || field != "[0].openTime" {
		t.Errorf("got (%d, field=%q), want (400, field=[0].openTime)", status, field)
	}
}

func TestUpdateHours_NotAnArray(t *testing.T) {
	h := newTestRouter(t, &fakeService{})
	rr := doRequest(t, h, http.MethodPut, "/api/stores/s1/hours", `{"dayOfWeek":1}`)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status %d, want 400", rr.Code)
	}
}

func TestCreateBlockedDate_PastDate(t *testing.T) {
	f := &fakeService{}
	f.createBlockedDate = func(_ context.Context, storeID, date, reason string) (store.BlockedDate, error) {
		if err := service.ValidateFutureDate(date); err != nil {
			return store.BlockedDate{}, &service.FieldError{Field: "date", Message: err.Error()}
		}
		return store.BlockedDate{}, nil
	}
	h := newTestRouter(t, f)
	rr := doRequest(t, h, http.MethodPost, "/api/stores/s1/blocked-dates", `{"date":"2020-01-01"}`)
	status, _, field, _ := errContract(t, rr)
	if status != http.StatusBadRequest || field != "date" {
		t.Errorf("got (%d, field=%q), want (400, field=date)", status, field)
	}
}

func TestUpdateAppointmentStatus_InvalidAction(t *testing.T) {
	f := &fakeService{}
	f.updateAppointmentStatus = func(_ context.Context, storeID, apptID, action string) (store.Appointment, error) {
		if storeID != "s1" || apptID != "a1" {
			t.Errorf("args = (%q, %q), want (s1, a1)", storeID, apptID)
		}
		return store.Appointment{}, &service.FieldError{Field: "action", Message: "action must be CONFIRM, REJECT, or COMPLETE"}
	}
	h := newTestRouter(t, f)
	rr := doRequest(t, h, http.MethodPut, "/api/stores/s1/appointments/a1", `{"action":"NOPE"}`)
	status, _, field, _ := errContract(t, rr)
	if status != http.StatusBadRequest || field != "action" {
		t.Errorf("got (%d, field=%q), want (400, field=action)", status, field)
	}
}

func TestReschedule_CrossStoreNotFound(t *testing.T) {
	f := &fakeService{}
	f.rescheduleAppointment = func(_ context.Context, storeID, apptID, date, time string) (store.Appointment, error) {
		if storeID != "s1" || apptID != "a1" {
			t.Errorf("args = (%q, %q), want (s1, a1)", storeID, apptID)
		}
		return store.Appointment{}, service.ErrNotFound
	}
	h := newTestRouter(t, f)
	rr := doRequest(t, h, http.MethodPut, "/api/stores/s1/appointments/a1/reschedule", `{"date":"2027-01-04","time":"10:00"}`)
	status, code, _, _ := errContract(t, rr)
	if status != http.StatusNotFound || code != "not_found" {
		t.Errorf("got (%d, %q), want (404, not_found)", status, code)
	}
}

func TestReschedule_UnavailableSlot(t *testing.T) {
	f := &fakeService{}
	f.rescheduleAppointment = func(_ context.Context, storeID, apptID, date, time string) (store.Appointment, error) {
		return store.Appointment{}, &service.FieldError{Field: "time", Message: "slot is no longer available"}
	}
	h := newTestRouter(t, f)
	rr := doRequest(t, h, http.MethodPut, "/api/stores/s1/appointments/a1/reschedule", `{"date":"2027-01-04","time":"10:00"}`)
	status, _, field, _ := errContract(t, rr)
	if status != http.StatusBadRequest || field != "time" {
		t.Errorf("got (%d, field=%q), want (400, field=time)", status, field)
	}
}

func TestOwnerRoute_RequiresAPIKey(t *testing.T) {
	h := newTestRouter(t, &fakeService{})
	req := httptest.NewRequest(http.MethodGet, "/api/stores", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	status, code, _, _ := errContract(t, rr)
	if status != http.StatusUnauthorized || code != "unauthorized" {
		t.Errorf("got (%d, %q), want (401, unauthorized)", status, code)
	}
}

func TestOwnerRoute_AllowsValidKey(t *testing.T) {
	f := &fakeService{}
	f.listStoresByOwner = func(_ context.Context, ownerID string) ([]store.Store, error) {
		if ownerID != "owner-1" {
			t.Errorf("ownerID = %q, want owner-1", ownerID)
		}
		return []store.Store{}, nil
	}
	h := newTestRouter(t, f)
	rr := doRequest(t, h, http.MethodGet, "/api/stores", "")
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rr.Code)
	}
	if got := strings.TrimSpace(rr.Body.String()); got != "[]" {
		t.Errorf("body = %q, want []", got)
	}
}

func TestCreateStore_Success(t *testing.T) {
	f := &fakeService{}
	f.createStore = func(_ context.Context, ownerID string, in store.CreateStoreInput) (store.Store, error) {
		if ownerID != "owner-1" {
			t.Errorf("ownerID = %q, want owner-1", ownerID)
		}
		return store.Store{ID: "s1", Name: in.Name, Slug: "clinica", Address: in.Address, Specialty: in.Specialty}, nil
	}
	h := newTestRouter(t, f)
	body := `{"name":"Clínica Central","address":"Av 1","specialty":"General"}`
	rr := doRequest(t, h, http.MethodPost, "/api/stores", body)
	if rr.Code != http.StatusCreated {
		t.Fatalf("status %d, want 201", rr.Code)
	}
	var got store.Store
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode store: %v", err)
	}
	if got.Slug != "clinica" {
		t.Errorf("slug = %q, want clinica", got.Slug)
	}
}
