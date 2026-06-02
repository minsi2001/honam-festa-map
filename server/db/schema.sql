-- 사용법:
--   mysql -u root -p < server/db/schema.sql
-- 또는 npm run seed (node 스크립트가 schema.sql 실행 후 더미데이터 + admin 계정 주입)

CREATE DATABASE IF NOT EXISTS honam_festa
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE honam_festa;

DROP TABLE IF EXISTS photo_likes;
DROP TABLE IF EXISTS photos;
DROP TABLE IF EXISTS festival_requests;
DROP TABLE IF EXISTS festivals;
DROP TABLE IF EXISTS users;

-- 사용자 (role 추가: 'user' | 'admin')
CREATE TABLE users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  email           VARCHAR(150)  UNIQUE NOT NULL,
  password_hash   VARCHAR(255)  NOT NULL,
  nickname        VARCHAR(50)   NOT NULL,
  role            VARCHAR(20)   NOT NULL DEFAULT 'user',
  points          INT           DEFAULT 0,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 축제
CREATE TABLE festivals (
  id              VARCHAR(64)   PRIMARY KEY,
  name            VARCHAR(200)  NOT NULL,
  region          VARCHAR(50)   NOT NULL,
  region_code     VARCHAR(20),
  start_date      DATE,
  end_date        DATE,
  venue           VARCHAR(200),
  lat             DECIMAL(10,7),
  lng             DECIMAL(10,7),
  parking         TEXT,
  schedule_json   JSON,
  thumbnail       VARCHAR(500),
  official_url    VARCHAR(500),
  description     TEXT,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_region (region),
  INDEX idx_dates  (start_date, end_date)
) ENGINE=InnoDB;

-- 축제 추가 요청 (일반 사용자 → 관리자 승인 대기)
CREATE TABLE festival_requests (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  requester_id    INT           NOT NULL,
  name            VARCHAR(200)  NOT NULL,
  region          VARCHAR(50)   NOT NULL,
  start_date      DATE,
  end_date        DATE,
  venue           VARCHAR(200),
  lat             DECIMAL(10,7),
  lng             DECIMAL(10,7),
  parking         TEXT,
  schedule_json   JSON,
  thumbnail       VARCHAR(500),
  official_url    VARCHAR(500),
  description     TEXT,
  status          VARCHAR(20)   NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  reject_reason   VARCHAR(500),
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  reviewed_at     TIMESTAMP     NULL,
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE photos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  festival_id     VARCHAR(64)   NOT NULL,
  user_id         INT           NOT NULL,
  image_url       VARCHAR(500)  NOT NULL,
  caption         VARCHAR(300),
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  INDEX idx_festival (festival_id),
  INDEX idx_user     (user_id)
) ENGINE=InnoDB;

CREATE TABLE photo_likes (
  photo_id        INT           NOT NULL,
  user_id         INT           NOT NULL,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (photo_id, user_id),
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE
) ENGINE=InnoDB;
