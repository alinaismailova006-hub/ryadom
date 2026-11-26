CREATE TABLE IF NOT EXISTS accounts (
  id CHAR(36) PRIMARY KEY,
  login VARCHAR(32) NOT NULL UNIQUE,
  salt CHAR(32) NOT NULL,
  password_hash CHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS pairs (
  id CHAR(36) PRIMARY KEY,
  code CHAR(10) NOT NULL UNIQUE,
  owner VARCHAR(128) NOT NULL,
  partner VARCHAR(128),
  created_at BIGINT NOT NULL,
  INDEX (owner),
  INDEX (partner)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS profiles (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  pair_id CHAR(36),
  INDEX (pair_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS answers (
  pair_id CHAR(36) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  question VARCHAR(40) NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (pair_id, user_id, question)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS completed (
  pair_id CHAR(36) NOT NULL,
  task VARCHAR(40) NOT NULL,
  at BIGINT NOT NULL,
  PRIMARY KEY (pair_id, task)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS pair_details (
  pair_id CHAR(36) PRIMARY KEY,
  start_date DATE,
  photo MEDIUMTEXT CHARACTER SET ascii,
  photo_version CHAR(36)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS milestones (
  id CHAR(36) PRIMARY KEY,
  pair_id CHAR(36) NOT NULL,
  title VARCHAR(80) NOT NULL,
  date DATE NOT NULL,
  INDEX (pair_id, date, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at BIGINT NOT NULL,
  INDEX (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS auth_limits (
  network_key CHAR(64) NOT NULL,
  time_window BIGINT NOT NULL,
  attempts INT UNSIGNED NOT NULL,
  PRIMARY KEY (network_key, time_window),
  INDEX (time_window)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
