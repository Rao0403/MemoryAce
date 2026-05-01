-- Run this script in MySQL as a user with CREATE privileges.
CREATE DATABASE IF NOT EXISTS brain_games
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE brain_games;

CREATE TABLE IF NOT EXISTS score_attempts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    player_name VARCHAR(64) NOT NULL,
    game VARCHAR(32) NOT NULL,
    score INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_score_attempts_player (player_name),
    INDEX idx_score_attempts_game (game),
    INDEX idx_score_attempts_created_at (created_at),
    INDEX idx_score_attempts_game_player (game, player_name)
) ENGINE=InnoDB;
