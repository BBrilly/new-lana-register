
# API Documentation Page Implementation

## Overview
Creating a comprehensive API documentation page for the Lana Register external APIs, accessible via an "API Docs" link in the landing page header.

## What Will Be Built

### 1. New API Documentation Page (`/api-docs`)
A clean, professional documentation page covering the external APIs:

- **Register Virgin Wallets API** - Bulk registration of zero-balance wallets for existing users
- Authentication requirements (API key)
- Request/response formats with examples
- Error codes and handling
- Link to official website lanawatch.us

### 2. Landing Page Header Update
Adding an "API Docs" navigation link in the landing page header, styled to match the existing design.

## Technical Details

### Files to Create

**`src/pages/ApiDocs.tsx`**
- Complete API documentation page with sections:
  - Introduction & Overview
  - Authentication (API key requirement)
  - Endpoints documentation
  - Request/Response examples
  - Error codes reference
  - Link to lanawatch.us

### Files to Modify

**`src/pages/LandingPage.tsx`**
- Add "API Docs" link to the header navigation (near existing elements like status indicators)

**`src/App.tsx`**
- Add new route: `/api-docs` pointing to ApiDocs component

## API Documentation Content

### Register Virgin Wallets Endpoint

```text
POST /functions/v1/register-virgin-wallets

Purpose: Bulk register up to 8 zero-balance (virgin) wallets 
         for an existing user profile

Authentication: API key in request body

Request Body:
{
  "method": "register_virgin_wallets_for_existing_user",
  "api_key": "your_api_key",
  "data": {
    "nostr_id_hex": "64-char-hex-string",
    "wallets": [
      {
        "wallet_id": "LxxxxxxxxxxxxxxxxxxxxxxxxL",
        "wallet_type": "Main Wallet",
        "notes": "Optional note"
      }
    ]
  }
}

Response (Success):
{
  "success": true,
  "status": "ok",
  "message": "Successfully registered X virgin wallets",
  "data": {
    "nostr_id_hex": "...",
    "wallets_registered": X,
    "wallets": [...],
    "nostr_broadcasts": {
      "successful": X,
      "failed": 0
    }
  },
  "correlation_id": "uuid"
}
```

### Error Codes
- `400` - Invalid request (bad method, invalid wallet format, non-virgin wallet)
- `401` - Invalid API key
- `404` - Profile not found for given nostr_id_hex
- `409` - Duplicate wallet registration
- `500` - Server error

## Design Approach

The API docs page will:
- Use existing UI components (Card, Badge, Table)
- Match the dark theme of the application
- Include code blocks with syntax highlighting for examples
- Provide copy-to-clipboard functionality for code snippets
- Link prominently to lanawatch.us as the official website

## Implementation Order

1. Create `ApiDocs.tsx` page component
2. Add route in `App.tsx`
3. Add "API Docs" link to `LandingPage.tsx` header
