# WalletConnect Pay API Reference

> API documentation for SonicPay integration

Base URL: `https://api.pay.walletconnect.com`

---

## Authentication

All requests require authentication via headers:

| Header | Required | Description |
|--------|----------|-------------|
| `Api-Key` | Yes | Your API key from WalletConnect dashboard |
| `Merchant-Id` | Yes (merchant endpoints) | Your merchant ID |
| `App-Id` | Alternative | App ID (requires `Client-Id` too) |
| `Client-Id` | With App-Id | Client identifier |

Optional headers:
- `WCP-Version` - API version
- `Sdk-Name` - SDK identifier
- `Sdk-Version` - SDK version
- `Sdk-Platform` - Platform (ios, android, web)
- `Idempotency-Key` - Prevent duplicate requests

---

## Merchant API (POS Side)

### Create Payment

Creates a new payment request. **This is what the POS calls.**

```
POST /v1/payments
```

**Headers:**
```
Api-Key: your_api_key
Merchant-Id: your_merchant_id
Content-Type: application/json
```

**Request Body:**
```json
{
  "referenceId": "ORDER-123",
  "amount": {
    "unit": "iso4217/USD",
    "value": "450"
  },
  "expiresAt": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `referenceId` | string | Yes | Your unique order/reference ID |
| `amount.unit` | string | Yes | `iso4217/USD` for fiat, `caip19/...` for crypto |
| `amount.value` | string | Yes | Amount in minor units (cents for USD) |
| `expiresAt` | integer | No | Unix timestamp for expiration |

**Response (201 Created):**
```json
{
  "paymentId": "pay_c8a2ecc101KN47A9Z5GPQYP88YANPHD7QJ",
  "status": "requires_action",
  "expiresAt": 1718236800,
  "gatewayUrl": "https://pay.walletconnect.com/pay_c8a2ecc101KN47A9Z5GPQYP88YANPHD7QJ",
  "isFinal": false,
  "pollInMs": 1000
}
```

| Field | Type | Description |
|-------|------|-------------|
| `paymentId` | string | Unique payment ID (transmit this via ultrasonic!) |
| `status` | enum | `requires_action`, `processing`, `succeeded`, `failed`, `expired`, `cancelled` |
| `gatewayUrl` | string | URL for wallet to open |
| `expiresAt` | integer | Unix timestamp |
| `isFinal` | boolean | True if payment reached terminal state |
| `pollInMs` | integer | Milliseconds to wait before polling status |

---

### Get Payment Status (Merchant)

Poll for payment completion.

```
GET /v1/payments/{id}/status
```

**Headers:**
```
Api-Key: your_api_key
Merchant-Id: your_merchant_id
```

**Query Parameters:**
- `maxPollMs` (optional) - Maximum time to wait for status change

**Response (200):**
```json
{
  "status": "succeeded",
  "isFinal": true,
  "pollInMs": null
}
```

---

### Cancel Payment (Merchant)

Cancel a pending payment.

```
POST /v1/payments/{id}/cancel
```

**Headers:**
```
Api-Key: your_api_key
Merchant-Id: your_merchant_id
```

**Response (200):**
```json
{
  "status": "cancelled",
  "isFinal": true
}
```

---

### List Payments (Merchant)

Get payment history.

```
GET /v1/merchants/payments
```

**Headers:**
```
Merchant-Id: your_merchant_id
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `startTs` | integer | Filter from timestamp |
| `endTs` | integer | Filter to timestamp |
| `status` | string | Filter by status |
| `asset` | string | Filter by asset |
| `network` | string | Filter by network |
| `limit` | integer | Page size |
| `cursor` | string | Pagination cursor |
| `sortBy` | string | Sort field |
| `sortDir` | string | `asc` or `desc` |

---

## Gateway API (Wallet Side)

These endpoints are called by the wallet app after receiving the payment ID.

### Get Payment Info

Get basic payment info to display to user.

```
GET /v1/gateway/payment/{id}
```

**Response (200):**
```json
{
  "status": "requires_action",
  "expiresAt": 1718236800,
  "amount": {
    "unit": "caip19/eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "value": "450000000",
    "display": {
      "assetName": "USD Coin",
      "assetSymbol": "USDC",
      "decimals": 6,
      "iconUrl": "https://assets.walletconnect.com/usdc.png",
      "networkName": "Base",
      "networkIconUrl": "https://assets.walletconnect.com/base.png"
    }
  },
  "merchant": {
    "name": "Blue Bottle Coffee",
    "iconUrl": "https://example.com/bluebottle.png"
  },
  "buyer": null
}
```

---

### Get Payment Options

Get available payment methods for user's accounts.

```
POST /v1/gateway/payment/{id}/options
```

**Query Parameters:**
- `includePaymentInfo` (boolean) - Include full payment info in response

**Request Body:**
```json
{
  "accounts": [
    "eip155:1:0xYourAddress",
    "eip155:8453:0xYourAddress",
    "eip155:137:0xYourAddress"
  ],
  "refresh": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accounts` | string[] | Yes | User's accounts in CAIP-10 format |
| `refresh` | string[] | No | Option IDs to refresh quotes |

**Response (200):**
```json
{
  "info": {
    "status": "requires_action",
    "amount": { "unit": "iso4217/USD", "value": "450", "display": {...} },
    "expiresAt": 1718236800,
    "merchant": { "name": "Blue Bottle Coffee", "iconUrl": "..." },
    "buyer": null
  },
  "options": [
    {
      "id": "opt_abc123",
      "account": "eip155:8453:0xYourAddress",
      "amount": {
        "unit": "caip19/eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "value": "4500000",
        "display": {
          "assetName": "USD Coin",
          "assetSymbol": "USDC",
          "decimals": 6
        }
      },
      "etaS": 5,
      "actions": [
        {
          "type": "walletRpc",
          "data": {
            "chain_id": "eip155:8453",
            "method": "eth_signTypedData_v4",
            "params": ["0xYourAddress", "{...typed data...}"]
          }
        }
      ],
      "expiresAt": 1718236900,
      "collectData": null
    }
  ],
  "collectData": null
}
```

**Option Object:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Option ID (use in fetch/confirm) |
| `account` | string | CAIP-10 account this option uses |
| `amount` | object | Amount in user's token |
| `etaS` | integer | Estimated time to complete (seconds) |
| `actions` | array | Actions required (signing, transactions) |
| `expiresAt` | integer | Quote expiration |
| `collectData` | object | Data collection requirements (if any) |

---

### Fetch Action

Get detailed signing data for an option.

```
POST /v1/gateway/payment/{id}/fetch
```

**Request Body:**
```json
{
  "optionId": "opt_abc123",
  "data": ""
}
```

**Response (200):**
```json
{
  "actions": [
    {
      "type": "walletRpc",
      "data": {
        "chain_id": "eip155:8453",
        "method": "eth_signTypedData_v4",
        "params": [
          "0xYourAddress",
          "{\"types\":{...},\"primaryType\":\"Permit\",\"domain\":{...},\"message\":{...}}"
        ]
      }
    }
  ]
}
```

**Action Types:**
| Type | Description |
|------|-------------|
| `walletRpc` | Requires wallet RPC call (signing, transaction) |
| `build` | Requires additional building step |

**WalletRpc Methods:**
| Method | Description |
|--------|-------------|
| `eth_signTypedData_v4` | EIP-712 typed data signing (permits) |
| `eth_sendTransaction` | Send a transaction |
| `personal_sign` | Personal message signing |

---

### Confirm Payment

Submit signatures and complete payment.

```
POST /v1/gateway/payment/{id}/confirm
```

**Query Parameters:**
- `maxPollMs` (optional) - Maximum time to wait for confirmation

**Request Body:**
```json
{
  "optionId": "opt_abc123",
  "results": [
    {
      "type": "walletRpc",
      "data": ["0xSignatureHex..."]
    }
  ],
  "collectedData": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `optionId` | string | Yes | Option ID from get options |
| `results` | array | Yes | Signatures/tx hashes for each action |
| `collectedData` | object | No | User data if `collectData` was required |

**Response (200):**
```json
{
  "status": "succeeded",
  "isFinal": true,
  "info": {
    "txId": "0xTransactionHash...",
    "optionAmount": {
      "unit": "caip19/eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "value": "4500000"
    }
  }
}
```

---

### Get Payment Status (Gateway)

Poll for payment completion from wallet side.

```
GET /v1/gateway/payment/{id}/status
```

**Query Parameters:**
- `maxPollMs` (optional) - Long poll duration

**Response (200):**
```json
{
  "status": "processing",
  "isFinal": false,
  "pollInMs": 2000
}
```

---

### Cancel Payment (Gateway)

Cancel from wallet side.

```
POST /v1/gateway/payment/{id}/cancel
```

**Response (200):**
```json
{
  "status": "cancelled",
  "isFinal": true
}
```

---

## Payment Status Values

| Status | Description | Is Final |
|--------|-------------|----------|
| `requires_action` | Waiting for user action | No |
| `processing` | Payment being processed | No |
| `succeeded` | Payment completed | Yes |
| `failed` | Payment failed | Yes |
| `expired` | Payment expired | Yes |
| `cancelled` | Payment cancelled | Yes |

---

## CAIP Formats

**CAIP-10 (Account):**
```
eip155:1:0xAddress        # Ethereum mainnet
eip155:8453:0xAddress     # Base
eip155:137:0xAddress      # Polygon
eip155:42161:0xAddress    # Arbitrum
eip155:10:0xAddress       # Optimism
```

**CAIP-19 (Asset):**
```
caip19/eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913  # USDC on Base
caip19/eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48     # USDC on Ethereum
```

---

## SonicPay Integration Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         POS (Merchant)                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. POST /v1/payments                                               │
│     { referenceId, amount: { unit: "iso4217/USD", value: "450" } }  │
│                                                                     │
│  2. Receive paymentId: "pay_abc123"                                 │
│                                                                     │
│  3. Broadcast "pay_abc123" via ultrasonic                           │
│                                                                     │
│  4. Poll GET /v1/payments/{id}/status until succeeded               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

                              🔊 Ultrasonic

┌─────────────────────────────────────────────────────────────────────┐
│                         Wallet (Customer)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  5. Receive "pay_abc123" via ultrasonic                             │
│                                                                     │
│  6. POST /v1/gateway/payment/{id}/options                           │
│     { accounts: ["eip155:8453:0xUser"] }                            │
│     → Get merchant info, payment options                            │
│                                                                     │
│  7. Display: "Pay $4.50 to Blue Bottle Coffee?"                     │
│                                                                     │
│  8. User selects option, app calls:                                 │
│     POST /v1/gateway/payment/{id}/fetch                             │
│     { optionId: "opt_123" }                                         │
│     → Get signing actions                                           │
│                                                                     │
│  9. Sign with wallet (eth_signTypedData_v4)                         │
│                                                                     │
│ 10. POST /v1/gateway/payment/{id}/confirm                           │
│     { optionId: "opt_123", results: [{ type: "walletRpc", data }] } │
│     → Payment complete!                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Error Responses

All endpoints may return:

| Code | Description |
|------|-------------|
| 400 | Invalid request (bad params, validation error) |
| 401 | Invalid API key or unauthorized |
| 404 | Payment not found |
| 500 | Internal server error |

**Error Response Format:**
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Description of what went wrong"
  }
}
```

---

## Environment Variables (POS)

```env
VITE_WC_API_URL=https://api.pay.walletconnect.com
VITE_WC_MERCHANT_ID=your_merchant_id
VITE_WC_API_KEY=your_api_key
```

---

*Last updated: April 4, 2026*
