package antigravity

import (
	"fmt"
	"strings"
)

// CredentialFileName generates a sanitized filename for antigravity credentials based on email
func CredentialFileName(email string) string {
	if strings.TrimSpace(email) == "" {
		return "antigravity.json"
	}
	replacer := strings.NewReplacer("@", "_", ".", "_")
	return fmt.Sprintf("antigravity-%s.json", replacer.Replace(email))
}
