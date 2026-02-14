#!/usr/bin/env bash
#
# seed-compensations.sh
#
# Sends test trace data to the MediatorFlow ingest API to exercise
# compensation scenarios.  The trace simulates a ProcessPaymentCommand
# that fails during a critical consumer and triggers two compensations,
# one of which also fails (requiring manual intervention).
#
# Usage:
#   ./scripts/seed-compensations.sh              # defaults to localhost:4800
#   BASE_URL=http://10.0.0.5:4800 ./scripts/seed-compensations.sh
#
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4800}"
INGEST_URL="${BASE_URL}/collect/steps"

# ---------------------------------------------------------------------------
# Generate IDs
# ---------------------------------------------------------------------------
new_uuid() {
  # macOS & Linux portable UUID v4
  if command -v uuidgen &>/dev/null; then
    uuidgen | tr '[:upper:]' '[:lower:]'
  else
    python3 -c "import uuid; print(uuid.uuid4())"
  fi
}

CORRELATION_ID="$(new_uuid)"
INSTANCE_ID="payment-svc-01"
SERVICE_NAME="payment-service"

# Step IDs (one per step so we can wire causation chains)
STEP_CMD_DISPATCHED="$(new_uuid)"
STEP_BHV_EXCEPTION="$(new_uuid)"
STEP_BHV_RETRY="$(new_uuid)"
STEP_BHV_LOGGING="$(new_uuid)"
STEP_HANDLER_STARTED="$(new_uuid)"
STEP_EVT_PAYMENT="$(new_uuid)"
STEP_SYS_CONSUMER_STARTED="$(new_uuid)"
STEP_SYS_CONSUMER_COMPLETED="$(new_uuid)"
STEP_CRIT_CONSUMER_STARTED="$(new_uuid)"
STEP_EVT_INV_FAILED="$(new_uuid)"
STEP_COMP_REFUND_STARTED="$(new_uuid)"
STEP_COMP_REFUND_COMPLETED="$(new_uuid)"
STEP_COMP_RESTORE_STARTED="$(new_uuid)"
STEP_COMP_RESTORE_FAILED="$(new_uuid)"
STEP_COMP_EVT_REFUNDED="$(new_uuid)"

# Event IDs (shared between publisher / consumer pairs)
EVT_ID_PAYMENT_PROCESSED="$(new_uuid)"
EVT_ID_INV_DEDUCTION_FAILED="$(new_uuid)"
EVT_ID_PAYMENT_REFUNDED="$(new_uuid)"

# ---------------------------------------------------------------------------
# Timestamps — start at "now" and increment a few ms each step
# ---------------------------------------------------------------------------
if [[ "$(uname)" == "Darwin" ]]; then
  # macOS date doesn't support %N; use python for sub-second precision
  BASE_TS_EPOCH=$(python3 -c "import time; print(int(time.time() * 1000))")
else
  BASE_TS_EPOCH=$(date +%s%3N)
fi

ts_iso() {
  # $1 = offset in ms from BASE_TS_EPOCH
  local epoch_ms=$(( BASE_TS_EPOCH + $1 ))
  python3 -c "
import datetime, sys
ms = int(sys.argv[1])
dt = datetime.datetime.fromtimestamp(ms / 1000, tz=datetime.timezone.utc)
print(dt.strftime('%Y-%m-%dT%H:%M:%S.') + f'{ms % 1000:03d}Z')
" "$epoch_ms"
}

TS_01=$(ts_iso 0)
TS_02=$(ts_iso 2)
TS_03=$(ts_iso 4)
TS_04=$(ts_iso 6)
TS_05=$(ts_iso 10)
TS_06=$(ts_iso 45)
TS_07=$(ts_iso 48)
TS_08=$(ts_iso 52)
TS_09=$(ts_iso 55)
TS_10=$(ts_iso 120)
TS_11=$(ts_iso 125)
TS_12=$(ts_iso 160)
TS_13=$(ts_iso 165)
TS_14=$(ts_iso 350)
TS_15=$(ts_iso 355)

# ---------------------------------------------------------------------------
# Build JSON payload
# ---------------------------------------------------------------------------
PAYLOAD=$(cat <<EOF
{
  "serviceName": "${SERVICE_NAME}",
  "steps": [
    {
      "stepId":        "${STEP_CMD_DISPATCHED}",
      "instanceId":    "${INSTANCE_ID}",
      "type":          "COMMAND_DISPATCHED",
      "timestamp":     "${TS_01}",
      "correlationId": "${CORRELATION_ID}",
      "causationId":   null,
      "name":          "ProcessPaymentCommand",
      "payload": {
        "orderId": "ORD-20250601-8812",
        "amount": 249.99,
        "currency": "USD",
        "customerId": "cust_38a7b"
      },
      "metadata": {
        "userId": "user-42",
        "source": "checkout-api"
      }
    },
    {
      "stepId":        "${STEP_BHV_EXCEPTION}",
      "instanceId":    "${INSTANCE_ID}",
      "type":          "BEHAVIOR_ENTERED",
      "timestamp":     "${TS_02}",
      "correlationId": "${CORRELATION_ID}",
      "causationId":   "${STEP_CMD_DISPATCHED}",
      "name":          "ExceptionHandlingBehavior",
      "durationMs":    348
    },
    {
      "stepId":        "${STEP_BHV_RETRY}",
      "instanceId":    "${INSTANCE_ID}",
      "type":          "BEHAVIOR_ENTERED",
      "timestamp":     "${TS_03}",
      "correlationId": "${CORRELATION_ID}",
      "causationId":   "${STEP_BHV_EXCEPTION}",
      "name":          "RetryBehavior",
      "durationMs":    344
    },
    {
      "stepId":        "${STEP_BHV_LOGGING}",
      "instanceId":    "${INSTANCE_ID}",
      "type":          "BEHAVIOR_ENTERED",
      "timestamp":     "${TS_04}",
      "correlationId": "${CORRELATION_ID}",
      "causationId":   "${STEP_BHV_RETRY}",
      "name":          "LoggingBehavior",
      "durationMs":    340
    },
    {
      "stepId":        "${STEP_HANDLER_STARTED}",
      "instanceId":    "${INSTANCE_ID}",
      "type":          "COMMAND_HANDLER_STARTED",
      "timestamp":     "${TS_05}",
      "correlationId": "${CORRELATION_ID}",
      "causationId":   "${STEP_BHV_LOGGING}",
      "name":          "ProcessPaymentHandler",
      "durationMs":    35
    },
    {
      "stepId":        "${STEP_EVT_PAYMENT}",
      "instanceId":    "${INSTANCE_ID}",
      "type":          "EVENT_PUBLISHED",
      "timestamp":     "${TS_06}",
      "correlationId": "${CORRELATION_ID}",
      "causationId":   "${STEP_HANDLER_STARTED}",
      "eventId":       "${EVT_ID_PAYMENT_PROCESSED}",
      "name":          "PaymentProcessedEvent",
      "payload": {
        "orderId": "ORD-20250601-8812",
        "transactionId": "txn_abc123",
        "amount": 249.99
      },
      "metadata": {
        "aggregateType": "Order",
        "aggregateId": "ORD-20250601-8812"
      }
    },
    {
      "stepId":        "${STEP_SYS_CONSUMER_STARTED}",
      "instanceId":    "${INSTANCE_ID}",
      "type":          "SYSTEM_CONSUMER_STARTED",
      "timestamp":     "${TS_07}",
      "correlationId": "${CORRELATION_ID}",
      "causationId":   "${STEP_EVT_PAYMENT}",
      "eventId":       "${EVT_ID_PAYMENT_PROCESSED}",
      "name":          "EventStorePersistenceConsumer"
    },
    {
      "stepId":        "${STEP_SYS_CONSUMER_COMPLETED}",
      "instanceId":    "${INSTANCE_ID}",
      "type":          "SYSTEM_CONSUMER_COMPLETED",
      "timestamp":     "${TS_08}",
      "correlationId": "${CORRELATION_ID}",
      "causationId":   "${STEP_SYS_CONSUMER_STARTED}",
      "eventId":       "${EVT_ID_PAYMENT_PROCESSED}",
      "name":          "EventStorePersistenceConsumer",
      "durationMs":    4
    },
    {
      "stepId":        "${STEP_CRIT_CONSUMER_STARTED}",
      "instanceId":    "${INSTANCE_ID}",
      "type":          "CRITICAL_CONSUMER_STARTED",
      "timestamp":     "${TS_09}",
      "correlationId": "${CORRELATION_ID}",
      "causationId":   "${STEP_EVT_PAYMENT}",
      "eventId":       "${EVT_ID_PAYMENT_PROCESSED}",
      "name":          "DeductInventoryHandler",
      "durationMs":    65,
      "error":         "InventoryDeductionError: Item SKU-7721 out of stock — cannot reserve 2 units"
    },
    {
      "stepId":        "${STEP_EVT_INV_FAILED}",
      "instanceId":    "${INSTANCE_ID}",
      "type":          "EVENT_PUBLISHED",
      "timestamp":     "${TS_10}",
      "correlationId": "${CORRELATION_ID}",
      "causationId":   "${STEP_CRIT_CONSUMER_STARTED}",
      "eventId":       "${EVT_ID_INV_DEDUCTION_FAILED}",
      "name":          "InventoryDeductionFailedEvent",
      "payload": {
        "orderId": "ORD-20250601-8812",
        "sku": "SKU-7721",
        "requestedQty": 2,
        "reason": "out_of_stock"
      },
      "metadata": {
        "aggregateType": "Order",
        "aggregateId": "ORD-20250601-8812"
      }
    },
    {
      "stepId":        "${STEP_COMP_REFUND_STARTED}",
      "instanceId":    "${INSTANCE_ID}",
      "type":          "COMPENSATION_STARTED",
      "timestamp":     "${TS_11}",
      "correlationId": "${CORRELATION_ID}",
      "causationId":   "${STEP_EVT_INV_FAILED}",
      "eventId":       "${EVT_ID_INV_DEDUCTION_FAILED}",
      "name":          "RefundPaymentHandler"
    },
    {
      "stepId":        "${STEP_COMP_REFUND_COMPLETED}",
      "instanceId":    "${INSTANCE_ID}",
      "type":          "COMPENSATION_COMPLETED",
      "timestamp":     "${TS_12}",
      "correlationId": "${CORRELATION_ID}",
      "causationId":   "${STEP_COMP_REFUND_STARTED}",
      "eventId":       "${EVT_ID_INV_DEDUCTION_FAILED}",
      "name":          "RefundPaymentHandler",
      "durationMs":    35,
      "payload": {
        "refundId": "ref_zz9901",
        "amount": 249.99
      }
    },
    {
      "stepId":        "${STEP_COMP_RESTORE_STARTED}",
      "instanceId":    "${INSTANCE_ID}",
      "type":          "COMPENSATION_STARTED",
      "timestamp":     "${TS_13}",
      "correlationId": "${CORRELATION_ID}",
      "causationId":   "${STEP_EVT_INV_FAILED}",
      "eventId":       "${EVT_ID_INV_DEDUCTION_FAILED}",
      "name":          "RestoreInventoryHandler"
    },
    {
      "stepId":        "${STEP_COMP_RESTORE_FAILED}",
      "instanceId":    "${INSTANCE_ID}",
      "type":          "COMPENSATION_FAILED",
      "timestamp":     "${TS_14}",
      "correlationId": "${CORRELATION_ID}",
      "causationId":   "${STEP_COMP_RESTORE_STARTED}",
      "eventId":       "${EVT_ID_INV_DEDUCTION_FAILED}",
      "name":          "RestoreInventoryHandler",
      "durationMs":    185,
      "error":         "Database connection timeout - MANUAL INTERVENTION REQUIRED"
    },
    {
      "stepId":        "${STEP_COMP_EVT_REFUNDED}",
      "instanceId":    "${INSTANCE_ID}",
      "type":          "COMPENSATING_EVENT_PUBLISHED",
      "timestamp":     "${TS_15}",
      "correlationId": "${CORRELATION_ID}",
      "causationId":   "${STEP_COMP_REFUND_COMPLETED}",
      "eventId":       "${EVT_ID_PAYMENT_REFUNDED}",
      "name":          "PaymentRefundedEvent",
      "payload": {
        "orderId": "ORD-20250601-8812",
        "refundId": "ref_zz9901",
        "amount": 249.99,
        "originalTransactionId": "txn_abc123"
      },
      "metadata": {
        "aggregateType": "Order",
        "aggregateId": "ORD-20250601-8812"
      }
    }
  ]
}
EOF
)

# ---------------------------------------------------------------------------
# Send to ingest API
# ---------------------------------------------------------------------------
echo "=========================================="
echo "  MediatorFlow - Seed Compensation Trace"
echo "=========================================="
echo ""
echo "Target:         ${INGEST_URL}"
echo "Correlation ID: ${CORRELATION_ID}"
echo "Steps:          15"
echo ""

HTTP_CODE=$(curl -s -o /tmp/mf-seed-response.json -w "%{http_code}" \
  -X POST "${INGEST_URL}" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}")

RESPONSE=$(cat /tmp/mf-seed-response.json)

if [[ "${HTTP_CODE}" == "200" || "${HTTP_CODE}" == "201" ]]; then
  echo "SUCCESS  (HTTP ${HTTP_CODE})"
  echo "Response: ${RESPONSE}"
  echo ""
  echo "=========================================="
  echo "  Trace ready!  Open in UI:"
  echo ""
  echo "  ${BASE_URL}/traces/${CORRELATION_ID}"
  echo "=========================================="
else
  echo "FAILED  (HTTP ${HTTP_CODE})"
  echo "Response: ${RESPONSE}"
  echo ""
  echo "Make sure the MediatorFlow server is running at ${BASE_URL}"
  exit 1
fi

rm -f /tmp/mf-seed-response.json
