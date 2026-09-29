const fs = require('fs');
const path = require('path');

const logPath = '/.aistudio/artifacts/brain/4e6e8c0e-dcb6-4cd1-9154-3bc3c4a038de/.system_generated/logs/transcript.jsonl';
if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  // Find "Top Panel: Boards Graph Canvas"
  const idx = content.lastIndexOf('Top Panel: Boards Graph Canvas');
  if (idx !== -1) {
    console.log('Found in transcript at index:', idx);
    // Find where the board rendering ends
    const endStr = 'Bottom Panel: Resizable & Collapsible';
    const endIdx = content.indexOf(endStr, idx);
    console.log('End index:', endIdx);
    if (endIdx !== -1) {
      // Find where the main content starts before idx
      const startStr = 'BANDEJA SUPERIOR 1: NAVEGACIÓN DE PLANCHAS';
      const startIdx = content.lastIndexOf(startStr, idx);
      console.log('Start index:', startIdx);
      if (startIdx !== -1) {
        let chunk = content.substring(startIdx, endIdx);
        // Clean JSON escaping if any
        chunk = chunk.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        fs.writeFileSync('extracted_canvas.txt', chunk);
        console.log('Saved extracted_canvas.txt with length:', chunk.length);
      }
    }
  }
} else {
  console.log('Log file does not exist');
}
