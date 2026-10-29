# OVESH CLOUD Client Workspaces — Implementation Plan

Status: design specification only. No production behavior is changed by this document.

## Goals

- Keep the existing OVESH CLOUD owner login, signed owner session, and owner dashboard behavior unchanged.
- Add a Client Login choice on the existing OVESH CLOUD login page.
- Give each client a separate workspace and a server-enforced 10 GiB storage quota.
- Let clients upload, view, download, update, delete, and share files they own.
- Support two share modes, selected per share:
  1. Link sharing: a random, revocable token with optional expiry and password protection.
  2. Invited people: access is granted to a specific verified email/account and can be revoked.
- Keep the Backblaze B2 bucket private and all B2 credentials server-side.
- Treat the feature as unverified until production tests pass.

## Architecture constraints

- One Vercel application, multiple isolated client workspaces.
- Firebase Authentication identifies client accounts. The API must verify Firebase ID tokens server-side with Firebase Admin; frontend-supplied UIDs, email addresses, workspace IDs, object keys, and file sizes are never trusted as authorization.
- Firestore stores workspace membership, quota reservations, file metadata, share records, and audit events.
- Backblaze B2 stores file bytes in the existing private bucket. Use workspace-scoped object keys, for example `client-workspaces/{workspaceId}/{fileId}/{safeName}`; never expose B2 credentials or permanent public object URLs.
- The existing owner session remains a separate authentication system. Client login must not set, replace, or impersonate the owner session.
- All client APIs use `Cache-Control: private, no-store`, validate HTTP methods and request fields, and return generic errors that do not leak whether another client's file exists.

## Data model

### `oveshCloudClientWorkspaces/{workspaceId}`

- `ownerUid`: Firebase UID of the client account that owns the workspace.
- `status`: `active` or `suspended`.
- `quotaBytes`: default 10 GiB (10 × 1024³ bytes).
- `usedBytes`: server-maintained total of active stored files.
- `createdAt`, `updatedAt`.

### `oveshCloudClientFiles/{fileId}`

- `workspaceId`, `ownerUid`, `objectKey`, `name`, `contentType`, `sizeBytes`, `status`, `createdAt`, `updatedAt`.
- File metadata is written only by trusted server code.
- Uploads reserve quota transactionally before a short-lived presigned upload URL is issued. Completion must verify the stored object size and reconcile the reservation. Failed or abandoned uploads release reservations. Deletion decrements usage only after the object is successfully deleted.

### `oveshCloudClientShares/{shareId}`

- `workspaceId`, `fileId`, `createdByUid`, `mode` (`link` or `invite`), `status`, `createdAt`, optional `expiresAt`.
- Link mode stores a hash of a high-entropy random token, not the raw token. Downloads require an active, unexpired share record and are streamed or authorized with a short-lived signed URL.
- Invite mode stores normalized invited email, optional recipient UID after account verification, permission (`view` or `download`), and revocation state. Access requires a verified Firebase account whose email matches the invitation or the specifically bound UID.
- Revoke operations are owner-only and immediately block future share authorization.

### `oveshCloudClientAudit/{eventId}`

- Minimal audit metadata: actor UID, workspace ID, event type, file/share ID, timestamp, and outcome. Do not log passwords, ID tokens, raw share tokens, or file contents.

## API contract (proposed)

- `POST /api/oveshcloud-client-workspace?action=me`: verify Firebase ID token; return the caller's active workspace, quota, and used bytes only.
- `POST /api/oveshcloud-client-workspace?action=list`: return only caller-owned file metadata.
- `POST /api/oveshcloud-client-workspace?action=upload-init`: validate name/type/size; transactionally reserve quota; issue a short-lived presigned PUT URL and upload ID.
- `POST /api/oveshcloud-client-workspace?action=upload-complete`: verify the B2 object exists and its actual size matches the reservation, then finalize metadata.
- `POST /api/oveshcloud-client-workspace?action=download`: authorize ownership or a valid share, then issue a short-lived download authorization.
- `POST /api/oveshcloud-client-workspace?action=delete`: authorize ownership, delete the object, and reconcile quota/metadata.
- `POST /api/oveshcloud-client-share?action=create`: create either a link share or an email invitation.
- `POST /api/oveshcloud-client-share?action=accept-invite`: bind a pending invitation to a verified matching account.
- `POST /api/oveshcloud-client-share?action=revoke`: revoke a share owned by the caller.
- `GET /api/oveshcloud-client-share?action=resolve`: resolve a link token without exposing metadata until token validation passes.

Every endpoint must independently authenticate and authorize the operation. Do not rely on hiding UI controls.

## Login page behavior

- Add a clearly labeled Client Login choice to the existing login page.
- Owner Login continues to call the current `/api/oveshcloud-auth` endpoint and retains the existing owner session and security flow.
- Client Login uses Firebase email/password sign-in, then requests an ID token and calls the client workspace API.
- Client login must never fall back to owner credentials or elevate a client to owner.
- A client without an active, provisioned workspace sees a neutral support message and no owner data.

## Sharing behavior

- On each share action, the client chooses **Share link** or **Invite by email**.
- Link share controls: expiry, optional password, permission, copy link, and revoke. Use high-entropy opaque tokens; store only a token hash; apply rate limiting; never expose the B2 object key in the URL.
- Invitation controls: email, view/download permission, optional expiry, accept only after verified email sign-in, and revoke.
- Link access is bearer access: anyone holding the link can use it until it expires or is revoked. Warn the sharer before creating an unrestricted link.
- Shared users receive access only to the selected file unless folder sharing is explicitly implemented later.
- Shared access never grants access to the client's whole workspace or other files.

## Required security and quota tests

1. Owner login and logout behavior remains unchanged.
2. Client A cannot list, view, download, replace, share, or delete Client B's files by changing IDs, object keys, URLs, or request bodies.
3. Client A cannot read or mutate owner-only data or owner sessions.
4. Quota reservation prevents concurrent uploads from exceeding 10 GiB.
5. Oversized uploads, forged size fields, failed uploads, and abandoned reservations are handled correctly.
6. File metadata is not marked complete until B2 confirms the expected object and size.
7. A link is unusable after expiry or revocation; guessing tokens does not reveal whether a file exists.
8. An invited user with a different or unverified email is denied; revoked invitations immediately stop future access.
9. B2 bucket remains private; credentials never appear in browser bundles, responses, logs, or share URLs.
10. API responses are no-store and errors do not reveal cross-tenant information.
11. Upload, view, download, update, delete, link sharing, invite sharing, and revocation pass on a production-like deployment.
12. No production-success claim is made until these tests are completed against the deployed version.

## Rollout plan

1. Review this design and confirm the client-account provisioning approach.
2. Implement server-side Firebase token verification, workspace membership, and quota reservation first.
3. Implement client login UI and workspace view behind a feature gate; do not alter owner flow.
4. Implement uploads and basic file operations; test cross-tenant isolation.
5. Implement link and invited-user sharing, including revocation and expiry.
6. Run the complete acceptance checklist in a preview deployment.
7. Deploy only after checks pass, then smoke-test owner login, client login, upload, quota enforcement, sharing, and revocation in production.

## Current implementation note

The existing share endpoint is designed around the existing OVESH CLOUD owner session and `users/{uid}/...` object-key ownership. Do not simply reuse it for client workspaces: client identities, workspace IDs, quota accounting, and share permissions need explicit server-side authorization. This document does not claim that client workspaces or sharing are implemented or deployed.
