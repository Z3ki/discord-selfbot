#!/usr/bin/env node

import { adminManager } from './utils/adminManager.js';
import { logger } from './utils/logger.js'; // Import logger

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('🔧 Admin Manager CLI');
  console.log('');
  console.log('Usage:');
  console.log('  node admin_cli.js <userId>     - Toggle admin status');
  console.log('  node admin_cli.js list         - List all admins');
  console.log('  node admin_cli.js clear        - Clear all admins');
  console.log(
    '  node admin_cli.js think        - Trigger the proactive cognitive loop'
  );
  console.log('');
  console.log('Examples:');
  console.log('  node admin_cli.js 123456789012345678');
  console.log('  node admin_cli.js list');
  console.log('  node admin_cli.js think');
  process.exit(0);
}

const command = args[0];

if (command === 'list') {
  const admins = adminManager.getAdmins();
  console.log(`Bot Administrators (${admins.length}):`);
  if (admins.length > 0) {
    admins.forEach((adminId, index) => {
      console.log(`  ${index + 1}. ${adminId}`);
    });
  } else {
    console.log('  No administrators configured');
  }
} else if (command === 'clear') {
  const result = adminManager.clearAdmins();
  console.log(`🚨 Cleared ${result.count} admin(s)`);
} else if (command === 'think') {
  const fs = await import('fs');
  const path = await import('path');
  const triggerPath = path.resolve(process.cwd(), 'temp/think.trigger');
  fs.writeFileSync(triggerPath, Date.now().toString()); // Use writeFileSync for simplicity
  logger.debug('Writing trigger file to:', { triggerPath }); // Add debug log
  console.log('🧠 Sent trigger for proactive cognitive loop.');
} else {
  // Treat as user ID to toggle
  const userId = command;
  const result = adminManager.toggleAdmin(userId);

  if (result.success) {
    const emoji = result.action === 'added' ? '➕' : '➖';
    console.log(`${emoji} ${result.message}`);
    console.log(`Total admins: ${adminManager.getAdminCount()}`);
  } else {
    console.log(`❌ Error: ${result.error}`);
  }
}
