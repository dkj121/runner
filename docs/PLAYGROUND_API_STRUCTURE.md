# Playground API Structure

```
/api/playgrounds
│
├── GET     → List user's playgrounds (with pagination & filters)
├── POST    → Create new playground
│
└── /[id]
    │
    ├── GET     → Get playground details
    ├── PUT     → Update playground (owner only)
    ├── DELETE  → Delete playground (owner only)
    │
    ├── /members
    │   └── GET → List all members
    │
    ├── /join
    │   └── POST → Join via invite code
    │
    ├── /leave
    │   └── POST → Leave playground
    │
    ├── /invite-codes
    │   ├── GET  → List invite codes (owner only)
    │   └── POST → Generate invite code (owner only)
    │
    └── /leaderboard
        └── GET → Get rankings/leaderboard
```

## HTTP Methods Summary

| Endpoint                             | Method | Auth Required | Owner Only | Description             |
| ------------------------------------ | ------ | ------------- | ---------- | ----------------------- |
| `/api/playgrounds`                   | GET    | ✅            | ❌         | List user's playgrounds |
| `/api/playgrounds`                   | POST   | ✅            | ❌         | Create playground       |
| `/api/playgrounds/[id]`              | GET    | 🔓\*          | ❌         | Get details             |
| `/api/playgrounds/[id]`              | PUT    | ✅            | ✅         | Update playground       |
| `/api/playgrounds/[id]`              | DELETE | ✅            | ✅         | Delete playground       |
| `/api/playgrounds/[id]/members`      | GET    | 🔓\*          | ❌         | List members            |
| `/api/playgrounds/[id]/join`         | POST   | ✅            | ❌         | Join playground         |
| `/api/playgrounds/[id]/leave`        | POST   | ✅            | ❌         | Leave playground        |
| `/api/playgrounds/[id]/invite-codes` | GET    | ✅            | ✅         | List codes              |
| `/api/playgrounds/[id]/invite-codes` | POST   | ✅            | ✅         | Generate code           |
| `/api/playgrounds/[id]/leaderboard`  | GET    | 🔓\*          | ❌         | Get leaderboard         |

🔓\* = Auth optional for PUBLIC playgrounds, required for PRIVATE

## Response Status Codes

- `200` - Success (GET)
- `201` - Created (POST)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Key Features

### 🔐 Security

- Session-based authentication via better-auth
- Role-based access control (OWNER/USER)
- Visibility control (PUBLIC/PRIVATE)

### ✅ Validation

- Input validation on all write operations
- Invite code expiration checking
- Usage limit enforcement
- Duplicate membership prevention

### 📊 Data Aggregation

- Leaderboard calculates:
  - Total distance per user
  - Total time per user
  - Run count per user
  - Best pace per user
  - Automatic ranking

### 🎫 Invite System

- 6-character random codes (A-Z, 0-9)
- Optional expiration (hours)
- Optional usage limits
- Use count tracking
- Active/inactive status
