#!/bin/bash
# Setup script for Google Cloud Scheduler cleanup cron job
# Usage: ./scripts/setup-cleanup-cron.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Setting up Cleanup Cron Job${NC}\n"

# Check if required variables are set
if [ -z "$CLEANUP_API_KEY" ]; then
    echo -e "${RED}❌ Error: CLEANUP_API_KEY environment variable is not set${NC}"
    echo -e "${YELLOW}Generate one with: openssl rand -hex 32${NC}"
    exit 1
fi

if [ -z "$APP_URL" ]; then
    echo -e "${YELLOW}⚠️  APP_URL not set, please provide your app URL:${NC}"
    read -p "Enter your app URL (e.g., https://your-app.com): " APP_URL
fi

if [ -z "$TIMEZONE" ]; then
    TIMEZONE="America/Los_Angeles"
    echo -e "${YELLOW}⚠️  TIMEZONE not set, using default: ${TIMEZONE}${NC}"
fi

if [ -z "$SCHEDULE" ]; then
    SCHEDULE="0 2 * * *"
    echo -e "${YELLOW}⚠️  SCHEDULE not set, using default: ${SCHEDULE} (Daily at 2 AM)${NC}"
fi

JOB_NAME="cleanup-history-job"
ENDPOINT_URL="${APP_URL}/api/history/cleanup"

echo -e "\n${GREEN}Configuration:${NC}"
echo "  Job Name: ${JOB_NAME}"
echo "  Endpoint: ${ENDPOINT_URL}"
echo "  Schedule: ${SCHEDULE}"
echo "  Timezone: ${TIMEZONE}"
echo ""

# Check if job already exists
if gcloud scheduler jobs describe ${JOB_NAME} &>/dev/null; then
    echo -e "${YELLOW}⚠️  Job ${JOB_NAME} already exists${NC}"
    read -p "Do you want to update it? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}Updating existing job...${NC}"
        gcloud scheduler jobs update http ${JOB_NAME} \
            --uri="${ENDPOINT_URL}" \
            --http-method=POST \
            --headers="Authorization=Bearer ${CLEANUP_API_KEY}" \
            --schedule="${SCHEDULE}" \
            --time-zone="${TIMEZONE}" \
            --description="Daily cleanup of deleted items older than 30 days"
        
        echo -e "\n${GREEN}✅ Job updated successfully!${NC}"
    else
        echo -e "${YELLOW}Cancelled.${NC}"
        exit 0
    fi
else
    echo -e "${GREEN}Creating new job...${NC}"
    gcloud scheduler jobs create http ${JOB_NAME} \
        --uri="${ENDPOINT_URL}" \
        --http-method=POST \
        --headers="Authorization=Bearer ${CLEANUP_API_KEY}" \
        --schedule="${SCHEDULE}" \
        --time-zone="${TIMEZONE}" \
        --description="Daily cleanup of deleted items older than 30 days"
    
    echo -e "\n${GREEN}✅ Job created successfully!${NC}"
fi

echo -e "\n${GREEN}📋 Next steps:${NC}"
echo "  1. Test the job manually:"
echo "     ${YELLOW}gcloud scheduler jobs run ${JOB_NAME}${NC}"
echo ""
echo "  2. View job details:"
echo "     ${YELLOW}gcloud scheduler jobs describe ${JOB_NAME}${NC}"
echo ""
echo "  3. View job logs:"
echo "     ${YELLOW}gcloud logging read \"resource.type=cloud_scheduler_job AND resource.labels.job_id=${JOB_NAME}\" --limit 50${NC}"
echo ""
echo -e "${GREEN}✨ Setup complete!${NC}"

