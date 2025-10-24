/**
 * Script to update API URLs in the frontend after Railway deployment
 * Usage: node update-api-urls.js https://your-railway-url.up.railway.app
 */

const fs = require('fs');
const path = require('path');

// Get Railway URL from command line argument
const railwayUrl = process.argv[2];

if (!railwayUrl) {
  console.error('❌ Please provide Railway URL:');
  console.error('Usage: node update-api-urls.js https://your-railway-url.up.railway.app');
  process.exit(1);
}

console.log(`🔄 Updating API URLs to: ${railwayUrl}`);

// Files to update
const filesToUpdate = [
  'public/script.js',
  'public/admin.js',
  'public/test-auth.html'
];

// Update each file
filesToUpdate.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Replace API endpoints
      const replacements = [
        { from: "fetch('/api/llm'", to: `fetch('${railwayUrl}/api/llm'` },
        { from: "fetch('/api/models'", to: `fetch('${railwayUrl}/api/models'` },
        { from: "fetch('/api/sheets'", to: `fetch('${railwayUrl}/api/sheets'` },
        { from: "fetch('/api/projects'", to: `fetch('${railwayUrl}/api/projects'` }
      ];
      
      let updated = false;
      replacements.forEach(({ from, to }) => {
        if (content.includes(from)) {
          content = content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
          updated = true;
        }
      });
      
      if (updated) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Updated: ${filePath}`);
      } else {
        console.log(`⏭️  No changes needed: ${filePath}`);
      }
    } catch (error) {
      console.error(`❌ Error updating ${filePath}:`, error.message);
    }
  } else {
    console.log(`⏭️  File not found: ${filePath}`);
  }
});

console.log('🎉 API URL update complete!');
console.log('');
console.log('📋 Next steps:');
console.log('1. Deploy updated frontend: firebase deploy --only hosting');
console.log('2. Test the complete app');
console.log('3. Verify AI generation works');
