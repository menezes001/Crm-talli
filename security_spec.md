# Security Specification — Talli CRM (Firestore Rules)

## 1. Data Invariants

1. **Strict Workspace Ownership & PII Isolation**: Every workspace (`workspaces/{workspaceId}`) is owned by a single verified user (`workspaceId == request.auth.uid` and `ownerId == request.auth.uid`). Lead PII (`phone`, `email`, `fullName`, `notes`) is readable and writable exclusively by the verified owner.
2. **Parent-Child Relational Integrity (Master Gate)**: A lead cannot be created unless its parent workspace exists and is owned by `request.auth.uid`. An interaction cannot be created unless its parent lead exists and is owned by `request.auth.uid`.
3. **Append-Only Interaction History**: Once an interaction is created under `workspaces/{workspaceId}/leads/{leadId}/interactions/{interactionId}`, it can NEVER be updated or deleted (`allow update, delete: if false;`), preserving complete commercial audit history.
4. **Atomic Interaction-Lead Synchronization**: Creating an interaction MUST happen atomically in the same batch as incrementing the parent lead's `interactionCount` (`getAfter(...).data.interactionCount == get(...).data.interactionCount + 1`).
5. **Strict Schema & Temporal Integrity**: Every string field enforces `.size()` bounds matching `firebase-blueprint.json`, every document ID matches `^[a-zA-Z0-9_\-]+$`, shadow/ghost fields are blocked via `hasOnly()`, and `createdAt`/`updatedAt` strictly require `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Return PERMISSION_DENIED)

1. **Unauthenticated Read/Write**: Reading `/workspaces/userA/leads/caio-lead-1` without auth.
2. **Unverified Email Spoofing**: Creating a lead with valid `uid` where `request.auth.token.email_verified == false`.
3. **Cross-Tenant PII Read**: User B attempting `get` or `list` on `/workspaces/userA/leads/caio-lead-1`.
4. **Identity Spoofing on Create**: User A creating a lead inside `/workspaces/userA/leads/lead-x` with `ownerId: "userB"`.
5. **Shadow / Ghost Field Injection on Create**: Creating a lead with an extra key `isAdmin: true` or `shadowTag: "hack"`.
6. **Shadow Update Attack**: Updating a lead with `{ stage: "venda_fechada", ghostField: 123, updatedAt: serverTimestamp() }`.
7. **Immutable Field Tampering**: Updating a lead's `ownerId`, `workspaceId`, `importedFromCaioSheet`, or `createdAt`.
8. **Value Poisoning on Whitelisted Stage Update**: Updating `stage` to `"invalid_stage"` or a 10KB string.
9. **Path ID Poisoning**: Creating a lead with a 200-character or special-character document ID (`../evil$id`).
10. **Forged Client Timestamp**: Creating a lead with `createdAt: new Date("2020-01-01")` instead of `request.time`.
11. **Non-Atomic Orphan Interaction**: Creating an interaction document without atomically updating the parent lead's `interactionCount`.
12. **History Erasure Attempt**: Owner attempting to `update` or `delete` an existing interaction under `/interactions/{id}`.
