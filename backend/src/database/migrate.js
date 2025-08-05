const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Ensure .env is loaded
const { query, connectDB } = require('./connection');
const logger = require('../utils/logger');

async function runMigrations() {
  try {
    // Connect to database
    await connectDB();
    logger.info('Connected to database for migrations');

    // Get all migration files in order
    const migrationsDir = path.join(__dirname, '../../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensures proper order: 001_, 002_, etc.

    logger.info(`Found ${migrationFiles.length} migration files`);

    // Create migrations tracking table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS migration_history (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Get already executed migrations
    const executedMigrations = await query('SELECT filename FROM migration_history');
    const executedSet = new Set(executedMigrations.rows.map(row => row.filename));

    // Execute each migration file
    for (const filename of migrationFiles) {
      if (executedSet.has(filename)) {
        logger.info(`⏭️  Skipping already executed migration: ${filename}`);
        continue;
      }

      logger.info(`🚀 Executing migration: ${filename}`);
      
      const migrationPath = path.join(migrationsDir, filename);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      try {
        // Execute the migration
        await query(migrationSQL);
        
        // Record successful execution
        await query(
          'INSERT INTO migration_history (filename) VALUES ($1)',
          [filename]
        );
        
        logger.info(`✅ Successfully executed: ${filename}`);
      } catch (error) {
        logger.error(`❌ Failed to execute migration ${filename}:`, error.message);
        throw error;
      }
    }

    logger.info('🎉 All migrations completed successfully!');

    // Verify tables were created
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name NOT LIKE 'pg_%'
      AND table_name != 'information_schema'
      ORDER BY table_name
    `);

    logger.info('📋 Database tables:');
    tables.rows.forEach(row => {
      logger.info(`  - ${row.table_name}`);
    });

    // Show protection rules
    const rules = await query('SELECT rule_name, rule_value, is_active FROM protection_rules ORDER BY rule_name');
    logger.info('🛡️  Protection rules configured:');
    rules.rows.forEach(rule => {
      logger.info(`  - ${rule.rule_name}: ${rule.rule_value} (${rule.is_active ? 'active' : 'inactive'})`);
    });

    process.exit(0);

  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Function to rollback migrations (for development)
async function rollbackMigrations(steps = 1) {
  try {
    await connectDB();
    logger.info(`Rolling back ${steps} migration(s)`);

    // Get last executed migrations
    const lastMigrations = await query(`
      SELECT filename FROM migration_history 
      ORDER BY executed_at DESC 
      LIMIT $1
    `, [steps]);

    for (const migration of lastMigrations.rows) {
      logger.info(`🔄 Rolling back: ${migration.filename}`);
      
      // Remove from history (actual rollback would need specific rollback SQL)
      await query('DELETE FROM migration_history WHERE filename = $1', [migration.filename]);
      
      logger.info(`✅ Rolled back: ${migration.filename}`);
    }

    logger.info('🎉 Rollback completed!');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Rollback failed:', error);
    process.exit(1);
  }
}

// Check migration status
async function checkMigrationStatus() {
  try {
    await connectDB();
    
    const migrationsDir = path.join(__dirname, '../../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Check if migration_history table exists
    const tableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'migration_history'
      )
    `);

    if (!tableExists.rows[0].exists) {
      logger.info('🆕 No migrations have been run yet');
      return;
    }

    const executedMigrations = await query('SELECT filename, executed_at FROM migration_history ORDER BY executed_at');
    const executedSet = new Set(executedMigrations.rows.map(row => row.filename));

    logger.info('📊 Migration Status:');
    logger.info('==================');

    migrationFiles.forEach(filename => {
      if (executedSet.has(filename)) {
        const execution = executedMigrations.rows.find(row => row.filename === filename);
        logger.info(`✅ ${filename} - executed at ${execution.executed_at}`);
      } else {
        logger.info(`⏳ ${filename} - pending`);
      }
    });

    const pendingCount = migrationFiles.length - executedMigrations.rows.length;
    logger.info('==================');
    logger.info(`Total: ${migrationFiles.length} migrations, ${executedMigrations.rows.length} executed, ${pendingCount} pending`);

    process.exit(0);

  } catch (error) {
    logger.error('❌ Failed to check migration status:', error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'rollback':
      const steps = parseInt(process.argv[3]) || 1;
      rollbackMigrations(steps);
      break;
    case 'status':
      checkMigrationStatus();
      break;
    default:
      runMigrations();
      break;
  }
}

module.exports = { 
  runMigrations, 
  rollbackMigrations, 
  checkMigrationStatus 
};