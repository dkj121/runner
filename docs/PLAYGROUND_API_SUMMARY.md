# Playground API Quick Reference

## Created API Routes

### Main Routes

- ✅ `GET /api/playgrounds` - List user's playgrounds
- ✅ `POST /api/playgrounds` - Create new playground
- ✅ `GET /api/playgrounds/[id]` - Get playground details
- ✅ `PUT /api/playgrounds/[id]` - Update playground (owner only)
- ✅ `DELETE /api/playgrounds/[id]` - Delete playground (owner only)

### Membership Routes

- ✅ `GET /api/playgrounds/[id]/members` - List all members
- ✅ `POST /api/playgrounds/[id]/join` - Join via invite code
- ✅ `POST /api/playgrounds/[id]/leave` - Leave playground

### Invite Code Routes

- ✅ `GET /api/playgrounds/[id]/invite-codes` - List codes (owner only)
- ✅ `POST /api/playgrounds/[id]/invite-codes` - Generate new code (owner only)

### Leaderboard Routes

- ✅ `GET /api/playgrounds/[id]/leaderboard` - Get rankings

## Features

### Authentication

- All routes use better-auth session validation
- Public playgrounds allow read-only access without auth
- Private playgrounds require membership

### Permissions

- **Owner**: Full CRUD, invite code management, member viewing
- **Member**: Join, leave (non-owners), view details/members/leaderboard
- **Public**: Read-only access to public playgrounds

### Data Validation

- Input validation for all POST/PUT requests
- Proper error messages in Chinese
- Invite code expiration and usage limits enforced

### Security

- Role-based access control (OWNER vs USER)
- Visibility checks (PUBLIC vs PRIVATE)
- Ownership verification for destructive operations

## File Structure

```
src/app/api/playgrounds/
├── route.ts                          # List & Create
└── [id]/
    ├── route.ts                      # Get, Update, Delete
    ├── members/
    │   └── route.ts                  # List members
    ├── join/
    │   └── route.ts                  # Join playground
    ├── leave/
    │   └── route.ts                  # Leave playground
    ├── invite-codes/
    │   └── route.ts                  # List & Generate codes
    └── leaderboard/
        └── route.ts                  # Get rankings
```

## Testing Endpoints

Use the HTTP client files in `requests/` directory or test with curl:

```bash
# List playgrounds
curl http://localhost:3000/api/playgrounds

# Create playground
curl -X POST http://localhost:3000/api/playgrounds \
  -H "Content-Type: application/json" \
  -d '{"name":"测试域","visibility":"PUBLIC"}'

# Get playground
curl http://localhost:3000/api/playgrounds/{id}

# Join playground
curl -X POST http://localhost:3000/api/playgrounds/{id}/join \
  -H "Content-Type: application/json" \
  -d '{"inviteCode":"ABC123"}'

# Get leaderboard
curl http://localhost:3000/api/playgrounds/{id}/leaderboard
```

## Integration with Existing Code

The API routes integrate with:

- **Prisma models**: `PlayGround`, `PlayGroundUser`, `InviteCode`, `PlayGroundRankingList`
- **Auth system**: better-auth session management
- **Server Actions**: Similar logic to `src/lib/actions.ts` but exposed via REST

## Next Steps

1. Start dev server: `pnpm dev`
2. Test endpoints with REST client or Postman
3. Update frontend to consume these APIs
4. Add rate limiting if needed
5. Consider adding WebSocket support for real-time features
