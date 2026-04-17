package auth

import (
	"context"
	"testing"

	cliproxyexecutor "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/executor"
)

type pickNextTestExecutor struct{}

func (e *pickNextTestExecutor) Identifier() string { return "codex" }

func (e *pickNextTestExecutor) Execute(context.Context, *Auth, cliproxyexecutor.Request, cliproxyexecutor.Options) (cliproxyexecutor.Response, error) {
	return cliproxyexecutor.Response{}, nil
}

func (e *pickNextTestExecutor) ExecuteStream(context.Context, *Auth, cliproxyexecutor.Request, cliproxyexecutor.Options) (<-chan cliproxyexecutor.StreamChunk, error) {
	ch := make(chan cliproxyexecutor.StreamChunk)
	close(ch)
	return ch, nil
}

func (e *pickNextTestExecutor) Refresh(context.Context, *Auth) (*Auth, error) { return nil, nil }

func (e *pickNextTestExecutor) CountTokens(context.Context, *Auth, cliproxyexecutor.Request, cliproxyexecutor.Options) (cliproxyexecutor.Response, error) {
	return cliproxyexecutor.Response{}, nil
}

func TestPickNext_FallsBackWhenRegistrySupportMissing(t *testing.T) {
	manager := NewManager(nil, nil, nil)
	manager.RegisterExecutor(&pickNextTestExecutor{})

	auth := &Auth{
		ID:       "test-auth-pick-next",
		Provider: "codex",
		Status:   StatusActive,
		Metadata: map[string]any{"email": "test@example.com"},
	}
	if _, err := manager.Register(context.Background(), auth); err != nil {
		t.Fatalf("manager.Register(): %v", err)
	}

	selected, _, err := manager.pickNext(context.Background(), "codex", "gpt-5.4", cliproxyexecutor.Options{}, map[string]struct{}{})
	if err != nil {
		t.Fatalf("pickNext(): %v", err)
	}
	if selected == nil {
		t.Fatalf("expected selected auth, got nil")
	}
	if selected.ID != auth.ID {
		t.Fatalf("expected auth %q, got %q", auth.ID, selected.ID)
	}
}
