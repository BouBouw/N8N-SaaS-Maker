-- Create database
CREATE DATABASE IF NOT EXISTS logicai_db;
USE logicai_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    discord_id VARCHAR(255) UNIQUE,
    avatar VARCHAR(500),
    email_verified BOOLEAN DEFAULT FALSE,
    role ENUM('user', 'support', 'admin') DEFAULT 'user' NOT NULL,
    reset_token VARCHAR(255),
    reset_token_expires DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_discord_id (discord_id),
    INDEX idx_role (role)
);

-- Sessions table (for express-session)
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    expires INT(11) UNSIGNED NOT NULL,
    data MEDIUMTEXT COLLATE utf8mb4_bin,
    PRIMARY KEY (session_id)
);

-- N8N Instances table
CREATE TABLE IF NOT EXISTS n8n_instances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    uuid VARCHAR(36) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(255) UNIQUE NOT NULL,
    container_id VARCHAR(255) UNIQUE,
    container_name VARCHAR(255) UNIQUE,
    docker_port INT,
    status ENUM('running', 'stopped', 'error', 'creating') DEFAULT 'creating',
    storage_limit INT DEFAULT 5, -- GB
    storage_used DECIMAL(10,2) DEFAULT 0, -- GB
    ram_limit INT DEFAULT 6, -- GB
    bandwidth_limit INT DEFAULT 2, -- TB
    bandwidth_used DECIMAL(10,2) DEFAULT 0, -- TB
    n8n_version VARCHAR(50) DEFAULT 'latest',
    environment_vars JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_uuid (uuid),
    INDEX idx_subdomain (subdomain),
    INDEX idx_status (status)
);

-- User subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    plan ENUM('free', 'pro', 'business') DEFAULT 'free',
    max_instances INT DEFAULT 1,
    storage_per_instance INT DEFAULT 5, -- GB
    ram_per_instance INT DEFAULT 6, -- GB
    bandwidth_per_instance INT DEFAULT 2, -- TB
    api_enabled BOOLEAN DEFAULT FALSE,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    subscription_status ENUM('active', 'canceled', 'past_due') DEFAULT 'active',
    current_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);

-- Activities table (for user activity tracking and notifications)
CREATE TABLE IF NOT EXISTS activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    instance_id INT,
    action ENUM('instance_created', 'instance_deleted', 'instance_started', 'instance_stopped', 'instance_restarted', 'instance_error', 'workflow_executed') NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (instance_id) REFERENCES n8n_instances(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_instance_id (instance_id),
    INDEX idx_created_at (created_at)
);

-- AI Chat Conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'Nouvelle conversation',
    model_type ENUM('workflow_generator', 'prompt_generator', 'general') DEFAULT 'general',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_updated_at (updated_at)
);

-- AI Chat Messages table
CREATE TABLE IF NOT EXISTS ai_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    role ENUM('user', 'assistant', 'system') NOT NULL,
    content TEXT NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_created_at (created_at)
);

-- AI Templates/Models library
CREATE TABLE IF NOT EXISTS ai_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category ENUM('workflow_generator', 'prompt_generator') NOT NULL,
    prompt_template TEXT NOT NULL,
    example_output TEXT,
    tags JSON,
    is_public BOOLEAN DEFAULT TRUE,
    created_by INT,
    usage_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_category (category),
    INDEX idx_is_public (is_public)
);

-- Instance Members table
CREATE TABLE IF NOT EXISTS instance_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instance_id INT NOT NULL,
    user_id INT,
    email VARCHAR(255) NOT NULL,
    role ENUM('admin', 'editor', 'viewer') DEFAULT 'viewer',
    status ENUM('pending', 'active', 'declined') DEFAULT 'pending',
    invitation_token VARCHAR(255) UNIQUE,
    invited_by INT NOT NULL,
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP NULL,
    FOREIGN KEY (instance_id) REFERENCES n8n_instances(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_instance_id (instance_id),
    INDEX idx_user_id (user_id),
    INDEX idx_email (email),
    INDEX idx_token (invitation_token),
    UNIQUE KEY unique_instance_email (instance_id, email)
);

-- Member notifications table
CREATE TABLE IF NOT EXISTS member_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('instance_invitation', 'member_added', 'member_removed', 'role_changed') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    metadata JSON,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS resources (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type ENUM('workflow', 'prompt') NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    content LONGTEXT NOT NULL,
    tags JSON DEFAULT NULL,
    price ENUM('free', 'paid') DEFAULT 'free',
    price_amount DECIMAL(10, 2) DEFAULT 0.00,
    downloads_count INT DEFAULT 0,
    views_count INT DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_type (type),
    INDEX idx_price (price),
    INDEX idx_user (user_id),
    INDEX idx_created (created_at),
    FULLTEXT INDEX idx_search (title, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for resource likes/favorites
CREATE TABLE IF NOT EXISTS resource_likes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    resource_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_like (resource_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create API keys table for N8N workflow execution
CREATE TABLE IF NOT EXISTS api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instance_id INT NOT NULL,
    api_key VARCHAR(255) NOT NULL UNIQUE,
    key_preview VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP NULL,
    request_count INT DEFAULT 0,
    FOREIGN KEY (instance_id) REFERENCES n8n_instances(id) ON DELETE CASCADE,
    INDEX idx_api_key (api_key),
    INDEX idx_instance_id (instance_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create API logs table for tracking usage
CREATE TABLE IF NOT EXISTS api_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    api_key_id INT NOT NULL,
    instance_id INT NOT NULL,
    workflow_id VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INT NOT NULL,
    response_time INT NOT NULL COMMENT 'in milliseconds',
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
    FOREIGN KEY (instance_id) REFERENCES n8n_instances(id) ON DELETE CASCADE,
    INDEX idx_api_key_id (api_key_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE users 
SET avatar = SUBSTRING_INDEX(SUBSTRING_INDEX(avatar, '/', -1), '.', 1)
WHERE avatar LIKE 'https://cdn.discordapp.com/avatars/%'
AND discord_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    stripe_customer_id VARCHAR(255) NOT NULL,
    stripe_subscription_id VARCHAR(255),
    plan_type ENUM('monthly', 'annual') NOT NULL,
    status ENUM('active', 'canceled', 'past_due', 'incomplete', 'trialing') DEFAULT 'active',
    current_period_start DATETIME,
    current_period_end DATETIME,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_stripe_subscription (stripe_subscription_id),
    INDEX idx_user_id (user_id),
    INDEX idx_stripe_customer_id (stripe_customer_id)
);

-- Create payments table for payment history
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subscription_id INT,
    stripe_payment_intent_id VARCHAR(255),
    stripe_invoice_id VARCHAR(255),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    status ENUM('succeeded', 'pending', 'failed', 'refunded') DEFAULT 'pending',
    description TEXT,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_subscription_id (subscription_id),
    INDEX idx_payment_date (payment_date)
);

-- Add subscription_plan column to users table if not exists
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS subscription_plan ENUM('free', 'monthly', 'annual') DEFAULT 'free',
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_stripe_customer_id (stripe_customer_id);

ALTER TABLE activities 
MODIFY COLUMN action ENUM(
    'instance_created', 
    'instance_deleted', 
    'instance_started', 
    'instance_stopped', 
    'instance_restarted', 
    'instance_error',
    'workflow_executed'
) NOT NULL;

ALTER TABLE users ADD COLUMN has_completed_onboarding BOOLEAN DEFAULT FALSE AFTER discord_username;

ALTER TABLE users 
ADD COLUMN role ENUM('user', 'support', 'admin') DEFAULT 'user' NOT NULL AFTER email_verified,
ADD INDEX idx_role (role);