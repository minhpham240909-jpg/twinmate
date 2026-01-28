#!/bin/bash
#
# Database Migration Script with Rollback Support
# For production deployments with safety checks
#
# Usage:
#   ./scripts/db-migrate.sh migrate    # Run pending migrations
#   ./scripts/db-migrate.sh status     # Check migration status
#   ./scripts/db-migrate.sh rollback   # Rollback last migration (requires confirmation)
#   ./scripts/db-migrate.sh backup     # Create backup before migration
#   ./scripts/db-migrate.sh verify     # Verify database connectivity
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure we're in the project root
cd "$PROJECT_ROOT"

# Check if required environment variables are set
check_env() {
    if [ -z "$DATABASE_URL" ]; then
        echo -e "${RED}ERROR: DATABASE_URL environment variable is not set${NC}"
        echo "Please set DATABASE_URL in your environment or .env file"
        exit 1
    fi
}

# Verify database connectivity
verify_connection() {
    echo -e "${BLUE}Verifying database connection...${NC}"

    if npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Database connection successful${NC}"
        return 0
    else
        echo -e "${RED}✗ Database connection failed${NC}"
        return 1
    fi
}

# Get current migration status
get_status() {
    echo -e "${BLUE}Checking migration status...${NC}"
    npx prisma migrate status
}

# Create a backup before migration
create_backup() {
    echo -e "${BLUE}Creating database backup...${NC}"

    mkdir -p "$BACKUP_DIR"

    # Extract database URL components
    # Note: This assumes PostgreSQL
    local backup_file="$BACKUP_DIR/backup_$TIMESTAMP.sql"

    echo -e "${YELLOW}Backup location: $backup_file${NC}"

    # Use pg_dump if available
    if command -v pg_dump &> /dev/null; then
        if pg_dump "$DATABASE_URL" > "$backup_file" 2>/dev/null; then
            echo -e "${GREEN}✓ Backup created successfully${NC}"
            # Compress the backup
            gzip "$backup_file"
            echo -e "${GREEN}✓ Backup compressed: ${backup_file}.gz${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠ pg_dump failed, falling back to Prisma export${NC}"
        fi
    fi

    # Fallback: Export schema only (not full data backup)
    echo -e "${YELLOW}Note: Full backup requires pg_dump. Exporting schema only...${NC}"
    npx prisma db pull --print > "$backup_file" 2>/dev/null || true

    echo -e "${GREEN}✓ Schema backup created${NC}"
}

# Run migrations
run_migrate() {
    echo -e "${BLUE}Running database migrations...${NC}"

    # Check for pending migrations
    local status_output=$(npx prisma migrate status 2>&1)

    if echo "$status_output" | grep -q "No pending migrations"; then
        echo -e "${GREEN}✓ No pending migrations to apply${NC}"
        return 0
    fi

    # Prompt for confirmation in production
    if [ "$NODE_ENV" = "production" ]; then
        echo -e "${YELLOW}⚠ WARNING: You are about to apply migrations to PRODUCTION${NC}"
        read -p "Are you sure you want to continue? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            echo "Migration cancelled"
            exit 0
        fi

        # Create backup before production migration
        create_backup
    fi

    # Run the migration
    if npx prisma migrate deploy; then
        echo -e "${GREEN}✓ Migrations applied successfully${NC}"

        # Generate Prisma client
        npx prisma generate
        echo -e "${GREEN}✓ Prisma client regenerated${NC}"
    else
        echo -e "${RED}✗ Migration failed${NC}"
        echo -e "${YELLOW}Tip: Check the migration files and database logs${NC}"
        exit 1
    fi
}

# Rollback last migration (manual process for Prisma)
run_rollback() {
    echo -e "${YELLOW}⚠ WARNING: Prisma does not support automatic rollbacks${NC}"
    echo ""
    echo "To rollback a migration manually:"
    echo ""
    echo "1. Identify the migration to rollback:"
    echo "   npx prisma migrate status"
    echo ""
    echo "2. Create a new migration that reverses the changes:"
    echo "   npx prisma migrate dev --name rollback_<migration_name>"
    echo ""
    echo "3. Or restore from backup (if available):"
    if [ -d "$BACKUP_DIR" ]; then
        echo "   Available backups:"
        ls -la "$BACKUP_DIR" 2>/dev/null || echo "   No backups found"
    else
        echo "   No backup directory found"
    fi
    echo ""
    echo "4. To restore a PostgreSQL backup:"
    echo "   gunzip < backup_file.sql.gz | psql \$DATABASE_URL"
    echo ""

    # Offer to mark migration as rolled back
    read -p "Do you want to mark the last migration as rolled back in _prisma_migrations? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        echo -e "${YELLOW}This will NOT undo the actual database changes.${NC}"
        echo -e "${YELLOW}You must manually revert the database schema.${NC}"
        read -p "Confirm marking as rolled back (type 'ROLLBACK' to confirm): " final_confirm
        if [ "$final_confirm" = "ROLLBACK" ]; then
            # Get the last migration name
            local last_migration=$(npx prisma migrate status 2>&1 | grep -o '[0-9]*_[a-z_]*' | tail -1)
            if [ -n "$last_migration" ]; then
                echo "Marking migration '$last_migration' as rolled back..."
                npx prisma db execute --stdin <<< "DELETE FROM _prisma_migrations WHERE migration_name LIKE '%$last_migration%';"
                echo -e "${GREEN}✓ Migration marked as rolled back${NC}"
            else
                echo -e "${RED}Could not identify last migration${NC}"
            fi
        fi
    fi
}

# Main command handler
case "$1" in
    migrate)
        check_env
        verify_connection
        run_migrate
        ;;
    status)
        check_env
        get_status
        ;;
    rollback)
        check_env
        verify_connection
        run_rollback
        ;;
    backup)
        check_env
        verify_connection
        create_backup
        ;;
    verify)
        check_env
        verify_connection
        ;;
    *)
        echo "Database Migration Tool"
        echo ""
        echo "Usage: $0 {migrate|status|rollback|backup|verify}"
        echo ""
        echo "Commands:"
        echo "  migrate   - Run pending database migrations"
        echo "  status    - Check current migration status"
        echo "  rollback  - Guide for rolling back migrations"
        echo "  backup    - Create a database backup"
        echo "  verify    - Verify database connectivity"
        echo ""
        exit 1
        ;;
esac
