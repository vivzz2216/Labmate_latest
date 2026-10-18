-- PostgreSQL; additive and safe to reapply. Back up the database before rollout.
-- SQLAlchemy create_all also provisions these tables on a fresh installation.
BEGIN;
CREATE TABLE IF NOT EXISTS credit_wallets (
    user_id INTEGER REFERENCES users(id) NOT NULL,
    mode VARCHAR(8) NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0,
    reserved INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, mode)
);
CREATE TABLE IF NOT EXISTS pack_purchases (
    id VARCHAR(36) PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    mode VARCHAR(8) NOT NULL,
    request_key VARCHAR(36) NOT NULL,
    pack_id VARCHAR(32) NOT NULL,
    amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    credits INTEGER NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'creating',
    gateway_order_id VARCHAR(64) UNIQUE,
    gateway_payment_id VARCHAR(64) UNIQUE,
    key_id VARCHAR(64) NOT NULL,
    fulfilled_at TIMESTAMP WITH TIME ZONE,
    refunded_amount INTEGER NOT NULL DEFAULT 0,
    reversed_credits INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_pack_request UNIQUE (user_id, mode, request_key)
);
CREATE INDEX IF NOT EXISTS ix_pack_purchases_user_id ON pack_purchases(user_id);
CREATE TABLE IF NOT EXISTS credit_ledger (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    mode VARCHAR(8) NOT NULL,
    reference VARCHAR(130) UNIQUE NOT NULL,
    kind VARCHAR(24) NOT NULL,
    delta INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_credit_ledger_user_id ON credit_ledger(user_id);
CREATE TABLE IF NOT EXISTS workflow_credit_holds (
    workflow_id INTEGER REFERENCES assignment_workflows(id) PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    mode VARCHAR(8) NOT NULL,
    run_token VARCHAR(36) NOT NULL,
    amount INTEGER NOT NULL,
    baseline_ids JSON NOT NULL DEFAULT '[]',
    state VARCHAR(16) NOT NULL DEFAULT 'held'
);
CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id VARCHAR(130) PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMIT;
