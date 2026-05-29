require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORTFOLIO_FOLDER_ID = process.env.PORTFOLIO_FOLDER_ID;

if (!PORTFOLIO_FOLDER_ID) {
  console.error("Error: PORTFOLIO_FOLDER_ID environment variable is missing.");
  process.exit(1);
}

// 1. Authenticate with Google Drive API
let auth;
if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  try {
    auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
  } catch (err) {
    console.error("Error parsing GOOGLE_SERVICE_ACCOUNT_JSON:", err.message);
    process.exit(1);
  }
} else if (fs.existsSync('./service-account.json')) {
  auth = new google.auth.GoogleAuth({
    keyFile: './service-account.json',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
} else {
  console.error("Error: No credentials found. Please set GOOGLE_SERVICE_ACCOUNT_JSON in your .env file or add service-account.json to the root folder.");
  process.exit(1);
}

const drive = google.drive({ version: 'v3', auth });

// Helper to list all files/folders inside a parent folder
async function listFilesInFolder(folderId) {
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, createdTime)',
      pageSize: 100,
    });
    return res.data.files || [];
  } catch (err) {
    console.error(`Error listing files in folder ${folderId}:`, err.message);
    return [];
  }
}

// Helper to read a Google Drive text file into memory (supports both text files and Google Docs)
async function readTextFile(file) {
  try {
    let res;
    if (file.mimeType === 'application/vnd.google-apps.document') {
      res = await drive.files.export(
        { fileId: file.id, mimeType: 'text/plain' },
        { responseType: 'stream' }
      );
    } else {
      res = await drive.files.get(
        { fileId: file.id, alt: 'media' },
        { responseType: 'stream' }
      );
    }
    return new Promise((resolve, reject) => {
      const chunks = [];
      res.data.on('data', chunk => chunks.push(Buffer.from(chunk)));
      res.data.on('error', err => reject(err));
      res.data.on('end', () => resolve(Buffer.concat(chunks).toString('utf8').trim()));
    });
  } catch (err) {
    console.error(`Error reading text file ${file.name} (${file.id}):`, err.message);
    return '';
  }
}

// Helper to download a binary file (image/video) to a local path
async function downloadFile(fileId, destPath) {
  try {
    const dest = fs.createWriteStream(destPath);
    const res = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    return new Promise((resolve, reject) => {
      res.data
        .on('error', err => {
          dest.close();
          reject(err);
        })
        .pipe(dest);
      dest.on('finish', () => resolve());
      dest.on('error', err => reject(err));
    });
  } catch (err) {
    console.error(`Error downloading file ${fileId} to ${destPath}:`, err.message);
  }
}

// Helper to copy a file safely
function copyFile(src, dest) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

// Clean up folder name (e.g. "01_Project Title" -> "Project Title")
function formatTitle(name) {
  return name.replace(/^\d+_+/, '').replace(/_+/g, ' ').trim();
}

async function processGoogleDoc(docId) {
  try {
    const res = await drive.files.export(
      { fileId: docId, mimeType: 'text/html' },
      { responseType: 'stream' }
    );
    
    const html = await new Promise((resolve, reject) => {
      const chunks = [];
      res.data.on('data', chunk => chunks.push(Buffer.from(chunk)));
      res.data.on('error', err => reject(err));
      res.data.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });

    // Extract body content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    let bodyContent = bodyMatch ? bodyMatch[1] : html;

    // Sanitize body content (remove style blocks, classes, inline styles, IDs)
    bodyContent = bodyContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    bodyContent = bodyContent.replace(/\s*style="[^"]*"/gi, "");
    bodyContent = bodyContent.replace(/\s*class="[^"]*"/gi, "");
    bodyContent = bodyContent.replace(/\s*id="[^"]*"/gi, "");
    bodyContent = bodyContent.replace(/\s*dir="[^"]*"/gi, "");
    
    return bodyContent.trim();
  } catch (err) {
    console.error(`Error processing Google Doc ${docId} as HTML:`, err.message);
    return "";
  }
}

async function build() {
  console.log("Starting build from Google Drive...");

  // Create local dist and assets directories
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const assetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Copy static frontend assets to dist/
  console.log("Copying frontend source files to dist/...");
  copyFile(path.join(__dirname, 'index.html'), path.join(distDir, 'index.html'));
  copyFile(path.join(__dirname, 'style.css'), path.join(distDir, 'style.css'));
  copyFile(path.join(__dirname, 'script.js'), path.join(distDir, 'script.js'));
  copyFile(path.join(__dirname, 'reset.css'), path.join(distDir, 'reset.css'));
  copyFile(path.join(__dirname, 'swirl@2x.png'), path.join(distDir, 'swirl@2x.png'));

  // Get the contents of the main root portfolio folder
  const rootFiles = await listFilesInFolder(PORTFOLIO_FOLDER_ID);
  
  const aboutFolder = rootFiles.find(f => f.name.toLowerCase() === 'about' && f.mimeType === 'application/vnd.google-apps.folder');
  const projectsFolder = rootFiles.find(f => f.name.toLowerCase() === 'projects' && f.mimeType === 'application/vnd.google-apps.folder');
  const wormholeFolder = rootFiles.find(f => f.name.toLowerCase() === 'wormhole' && f.mimeType === 'application/vnd.google-apps.folder');

  if (!aboutFolder || !projectsFolder) {
    console.error("Error: Could not find 'About' or 'Projects' folders in the specified Google Drive root.");
    console.log("Found items in root folder:", rootFiles.map(f => `${f.name} (${f.mimeType})`).join(', '));
    process.exit(1);
  }

  const resultData = {
    about: {
      description: "",
      links: []
    },
    projects: [],
    wormhole: []
  };

  // --- 2. Process the "About" Folder ---
  console.log("Processing 'About' folder...");
  const aboutFiles = await listFilesInFolder(aboutFolder.id);
  
  const descFile = aboutFiles.find(f => 
    f.name.toLowerCase() === 'description.txt' || 
    (f.name.toLowerCase() === 'description' && f.mimeType === 'application/vnd.google-apps.document')
  );
  if (descFile) {
    console.log(`Reading description (${descFile.name})...`);
    resultData.about.description = await readTextFile(descFile);
  } else {
    resultData.about.description = "Add description.txt or a Google Doc named 'description' to your About folder in Google Drive.";
  }

  const linksFile = aboutFiles.find(f => 
    f.name.toLowerCase() === 'links.txt' || 
    (f.name.toLowerCase() === 'links' && f.mimeType === 'application/vnd.google-apps.document')
  );
  if (linksFile) {
    console.log(`Reading links (${linksFile.name})...`);
    const linksContent = await readTextFile(linksFile);
    const lines = linksContent.split('\n');
    lines.forEach(line => {
      const parts = line.split(',');
      if (parts.length >= 2) {
        resultData.about.links.push({
          label: parts[0].trim(),
          url: parts[1].trim()
        });
      }
    });
  }

  // --- 3. Process the "Projects" Folder ---
  console.log("Processing 'Projects' folder...");
  const projectFolders = (await listFilesInFolder(projectsFolder.id))
    .filter(f => f.mimeType === 'application/vnd.google-apps.folder')
    // Sort projects alphabetically (supports "01_Project", "02_Project" naming)
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const projFolder of projectFolders) {
    console.log(`Processing project: ${projFolder.name}...`);
    const projFiles = await listFilesInFolder(projFolder.id);

    const projectData = {
      title: formatTitle(projFolder.name),
      description: "",
      assets: []
    };

    // Find description file inside project folder (txt or Google Doc)
    const projDescFile = projFiles.find(f => 
      f.name.toLowerCase() === 'description.txt' || 
      f.name.toLowerCase() === 'info.txt' || 
      ((f.name.toLowerCase() === 'description' || f.name.toLowerCase() === 'info') && f.mimeType === 'application/vnd.google-apps.document')
    );
    if (projDescFile) {
      projectData.description = await readTextFile(projDescFile);
    } else {
      projectData.description = "";
    }

    // Process other assets (images and videos)
    // Filter out text files, Google Doc descriptions, and subfolders
    const mediaFiles = projFiles.filter(f => {
      const isText = f.name.endsWith('.txt');
      const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
      const isGoogleDocDesc = ['description', 'info'].includes(f.name.toLowerCase()) && f.mimeType === 'application/vnd.google-apps.document';
      return !isText && !isFolder && !isGoogleDocDesc;
    }).sort((a, b) => a.name.localeCompare(b.name)); // Sort assets within project alphabetically

    for (const media of mediaFiles) {
      const ext = path.extname(media.name).toLowerCase();
      const filename = `${media.id}${ext}`;
      const destPath = path.join(assetsDir, filename);

      console.log(`Downloading asset: ${media.name} -> ${filename}...`);
      await downloadFile(media.id, destPath);

      const isVideo = media.mimeType.startsWith('video/') || ['.mp4', '.mov', '.webm'].includes(ext);
      const isAudio = media.mimeType.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.m4a'].includes(ext);

      let assetType = 'image';
      if (isVideo) {
        assetType = 'video';
      } else if (isAudio) {
        assetType = 'audio';
      }

      projectData.assets.push({
        type: assetType,
        src: `assets/${filename}`,
        alt: formatTitle(path.basename(media.name, ext))
      });
    }

    resultData.projects.push(projectData);
  }

  // --- 4. Process the "Wormhole" Folder (Optional) ---
  if (wormholeFolder) {
    console.log("Processing 'Wormhole' folder...");
    const wormholeFiles = (await listFilesInFolder(wormholeFolder.id))
      .filter(f => 
        f.mimeType === 'application/vnd.google-apps.document' || 
        f.name.endsWith('.txt') || 
        f.mimeType.startsWith('image/')
      )
      // Sort chronologically (oldest first)
      .sort((a, b) => new Date(a.createdTime) - new Date(b.createdTime));

    for (let i = 0; i < wormholeFiles.length; i++) {
      const file = wormholeFiles[i];
      console.log(`Reading/downloading writing item: ${file.name}...`);
      
      let content = "";
      
      if (file.mimeType === 'application/vnd.google-apps.document') {
        // Try parsing inline images and text via Google Docs HTML export
        content = await processGoogleDoc(file.id);
        // Fallback to text export if empty/fails
        if (!content) {
          content = await readTextFile(file);
        }
      } else if (file.mimeType.startsWith('image/')) {
        // Download standalone image file directly to assets folder
        const ext = path.extname(file.name).toLowerCase() || '.png';
        const filename = `wormhole_${file.id}${ext}`;
        const destPath = path.join(assetsDir, filename);
        console.log(`Downloading standalone wormhole image: ${file.name} -> ${filename}...`);
        await downloadFile(file.id, destPath);
        
        content = `<img src="assets/${filename}" class="wormhole-image-file" alt="${formatTitle(file.name)}" />`;
      } else {
        content = await readTextFile(file);
      }

      // Format date beautifully (e.g. May 26, 2026)
      const formattedDate = new Date(file.createdTime).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      resultData.wormhole.push({
        index: i + 1,
        title: formatTitle(file.name.replace(/\.txt$/i, '')),
        content: content,
        date: formattedDate
      });
    }
  } else {
    console.log("Wormhole folder not found in Google Drive root. Skipping wormhole section.");
  }

  // --- 5. Write data.json ---
  console.log("Writing data.json...");
  fs.writeFileSync(
    path.join(distDir, 'data.json'),
    JSON.stringify(resultData, null, 2)
  );

  console.log("Build completed successfully!");
}

build().catch(err => {
  console.error("Build failed:", err);
  process.exit(1);
});
