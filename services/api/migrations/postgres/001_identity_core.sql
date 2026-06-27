BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'suspended', 'closed')),
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('platform', 'tenant', 'customer')),
  UNIQUE (tenant_id, code)
);

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NOT NULL
);

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE staff_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  username text NOT NULL,
  display_name text NOT NULL,
  phone text,
  email text,
  password_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('invited', 'active', 'locked', 'disabled')),
  failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, username)
);

CREATE TABLE staff_user_roles (
  staff_user_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_user_id, role_id)
);

CREATE TABLE customer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone text NOT NULL,
  business_name text,
  gstin text,
  state text NOT NULL CHECK (
    state IN ('draft', 'otp_verified', 'submitted', 'under_review', 'needs_information', 'approved', 'rejected', 'activated')
  ),
  requested_credit_limit numeric(14,2) CHECK (requested_credit_limit >= 0),
  requested_credit_days integer CHECK (requested_credit_days >= 0),
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid REFERENCES staff_users(id),
  decision_reason text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone, state)
);

CREATE UNIQUE INDEX customer_applications_active_phone_idx
  ON customer_applications (tenant_id, phone)
  WHERE state NOT IN ('rejected', 'activated');

CREATE TABLE customer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id uuid UNIQUE REFERENCES customer_applications(id),
  customer_code text NOT NULL,
  legal_name text NOT NULL,
  trade_name text,
  gstin text,
  status text NOT NULL CHECK (status IN ('pending', 'active', 'on_hold', 'suspended', 'closed')),
  tier text,
  credit_limit numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  credit_days integer NOT NULL DEFAULT 0 CHECK (credit_days >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, customer_code),
  UNIQUE (tenant_id, gstin)
);

CREATE TABLE customer_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  branch_code text NOT NULL,
  name text NOT NULL,
  state text NOT NULL CHECK (state IN ('draft', 'pending_approval', 'active', 'suspended', 'rejected', 'closed')),
  address_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  service_zone text,
  receiving_instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, branch_code)
);

CREATE INDEX customer_branches_customer_idx ON customer_branches (tenant_id, customer_id, state);

CREATE TABLE customer_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  login_id text NOT NULL,
  display_name text NOT NULL,
  phone text,
  email text,
  password_hash text,
  role_code text NOT NULL CHECK (role_code IN ('account_admin', 'buyer', 'requester', 'approver', 'finance', 'receiver', 'viewer')),
  status text NOT NULL CHECK (status IN ('invited', 'active', 'locked', 'disabled')),
  approval_limit numeric(14,2) CHECK (approval_limit >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, login_id)
);

CREATE TABLE customer_user_branches (
  customer_user_id uuid NOT NULL REFERENCES customer_users(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES customer_branches(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_user_id, branch_id)
);

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  principal_type text NOT NULL CHECK (principal_type IN ('staff', 'customer')),
  principal_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  device_id text,
  ip_address inet,
  user_agent text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_sessions_principal_idx ON auth_sessions (tenant_id, principal_type, principal_id, expires_at);

CREATE TABLE otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  identifier_hash text NOT NULL,
  provider text NOT NULL,
  provider_request_id text,
  purpose text NOT NULL,
  status text NOT NULL CHECK (status IN ('requested', 'sent', 'verified', 'expired', 'failed', 'blocked')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX otp_challenges_identifier_idx ON otp_challenges (identifier_hash, created_at DESC);

CREATE TABLE idempotency_keys (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  principal_id uuid NOT NULL,
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_status integer,
  response_json jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, principal_id, operation, idempotency_key)
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  actor_type text NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  reason text,
  before_json jsonb,
  after_json jsonb,
  request_id text,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_target_idx ON audit_events (tenant_id, target_type, target_id, created_at DESC);

COMMIT;
