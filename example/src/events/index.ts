// Event
export * from './order-placed.event';

// Critical handlers
export * from './handlers/validate-inventory.handler';
export * from './handlers/reserve-inventory.handler';
export * from './handlers/create-order-record.handler';

// Non-critical handlers
export * from './handlers/send-order-confirmation.handler';
export * from './handlers/notify-warehouse.handler';
export * from './handlers/track-order-analytics.handler';
