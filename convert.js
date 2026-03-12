const fs = require('fs');
const lines = fs.readFileSync('../../exercises_data.csv', 'utf8').split('\n').filter(Boolean);
const headers = lines.shift().split(',');
const data = [];
for (let l of lines) {
    // split by comma, handling quotes if any
    let t = l.trim();
    if (!t) continue;

    // Simple custom csv parser
    let parts = [];
    let insideQuote = false;
    let currentPart = '';

    for (let char of t) {
        if (char === '"') {
            insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
            parts.push(currentPart.trim());
            currentPart = '';
        } else {
            currentPart += char;
        }
    }
    parts.push(currentPart.trim());

    data.push({
        name: parts[0] || '',
        equipment: parts[1] || '',
        primary_muscle: parts[2] || '',
        secondary_muscle: parts[3] || '',
        source: parts[4] !== 'None' ? parts[4] : '',
        sourceType: parts[5] !== 'None' ? parts[5] : ''
    });
}
fs.mkdirSync('./src/data', { recursive: true });
fs.writeFileSync('./src/data/exercises.json', JSON.stringify(data, null, 2));
console.log('done');
