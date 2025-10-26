import { CONFIG } from './config/config.js';
import 'dotenv/config';

console.log('=== OWNER CONFIGURATION TEST ===');
console.log('ADMIN_USER_ID from env:', process.env.ADMIN_USER_ID);
console.log('DISCORD_USER_ID from env:', process.env.DISCORD_USER_ID);
console.log('CONFIG.admin.userId:', CONFIG.admin.userId);

// Test Z3ki's ID
const z3kiId = '877972869001412768';
console.log('\n=== Z3KI RECOGNITION TEST ===');
console.log('Z3ki ID:', z3kiId);
console.log('Is Z3ki recognized as admin?', z3kiId === CONFIG.admin.userId);
console.log('Is Z3ki recognized as admin (env check)?', z3kiId === (process.env.ADMIN_USER_ID || process.env.DISCORD_USER_ID));

// Test role detection logic
console.log('\n=== ROLE DETECTION TEST ===');
const mockMessage = {
  author: {
    id: z3kiId,
    username: '.z3ki',
    globalName: 'Z3ki'
  },
  guild: {
    ownerId: 'some_other_id'
  },
  member: {
    permissions: {
      has: () => false
    }
  }
};

// Simulate the role detection logic from ai.js
let userRole = '';
const adminUserId = process.env.ADMIN_USER_ID || process.env.DISCORD_USER_ID;
if (mockMessage.author.id === adminUserId) {
  userRole = ' (OWNER/BOT ADMIN)';
} else if (mockMessage.guild && mockMessage.guild.ownerId === mockMessage.author.id) {
  userRole = ' (SERVER OWNER)';
} else if (mockMessage.member && mockMessage.member.permissions.has('ADMINISTRATOR')) {
  userRole = ' (SERVER ADMIN)';
}

const currentUserInfo = `Username: ${mockMessage.author.username}, Display Name: ${mockMessage.author.globalName || 'None'}, ID: ${mockMessage.author.id}${userRole}`;
console.log('Generated user info:', currentUserInfo);
console.log('Role detected:', userRole || 'No special role');