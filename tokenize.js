const fs = require('fs');
const path = require('path');

const srcDirs = [
  path.join(__dirname, '../c/Users/Joy/OneDrive/Desktop/記帳app/src/views'),
  path.join(__dirname, '../c/Users/Joy/OneDrive/Desktop/記帳app/src/components')
];

// Provide absolute paths since the above relative might fail depending on where the script is executed
const absoluteSrcDirs = [
  'c:\\Users\\Joy\\OneDrive\\Desktop\\記帳app\\src\\views',
  'c:\\Users\\Joy\\OneDrive\\Desktop\\記帳app\\src\\components'
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Icon sizing
  content = content.replace(/\bw-3\s+h-3\b/g, 'size-icon-sm');
  content = content.replace(/\bw-4\s+h-4\b/g, 'size-icon-md');
  content = content.replace(/\bw-5\s+h-5\b/g, 'size-icon-md');
  content = content.replace(/\bw-6\s+h-6\b/g, 'size-icon-lg');
  content = content.replace(/\bw-8\s+h-8\b/g, 'size-icon-container text-h1');
  content = content.replace(/\bw-10\s+h-10\b/g, 'size-icon-container text-h1');
  content = content.replace(/\bw-12\s+h-12\b/g, 'size-icon-container text-[3rem]');
  content = content.replace(/\bw-16\s+h-16\b/g, 'size-avatar-lg');
  
  // Padding
  content = content.replace(/\bp-1\b/g, 'p-micro');
  content = content.replace(/\bp-2\b/g, 'p-inner');
  content = content.replace(/\bp-3\b/g, 'p-item');
  content = content.replace(/\bp-4\b/g, 'p-item');
  content = content.replace(/\bp-5\b/g, 'p-section');
  content = content.replace(/\bp-6\b/g, 'p-section');
  content = content.replace(/\bp-8\b/g, 'p-section');

  // Padding X/Y
  content = content.replace(/\bpx-1\b/g, 'px-micro');
  content = content.replace(/\bpx-2\b/g, 'px-inner');
  content = content.replace(/\bpx-3\b/g, 'px-item');
  content = content.replace(/\bpx-4\b/g, 'px-item');
  content = content.replace(/\bpx-5\b/g, 'px-section');
  content = content.replace(/\bpx-6\b/g, 'px-section');
  content = content.replace(/\bpx-8\b/g, 'px-section');

  content = content.replace(/\bpy-1\b/g, 'py-micro');
  content = content.replace(/\bpy-1\.5\b/g, 'py-inner');
  content = content.replace(/\bpy-2\b/g, 'py-inner');
  content = content.replace(/\bpy-3\b/g, 'py-item');
  content = content.replace(/\bpy-4\b/g, 'py-item');
  content = content.replace(/\bpy-5\b/g, 'py-section');
  content = content.replace(/\bpy-6\b/g, 'py-section');
  content = content.replace(/\bpy-8\b/g, 'py-section');

  // Gaps
  content = content.replace(/\bgap-0\.5\b/g, 'gap-micro');
  content = content.replace(/\bgap-1\b/g, 'gap-micro');
  content = content.replace(/\bgap-2\b/g, 'gap-inner');
  content = content.replace(/\bgap-3\b/g, 'gap-item');
  content = content.replace(/\bgap-4\b/g, 'gap-item');
  content = content.replace(/\bgap-5\b/g, 'gap-section');
  content = content.replace(/\bgap-6\b/g, 'gap-section');
  content = content.replace(/\bgap-8\b/g, 'gap-section');

  // Margins
  content = content.replace(/\bmt-2\b/g, 'mt-inner');
  content = content.replace(/\bmt-4\b/g, 'mt-item');
  content = content.replace(/\bmt-6\b/g, 'mt-section');
  content = content.replace(/\bmt-8\b/g, 'mt-section');

  content = content.replace(/\bmb-2\b/g, 'mb-inner');
  content = content.replace(/\bmb-4\b/g, 'mb-item');
  content = content.replace(/\bmb-6\b/g, 'mb-section');
  content = content.replace(/\bmb-8\b/g, 'mb-section');

  // Typo & Durations
  content = content.replace(/\bfont-semibold\b/g, 'font-h3');
  content = content.replace(/\bfont-medium\b/g, 'font-h3');
  content = content.replace(/\bfont-bold\b/g, 'font-h2');
  content = content.replace(/\bduration-150\b/g, 'duration-fast');
  content = content.replace(/\bduration-200\b/g, 'duration-normal');
  content = content.replace(/\bduration-300\b/g, 'duration-normal');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function traverse(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      traverse(fullPath);
    } else if (fullPath.endsWith('.tsx') && !fullPath.includes('AccountDetailView') && !fullPath.includes('AccountFormView') && !fullPath.includes('TransactionDetailView') && !fullPath.includes('TransactionFormView') && !fullPath.includes('AccountView')) {
      processFile(fullPath);
    }
  }
}

absoluteSrcDirs.forEach(traverse);
console.log('Tokenization sweep complete!');
