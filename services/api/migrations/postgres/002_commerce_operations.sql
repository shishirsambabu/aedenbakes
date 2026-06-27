BEGIN;

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  unit text NOT NULL,
  pack_size numeric(12,3) NOT NULL CHECK (pack_size > 0),
  minimum_order_quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK (minimum_order_quantity > 0),
  gst_rate numeric(5,2) NOT NULL CHECK (gst_rate >= 0),
  status text NOT NULL CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  published boolean NOT NULL DEFAULT false,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sku)
);

CREATE TABLE branch_product_terms (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES customer_branches(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit_price numeric(14,2) NOT NULL CHECK (unit_price >= 0),
  available boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  PRIMARY KEY (branch_id, product_id, effective_from),
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE TABLE delivery_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  service_zone text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  maximum_orders integer NOT NULL CHECK (maximum_orders > 0),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, code)
);

CREATE TABLE product_day_capacity (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  service_date date NOT NULL,
  capacity numeric(12,3) NOT NULL CHECK (capacity >= 0),
  reserved numeric(12,3) NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, product_id, service_date),
  CHECK (reserved <= capacity)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL REFERENCES customer_branches(id) ON DELETE RESTRICT,
  slot_id uuid NOT NULL REFERENCES delivery_slots(id) ON DELETE RESTRICT,
  order_number text NOT NULL,
  service_date date NOT NULL,
  state text NOT NULL CHECK (
    state IN ('draft', 'pending_approval', 'submitted', 'confirmed', 'rejected', 'in_production', 'packed', 'dispatched', 'partially_delivered', 'delivered', 'failed_delivery', 'cancelled')
  ),
  payment_mode text NOT NULL CHECK (payment_mode IN ('prepaid', 'part_pay', 'credit')),
  purchase_order_number text,
  subtotal numeric(14,2) NOT NULL CHECK (subtotal >= 0),
  tax_total numeric(14,2) NOT NULL CHECK (tax_total >= 0),
  grand_total numeric(14,2) NOT NULL CHECK (grand_total >= 0),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  submitted_by uuid REFERENCES customer_users(id),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, order_number)
);

CREATE INDEX orders_branch_date_idx ON orders (tenant_id, branch_id, service_date, state);

CREATE TABLE order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(14,2) NOT NULL CHECK (unit_price >= 0),
  tax_rate numeric(5,2) NOT NULL CHECK (tax_rate >= 0),
  line_total numeric(14,2) NOT NULL CHECK (line_total >= 0),
  fulfilment_state text NOT NULL DEFAULT 'pending',
  substitution_consent text NOT NULL DEFAULT 'ask' CHECK (substitution_consent IN ('allow', 'ask', 'reject'))
);

CREATE TABLE order_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  required_approver_id uuid REFERENCES customer_users(id),
  state text NOT NULL CHECK (state IN ('pending', 'approved', 'rejected', 'expired')),
  reason text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customer_accounts(id) ON DELETE CASCADE,
  application_id uuid REFERENCES customer_applications(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending_upload', 'uploaded', 'under_review', 'verified', 'rejected', 'archived')),
  object_key text NOT NULL,
  original_file_name text NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  checksum_sha256 text NOT NULL,
  rejection_reason text,
  verified_by uuid REFERENCES staff_users(id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (customer_id IS NOT NULL OR application_id IS NOT NULL)
);

CREATE INDEX documents_customer_idx ON documents (tenant_id, customer_id, document_type, state);

CREATE TABLE production_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_number text NOT NULL,
  service_date date NOT NULL,
  state text NOT NULL CHECK (state IN ('draft', 'locked', 'in_progress', 'quality_hold', 'completed', 'cancelled')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  locked_by uuid REFERENCES staff_users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, batch_number)
);

CREATE TABLE production_batch_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  planned_quantity numeric(12,3) NOT NULL CHECK (planned_quantity >= 0),
  actual_quantity numeric(12,3) CHECK (actual_quantity >= 0),
  rejected_quantity numeric(12,3) NOT NULL DEFAULT 0 CHECK (rejected_quantity >= 0),
  state text NOT NULL CHECK (state IN ('pending', 'in_progress', 'quality_hold', 'completed', 'cancelled'))
);

CREATE TABLE delivery_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_date date NOT NULL,
  route_code text NOT NULL,
  state text NOT NULL CHECK (state IN ('draft', 'locked', 'dispatched', 'completed', 'cancelled')),
  driver_id uuid REFERENCES staff_users(id),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  dispatched_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, service_date, route_code)
);

CREATE TABLE delivery_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id uuid NOT NULL REFERENCES delivery_manifests(id) ON DELETE CASCADE,
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  stop_number integer NOT NULL CHECK (stop_number > 0),
  state text NOT NULL CHECK (state IN ('pending', 'arrived', 'completed', 'failed', 'partial', 'returned')),
  proof_state text NOT NULL DEFAULT 'pending' CHECK (proof_state IN ('pending', 'captured', 'verified', 'rejected')),
  UNIQUE (manifest_id, stop_number)
);

CREATE TABLE delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stop_id uuid NOT NULL REFERENCES delivery_stops(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  event_type text NOT NULL,
  payload_json jsonb NOT NULL,
  captured_at timestamptz NOT NULL,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, stop_id, idempotency_key)
);

COMMIT;
