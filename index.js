const tlock = require('tlock-js');
const fs = require('fs');
const path = require('path');

const client = tlock.mainnetClient();

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMode() {
    const dataDir = path.resolve(__dirname, 'data');

    const pinPath = path.join(dataDir, 'pin.txt');
    const passwordPath = path.join(dataDir, 'password.txt');
    const encryptedPath = path.join(dataDir, 'encrypted.txt');

    let hasPin = false;
    let hasPassword = false;
    let hasEncrypted = false;
	let passwordContent = "";
	let pinContent = "";

    // Check if pin.txt exists and meets requirements
    if (fs.existsSync(pinPath)) {
        pinContent = fs.readFileSync(pinPath, 'utf-8').trim();
        if (!/^\d{4}$/.test(pinContent)) {
            throw new Error("The file 'pin.txt' must contain exactly one line with exactly 4 digits.");
        }
        hasPin = true;
    }

    // Check if password.txt exists and meets requirements
    if (fs.existsSync(passwordPath)) {
        passwordContent = fs.readFileSync(passwordPath, 'utf-8').trim();
        if (passwordContent.split('\n').length !== 1 || passwordContent.length === 0) {
            throw new Error("The file 'password.txt' must contain exactly one non-empty line.");
        }
        hasPassword = true;
    }

    // If only one of pin or password exists, throw an error
    if ((hasPin && !hasPassword) || (!hasPin && hasPassword)) {
        throw new Error("Both 'pin.txt' and 'password.txt' must exist and meet their respective requirements, or neither.");
    }

    // If both pin.txt and password.txt meet requirements, return MODE_START
    if (hasPin && hasPassword) {
        return {password: passwordContent, pin: pinContent};
    }

    // Check if encrypted.txt exists and meets requirements
    if (fs.existsSync(encryptedPath)) {
        const encryptedContent = fs.readFileSync(encryptedPath, 'utf-8').trim();
        if (encryptedContent.split('\n').length >= 1) {
            hasEncrypted = true;
        }
    }

    // If encrypted.txt exists and is valid, return MODE_ENCRYPTED
    if (hasEncrypted) {
        return;
    }

    // If no valid mode can be determined, throw an error
    throw new Error("No valid mode could be determined. Ensure 'pin.txt', 'password.txt', or 'encrypted.txt' exist and meet requirements.");
}


async function encrypt(text) {
        const now = new Date();
        console.log(`${now.toISOString()} – Encrypting ...`);
        const activationTime = new Date(Date.now() + 86400 * 1000);
        activationTime.setHours(5, 0, 0); 
        console.log(`Chosen time: ${activationTime.toISOString()}`);
	const round = tlock.roundAt(activationTime.valueOf(), tlock.defaultChainInfo);
	const encrypted = await tlock.timelockEncrypt(round, Buffer.from(text, "utf-8"), client);
	const filePath = path.join(__dirname, 'data', 'encrypted.txt');
	fs.writeFileSync(filePath, encrypted + '\n' + activationTime.toString(), 'utf-8');
}

async function decrypt() {
        const now = new Date();
        console.log(`${now.toISOString()} - Decrypting ...`);
	const filePath = path.join(__dirname, 'data', 'encrypted.txt');
	const fileContent = fs.readFileSync(filePath, 'utf-8').trim();
        const lines = fileContent.split('\n');
        lines.pop();
	const result = await tlock.timelockDecrypt(lines.join('\n').trim(), client);
	return result.toString();
}


async function start() {
    const init = getMode();
    if (init && init.password && init.pin) {
	
        await encrypt(`${init.pin}:${init.password}`);
	init.password = "";
	init.pin = "";
        const passwordPath = path.join(__dirname, 'data', 'password.txt');
        const pinPath = path.join(__dirname, 'data', 'pin.txt');
        fs.unlinkSync(passwordPath);
        fs.unlinkSync(pinPath);
    }

    while (true) {
	const filePath = path.join(__dirname, 'data', 'encrypted.txt');
        if (fs.existsSync(filePath)) {
	    const fileContent = fs.readFileSync(filePath, 'utf-8').trim();
            const activationTime = Date.parse(fileContent.split('\n').pop());
            if (activationTime.valueOf() > Date.now() + 10 * 1000) {
                await sleep(activationTime.valueOf() - Date.now() + 1 * 60 * 1000);
            }
        }
        await encrypt(await decrypt());

    }
}

start();

