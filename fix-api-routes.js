const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all route.ts files in the api directory
const apiRoutes = glob.sync('src/app/api/**/route.ts', { cwd: process.cwd() });

console.log(`Found ${apiRoutes.length} API routes to fix`);

// First, let's remove any incorrectly placed export statements
apiRoutes.forEach(filePath => {
  const fullPath = path.resolve(process.cwd(), filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Remove the wrongly placed export declarations
  content = content.replace(/\/\/ Add these exports to make the route compatible with static export\nexport const dynamic = 'force-static';\nexport const revalidate = false;\n\n/g, '');
  
  fs.writeFileSync(fullPath, content, 'utf8');
});

// Now, let's add the export statements in the correct place
apiRoutes.forEach(filePath => {
  const fullPath = path.resolve(process.cwd(), filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Check if the file already has the export declarations
  if (!content.includes('export const dynamic =')) {
    // Add exports after imports but before any other code
    const lines = content.split('\n');
    let lastImportIndex = -1;
    
    // Find the last import statement
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }
    
    if (lastImportIndex !== -1) {
      // Insert exports after the last import
      const exportLines = [
        '',
        '// Add these exports to make the route compatible with static export',
        'export const dynamic = \'force-static\';',
        'export const revalidate = false;',
        ''
      ];
      
      lines.splice(lastImportIndex + 1, 0, ...exportLines);
      content = lines.join('\n');
      
      // Write the updated content back to the file
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`Fixed ${filePath}`);
    } else {
      console.log(`Skipped ${filePath} - couldn't find import statements`);
    }
  } else {
    console.log(`Skipped ${filePath} - already contains export declarations`);
  }
});

console.log('API route fixes completed!'); 