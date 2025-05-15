# Session-Based Authentication with Redis

This project now supports session-based authentication using Redis as the session store. This provides several advantages over JWT-only authentication:

1. Better security (tokens aren't stored in localStorage)
2. Server-side session management and revocation
3. Reduced token size (session ID only)
4. Automatic session expiration

## Setup

1. Ensure Redis is running (already configured in docker-compose.yml)
2. Add the following environment variables to your `.env` file:

```
# Session Configuration
SESSION_SECRET=your_strong_random_secret_key
SESSION_MAX_AGE=86400000 # 24 hours (in milliseconds)

# Redis Configuration
REDIS_URL=redis://redis:6379

# Client URL for CORS
CLIENT_URL=http://localhost:3000
```

## How It Works

1. **Session Storage**: User sessions are stored in Redis with a configurable expiration time
2. **Authentication Flow**:
   - User logs in with credentials
   - Server creates a session and returns a session cookie
   - Client includes this cookie in subsequent requests
   - Server validates the session on each request

3. **Backward Compatibility**: The system still supports JWT authentication for API clients

## Client Integration

The client has been updated to:
- Include credentials in all API requests (`credentials: 'include'`)
- Try session-based authentication first, with JWT as fallback
- Properly handle logout by calling the server's logout endpoint

## Security Considerations

- Session cookies are HTTP-only (not accessible via JavaScript)
- In production, cookies are set with the Secure flag
- CORS is configured to allow credentials only from trusted origins

## API Endpoints

- **POST /api/auth/login**: Authenticates user and creates a session
- **POST /api/auth/logout**: Destroys the current session
- **GET /api/auth/me**: Returns the current authenticated user

## Middleware

Use the `isAuthenticated` middleware to protect routes that require authentication:

```typescript
import { isAuthenticated } from '../middleware/authMiddleware';

router.get('/protected-route', isAuthenticated, yourController);
``` 