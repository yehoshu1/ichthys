-- Make verification message columns nullable so notification messages can be optional
ALTER TABLE verification_message_rule ALTER COLUMN message DROP NOT NULL;
ALTER TABLE verification_role_message ALTER COLUMN message DROP NOT NULL;

-- No data migration required; empty messages can be represented as NULL
