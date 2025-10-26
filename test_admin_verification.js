// Test admin verification logic
import { hasHealthPermission } from './health.js';

// Mock message from new admin
const newAdminMessage = {
  author: { id: '1069847333388419134', username: 'newadmin' }
};

// Mock message from old admin
const oldAdminMessage = {
  author: { id: '877972869001412768', username: 'oldadmin' }
};

// Mock message from non-admin
const nonAdminMessage = {
  author: { id: '123456789', username: 'regularuser' }
};

console.log('🔍 Testing admin verification logic...');
console.log('📝 Current ADMIN_USER_ID:', process.env.ADMIN_USER_ID);

console.log('\n🧪 Testing new admin (1069847333388419134):');
console.log('Has permission:', hasHealthPermission(newAdminMessage));

console.log('\n🧪 Testing old admin (877972869001412768):');
console.log('Has permission:', hasHealthPermission(oldAdminMessage));

console.log('\n🧪 Testing non-admin (123456789):');
console.log('Has permission:', hasHealthPermission(nonAdminMessage));

console.log('\n✅ Admin verification test completed!');