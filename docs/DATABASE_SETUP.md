# SHAMBA LUV - Database Setup Guide

This guide will walk you through setting up PostgreSQL, configuring the environment, running database migrations, and starting both the frontend and backend servers.

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager
- Git

## 1. PostgreSQL Installation

### macOS (using Homebrew)
```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Create a database user (if needed)
createuser -s postgres
```

### macOS (using PostgreSQL.app)
1. Download PostgreSQL.app from https://postgresapp.com/
2. Install and start the application
3. Add PostgreSQL to your PATH by adding this to your `~/.bash_profile` or `~/.zshrc`:
   ```bash
   export PATH=$PATH:/Applications/Postgres.app/Contents/Versions/latest/bin
   ```

### Windows
1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Run the installer and follow the setup wizard
3. Remember the password you set for the postgres user
4. Add PostgreSQL to your system PATH

### Ubuntu/Debian
```bash
# Update package index
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Switch to postgres user and create database
sudo -u postgres psql
```

## 2. Database Creation

### Connect to PostgreSQL
```bash
# Connect as postgres user
psql -U postgres

# Or if you're on macOS with PostgreSQL.app
psql postgres
```

### Create the Database
```sql
-- Create the database
CREATE DATABASE shamba_luv_db;

-- Create a user (optional, you can use postgres user)
CREATE USER shamba_user WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE shamba_luv_db TO shamba_user;

-- Connect to the database
\c shamba_luv_db

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO shamba_user;

-- Exit psql
\q
```

## 3. Environment Configuration

### Backend Environment Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Copy and configure the environment file:
   ```bash
   cp .env.example .env  # If .env.example exists, or create .env manually
   ```

3. Edit the `.env` file with your database credentials:
   ```env
   # Database Configuration
   DATABASE_URL=postgresql://postgres:your_password@localhost:5432/shamba_luv_db
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=shamba_luv_db
   DB_USER=postgres
   DB_PASSWORD=your_password

   # Server Configuration
   NODE_ENV=development
   PORT=3001
   API_BASE_URL=http://localhost:3001

   # Security
   JWT_SECRET=shamba_luv_jwt_secret_key_2024_very_secure
   API_KEY=shamba_luv_api_key_for_frontend_auth_2024
   IP_SALT=shamba_luv_ip_salt_for_hashing_2024

   # IP Geolocation Service (optional)
   # IP_GEOLOCATION_API_KEY=your_ipgeolocation_api_key
   # IP_API_URL=https://api.ipgeolocation.io/ipgeo

   # VPN/Proxy Detection Service (optional)
   # VPN_DETECTION_API_KEY=your_vpn_detection_api_key
   # VPN_API_URL=https://vpnapi.io/api

   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100

   # Logging
   LOG_LEVEL=info
   LOG_FILE_PATH=./logs/app.log

   # CORS
   ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend-domain.com

   # Protection Rules
   DEFAULT_MAX_CLAIMS_PER_IP=2
   DEFAULT_MAX_CLAIMS_PER_DEVICE=2
   DEFAULT_MIN_TIME_BETWEEN_CLAIMS=3600
   DEFAULT_VPN_RISK_THRESHOLD=70
   ```

   **Important**: Replace `your_password` with your actual PostgreSQL password.

## 4. Install Dependencies

### Backend Dependencies
```bash
# From the backend directory
cd backend
npm install
```

### Frontend Dependencies
```bash
# From the root project directory
cd ..
npm install
```

## 5. Database Migration

The backend includes several migration scripts to set up your database schema.

### Available Migration Commands

From the `backend` directory, you can run:

```bash
# Run all pending migrations
npm run db:migrate

# Check migration status
npm run db:migrate:status

# Rollback the last migration
npm run db:migrate:rollback

# Seed the database with initial data
npm run db:seed
```

### Migration Files

The following migrations will be applied:

1. **001_create_tables.sql** - Creates all core tables (users, ip_addresses, airdrop_claims, etc.)
2. **002_create_indexes.sql** - Creates database indexes for performance
3. **003_create_functions.sql** - Creates stored procedures and functions
4. **004_insert_default_data.sql** - Inserts default configuration data
5. **005_fix_country_code_length.sql** - Fixes country code column length

### Run the Migration

```bash
# Make sure you're in the backend directory
cd backend

# Run the migration
npm run db:migrate
```

You should see output like:
```
✅ Running migration: 001_create_tables.sql
✅ Running migration: 002_create_indexes.sql
✅ Running migration: 003_create_functions.sql
✅ Running migration: 004_insert_default_data.sql
✅ Running migration: 005_fix_country_code_length.sql
✅ All migrations completed successfully
```

## 6. Verify Database Setup

Connect to your database and verify the tables were created:

```bash
psql -U postgres -d shamba_luv_db
```

```sql
-- List all tables
\dt

-- Check users table structure
\d users

-- Check if any data exists
SELECT COUNT(*) FROM users;

-- Exit
\q
```

## 7. Start the Servers

### Start the Backend Server

```bash
# From the backend directory
cd backend

# Development mode (auto-restart on changes)
npm run dev

# Or production mode
npm start
```

The backend will start on `http://localhost:3001`

You should see:
```
2025-07-25 00:00:00 [info]: ✅ Database connected successfully
2025-07-25 00:00:00 [info]: 🚀 Server is running on port 3001
2025-07-25 00:00:00 [info]: 🌍 Environment: development
```

### Start the Frontend Server

```bash
# From the root project directory
cd ..

# Start the development server
npm run dev
```

The frontend will start on `http://localhost:5173`

## 8. Test the Setup

1. **Backend Health Check**: Visit `http://localhost:3001/api/v1/health` in your browser
2. **Frontend**: Visit `http://localhost:5173` in your browser
3. **Database Connection**: The frontend should show "Backend Connected" if everything is working

## 9. Troubleshooting

### Common Issues

#### Database Connection Failed
- Check if PostgreSQL is running: `brew services list` (macOS) or `sudo systemctl status postgresql` (Linux)
- Verify your database credentials in the `.env` file
- Make sure the database `shamba_luv_db` exists

#### Migration Errors
- Check if you have the correct permissions on the database
- Verify the `.env` file has the correct database configuration
- Make sure PostgreSQL is running before running migrations

#### Port Already in Use
- Backend (3001): Kill any existing Node.js processes: `pkill -f "node"`
- Frontend (5173): Change the port in `vite.config.js` or kill existing Vite processes

#### Permission Denied
```bash
# Grant permissions to your user
sudo -u postgres psql
GRANT ALL PRIVILEGES ON DATABASE shamba_luv_db TO your_username;
GRANT ALL ON SCHEMA public TO your_username;
```

### Logs

Check the backend logs for detailed error information:
```bash
# View real-time logs
tail -f backend/logs/combined.log

# View error logs
tail -f backend/logs/error.log
```

## 10. Development Workflow

### Making Database Changes

1. Create a new migration file in `backend/migrations/` following the naming convention: `00X_description.sql`
2. Write your SQL changes
3. Run the migration: `npm run db:migrate`

### Backend Development

- The backend automatically restarts when you make changes (using nodemon)
- Check logs for any errors
- API endpoints are available at `http://localhost:3001/api/v1/`

### Frontend Development

- The frontend automatically reloads when you make changes
- Backend connection status is shown in the UI
- User registration and wallet tracking should work automatically

## Next Steps

Once everything is running:

1. Connect a wallet to test user registration
2. Check the database to see user data being tracked
3. Test the airdrop functionality
4. Review the API endpoints in the backend code

Your SHAMBA LUV application should now be fully functional with complete database tracking and protection features!