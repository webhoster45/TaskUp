const path = require('path');
const fs = require('fs');
const fspromises = require('fs').promises;

async function reader(filename) {
    try {
        const mrfile = path.join(__dirname, 'data', filename);
        if (fs.existsSync(mrfile)) {
            const data = await fspromises.readFile(mrfile, 'utf8');
            if (mrfile.endsWith('.json')) {
                return JSON.parse(data);
            } else {
                return data;
            }
        } else {
            // FIX: Write an empty array string '[]' instead of a live array object []
            await fspromises.writeFile(mrfile, '[]');
            return []; // FIX: Return the empty array so the writer can use it immediately
        }
    } catch (error) {
        console.log(error);
    }
}

async function writer(content, filename) {
    try {
        let filefamily = await reader(filename);
        const mrfile = path.join(__dirname, 'data', filename);
        
        // FIX: Ensure filefamily is treated as an array if the file was empty/just created
        if (!Array.isArray(filefamily)) {
            filefamily = [];
        }
        
        filefamily.push(content); // Modifies the array in place

        // FIX: Convert the array to a string using JSON.stringify before writing
        await fspromises.writeFile(mrfile, JSON.stringify(filefamily, null, 2), 'utf8');
        console.log("Data successfully written!");
    } catch (error) {
        console.log(error);
    }
}


writer({ username: "kettle" }, 'me.json');
writer({ username: "olawale" }, 'me.json');