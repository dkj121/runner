# Playground API Documentation

This document describes the REST API endpoints for the Playground (域) feature.

## Base URL

All endpoints are prefixed with `/api/playgrounds`

## Authentication

All endpoints require authentication via better-auth session cookies, except:

- `GET /api/playgrounds/[id]` (public playgrounds only)
- `GET /api/playgrounds/[id]/members` (public playgrounds only)
- `GET /api/playgrounds/[id]/leaderboard` (public playgrounds only)

## Endpoints

### 1. List Playgrounds

**GET** `/api/playgrounds`

List all playgrounds for the authenticated user.

**Query Parameters:**

- `take` (number, optional): Number of results to return (default: 20, max: 100)
- `skip` (number, optional): Number of results to skip for pagination (default: 0)
- `visibility` (string, optional): Filter by visibility (`PUBLIC` or `PRIVATE`)

**Response:**

```json
{
	"playgrounds": [
		{
			"id": "cm4abc123",
			"name": "晨跑团",
			"description": "每周三次晨跑",
			"visibility": "PUBLIC",
			"locationLat": 39.9042,
			"locationLng": 116.4074,
			"locationAddr": "天安门广场",
			"createdAt": "2026-01-15T08:00:00Z",
			"updatedAt": "2026-01-20T09:30:00Z",
			"_count": {
				"users": 15
			},
			"users": [
				{
					"role": "OWNER",
					"user": {
						"name": "张三",
						"image": "https://..."
					}
				}
			]
		}
	],
	"total": 42
}
```

---

### 2. Create Playground

**POST** `/api/playgrounds`

Create a new playground. The authenticated user becomes the owner.

**Request Body:**

```json
{
	"name": "晨跑团",
	"description": "每周三次晨跑",
	"visibility": "PUBLIC",
	"locationLat": 39.9042,
	"locationLng": 116.4074,
	"locationAddr": "天安门广场"
}
```

**Required Fields:**

- `name` (string): Playground name

**Optional Fields:**

- `description` (string): Description
- `visibility` (string): `PUBLIC` or `PRIVATE` (default: `PUBLIC`)
- `locationLat` (number): Latitude
- `locationLng` (number): Longitude
- `locationAddr` (string): Address

**Response:** `201 Created`

```json
{
  "id": "cm4abc123",
  "name": "晨跑团",
  ...
}
```

---

### 3. Get Playground Details

**GET** `/api/playgrounds/[id]`

Get detailed information about a specific playground.

**Response:**

```json
{
	"id": "cm4abc123",
	"name": "晨跑团",
	"description": "每周三次晨跑",
	"visibility": "PUBLIC",
	"locationLat": 39.9042,
	"locationLng": 116.4074,
	"locationAddr": "天安门广场",
	"createdAt": "2026-01-15T08:00:00Z",
	"updatedAt": "2026-01-20T09:30:00Z",
	"_count": {
		"users": 15
	},
	"users": [
		{
			"id": "user123",
			"userId": "user123",
			"playGroundId": "cm4abc123",
			"role": "OWNER",
			"user": {
				"id": "user123",
				"name": "张三",
				"image": "https://..."
			}
		}
	],
	"inviteCodes": [
		{
			"code": "ABC123",
			"isActive": true,
			"expiresAt": null,
			"maxUses": 0,
			"useCount": 5
		}
	]
}
```

---

### 4. Update Playground

**PUT** `/api/playgrounds/[id]`

Update playground details. Only the owner can update.

**Request Body:**

```json
{
	"name": "新名称",
	"description": "新描述",
	"visibility": "PRIVATE",
	"locationLat": 39.9042,
	"locationLng": 116.4074,
	"locationAddr": "新地址"
}
```

All fields are optional. Only provided fields will be updated.

**Response:**

```json
{
  "id": "cm4abc123",
  "name": "新名称",
  ...
}
```

---

### 5. Delete Playground

**DELETE** `/api/playgrounds/[id]`

Delete a playground. Only the owner can delete.

**Response:**

```json
{
	"success": true
}
```

---

### 6. Get Members

**GET** `/api/playgrounds/[id]/members`

Get all members of a playground.

**Response:**

```json
{
	"members": [
		{
			"id": "member123",
			"userId": "user123",
			"playGroundId": "cm4abc123",
			"role": "OWNER",
			"createdAt": "2026-01-15T08:00:00Z",
			"user": {
				"id": "user123",
				"name": "张三",
				"image": "https://...",
				"email": "zhangsan@example.com"
			}
		}
	]
}
```

---

### 7. Join Playground

**POST** `/api/playgrounds/[id]/join`

Join a playground using an invite code.

**Request Body:**

```json
{
	"inviteCode": "ABC123"
}
```

**Response:** `201 Created`

```json
{
  "id": "member456",
  "userId": "user456",
  "playGroundId": "cm4abc123",
  "role": "USER",
  "user": {
    "id": "user456",
    "name": "李四",
    "image": "https://..."
  },
  "playGround": {
    "id": "cm4abc123",
    "name": "晨跑团",
    ...
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid invite code, expired, or already a member
- `401 Unauthorized`: Not authenticated

---

### 8. Leave Playground

**POST** `/api/playgrounds/[id]/leave`

Leave a playground. Owners cannot leave (must transfer ownership or delete playground first).

**Response:**

```json
{
	"success": true
}
```

**Error Responses:**

- `400 Bad Request`: Not a member
- `403 Forbidden`: Owner cannot leave

---

### 9. List Invite Codes

**GET** `/api/playgrounds/[id]/invite-codes`

Get all invite codes for a playground. Only the owner can view.

**Response:**

```json
{
	"inviteCodes": [
		{
			"id": "code123",
			"code": "ABC123",
			"playGroundId": "cm4abc123",
			"createdBy": "user123",
			"maxUses": 10,
			"useCount": 5,
			"expiresAt": "2026-02-01T00:00:00Z",
			"isActive": true,
			"createdAt": "2026-01-15T08:00:00Z"
		}
	]
}
```

---

### 10. Generate Invite Code

**POST** `/api/playgrounds/[id]/invite-codes`

Generate a new invite code. Only the owner can generate.

**Request Body:**

```json
{
	"maxUses": 10,
	"expiresInHours": 168
}
```

**Optional Fields:**

- `maxUses` (number): Maximum number of uses (0 = unlimited, default: 0)
- `expiresInHours` (number): Hours until expiration (default: no expiration)

**Response:** `201 Created`

```json
{
	"id": "code456",
	"code": "XYZ789",
	"playGroundId": "cm4abc123",
	"createdBy": "user123",
	"maxUses": 10,
	"useCount": 0,
	"expiresAt": "2026-01-22T08:00:00Z",
	"isActive": true,
	"createdAt": "2026-01-15T08:00:00Z"
}
```

---

### 11. Get Leaderboard

**GET** `/api/playgrounds/[id]/leaderboard`

Get the leaderboard (ranking) for a playground based on run records.

**Response:**

```json
{
	"leaderboard": [
		{
			"rank": 1,
			"userId": "user123",
			"name": "张三",
			"image": "https://...",
			"totalDistance": 42195.5,
			"totalTime": 12600,
			"runCount": 15,
			"bestPace": "04:58"
		},
		{
			"rank": 2,
			"userId": "user456",
			"name": "李四",
			"image": "https://...",
			"totalDistance": 35000.0,
			"totalTime": 10800,
			"runCount": 12,
			"bestPace": "05:12"
		}
	]
}
```

**Field Descriptions:**

- `totalDistance`: Total distance in meters
- `totalTime`: Total running time in seconds
- `runCount`: Number of runs
- `bestPace`: Best average pace in MM:SS format per kilometer

---

## Error Responses

All endpoints follow standard HTTP status codes:

- `200 OK`: Successful GET request
- `201 Created`: Successful POST request (resource created)
- `400 Bad Request`: Invalid request body or parameters
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error response format:

```json
{
	"error": "Error message in Chinese or English"
}
```

---

## Usage Examples

### Create a new playground

```bash
curl -X POST https://your-domain.com/api/playgrounds \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=..." \
  -d '{
    "name": "周末长跑",
    "description": "每周末10公里",
    "visibility": "PUBLIC"
  }'
```

### Join a playground

```bash
curl -X POST https://your-domain.com/api/playgrounds/cm4abc123/join \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=..." \
  -d '{
    "inviteCode": "ABC123"
  }'
```

### Generate invite code

```bash
curl -X POST https://your-domain.com/api/playgrounds/cm4abc123/invite-codes \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=..." \
  -d '{
    "maxUses": 50,
    "expiresInHours": 168
  }'
```

### Get leaderboard

```bash
curl https://your-domain.com/api/playgrounds/cm4abc123/leaderboard
```
