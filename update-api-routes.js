const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all route.ts files in the api directory
const apiRoutes = glob.sync('src/app/api/**/route.ts', { cwd: process.cwd() });

console.log(`Found ${apiRoutes.length} API routes to update`);

// Update each file
apiRoutes.forEach(filePath => {
  const fullPath = path.resolve(process.cwd(), filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Check if the file already has the export declarations
  if (!content.includes('export const dynamic =') && !content.includes('export const revalidate =')) {
    // Find a good insertion point - after imports, before the first function
    const importEndIndex = content.lastIndexOf('import');
    let insertionPoint = 0;
    
    if (importEndIndex !== -1) {
      // Find the end of the last import statement
      const semicolonAfterImport = content.indexOf(';', importEndIndex);
      insertionPoint = semicolonAfterImport !== -1 ? semicolonAfterImport + 1 : 0;
    }
    
    // Insert the export declarations
    const exportDeclarations = `

// Add these exports to make the route compatible with static export
export const dynamic = 'force-static';
export const revalidate = false;
`;
    
    const updatedContent = 
      content.slice(0, insertionPoint) + 
      exportDeclarations + 
      content.slice(insertionPoint);
    
    // Write the updated content back to the file
    fs.writeFileSync(fullPath, updatedContent, 'utf8');
    console.log(`Updated ${filePath}`);
  } else {
    console.log(`Skipped ${filePath} - already contains export declarations`);
  }
});

console.log('API route updates completed!'); 