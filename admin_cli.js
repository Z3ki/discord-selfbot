#!/usr/bin/env node

import { adminManager } from './utils/adminManager.js';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('🔧 Admin Manager CLI');
  console.log('');
  console.log('Usage:');
  console.log('  node admin_cli.js <userId>     - Toggle admin status');
  console.log('  node admin_cli.js list         - List all admins');
  console.log('  node admin_cli.js clear        - Clear all admins');
  console.log('');
  console.log('Examples:');
  console.log('  node admin_cli.js 123456789012345678');
  console.log('  node admin_cli.js list');
  process.exit(0);
}

const command = args[0];

if (command === 'list') {
  const admins = adminManager.getAdmins();
  console.log(`👑 Bot Administrators (${admins.length}):`);
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