# Security

## Reporting Security Issues

If you discover a security vulnerability, please email the maintainers directly instead of using the issue tracker.

## Security Best Practices

### OAuth Credentials

This project requires Google OAuth credentials for Gemini CLI and Antigravity authentication. **Never commit OAuth credentials to source code.**

To configure OAuth credentials securely:

1. Copy `.env.example` to `.env`
2. Set the following environment variables:
   - `GEMINI_OAUTH_CLIENT_SECRET` - Required for Gemini CLI OAuth
   - `ANTIGRAVITY_OAUTH_CLIENT_SECRET` - Required for Antigravity OAuth
   - (Optional) `GEMINI_OAUTH_CLIENT_ID` and `ANTIGRAVITY_OAUTH_CLIENT_ID` if you want to override the defaults

3. Ensure `.env` is in your `.gitignore` file

Example:
```bash
# .env
GEMINI_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GEMINI_OAUTH_CLIENT_SECRET=your-secret-here
ANTIGRAVITY_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
ANTIGRAVITY_OAUTH_CLIENT_SECRET=your-other-secret-here
```

### Production Deployment

For production deployments:
- Always set OAuth secrets via environment variables or secret management systems
- Never use default credentials in production
- Rotate credentials regularly
- Use separate credentials for development and production environments

## Security Updates

### January 2026 - OAuth Credentials Hardcoding

**Fixed:** Removed hardcoded Google OAuth client secrets from source code

**Impact:** Public exposure of OAuth credentials could allow unauthorized access

**Resolution:** 
- Migrated OAuth credentials to environment variables
- Added `.env.example` with secure configuration template
- Updated documentation with security best practices

**Action Required:**
- Set `GEMINI_OAUTH_CLIENT_ID` environment variable
- Set `GEMINI_OAUTH_CLIENT_SECRET` environment variable
- Set `ANTIGRAVITY_OAUTH_CLIENT_ID` environment variable
- Set `ANTIGRAVITY_OAUTH_CLIENT_SECRET` environment variable
- Remove any `.env` files from version control
