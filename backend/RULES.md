# PocketBase API Access & Security Rules

All business data (client phone numbers, contact persons, salon notes, and interaction history) is strictly protected. No public or anonymous access is permitted to any data collection.

---

## 1. Role Definitions

- **Unauthenticated (Guest):** No access (`@request.auth.id = ""`). Can only access the login endpoint (`/api/collections/users/auth-with-password`).
- **Agent (`@request.auth.role = "agent"`):** Frontline sales staff.
  - Can read all clients and contact logs.
  - Can create and update clients and contact logs.
  - **CANNOT delete** clients or logs.
  - **CANNOT create or delete** team members (users).
- **Admin (`@request.auth.role = "admin"`):** Team leads / managers.
  - Full permissions across all collections, including deletion and user management.

---

## 2. Collection Rules Matrix

| Collection | List | View | Create | Update | Delete |
|---|---|---|---|---|---|
| `users` | `@request.auth.id != ""` | `@request.auth.id != ""` | `@request.auth.role = "admin"` | `@request.auth.role = "admin" \|\| @request.auth.id = id` | `@request.auth.role = "admin"` |
| `clients` | `@request.auth.id != ""` | `@request.auth.id != ""` | `@request.auth.id != ""` | `@request.auth.id != ""` | `@request.auth.role = "admin"` |
| `contact_logs` | `@request.auth.id != ""` | `@request.auth.id != ""` | `@request.auth.id != ""` | `@request.auth.id != ""` | `@request.auth.role = "admin"` |

### Additional Security Controls
- **Public Signup Disabled:** `users.createRule` requires admin privileges. Self-registration via the public API is forbidden.
- **OAuth / Username Auth Disabled:** Users can only authenticate using email and password.
- **Rate Limiting:** PocketBase IP-based rate limiting enabled for auth endpoints to protect against brute force attacks.
- **Server-Side Phone Normalization:** On `clients` create and update, phone numbers are validated and stored in `9665XXXXXXXX` format. Invalid numbers return HTTP 400 with an Arabic error message.
- **Server-Side User Stamp:** `contact_logs.created_by` is set server-side from `@request.auth.id`, ignoring any client-provided user ID.

---

## 3. Contact Result Derivation Table

When a contact log is submitted with `update_client: true`, the following mapping is atomically applied to the parent client:

| Contact Result (`result`) | Contact Status (`contact_status`) | Outcome (`outcome`) | Next Follow-Up Date (`next_follow_up_date`) |
|---|---|---|---|
| `مهتم` | `ردّ` | `مهتم` | Preserved from log input |
| `طلب تفاصيل` | `ردّ` | `طلب عرض` | Preserved from log input |
| `طلب عرض` | `ردّ` | `طلب عرض` | Preserved from log input |
| `طلب تجربة` | `ردّ` | `تجربة/ديمو` | Preserved from log input |
| `مشترك` | `ردّ` | `مشترك` | Preserved from log input |
| `غير مهتم` | `ردّ` | `غير مهتم` | Preserved from log input |
| `لم يرد` | `في انتظار الرد` | *(Unchanged)* | Preserved from log input |
| `إعادة التواصل لاحقًا` | `متابعة مطلوبة` | `يحتاج متابعة لاحقًا` | Preserved from log input |
| `رقم غير صحيح` | `تم إيقاف التواصل` | *(Unchanged)* | Preserved from log input |
| `طلب عدم التواصل` | `تم إيقاف التواصل` | `لا يرغب بالتواصل` | **Forced NULL** (regardless of `update_client`) |

---

## 4. Verification with curl

### 1) Unauthenticated Read Request → 403 Forbidden
```bash
$ curl -s -w "\nHTTP Status: %{http_code}\n" http://127.0.0.1:8090/api/collections/clients/records
{"code":403,"message":"Only authenticated users can access this resource.","data":{}}
HTTP Status: 403
```

### 2) Agent Authenticated Delete Request → 403 Forbidden
```bash
# Log in as agent:
$ AGENT_TOKEN=$(curl -s -X POST http://127.0.0.1:8090/api/collections/users/auth-with-password \
  -H "Content-Type: application/json" \
  -d '{"identity":"agent@ojlinker.sa","password":"AgentPassword123"}' | jq -r .token)

# Attempt to delete client as agent:
$ curl -s -X DELETE http://127.0.0.1:8090/api/collections/clients/records/RECORD_ID \
  -H "Authorization: Bearer $AGENT_TOKEN" -w "\nHTTP Status: %{http_code}\n"
{"code":403,"message":"You are not allowed to perform this request.","data":{}}
HTTP Status: 403
```

### 3) Admin Authenticated Delete Request → 204 No Content
```bash
# Log in as admin:
$ ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8090/api/collections/users/auth-with-password \
  -H "Content-Type: application/json" \
  -d '{"identity":"admin@ojlinker.sa","password":"AdminPassword123"}' | jq -r .token)

# Delete client as admin:
$ curl -s -X DELETE http://127.0.0.1:8090/api/collections/clients/records/RECORD_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" -w "\nHTTP Status: %{http_code}\n"
HTTP Status: 204
```
