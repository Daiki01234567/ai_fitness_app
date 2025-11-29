#!/bin/bash
# =============================================================================
# Cloud Monitoring Setup Script
# AI Fitness App - tokyo-list-478804-e5
#
# This script sets up Cloud Monitoring infrastructure including:
# - API enablement
# - Notification channels
# - Alert policies
# - Dashboards
#
# Usage: ./monitoring/setup-monitoring.sh
#
# Date: 2025-11-29
# Version: 1.0.0
# =============================================================================

set -e

# Configuration
PROJECT_ID="tokyo-list-478804-e5"
REGION="asia-northeast1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check gcloud
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI is not installed. Please install it first."
        exit 1
    fi

    # Check firebase
    if ! command -v firebase &> /dev/null; then
        log_error "Firebase CLI is not installed. Please install it first."
        exit 1
    fi

    # Check project access
    if ! gcloud projects describe "$PROJECT_ID" &> /dev/null; then
        log_error "Cannot access project $PROJECT_ID. Check your permissions."
        exit 1
    fi

    log_success "Prerequisites check passed."
}

# Set project
set_project() {
    log_info "Setting project to $PROJECT_ID..."
    gcloud config set project "$PROJECT_ID"
    firebase use "$PROJECT_ID"
    log_success "Project set successfully."
}

# Enable APIs
enable_apis() {
    log_info "Enabling required APIs..."

    apis=(
        "monitoring.googleapis.com"
        "logging.googleapis.com"
        "cloudtrace.googleapis.com"
        "clouderrorreporting.googleapis.com"
        "cloudfunctions.googleapis.com"
        "firestore.googleapis.com"
    )

    for api in "${apis[@]}"; do
        log_info "Enabling $api..."
        gcloud services enable "$api" --project="$PROJECT_ID" 2>/dev/null || true
    done

    log_success "APIs enabled successfully."
}

# Create notification channels
create_notification_channels() {
    log_info "Setting up notification channels..."

    # Check if email notification channel exists
    existing_channels=$(gcloud alpha monitoring channels list \
        --project="$PROJECT_ID" \
        --format="value(name)" 2>/dev/null || echo "")

    if [ -z "$existing_channels" ]; then
        log_warning "No notification channels found."
        log_info "Please create notification channels manually via Cloud Console:"
        log_info "https://console.cloud.google.com/monitoring/alerting/notifications?project=$PROJECT_ID"
        log_info ""
        log_info "Recommended channels:"
        log_info "  1. Email channel for admin notifications"
        log_info "  2. Slack integration for team alerts"
        log_info "  3. PagerDuty for critical on-call alerts"
    else
        log_success "Notification channels already configured."
        log_info "Existing channels:"
        gcloud alpha monitoring channels list --project="$PROJECT_ID" --format="table(displayName,type,enabled)"
    fi
}

# Create dashboard
create_dashboard() {
    log_info "Creating monitoring dashboard..."

    dashboard_file="$SCRIPT_DIR/dashboards/system-overview.json"

    if [ ! -f "$dashboard_file" ]; then
        log_error "Dashboard file not found: $dashboard_file"
        return 1
    fi

    # Check if dashboard already exists
    existing_dashboards=$(gcloud monitoring dashboards list \
        --project="$PROJECT_ID" \
        --format="value(displayName)" 2>/dev/null || echo "")

    if echo "$existing_dashboards" | grep -q "AI Fitness App - System Overview"; then
        log_warning "Dashboard 'AI Fitness App - System Overview' already exists."
        log_info "To update, delete the existing dashboard first."
    else
        gcloud monitoring dashboards create \
            --config-from-file="$dashboard_file" \
            --project="$PROJECT_ID"
        log_success "Dashboard created successfully."
    fi
}

# Create alert policies
create_alert_policies() {
    log_info "Creating alert policies..."

    alert_file="$SCRIPT_DIR/alert-policies.yaml"

    if [ ! -f "$alert_file" ]; then
        log_error "Alert policies file not found: $alert_file"
        return 1
    fi

    # Note: gcloud alpha monitoring policies create requires proper YAML format
    # The current YAML is a list, which needs to be processed individually

    log_warning "Alert policies should be created via Cloud Console for proper configuration."
    log_info "Please visit: https://console.cloud.google.com/monitoring/alerting?project=$PROJECT_ID"
    log_info ""
    log_info "Alert policies defined in $alert_file:"
    log_info "  1. API Error Rate High (High severity)"
    log_info "  2. API Latency High (Medium severity)"
    log_info "  3. Authentication Failures Spike (High severity)"
    log_info "  4. Cloud Function Execution Errors (High severity)"
    log_info "  5. Firestore High Operations (Medium severity)"
    log_info "  6. Cloud Function Memory Usage High (Medium severity)"
    log_info "  7. Security Event Detected (Critical severity)"
}

# Verify setup
verify_setup() {
    log_info "Verifying monitoring setup..."

    echo ""
    log_info "=== Enabled APIs ==="
    gcloud services list --enabled --project="$PROJECT_ID" \
        --filter="NAME:(monitoring OR logging OR trace OR errorreporting)" \
        --format="table(NAME,TITLE)"

    echo ""
    log_info "=== Dashboards ==="
    gcloud monitoring dashboards list --project="$PROJECT_ID" \
        --format="table(displayName)" 2>/dev/null || log_warning "No dashboards found."

    echo ""
    log_info "=== Notification Channels ==="
    gcloud alpha monitoring channels list --project="$PROJECT_ID" \
        --format="table(displayName,type,enabled)" 2>/dev/null || log_warning "No channels found."

    echo ""
    log_info "=== Alert Policies ==="
    gcloud alpha monitoring policies list --project="$PROJECT_ID" \
        --format="table(displayName,enabled)" 2>/dev/null || log_warning "No policies found."

    echo ""
    log_success "Verification complete."
}

# Print summary
print_summary() {
    echo ""
    echo "============================================================================="
    echo "                     MONITORING SETUP SUMMARY"
    echo "============================================================================="
    echo ""
    echo "Project: $PROJECT_ID"
    echo "Region:  $REGION"
    echo ""
    echo "Resources Created/Verified:"
    echo "  [x] APIs enabled (monitoring, logging, trace, error reporting)"
    echo "  [x] Dashboard: AI Fitness App - System Overview"
    echo "  [ ] Notification channels (manual setup required)"
    echo "  [ ] Alert policies (manual setup required)"
    echo ""
    echo "Next Steps:"
    echo "  1. Configure notification channels in Cloud Console"
    echo "  2. Create alert policies based on alert-policies.yaml"
    echo "  3. Set up budget alerts in Cloud Billing"
    echo "  4. Test alerting with synthetic failures"
    echo ""
    echo "Useful Links:"
    echo "  Dashboard:     https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"
    echo "  Alerting:      https://console.cloud.google.com/monitoring/alerting?project=$PROJECT_ID"
    echo "  Logs:          https://console.cloud.google.com/logs?project=$PROJECT_ID"
    echo "  Error Report:  https://console.cloud.google.com/errors?project=$PROJECT_ID"
    echo ""
    echo "============================================================================="
}

# Main execution
main() {
    echo ""
    echo "============================================================================="
    echo "            AI FITNESS APP - MONITORING SETUP"
    echo "============================================================================="
    echo ""

    check_prerequisites
    set_project
    enable_apis
    create_notification_channels
    create_dashboard
    create_alert_policies
    verify_setup
    print_summary

    log_success "Monitoring setup completed!"
}

# Run main function
main "$@"
