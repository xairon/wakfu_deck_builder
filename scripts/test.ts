const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'pages');
console.log('Lecture du répertoire pages...');

try {
  const extensions = fs.readdirSync(pagesDir);
  console.log(`Extensions trouvées : ${extensions.join(', ')}`);

  for (const extension of extensions) {
    const extensionDir = path.join(pagesDir, extension);
    if (fs.statSync(extensionDir).isDirectory()) {
      const files = fs.readdirSync(extensionDir)
        .filter((file: string) => file.endsWith('.html'));
      console.log(`\nExtension ${extension}: ${files.length} fichiers HTML`);
      
      // Afficher les 5 premiers fichiers
      console.log('Premiers fichiers:');
      files.slice(0, 5).forEach((file: string) => console.log(`- ${file}`));
    }
  }
} catch (error) {
  console.error('Erreur:', error);
} 