# Integration Specifications — ResilienceOS
**Version:** 0.1.0-DRAFT  
**Date:** 2026-03-29  
**Status:** DRAFT  

---

## Integration Architecture Principles

1. **Adapter Pattern:** Every third-party integration is wrapped in an adapter interface. The application depends on the interface, not the provider. Switching providers requires only a new adapter, not application changes.
2. **Graceful Degradation:** If an integration fails, the core platform continues to function. No integration is a hard dependency for exercise execution.
3. **Webhook Security:** All inbound webhooks are validated via HMAC signature before processing.
4. **Idempotency:** All integration event handlers are idempotent — receiving the same event twice produces the same result.
5. **Observability:** Every integration call is logged with provider, method, duration, status code, and any error.

---

## 1. Auth0 Integration

### Purpose
Authentication provider for all platform users.

### Configuration (per tenant — Enterprise SSO)
```
Tenant Settings → SSO → Upload IdP Metadata XML
Platform creates Auth0 Connection for tenant's SAML IdP
```

### JWT Validation
```typescript
// packages/auth/jwt.ts
interface DecodedToken {
  sub: string          // auth0_user_id
  email: string
  'rsos/tenant_id': string
  'rsos/role': UserRole
  'rsos/user_id': string
  iat: number
  exp: number
}

// All API routes call this before processing
async function validateToken(jwt: string): Promise<DecodedToken>
```

### Auth0 Actions (custom hooks)
**Post-login Action:** After Auth0 authenticates the user, inject custom claims:
```javascript
// Auth0 Action: Add ResilienceOS claims
exports.onExecutePostLogin = async (event, api) => {
  const user = await getRSOSUser(event.user.email, event.tenant.id)
  api.accessToken.setCustomClaim('rsos/tenant_id', user.tenantId)
  api.accessToken.setCustomClaim('rsos/role', user.role)
  api.accessToken.setCustomClaim('rsos/user_id', user.id)
}
```

**Post-user-registration Action:** Create resource record for new user.

### MFA Enforcement
```javascript
// Auth0 Action: Enforce MFA for privileged roles
exports.onContinuePostLogin = async (event, api) => {
  const role = event.user.app_metadata?.role
  if (['admin', 'moderator'].includes(role) && !event.authentication?.methods.includes('mfa')) {
    api.multifactor.enable('any', { allowRememberBrowser: false })
  }
}
```

---

## 2. Email Integration (Resend)

### Interface
```typescript
// packages/email/provider.ts
interface EmailProvider {
  send(params: {
    from: string
    to: string | string[]
    subject: string
    html: string
    text?: string
    replyTo?: string
    tags?: Record<string, string>
  }): Promise<{ messageId: string }>
  
  getDeliveryStatus(messageId: string): Promise<{
    status: 'sent' | 'delivered' | 'bounced' | 'failed'
    timestamp?: Date
  }>
}

// Implementations: ResendProvider, SMTPProvider, SendGridProvider (Enterprise BYO)
```

### Webhook Handler (Delivery Receipts)
```
POST /webhooks/email/resend
Headers: resend-signature: sha256=...
Body: { type: 'email.delivered' | 'email.bounced' | 'email.complained', ... }

Handler:
1. Validate HMAC signature
2. Find email_delivery by provider_message_id
3. Update status, record timestamp
4. Emit internal event for audit log
```

### Template Engine
```typescript
// Uses React Email for template authoring
// Templates are TypeScript components, not HTML strings
import { ExerciseStartEmail } from '@rsos/email/templates/exercise-start'
import { render } from '@react-email/render'

const html = render(<ExerciseStartEmail
  exerciseName="S4P/CFIN — Mock 1"
  startTime={new Date('2026-03-29T06:00:00Z')}
  recipientName="James Barrett"
  exerciseUrl="https://acmecorp.resilienceos.com/exercises/123"
/>)
```

---

## 3. SMS Integration (Twilio)

### Purpose
- Resource check-in invitations via SMS (for resources without email access)
- Crisis notification mass SMS (Module 3)
- Two-factor authentication via SMS (if TOTP not enrolled)

### Interface
```typescript
interface SMSProvider {
  send(params: {
    to: string        // E.164 format: +12125551234
    body: string      // Max 160 chars for single SMS
    from?: string     // Twilio number or short code
  }): Promise<{ messageId: string; status: string }>
  
  // Inbound SMS handling (for acknowledgements)
  parseWebhook(payload: Record<string, string>): InboundSMS
}
```

### Webhook Handler (Inbound SMS — for acknowledgements)
```
POST /webhooks/sms/twilio
Twilio-Signature: ...

Body (form-encoded):
  From: +12125551234
  Body: "YES"  (or "1", "CONFIRM", "STOP", etc.)
  
Handler:
1. Validate Twilio signature (X-Twilio-Signature)
2. Look up pending acknowledgement by phone number + context
3. Process response ("YES/1/CONFIRM" = acknowledged, "STOP" = opt-out)
4. Update acknowledgement record
5. Respond with TwiML: <Response/> (empty — no reply needed)
```

### Opt-Out Compliance
- Handle STOP/UNSUBSCRIBE automatically via Twilio's built-in opt-out handling
- Maintain opt-out list per tenant — never send to opted-out numbers
- Required by TCPA (US), GDPR (EU)

---

## 4. Voice Call Integration (Twilio Programmable Voice)

### Purpose
- Robocall notifications for crisis communications (Module 3, Phase 4)
- Press-1-to-acknowledge pattern for critical notifications

### Call Flow
```
1. API triggers outbound call via Twilio
   POST /2010-04-01/Accounts/{AccountSid}/Calls
   Body: { To, From, Url: 'https://api.resilienceos.com/twiml/crisis-notification/{notification_id}' }

2. Twilio fetches TwiML from our URL
   GET /twiml/crisis-notification/:id
   Returns:
   <Response>
     <Say voice="alice">
       This is an automated message from ResilienceOS on behalf of Acme Corporation.
       A Critical incident has been declared: Hurricane warning affecting Austin facility.
       If you have received this message, press 1 to confirm.
       To hear this message again, press 9.
     </Say>
     <Gather numDigits="1" action="/twiml/acknowledge/{notification_id}" timeout="15">
     </Gather>
     <Say>No response recorded. Goodbye.</Say>
   </Response>

3. User presses 1 → Twilio POSTs to /twiml/acknowledge/:id
   Handler: update acknowledgement record, return <Response/> (hang up)
```

---

## 5. Microsoft Teams Integration

### Purpose
- Incident notifications to Teams channels (Module 3)
- Task board status summaries for exercise moderators
- Slash command support (future)

### Webhook Notification
```typescript
// Adaptive Card payload for task status update
const card = {
  type: 'AdaptiveCard',
  version: '1.4',
  body: [
    { type: 'TextBlock', text: '📋 ResilienceOS — Exercise Update', weight: 'Bolder' },
    { type: 'FactSet', facts: [
      { title: 'Exercise', value: exercise.name },
      { title: 'Task', value: `#${task.displayId} — ${task.name}` },
      { title: 'Status', value: task.status },
      { title: 'Updated by', value: actor.name },
      { title: 'Time', value: new Date().toISOString() },
    ]},
  ],
  actions: [
    { type: 'Action.OpenUrl', title: 'View Exercise', url: exerciseUrl }
  ]
}

await fetch(teamsWebhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'message', attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: card }] })
})
```

### Configuration (per tenant)
```
Tenant Settings → Integrations → Microsoft Teams → Add Webhook URL
Configure: which events trigger notifications (exercise started, go/no-go, stage complete, exercise complete)
Configure: which Teams channel(s)
```

---

## 6. Slack Integration

### Purpose
- Incident notifications to Slack channels
- Exercise status summaries
- `/rsos incident declare` slash command (Phase 4)

### App Installation
- Tenant admin installs ResilienceOS Slack App via OAuth
- App stores `access_token` and `incoming_webhook_url` per workspace
- Scopes required: `chat:write`, `commands`, `incoming-webhook`

### Block Kit Notification
```typescript
const blocks = [
  {
    type: 'header',
    text: { type: 'plain_text', text: '🛡️ ResilienceOS — DR Exercise Update' }
  },
  {
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*Exercise:*\n${exercise.name}` },
      { type: 'mrkdwn', text: `*Stage:*\n${stage.stageName}` },
      { type: 'mrkdwn', text: `*Task #${task.displayId}:*\n${task.name}` },
      { type: 'mrkdwn', text: `*Status:*\n${statusEmoji} ${task.status}` },
    ]
  },
  {
    type: 'actions',
    elements: [{
      type: 'button', text: { type: 'plain_text', text: 'Open Exercise Board' },
      url: exerciseUrl, style: 'primary'
    }]
  }
]
```

### Slash Command Handler
```
POST /webhooks/slack/command
Body: { command: '/rsos', text: 'incident declare fire Austin Plant', user_id, team_id }

Handler:
1. Validate Slack signing secret (X-Slack-Signature)
2. Parse command intent
3. Find tenant by Slack team_id
4. Route to appropriate handler
5. Respond within 3 seconds (Slack requires immediate response)
   → If complex: respond immediately with "Processing..." then send delayed message
```

---

## 7. ServiceNow Integration

### Purpose
- Create/update Change Requests for DR exercises
- Sync task completion status to ServiceNow ITSM tickets
- Bi-directional: ServiceNow incident creation can trigger a ResilienceOS crisis notification

### Connector Pattern
```typescript
// packages/integrations/servicenow.ts
interface ServiceNowConnector {
  createChangeRequest(params: {
    shortDescription: string
    description: string
    category: string
    risk: 'low' | 'medium' | 'high' | 'critical'
    startDate: Date
    endDate: Date
    assignedTo: string
  }): Promise<{ sysId: string; number: string }>
  
  updateChangeRequest(sysId: string, params: Partial<{
    state: number  // ServiceNow state code
    workNotes: string
    closureCode: string
  }>): Promise<void>
  
  createIncident(params: {
    shortDescription: string
    urgency: 1 | 2 | 3
    impact: 1 | 2 | 3
    category: string
  }): Promise<{ sysId: string; number: string }>
}
```

### Configuration (Enterprise tier)
```
Tenant Settings → Integrations → ServiceNow
Fields: instance URL, username, password/OAuth client credentials
Test connection button
Field mapping: ResilienceOS Exercise fields ↔ ServiceNow Change fields
```

### Automated Workflows
- Exercise created → automatically create Change Request
- Exercise started → update Change Request state to "Implement"
- Exercise completed → update Change Request state to "Review", attach report
- Stage failure / rollback → create Incident linked to Change Request

---

## 8. Azure Site Recovery (ASR) Integration (Future)

### Purpose
Pull actual failover job status from ASR to auto-update corresponding task status in the exercise. This is the "holy grail" integration — eliminating the need for engineers to manually update task status when Azure performs the failover.

### Concept
```
ASR Job Starts (Primary → Secondary) 
  → Azure Event Grid publishes job event
  → ResilienceOS Event Grid webhook handler receives event
  → Match job type to corresponding task (e.g., "Azure Failover job" → task #43)
  → Auto-update task status to 'in_progress'
  → Store ASR job ID in task notes

ASR Job Completes
  → Same flow → auto-update task to 'completed'
  → Record actual end time from ASR completion timestamp
  
ASR Job Fails
  → auto-update task to 'failed'
  → Trigger rollback evaluation
```

### Authentication
Azure Managed Identity or Service Principal with Reader role on the ASR vault.

### Configuration (per exercise)
```
Task detail → ASR Integration → Map to ASR Job Type
Available job types: TestFailover, Failover, Failback, Commit, Reprotect
```

### Phase: This integration is Phase 5 / Enterprise add-on

---

## 9. Rubrik / Veeam Backup Integration (Future)

### Purpose
Track backup job status as part of DR exercise task validation. The Excel runbook showed backup validation tasks (e.g., "Confirm Azure Rubrik agent for DB backup").

### Concept
```
Task: "Validate Rubrik backup completed"
  → Connected to Rubrik job ID
  → Platform polls Rubrik API for job status
  → Auto-completes task when backup job succeeds
  → Task fails automatically if backup job fails within the expected window
```

---

## 10. Webhook Outbound (Developer API)

### Purpose
Enable enterprise customers to receive ResilienceOS events in their own systems.

### Configuration
```
Tenant Settings → Developer → Webhooks → Add Endpoint
URL: https://customer-system.example.com/rsos-events
Secret: (generated, for HMAC validation)
Events: (multi-select)
  ☑ exercise.started
  ☑ exercise.completed
  ☑ stage.completed
  ☑ stage.rollback_activated
  ☑ task.status_updated
  ☑ go_no_go.decision
  ☑ checkin.received
  ☑ incident.declared (Module 3)
```

### Delivery
- HTTP POST with JSON body and `X-RSOS-Signature: sha256={hmac}` header
- Retry 3 times with exponential backoff on non-2xx response
- Dead letter queue for permanently failed deliveries (admin visible)
- Delivery log available in settings UI

### Payload Envelope
```json
{
  "id": "evt_01J7...",
  "type": "task.status_updated",
  "tenant_id": "ten_...",
  "created_at": "2026-03-29T14:22:00.000Z",
  "data": {
    "exercise_id": "ex_...",
    "task_id": "tsk_...",
    "old_status": "not_started",
    "new_status": "in_progress",
    "updated_by": { "user_id": "usr_...", "name": "Jake Rog" }
  }
}
```
