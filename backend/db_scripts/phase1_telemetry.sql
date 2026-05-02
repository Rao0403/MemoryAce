-- Apply this script if your DB already exists and you need Phase 1 telemetry tables.
USE brain_games;

CREATE TABLE IF NOT EXISTS game_runs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    player_name VARCHAR(64) NULL,
    game VARCHAR(32) NOT NULL,
    run_status VARCHAR(16) NOT NULL DEFAULT 'active',
    end_reason VARCHAR(32) NULL,
    final_score INT NULL,
    final_lives INT NULL,
    total_trials INT NULL,
    event_count INT NOT NULL DEFAULT 0,
    event_schema_version INT NOT NULL DEFAULT 1,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME NULL,
    PRIMARY KEY (id),
    INDEX idx_game_runs_player (player_name),
    INDEX idx_game_runs_game (game),
    INDEX idx_game_runs_status (run_status),
    INDEX idx_game_runs_started (started_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trial_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    run_id BIGINT UNSIGNED NOT NULL,
    player_name VARCHAR(64) NULL,
    game VARCHAR(32) NOT NULL,
    trial_index INT NOT NULL,
    occurred_at DATETIME(3) NULL,
    event_name VARCHAR(64) NOT NULL DEFAULT 'trial_resolved',
    difficulty_level INT NOT NULL DEFAULT 0,
    reaction_ms INT NULL,
    correct TINYINT(1) NOT NULL,
    score_before INT NOT NULL,
    score_after INT NOT NULL,
    lives_before INT NULL,
    lives_after INT NULL,
    event_payload JSON NULL,
    event_schema_version INT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_trial_events_run_trial (run_id, trial_index),
    INDEX idx_trial_events_run (run_id),
    INDEX idx_trial_events_game_player (game, player_name),
    INDEX idx_trial_events_created (created_at),
    CONSTRAINT fk_trial_events_run
        FOREIGN KEY (run_id) REFERENCES game_runs(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;
